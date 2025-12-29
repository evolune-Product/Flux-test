# -*- coding: utf-8 -*-
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import jwt
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
import io
from io import BytesIO
import os
import secrets
import time
from dotenv import load_dotenv
import httpx

# ReportLab for PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

# GitHub API
from github import Github, GithubException

# OAuth imports
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from starlette.middleware.sessions import SessionMiddleware

# SQLAlchemy imports
from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text, Integer, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.exc import IntegrityError
from sqlalchemy.dialects.postgresql import JSONB

# Import classes from your existing v3.py
from v3 import APITester, OpenAITestGenerator, generate_pdf_report

# OpenAI for GraphQL testing
try:
    import openai
except ImportError:
    openai = None

load_dotenv()

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# OpenAI API Key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# ============================================
# OAUTH CONFIGURATION
# ============================================

config = Config(environ=os.environ)

oauth = OAuth(config)

# Google OAuth
oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# GitHub OAuth
oauth.register(
    name='github',
    client_id=os.getenv('GITHUB_CLIENT_ID'),
    client_secret=os.getenv('GITHUB_CLIENT_SECRET'),
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'user:email'},
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ============================================
# DATABASE SETUP (PostgreSQL)
# ============================================

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/evo_tfx")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# User model
class UserDB(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=True)  # Nullable for OAuth users
    oauth_provider = Column(String, nullable=True)  # 'google', 'github', or None
    oauth_id = Column(String, nullable=True)  # ID from OAuth provider
    full_name = Column(String, nullable=True)  # User's full name
    linkedin_url = Column(String, nullable=True)  # LinkedIn profile
    github_url = Column(String, nullable=True)  # GitHub profile
    github_token = Column(String, nullable=True)  # GitHub access token for repo access
    github_username = Column(String, nullable=True)  # GitHub username
    github_repo = Column(String, nullable=True)  # Default GitHub repo name
    created_at = Column(DateTime, default=datetime.utcnow)

# Team model
class TeamDB(Base):
    __tablename__ = "teams"

    team_id = Column(String, primary_key=True)
    team_name = Column(String, nullable=False)
    created_by = Column(String, ForeignKey('users.user_id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# Team member model
class TeamMemberDB(Base):
    __tablename__ = "team_members"

    team_id = Column(String, ForeignKey('teams.team_id'), primary_key=True)
    user_id = Column(String, ForeignKey('users.user_id'), primary_key=True)
    role = Column(String, nullable=False)  # 'owner', 'admin', 'member'
    joined_at = Column(DateTime, default=datetime.utcnow)

# Test suite model
class TestSuiteDB(Base):
    __tablename__ = "test_suites"

    suite_id = Column(String, primary_key=True)
    suite_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    api_url = Column(String, nullable=False)
    sample_data = Column(JSONB, nullable=True)
    auth_config = Column(JSONB, nullable=True)
    test_cases = Column(JSONB, nullable=True)
    created_by = Column(String, ForeignKey('users.user_id'), nullable=False)
    team_id = Column(String, ForeignKey('teams.team_id'), nullable=True)
    is_shared = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# GitHub test result model
class GitHubTestResultDB(Base):
    __tablename__ = "github_test_results"

    result_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.user_id'), nullable=False)
    suite_name = Column(String, nullable=False)
    github_url = Column(String, nullable=False)
    commit_sha = Column(String, nullable=False)
    results_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# OAuth state storage model
class OAuthStateDB(Base):
    __tablename__ = "oauth_states"

    state = Column(String, primary_key=True)
    username = Column(String, nullable=False)
    provider = Column(String, nullable=False)  # 'github_repo', 'google', etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

# Regression baseline model
class RegressionBaselineDB(Base):
    __tablename__ = "regression_baselines"

    baseline_id = Column(String, primary_key=True)
    baseline_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    api_url = Column(String, nullable=False)
    http_method = Column(String, nullable=False, default='GET')
    request_body = Column(JSONB, nullable=True)
    custom_headers = Column(JSONB, nullable=True)
    baseline_response = Column(JSONB, nullable=False)  # Stores baseline response data
    expected_status = Column(Integer, nullable=False, default=200)
    expected_response_time_ms = Column(Integer, nullable=True)  # Max acceptable response time
    created_by = Column(String, ForeignKey('users.user_id'), nullable=False)
    team_id = Column(String, ForeignKey('teams.team_id'), nullable=True)
    is_shared = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Regression test result model
class RegressionTestResultDB(Base):
    __tablename__ = "regression_test_results"

    result_id = Column(String, primary_key=True)
    baseline_id = Column(String, ForeignKey('regression_baselines.baseline_id'), nullable=False)
    user_id = Column(String, ForeignKey('users.user_id'), nullable=False)
    test_response = Column(JSONB, nullable=False)  # Actual response received
    status_code = Column(Integer, nullable=False)
    response_time_ms = Column(Integer, nullable=False)
    passed = Column(Boolean, nullable=False)
    differences = Column(JSONB, nullable=True)  # Stores detected differences
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Contract model (Consumer-Driven Contract)
class ContractDB(Base):
    __tablename__ = "contracts"

    contract_id = Column(String, primary_key=True)
    contract_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    consumer_name = Column(String, nullable=False)  # Name of the consuming service/app
    provider_name = Column(String, nullable=False)  # Name of the providing service/API
    version = Column(String, nullable=False, default='1.0.0')  # Contract version (semver)

    # Request specification
    request_method = Column(String, nullable=False)
    request_path = Column(String, nullable=False)
    request_headers_schema = Column(JSONB, nullable=True)  # Expected headers schema
    request_body_schema = Column(JSONB, nullable=True)  # Expected request body schema
    request_query_schema = Column(JSONB, nullable=True)  # Expected query params schema

    # Response specification
    response_status = Column(Integer, nullable=False)
    response_headers_schema = Column(JSONB, nullable=True)  # Expected response headers schema
    response_body_schema = Column(JSONB, nullable=False)  # Expected response body schema (JSON Schema)

    # Contract metadata
    state = Column(String, nullable=True)  # Provider state for this interaction (e.g., "user exists")
    created_by = Column(String, ForeignKey('users.user_id'), nullable=False)
    team_id = Column(String, ForeignKey('teams.team_id'), nullable=True)
    is_shared = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Provider verification result model
class ProviderVerificationDB(Base):
    __tablename__ = "provider_verifications"

    verification_id = Column(String, primary_key=True)
    contract_id = Column(String, ForeignKey('contracts.contract_id'), nullable=False)
    user_id = Column(String, ForeignKey('users.user_id'), nullable=False)
    provider_url = Column(String, nullable=False)  # Actual provider API URL

    # Verification results
    passed = Column(Boolean, nullable=False)
    request_sent = Column(JSONB, nullable=False)  # Actual request sent to provider
    response_received = Column(JSONB, nullable=False)  # Actual response from provider

    # Validation details
    validation_errors = Column(JSONB, nullable=True)  # Schema validation errors
    status_code_match = Column(Boolean, nullable=False)
    schema_match = Column(Boolean, nullable=False)
    response_time_ms = Column(Integer, nullable=False)

    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Contract compatibility history
class ContractCompatibilityDB(Base):
    __tablename__ = "contract_compatibility"

    compatibility_id = Column(String, primary_key=True)
    old_contract_id = Column(String, ForeignKey('contracts.contract_id'), nullable=False)
    new_contract_id = Column(String, ForeignKey('contracts.contract_id'), nullable=False)

    # Compatibility analysis
    is_backward_compatible = Column(Boolean, nullable=False)
    is_forward_compatible = Column(Boolean, nullable=False)
    breaking_changes = Column(JSONB, nullable=True)  # List of breaking changes

    created_at = Column(DateTime, default=datetime.utcnow)

# AI Analysis History Model
class AIAnalysisHistoryDB(Base):
    __tablename__ = "ai_analysis_history"

    analysis_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.user_id'), nullable=False)

    # Analysis type
    analysis_type = Column(String, nullable=False)  # 'failure', 'batch', 'coverage', 'predictive'
    test_type = Column(String, nullable=True)  # 'functional', 'smoke', 'performance', etc.

    # Input context
    failure_context = Column(JSONB, nullable=True)  # For failure analysis
    test_cases = Column(JSONB, nullable=True)  # For coverage analysis

    # Analysis results
    root_cause = Column(Text, nullable=True)
    severity = Column(String, nullable=True)  # critical, high, medium, low
    category = Column(String, nullable=True)  # authentication, data, network, etc.
    recommendations = Column(JSONB, nullable=True)  # List of actionable recommendations
    technical_details = Column(Text, nullable=True)
    business_impact = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)  # 0.0-1.0

    # Coverage specific fields
    coverage_score = Column(Float, nullable=True)  # 0.0-1.0
    missing_scenarios = Column(JSONB, nullable=True)
    priority_tests = Column(JSONB, nullable=True)

    # Predictive analysis fields
    high_risk_tests = Column(JSONB, nullable=True)
    predictions = Column(JSONB, nullable=True)

    # Metadata
    endpoint = Column(String, nullable=True)
    method = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Test Execution History Model (for predictive analysis)
class TestExecutionHistoryDB(Base):
    __tablename__ = "test_execution_history"

    execution_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.user_id'), nullable=False)
    suite_id = Column(String, ForeignKey('test_suites.suite_id'), nullable=True)

    # Test details
    test_name = Column(String, nullable=False)
    test_type = Column(String, nullable=False)  # functional, smoke, etc.
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)

    # Execution results
    status = Column(String, nullable=False)  # PASS, FAIL
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)

    # Test configuration
    expected_status = Column(Integer, nullable=True)
    request_data = Column(JSONB, nullable=True)
    actual_response = Column(JSONB, nullable=True)

    # Metadata
    executed_at = Column(DateTime, default=datetime.utcnow)
    ai_analysis_id = Column(String, ForeignKey('ai_analysis_history.analysis_id'), nullable=True)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============================================
# FASTAPI APP
# ============================================

app = FastAPI(title="AI API Tester Backend", version="1.0.0")

# IMPORTANT: Add middlewares in reverse order (last added = first executed)
# CORS should be added AFTER SessionMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://evo-tfx.vercel.app",
        "https://fluxtest.evolune.in",
        FRONTEND_URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SessionMiddleware MUST be added last (so it executes first)
app.add_middleware(
    SessionMiddleware, 
    secret_key=SECRET_KEY,
    max_age=3600,  # Session expires after 1 hour
    same_site="lax",
    https_only=False  # Set to True in production with HTTPS
)

# ============================================
# AUTHENTICATION HELPER FUNCTIONS
# ============================================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return username
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

def get_or_create_oauth_user(db: Session, email: str, username: str, provider: str, oauth_id: str):
    """Get or create user from OAuth login"""
    # Check if user exists by email
    user = db.query(UserDB).filter(UserDB.email == email).first()
    
    if user:
        # Update OAuth info if not set
        if not user.oauth_provider:
            user.oauth_provider = provider
            user.oauth_id = oauth_id
            db.commit()
        return user
    
    # Create new user
    user_id = secrets.token_urlsafe(16)
    
    # Make username unique if it already exists
    base_username = username
    counter = 1
    while db.query(UserDB).filter(UserDB.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1
    
    new_user = UserDB(
        user_id=user_id,
        username=username,
        email=email,
        password_hash=None,  # OAuth users don't have password
        oauth_provider=provider,
        oauth_id=oauth_id,
        created_at=datetime.utcnow()
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user

# ============================================
# PYDANTIC MODELS
# ============================================

class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    user_id: str
    username: str
    email: str
    token: str

class GenerateTestsRequest(BaseModel):
    api_url: str
    sample_data: Dict[str, Any]
    num_tests: int = 30
    test_types: List[str] = ["happy_path", "edge_cases", "negative_tests", "security_tests"]
    has_auth: bool = False

class NLTestRequest(BaseModel):
    description: str
    base_url: str

class RunTestsRequest(BaseModel):
    base_url: str
    auth_config: Dict[str, Any]
    timeout: int = 10
    test_cases: List[Dict[str, Any]]

class DownloadReportRequest(BaseModel):
    test_results: Dict[str, Any]
    api_url: str
    auth_enabled: bool = False

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# Team models
class CreateTeamRequest(BaseModel):
    team_name: str

class InviteMemberRequest(BaseModel):
    email: str
    role: str = 'member'

class SaveTestSuiteRequest(BaseModel):
    suite_name: str
    description: Optional[str] = None
    api_url: str
    sample_data: Dict[str, Any]
    auth_config: Dict[str, Any]
    test_cases: List[Dict[str, Any]]
    team_id: Optional[str] = None
    is_shared: bool = False

class UpdateTestSuiteRequest(BaseModel):
    suite_name: Optional[str] = None
    description: Optional[str] = None
    team_id: Optional[str] = None
    is_shared: Optional[bool] = None

class SaveToGitHubRequest(BaseModel):
    suite_name: str
    test_results: Dict[str, Any]
    repo_name: str
    file_path: str = "test-results"
    commit_message: Optional[str] = None

class CreateBaselineRequest(BaseModel):
    baseline_name: str
    description: Optional[str] = None
    api_url: str
    http_method: str = 'GET'
    request_body: Optional[Dict[str, Any]] = None
    custom_headers: Optional[Dict[str, Any]] = None
    expected_status: int = 200
    expected_response_time_ms: Optional[int] = None
    team_id: Optional[str] = None
    is_shared: bool = False

class RunRegressionTestRequest(BaseModel):
    baseline_id: str
    timeout: int = 10

class CreateContractRequest(BaseModel):
    contract_name: str
    description: Optional[str] = None
    consumer_name: str
    provider_name: str
    version: str = '1.0.0'

    # Request specification
    request_method: str
    request_path: str
    request_headers_schema: Optional[Dict[str, Any]] = None
    request_body_schema: Optional[Dict[str, Any]] = None
    request_query_schema: Optional[Dict[str, Any]] = None

    # Response specification
    response_status: int
    response_headers_schema: Optional[Dict[str, Any]] = None
    response_body_schema: Dict[str, Any]  # JSON Schema format

    state: Optional[str] = None
    team_id: Optional[str] = None
    is_shared: bool = False

class VerifyProviderRequest(BaseModel):
    contract_id: str
    provider_url: str
    timeout: int = 10
    custom_headers: Optional[Dict[str, Any]] = None

class CheckCompatibilityRequest(BaseModel):
    old_contract_id: str
    new_contract_id: str

class AIContractGenerationRequest(BaseModel):
    description: str  # Plain English description of the contract
    include_request_schema: bool = True
    include_response_headers: bool = False

# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@app.post("/auth/signup", response_model=UserResponse)
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """User signup endpoint"""
    try:
        existing_user = db.query(UserDB).filter(UserDB.username == request.username).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        existing_email = db.query(UserDB).filter(UserDB.email == request.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = hash_password(request.password)
        user_id = secrets.token_urlsafe(16)
        
        new_user = UserDB(
            user_id=user_id,
            username=request.username,
            email=request.email,
            password_hash=hashed_password,
            oauth_provider=None,
            oauth_id=None,
            created_at=datetime.utcnow()
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        access_token = create_access_token(data={"sub": request.username})
        
        return UserResponse(
            user_id=new_user.user_id,
            username=new_user.username,
            email=new_user.email,
            token=access_token
        )
    
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username or email already exists")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/login", response_model=UserResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """User login endpoint"""
    user = db.query(UserDB).filter(UserDB.username == request.username).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not user.password_hash:
        raise HTTPException(status_code=401, detail="This account uses OAuth login. Please use Google or GitHub.")
    
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    
    return UserResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        token=access_token
    )

# ============================================
# GOOGLE OAUTH ENDPOINTS
# ============================================

@app.get("/auth/google")
async def google_login(request: Request):
    """Initiate Google OAuth login"""
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    redirect_uri = f"{backend_url}/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """Handle Google OAuth callback"""
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')
        
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to get user info from Google")
        
        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0])
        google_id = user_info.get('sub')
        
        # Get or create user
        user = get_or_create_oauth_user(
            db=db,
            email=email,
            username=name.replace(' ', '_').lower(),
            provider='google',
            oauth_id=google_id
        )
        
        # Create access token
        access_token = create_access_token(data={"sub": user.username})
        
        # Redirect to frontend with token
        return RedirectResponse(
            url=f"{FRONTEND_URL}?token={access_token}&user_id={user.user_id}&username={user.username}&email={user.email}"
        )
    
    except Exception as e:
        print(f"Google OAuth error: {str(e)}")
        return RedirectResponse(url=f"{FRONTEND_URL}?error=google_auth_failed")

# ============================================
# GITHUB OAUTH ENDPOINTS
# ============================================

@app.get("/auth/github")
async def github_login(request: Request):
    """Initiate GitHub OAuth login"""
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    redirect_uri = f"{backend_url}/auth/github/callback"
    return await oauth.github.authorize_redirect(request, redirect_uri)

@app.get("/auth/github/callback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    """Handle GitHub OAuth callback"""
    try:
        token = await oauth.github.authorize_access_token(request)
        
        # Get user info from GitHub
        async with httpx.AsyncClient() as client:
            headers = {'Authorization': f'token {token["access_token"]}'}
            
            # Get user profile
            user_response = await client.get('https://api.github.com/user', headers=headers)
            user_info = user_response.json()
            
            # Get user email (if not public, fetch from emails endpoint)
            email = user_info.get('email')
            if not email:
                email_response = await client.get('https://api.github.com/user/emails', headers=headers)
                emails = email_response.json()
                primary_email = next((e for e in emails if e['primary']), None)
                email = primary_email['email'] if primary_email else None
            
            if not email:
                raise HTTPException(status_code=400, detail="Could not get email from GitHub")
        
        username = user_info.get('login', email.split('@')[0])
        github_id = str(user_info.get('id'))
        
        # Get or create user
        user = get_or_create_oauth_user(
            db=db,
            email=email,
            username=username,
            provider='github',
            oauth_id=github_id
        )
        
        # Create access token
        access_token = create_access_token(data={"sub": user.username})
        
        # Redirect to frontend with token
        return RedirectResponse(
            url=f"{FRONTEND_URL}?token={access_token}&user_id={user.user_id}&username={user.username}&email={user.email}"
        )
    
    except Exception as e:
        print(f"GitHub OAuth error: {str(e)}")
        return RedirectResponse(url=f"{FRONTEND_URL}?error=github_auth_failed")

# ============================================
# OTHER AUTH ENDPOINTS
# ============================================

@app.get("/auth/me")
async def get_current_user(username: str = Depends(verify_token), db: Session = Depends(get_db)):
    """Get current user info"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "linkedin_url": user.linkedin_url,
        "github_url": user.github_url,
        "oauth_provider": user.oauth_provider,
        "created_at": user.created_at.isoformat()
    }

@app.put("/auth/profile")
async def update_profile(
    request: UpdateProfileRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Update user profile"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if request.full_name is not None:
        user.full_name = request.full_name
    if request.linkedin_url is not None:
        user.linkedin_url = request.linkedin_url
    if request.github_url is not None:
        user.github_url = request.github_url
    
    db.commit()
    db.refresh(user)
    
    return {
        "message": "Profile updated successfully",
        "user": {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "linkedin_url": user.linkedin_url,
            "github_url": user.github_url
        }
    }

@app.post("/auth/change-password")
async def change_password(
    request: ChangePasswordRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Change user password"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has password (not OAuth user)
    if not user.password_hash:
        raise HTTPException(
            status_code=400, 
            detail="Cannot change password for OAuth accounts. Please use your OAuth provider."
        )
    
    # Verify current password
    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Update password
    user.password_hash = hash_password(request.new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}

@app.post("/auth/logout")
async def logout():
    """Logout endpoint"""
    return {"message": "Logged out successfully"}

# ============================================
# API TESTING ENDPOINTS (keep your existing ones)
# ============================================

@app.get("/")
async def root():
    return {
        "message": "AI API Tester Backend",
        "version": "1.0.0",
        "database": "PostgreSQL",
        "oauth": "Google & GitHub enabled"
    }

@app.post("/generate-tests")
async def generate_tests(request: GenerateTestsRequest):
    """Generate AI-powered test cases"""
    try:
        openai_api_key = os.getenv('OPENAI_API_KEY')

        if not openai_api_key:
            print("\n" + "="*80)
            print("🔴 TEST GENERATION SOURCE: PURE FALLBACK (No API Key)")
            print("="*80 + "\n")
            generator = OpenAITestGenerator("dummy_key")
            test_cases = generator._generate_fallback_tests(
                api_url=request.api_url,
                sample_data=request.sample_data,
                num=request.num_tests,
                has_auth=request.has_auth
            )
            print(f"✅ Generated {len(test_cases)} test cases using FALLBACK templates\n")

            return {
                "success": True,
                "test_cases": test_cases,
                "used_fallback": True,
                "count": len(test_cases),
                "message": f"Generated {len(test_cases)} test cases using fallback"
            }
        
        try:
            # Debug: Print API key status (first/last 4 chars only for security)
            if len(openai_api_key) > 8:
                print(f"\n🔑 OpenAI API Key detected: {openai_api_key[:7]}...{openai_api_key[-4:]}")
            else:
                print(f"\n⚠️  OpenAI API Key seems too short: {len(openai_api_key)} characters")

            generator = OpenAITestGenerator(openai_api_key)

            test_cases, used_fallback = generator.generate_test_cases(
                api_url=request.api_url,
                sample_data=request.sample_data,
                num_tests=request.num_tests,
                test_types=request.test_types,
                has_auth=request.has_auth,
                status_container=None
            )

            # Print generation source to terminal
            if not used_fallback:
                print("\n" + "="*80)
                print("🟢 TEST GENERATION SOURCE: PURE AI (OpenAI GPT-4o)")
                print("="*80)
                print(f"✅ Generated {len(test_cases)} EXPERT-LEVEL test cases")
                print("   Quality: Senior QA Architect with 30+ years experience")
                print("   Model: GPT-4o (OpenAI's most advanced model)")
                print("="*80 + "\n")
            else:
                print("\n" + "="*80)
                print("🔴 TEST GENERATION SOURCE: PURE FALLBACK")
                print("="*80)
                print(f"⚠️  AI generation failed - using template-based fallback")
                print(f"✅ Generated {len(test_cases)} test cases from fallback templates")
                print("="*80 + "\n")

            return {
                "success": True,
                "test_cases": test_cases,
                "used_fallback": used_fallback,
                "count": len(test_cases),
                "message": f"Generated {len(test_cases)} test cases" +
                          (" using fallback" if used_fallback else " using AI")
            }
        
        except Exception as ai_error:
            print("\n" + "="*80)
            print("🔴 TEST GENERATION SOURCE: PURE FALLBACK (OpenAI Error)")
            print("="*80)
            print(f"⚠️  OpenAI API Error: {str(ai_error)}")
            print("🔄 Switching to fallback template generation...")
            print("="*80 + "\n")

            generator = OpenAITestGenerator(openai_api_key)
            test_cases = generator._generate_fallback_tests(
                api_url=request.api_url,
                sample_data=request.sample_data,
                num=request.num_tests,
                has_auth=request.has_auth
            )
            print(f"✅ Generated {len(test_cases)} test cases using FALLBACK templates\n")

            return {
                "success": True,
                "test_cases": test_cases,
                "used_fallback": True,
                "count": len(test_cases),
                "message": f"Generated {len(test_cases)} test cases using fallback"
            }
    
    except Exception as e:
        print(f"❌ Error in generate_tests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-test-from-nl")
async def generate_test_from_nl(request: NLTestRequest):
    """Generate a single test case from natural language description"""
    try:
        openai_api_key = os.getenv('OPENAI_API_KEY')

        if not openai_api_key:
            # Fallback: Basic pattern matching
            description_lower = request.description.lower()

            # Extract method
            method = 'GET'
            if 'post' in description_lower or 'create' in description_lower:
                method = 'POST'
            elif 'put' in description_lower or 'update' in description_lower:
                method = 'PUT'
            elif 'delete' in description_lower or 'remove' in description_lower:
                method = 'DELETE'

            # Extract expected status
            expected_status = 200
            if '401' in description_lower or 'unauthorized' in description_lower:
                expected_status = 401
            elif '403' in description_lower or 'forbidden' in description_lower:
                expected_status = 403
            elif '404' in description_lower or 'not found' in description_lower:
                expected_status = 404
            elif '400' in description_lower or 'bad request' in description_lower or 'invalid' in description_lower:
                expected_status = 400
            elif 'fail' in description_lower or 'error' in description_lower:
                expected_status = 400

            # Extract endpoint hints
            endpoint = ''
            if 'login' in description_lower:
                endpoint = '/api/login'
            elif 'user' in description_lower:
                endpoint = '/api/users'
            elif 'post' in description_lower and 'create' not in description_lower:
                endpoint = '/api/posts'

            return {
                "method": method,
                "endpoint": endpoint,
                "description": request.description,
                "expected_status": expected_status,
                "data": None,
                "params": None
            }

        # Use OpenAI for better generation
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_api_key)

            prompt = f"""Convert this natural language test description into a structured API test case.

Description: "{request.description}"
Base URL: {request.base_url}

Return ONLY a JSON object with these fields:
- method: HTTP method (GET, POST, PUT, DELETE, PATCH)
- endpoint: relative path (e.g., "/api/users" or "/api/login")
- description: clear description of what the test does
- expected_status: HTTP status code (200, 401, 404, etc.)
- data: request body as JSON object (null if not needed)
- params: query parameters as JSON object (null if not needed)

Example output:
{{
  "method": "POST",
  "endpoint": "/api/login",
  "description": "Test user login with invalid password",
  "expected_status": 401,
  "data": {{"email": "test@example.com", "password": "wrongpassword"}},
  "params": null
}}

Return ONLY the JSON, no explanation."""

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an expert API testing assistant. Convert natural language descriptions into structured test cases."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )

            result_text = response.choices[0].message.content.strip()

            # Clean JSON
            import re
            result_text = re.sub(r'```(?:json)?\s*', '', result_text)
            result_text = re.sub(r'```\s*', '', result_text)
            result_text = result_text.strip()

            test_case = json.loads(result_text)

            # Ensure all required fields
            test_case.setdefault('method', 'GET')
            test_case.setdefault('endpoint', '')
            test_case.setdefault('description', request.description)
            test_case.setdefault('expected_status', 200)
            test_case.setdefault('data', None)
            test_case.setdefault('params', None)

            return test_case

        except Exception as ai_error:
            print(f"⚠️  OpenAI Error: {str(ai_error)}, using fallback")
            # Use the fallback logic above
            description_lower = request.description.lower()
            method = 'POST' if any(word in description_lower for word in ['post', 'create']) else 'GET'
            expected_status = 401 if '401' in description_lower or 'unauthorized' in description_lower else 200

            return {
                "method": method,
                "endpoint": '',
                "description": request.description,
                "expected_status": expected_status,
                "data": None,
                "params": None
            }

    except Exception as e:
        print(f"❌ Error in generate_test_from_nl: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/run-tests")
async def run_tests(request: RunTestsRequest):
    """Run test cases against the API with AI-powered root cause analysis"""
    try:
        # Initialize APITester with AI analysis enabled (Hybrid Option 3)
        tester = APITester(
            base_url=request.base_url,
            auth_config=request.auth_config,
            timeout=request.timeout,
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            enable_ai_analysis=True  # Auto-analyze critical failures
        )
        
        for idx, test_case in enumerate(request.test_cases, 1):
            tester.test_request(
                method=test_case.get('method', 'GET'),
                endpoint=test_case.get('endpoint', ''),
                data=test_case.get('data'),
                expected_status=test_case.get('expected_status', 200),
                test_name=f"Test {idx}: {test_case.get('description', 'N/A')}",
                params=test_case.get('params'),
                expected_body=test_case.get('expected_body'),
                expected_schema=test_case.get('expected_schema'),
                validate_body=test_case.get('validate_body', False)
            )
        
        summary = tester.get_summary()
        
        return {
            "success": True,
            "summary": summary,
            "results": tester.results,
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/download-report/json")
async def download_json_report(request: DownloadReportRequest):
    """Generate and download JSON report"""
    try:
        tester = APITester(request.api_url)
        tester.results = request.test_results.get('results', [])
        
        json_report = {
            'api_url': request.api_url,
            'timestamp': datetime.now().isoformat(),
            'authentication': {
                'enabled': request.auth_enabled,
            },
            'summary': request.test_results.get('summary', {}),
            'results': tester.results
        }
        
        json_str = json.dumps(json_report, indent=2)
        
        return StreamingResponse(
            io.BytesIO(json_str.encode()),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=api_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/download-report/pdf")
async def download_pdf_report(request: DownloadReportRequest):
    """Generate and download PDF report"""
    try:
        tester = APITester(request.api_url)
        tester.results = request.test_results.get('results', [])
        
        pdf_buffer = generate_pdf_report(
            tester=tester,
            api_url=request.api_url,
            auth_enabled=request.auth_enabled
        )
        
        if not pdf_buffer:
            raise HTTPException(status_code=500, detail="Failed to generate PDF")
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=api_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# AI ROOT CAUSE ANALYSIS ENDPOINTS
# ============================================

@app.post("/analyze-failure")
async def analyze_test_failure(
    failure_data: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    On-demand AI analysis of a test failure.
    Part of Hybrid Option 3: Users can manually request analysis for non-critical failures.

    Request body should contain failure context:
    {
        "test_name": "Login test",
        "test_type": "functional",
        "endpoint": "/api/login",
        "method": "POST",
        "expected_status": 200,
        "actual_status": 500,
        "error_message": "Internal server error",
        "request_data": {...},
        "actual_response": {...},
        ...
    }
    """
    try:
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise HTTPException(
                status_code=503,
                detail="AI analysis unavailable - OpenAI API key not configured"
            )

        # Get user
        user = db.query(UserDB).filter(UserDB.username == current_user['username']).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Import AIRootCauseAnalyzer from v3
        from v3 import AIRootCauseAnalyzer

        analyzer = AIRootCauseAnalyzer(openai_key)

        # Perform analysis
        analysis = analyzer.analyze_failure(failure_data)

        # Save analysis to database
        analysis_id = secrets.token_urlsafe(16)
        ai_analysis = AIAnalysisHistoryDB(
            analysis_id=analysis_id,
            user_id=user.user_id,
            analysis_type='failure',
            test_type=failure_data.get('test_type'),
            failure_context=failure_data,
            root_cause=analysis.get('root_cause'),
            severity=analysis.get('severity'),
            category=analysis.get('category'),
            recommendations=analysis.get('recommendations'),
            technical_details=analysis.get('technical_details'),
            business_impact=analysis.get('business_impact'),
            confidence_score=analysis.get('confidence_score'),
            endpoint=failure_data.get('endpoint'),
            method=failure_data.get('method'),
            created_at=datetime.utcnow()
        )
        db.add(ai_analysis)
        db.commit()

        # Add analysis_id to response
        analysis['analysis_id'] = analysis_id

        return {
            'success': True,
            'analysis': analysis,
            'timestamp': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ AI analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze-batch-failures")
async def analyze_multiple_failures(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyzes multiple test failures together to identify patterns and correlations.
    Critical for smoke testing where multiple endpoints fail due to a common cause.

    Request body:
    {
        "failures": [
            {failure_context_1},
            {failure_context_2},
            ...
        ]
    }
    """
    try:
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise HTTPException(
                status_code=503,
                detail="AI analysis unavailable - OpenAI API key not configured"
            )

        failures = request.get('failures', [])
        if not failures:
            raise HTTPException(status_code=400, detail="No failures provided")

        # Import AIRootCauseAnalyzer from v3
        from v3 import AIRootCauseAnalyzer

        analyzer = AIRootCauseAnalyzer(openai_key)

        # Perform batch analysis
        pattern_analysis = analyzer.analyze_batch_failures(failures)

        return {
            'success': True,
            'pattern_analysis': pattern_analysis,
            'failure_count': len(failures),
            'timestamp': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Batch analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch analysis failed: {str(e)}")


@app.post("/ai/analyze-coverage")
async def analyze_test_coverage(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    AI-powered test coverage analysis.
    Identifies gaps in testing strategy and recommends additional test cases.

    Request body:
    {
        "endpoints": [
            {"method": "GET", "path": "/api/users"},
            {"method": "POST", "path": "/api/users"}
        ],
        "test_cases": [...],
        "api_spec": {} // optional
    }
    """
    try:
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise HTTPException(
                status_code=503,
                detail="AI coverage analysis unavailable - OpenAI API key not configured"
            )

        from v3 import AIRootCauseAnalyzer

        analyzer = AIRootCauseAnalyzer(openai_key)

        # Perform coverage analysis
        coverage_analysis = analyzer.analyze_test_coverage(request)

        return {
            'success': True,
            'coverage_analysis': coverage_analysis,
            'timestamp': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Coverage analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Coverage analysis failed: {str(e)}")


@app.post("/ai/predict-failures")
async def predict_test_failures(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Predictive test maintenance - predicts which tests are likely to fail.

    Request body:
    {
        "test_history": [
            {"test_name": "...", "status": "PASS/FAIL", "timestamp": "..."},
            ...
        ],
        "upcoming_changes": {
            "description": "API schema change",
            "affected_endpoints": ["/api/users"]
        } // optional
    }
    """
    try:
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            raise HTTPException(
                status_code=503,
                detail="AI predictive analysis unavailable - OpenAI API key not configured"
            )

        test_history = request.get('test_history', [])
        if not test_history:
            raise HTTPException(status_code=400, detail="test_history is required")

        from v3 import AIRootCauseAnalyzer

        analyzer = AIRootCauseAnalyzer(openai_key)

        # Perform predictive analysis
        predictions = analyzer.predict_failure_risk(
            test_history=test_history,
            upcoming_changes=request.get('upcoming_changes')
        )

        return {
            'success': True,
            'predictions': predictions,
            'timestamp': datetime.now().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Predictive analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Predictive analysis failed: {str(e)}")


@app.get("/ai/analysis-history")
async def get_analysis_history(
    test_type: str = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve AI analysis history for the current user.
    Useful for identifying patterns and learning from past failures.

    Query params:
    - test_type: Filter by test type (functional, smoke, etc.) - optional
    - limit: Number of records to return (default 20, max 100)
    """
    try:
        user = db.query(UserDB).filter(UserDB.username == current_user['username']).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Build query
        query = db.query(AIAnalysisHistoryDB).filter(
            AIAnalysisHistoryDB.user_id == user.user_id
        )

        # Filter by test type if provided
        if test_type:
            query = query.filter(AIAnalysisHistoryDB.test_type == test_type)

        # Limit results
        limit = min(limit, 100)  # Max 100
        history = query.order_by(AIAnalysisHistoryDB.created_at.desc()).limit(limit).all()

        # Format results
        results = []
        for record in history:
            results.append({
                'analysis_id': record.analysis_id,
                'analysis_type': record.analysis_type,
                'test_type': record.test_type,
                'endpoint': record.endpoint,
                'method': record.method,
                'severity': record.severity,
                'category': record.category,
                'root_cause': record.root_cause,
                'recommendations': record.recommendations,
                'confidence_score': record.confidence_score,
                'coverage_score': record.coverage_score,
                'created_at': record.created_at.isoformat()
            })

        return {
            'success': True,
            'count': len(results),
            'history': results
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to retrieve analysis history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/test-execution/save")
async def save_test_execution(
    execution_data: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save test execution results for predictive analysis.

    Request body:
    {
        "test_name": "...",
        "test_type": "functional",
        "endpoint": "/api/users",
        "method": "GET",
        "status": "PASS/FAIL",
        "status_code": 200,
        "response_time_ms": 150,
        "error_message": null,
        "expected_status": 200,
        "request_data": {...},
        "actual_response": {...},
        "suite_id": "..." // optional
    }
    """
    try:
        user = db.query(UserDB).filter(UserDB.username == current_user['username']).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        execution_id = secrets.token_urlsafe(16)

        execution = TestExecutionHistoryDB(
            execution_id=execution_id,
            user_id=user.user_id,
            suite_id=execution_data.get('suite_id'),
            test_name=execution_data.get('test_name'),
            test_type=execution_data.get('test_type'),
            endpoint=execution_data.get('endpoint'),
            method=execution_data.get('method'),
            status=execution_data.get('status'),
            status_code=execution_data.get('status_code'),
            response_time_ms=execution_data.get('response_time_ms'),
            error_message=execution_data.get('error_message'),
            expected_status=execution_data.get('expected_status'),
            request_data=execution_data.get('request_data'),
            actual_response=execution_data.get('actual_response'),
            executed_at=datetime.utcnow()
        )

        db.add(execution)
        db.commit()

        return {
            'success': True,
            'execution_id': execution_id,
            'message': 'Test execution saved successfully'
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to save test execution: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/test-execution/history")
async def get_test_execution_history(
    test_name: str = None,
    suite_id: str = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve test execution history for predictive analysis.

    Query params:
    - test_name: Filter by test name - optional
    - suite_id: Filter by test suite - optional
    - limit: Number of records (default 50, max 200)
    """
    try:
        user = db.query(UserDB).filter(UserDB.username == current_user['username']).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        query = db.query(TestExecutionHistoryDB).filter(
            TestExecutionHistoryDB.user_id == user.user_id
        )

        if test_name:
            query = query.filter(TestExecutionHistoryDB.test_name == test_name)
        if suite_id:
            query = query.filter(TestExecutionHistoryDB.suite_id == suite_id)

        limit = min(limit, 200)
        history = query.order_by(TestExecutionHistoryDB.executed_at.desc()).limit(limit).all()

        results = []
        for record in history:
            results.append({
                'execution_id': record.execution_id,
                'test_name': record.test_name,
                'test_type': record.test_type,
                'endpoint': record.endpoint,
                'method': record.method,
                'status': record.status,
                'status_code': record.status_code,
                'response_time_ms': record.response_time_ms,
                'error_message': record.error_message,
                'executed_at': record.executed_at.isoformat()
            })

        return {
            'success': True,
            'count': len(results),
            'history': results
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Failed to retrieve execution history: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint"""
    openai_key_exists = bool(os.getenv('OPENAI_API_KEY'))
    google_oauth_configured = bool(os.getenv('GOOGLE_CLIENT_ID'))
    github_oauth_configured = bool(os.getenv('GITHUB_CLIENT_ID'))

    try:
        db.execute("SELECT 1")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "database": db_status,
        "openai_api_configured": openai_key_exists,
        "google_oauth_configured": google_oauth_configured,
        "github_oauth_configured": github_oauth_configured,
        "timestamp": datetime.now().isoformat()
    }

# ============================================
# TEAM MANAGEMENT ENDPOINTS
# ============================================

@app.post("/teams/create")
async def create_team(
    request: CreateTeamRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Create a new team"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    team_id = secrets.token_urlsafe(16)
    
    new_team = TeamDB(
        team_id=team_id,
        team_name=request.team_name,
        created_by=user.user_id,
        created_at=datetime.utcnow()
    )
    
    # Add creator as owner
    team_member = TeamMemberDB(
        team_id=team_id,
        user_id=user.user_id,
        role='owner',
        joined_at=datetime.utcnow()
    )
    
    db.add(new_team)
    db.add(team_member)
    db.commit()
    
    return {
        "message": "Team created successfully",
        "team_id": team_id,
        "team_name": request.team_name
    }

@app.get("/teams/my-teams")
async def get_my_teams(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all teams user is part of"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get teams where user is a member
    team_memberships = db.query(TeamMemberDB, TeamDB).join(
        TeamDB, TeamMemberDB.team_id == TeamDB.team_id
    ).filter(TeamMemberDB.user_id == user.user_id).all()
    
    teams = []
    for membership, team in team_memberships:
        # Get member count
        member_count = db.query(TeamMemberDB).filter(TeamMemberDB.team_id == team.team_id).count()
        
        teams.append({
            "team_id": team.team_id,
            "team_name": team.team_name,
            "role": membership.role,
            "member_count": member_count,
            "created_at": team.created_at.isoformat()
        })
    
    return {"teams": teams}

@app.get("/teams/{team_id}/members")
async def get_team_members(
    team_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all members of a team"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is member of team
    membership = db.query(TeamMemberDB).filter(
        TeamMemberDB.team_id == team_id,
        TeamMemberDB.user_id == user.user_id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    
    # Get all members
    members = db.query(TeamMemberDB, UserDB).join(
        UserDB, TeamMemberDB.user_id == UserDB.user_id
    ).filter(TeamMemberDB.team_id == team_id).all()
    
    member_list = []
    for member, user_info in members:
        member_list.append({
            "user_id": user_info.user_id,
            "username": user_info.username,
            "email": user_info.email,
            "full_name": user_info.full_name,
            "role": member.role,
            "joined_at": member.joined_at.isoformat()
        })
    
    return {"members": member_list}

@app.post("/teams/{team_id}/invite")
async def invite_member(
    team_id: str,
    request: InviteMemberRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Invite a member to team"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is admin or owner
    membership = db.query(TeamMemberDB).filter(
        TeamMemberDB.team_id == team_id,
        TeamMemberDB.user_id == user.user_id
    ).first()
    
    if not membership or membership.role not in ['owner', 'admin']:
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")
    
    # Find user to invite
    invite_user = db.query(UserDB).filter(UserDB.email == request.email).first()
    if not invite_user:
        raise HTTPException(status_code=404, detail="User with this email not found")
    
    # Check if already member
    existing = db.query(TeamMemberDB).filter(
        TeamMemberDB.team_id == team_id,
        TeamMemberDB.user_id == invite_user.user_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")
    
    # Add member
    new_member = TeamMemberDB(
        team_id=team_id,
        user_id=invite_user.user_id,
        role=request.role,
        joined_at=datetime.utcnow()
    )
    
    db.add(new_member)
    db.commit()
    
    return {"message": f"Successfully added {invite_user.username} to team"}

@app.delete("/teams/{team_id}/members/{member_user_id}")
async def remove_member(
    team_id: str,
    member_user_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Remove a member from team"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is admin or owner
    membership = db.query(TeamMemberDB).filter(
        TeamMemberDB.team_id == team_id,
        TeamMemberDB.user_id == user.user_id
    ).first()
    
    if not membership or membership.role not in ['owner', 'admin']:
        raise HTTPException(status_code=403, detail="Only owners and admins can remove members")
    
    # Remove member
    member_to_remove = db.query(TeamMemberDB).filter(
        TeamMemberDB.team_id == team_id,
        TeamMemberDB.user_id == member_user_id
    ).first()
    
    if not member_to_remove:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Don't allow removing owner
    if member_to_remove.role == 'owner':
        raise HTTPException(status_code=400, detail="Cannot remove team owner")
    
    db.delete(member_to_remove)
    db.commit()
    
    return {"message": "Member removed successfully"}

# ============================================
# TEST SUITE MANAGEMENT ENDPOINTS
# ============================================

@app.post("/test-suites/save")
async def save_test_suite(
    request: SaveTestSuiteRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Save a test suite"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If sharing with team, verify membership
    if request.team_id:
        membership = db.query(TeamMemberDB).filter(
            TeamMemberDB.team_id == request.team_id,
            TeamMemberDB.user_id == user.user_id
        ).first()
        
        if not membership:
            raise HTTPException(status_code=403, detail="You are not a member of this team")
    
    suite_id = secrets.token_urlsafe(16)
    
    new_suite = TestSuiteDB(
        suite_id=suite_id,
        suite_name=request.suite_name,
        description=request.description,
        api_url=request.api_url,
        sample_data=request.sample_data,
        auth_config=request.auth_config,
        test_cases=request.test_cases,
        created_by=user.user_id,
        team_id=request.team_id,
        is_shared=request.is_shared,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_suite)
    db.commit()
    
    return {
        "message": "Test suite saved successfully",
        "suite_id": suite_id,
        "suite_name": request.suite_name
    }

@app.get("/test-suites/my-suites")
async def get_my_suites(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all test suites accessible to user"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's teams
    user_teams = db.query(TeamMemberDB.team_id).filter(
        TeamMemberDB.user_id == user.user_id
    ).all()
    team_ids = [t[0] for t in user_teams]
    
    # Get suites created by user or shared with their teams
    suites = db.query(TestSuiteDB).filter(
        (TestSuiteDB.created_by == user.user_id) |
        (TestSuiteDB.team_id.in_(team_ids) if team_ids else False)
    ).all()
    
    suite_list = []
    for suite in suites:
        # Get creator info
        creator = db.query(UserDB).filter(UserDB.user_id == suite.created_by).first()
        
        # Get team info if shared
        team_name = None
        if suite.team_id:
            team = db.query(TeamDB).filter(TeamDB.team_id == suite.team_id).first()
            team_name = team.team_name if team else None
        
        suite_list.append({
            "suite_id": suite.suite_id,
            "suite_name": suite.suite_name,
            "description": suite.description,
            "api_url": suite.api_url,
            "test_count": len(suite.test_cases) if suite.test_cases else 0,
            "created_by": creator.username if creator else "Unknown",
            "is_owner": suite.created_by == user.user_id,
            "team_name": team_name,
            "is_shared": suite.is_shared,
            "created_at": suite.created_at.isoformat(),
            "updated_at": suite.updated_at.isoformat()
        })
    
    return {"suites": suite_list}

@app.get("/test-suites/{suite_id}")
async def get_test_suite(
    suite_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get a specific test suite"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    suite = db.query(TestSuiteDB).filter(TestSuiteDB.suite_id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")
    
    # Check access
    has_access = False
    if suite.created_by == user.user_id:
        has_access = True
    elif suite.team_id:
        membership = db.query(TeamMemberDB).filter(
            TeamMemberDB.team_id == suite.team_id,
            TeamMemberDB.user_id == user.user_id
        ).first()
        if membership:
            has_access = True
    
    if not has_access:
        raise HTTPException(status_code=403, detail="You don't have access to this test suite")
    
    return {
        "suite_id": suite.suite_id,
        "suite_name": suite.suite_name,
        "description": suite.description,
        "api_url": suite.api_url,
        "sample_data": suite.sample_data,
        "auth_config": suite.auth_config,
        "test_cases": suite.test_cases,
        "created_by": suite.created_by,
        "team_id": suite.team_id,
        "is_shared": suite.is_shared,
        "created_at": suite.created_at.isoformat(),
        "updated_at": suite.updated_at.isoformat()
    }

@app.delete("/test-suites/{suite_id}")
async def delete_test_suite(
    suite_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Delete a test suite"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    suite = db.query(TestSuiteDB).filter(TestSuiteDB.suite_id == suite_id).first()
    if not suite:
        raise HTTPException(status_code=404, detail="Test suite not found")
    
    # Only creator can delete
    if suite.created_by != user.user_id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this test suite")
    
    db.delete(suite)
    db.commit()
    
    return {"message": "Test suite deleted successfully"}

# ============================================
# GITHUB INTEGRATION ENDPOINTS
# ============================================

@app.get("/github/connect")
async def connect_github_repo(request: Request, username: str = Depends(verify_token), db: Session = Depends(get_db)):
    """Initiate GitHub OAuth for repository access - returns OAuth URL"""
    try:
        # Store state and user context to retrieve later
        state = secrets.token_urlsafe(32)

        # Build the full callback URL
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
        callback_url = f"{backend_url}/github/callback"

        # Use separate GitHub OAuth app for repo access with 'repo' scope
        github_client_id = os.getenv('GITHUB_REPO_CLIENT_ID')
        github_client_secret = os.getenv('GITHUB_REPO_CLIENT_SECRET')

        if not github_client_id or not github_client_secret:
            print("ERROR: GitHub OAuth credentials not configured")
            raise HTTPException(
                status_code=500,
                detail="GitHub Repository OAuth not configured. Please set GITHUB_REPO_CLIENT_ID and GITHUB_REPO_CLIENT_SECRET in .env"
            )

        github_auth_url = (
            f"https://github.com/login/oauth/authorize?"
            f"client_id={github_client_id}&"
            f"redirect_uri={callback_url}&"
            f"scope=repo&"
            f"state={state}"
        )

        # Store state in database instead of session (more reliable for OAuth)
        # Clean up expired states first
        db.query(OAuthStateDB).filter(OAuthStateDB.expires_at < datetime.utcnow()).delete()

        # Create new OAuth state entry
        oauth_state = OAuthStateDB(
            state=state,
            username=username,
            provider='github_repo',
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(minutes=10)  # 10 minute expiry
        )

        db.add(oauth_state)
        db.commit()

        print(f"GitHub OAuth initiated for user: {username}")
        print(f"OAuth URL: {github_auth_url}")

        # Return the URL as JSON instead of redirecting
        return JSONResponse({
            "auth_url": github_auth_url,
            "message": "Please redirect to this URL to authorize GitHub"
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in /github/connect: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initiate GitHub connection: {str(e)}"
        )

@app.get("/github/callback")
async def github_repo_callback(
    request: Request,
    code: str,
    state: str,
    db: Session = Depends(get_db)
):
    """Handle GitHub OAuth callback for repository access"""
    try:
        # Verify state from database
        oauth_state = db.query(OAuthStateDB).filter(
            OAuthStateDB.state == state,
            OAuthStateDB.provider == 'github_repo'
        ).first()

        if not oauth_state:
            print(f"GitHub repo OAuth error: 400: Invalid state parameter")
            raise HTTPException(status_code=400, detail="Invalid state parameter")

        # Check if state has expired
        if oauth_state.expires_at < datetime.utcnow():
            db.delete(oauth_state)
            db.commit()
            print(f"GitHub repo OAuth error: 400: State has expired")
            raise HTTPException(status_code=400, detail="OAuth state has expired")

        stored_username = oauth_state.username

        if not stored_username:
            raise HTTPException(status_code=400, detail="User session not found")

        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                'https://github.com/login/oauth/access_token',
                data={
                    'client_id': os.getenv('GITHUB_REPO_CLIENT_ID'),
                    'client_secret': os.getenv('GITHUB_REPO_CLIENT_SECRET'),
                    'code': code,
                },
                headers={'Accept': 'application/json'}
            )

            token_data = token_response.json()
            access_token = token_data.get('access_token')

            if not access_token:
                raise HTTPException(status_code=400, detail="Failed to get access token")

            # Get GitHub username
            user_response = await client.get(
                'https://api.github.com/user',
                headers={'Authorization': f'token {access_token}'}
            )
            github_data = user_response.json()
            github_username = github_data.get('login')

        # Store token in database using username from OAuth state
        user = db.query(UserDB).filter(UserDB.username == stored_username).first()
        if user:
            user.github_token = access_token
            user.github_username = github_username
            db.commit()

        # Clean up OAuth state from database
        db.delete(oauth_state)
        db.commit()

        return RedirectResponse(url=f"{FRONTEND_URL}?github_connected=true")

    except Exception as e:
        print(f"GitHub repo OAuth error: {str(e)}")
        return RedirectResponse(url=f"{FRONTEND_URL}?github_connected=false&error={str(e)}")

@app.post("/github/save-results")
async def save_results_to_github(
    request: SaveToGitHubRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Save test results to GitHub repository"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.github_token:
        raise HTTPException(
            status_code=400, 
            detail="GitHub not connected. Please connect your GitHub account first."
        )
    
    try:
        # Initialize GitHub client
        g = Github(user.github_token)
        github_user = g.get_user()
        
        # Get or create repository
        try:
            repo = github_user.get_repo(request.repo_name)
        except GithubException:
            # Create repo if it doesn't exist
            repo = github_user.create_repo(
                request.repo_name,
                description="API Test Results - Generated by API TestLab",
                private=True,
                auto_init=True
            )
        
        # Create file path with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_path = f"{request.file_path}/{request.suite_name}_{timestamp}.json"
        
        # Prepare JSON content
        json_content = json.dumps(request.test_results, indent=2)
        
        # Commit message
        commit_msg = request.commit_message or f"Add test results for {request.suite_name} - {timestamp}"
        
        # Check if file exists (update) or create new
        try:
            contents = repo.get_contents(file_path)
            repo.update_file(
                path=file_path,
                message=commit_msg,
                content=json_content,
                sha=contents.sha
            )
        except GithubException:
            # File doesn't exist, create it
            repo.create_file(
                path=file_path,
                message=commit_msg,
                content=json_content
            )
        
        # Get the file URL
        file_url = f"https://github.com/{github_user.login}/{request.repo_name}/blob/main/{file_path}"
        
        # Store record in database
        result_id = secrets.token_urlsafe(16)
        github_result = GitHubTestResultDB(
            result_id=result_id,
            user_id=user.user_id,
            suite_name=request.suite_name,
            github_url=file_url,
            commit_sha=repo.get_branch("main").commit.sha,
            results_data=request.test_results,
            created_at=datetime.utcnow()
        )
        
        db.add(github_result)
        db.commit()
        
        return {
            "success": True,
            "message": "Test results saved to GitHub successfully",
            "github_url": file_url,
            "repo_name": request.repo_name,
            "file_path": file_path
        }
    
    except GithubException as e:
        raise HTTPException(status_code=400, detail=f"GitHub error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving to GitHub: {str(e)}")

@app.get("/github/status")
async def get_github_status(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Check if user has connected GitHub"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_connected = bool(user.github_token)
    
    return {
        "connected": is_connected,
        "github_username": user.github_username if is_connected else None,
        "default_repo": user.github_repo
    }

@app.delete("/github/disconnect")
async def disconnect_github(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Disconnect GitHub integration"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.github_token = None
    user.github_username = None
    user.github_repo = None
    db.commit()
    
    return {"message": "GitHub disconnected successfully"}

@app.get("/github/my-results")
async def get_my_github_results(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all GitHub saved results for user"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    results = db.query(GitHubTestResultDB).filter(
        GitHubTestResultDB.user_id == user.user_id
    ).order_by(GitHubTestResultDB.created_at.desc()).all()
    
    result_list = []
    for result in results:
        result_list.append({
            "result_id": result.result_id,
            "suite_name": result.suite_name,
            "github_url": result.github_url,
            "commit_sha": result.commit_sha,
            "created_at": result.created_at.isoformat()
        })
    
    return {"results": result_list}

# ============================================
# REGRESSION TESTING ENDPOINTS
# ============================================

@app.post("/regression/create-baseline")
async def create_baseline(
    request: CreateBaselineRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Create a new regression baseline by capturing current API response"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        # Make the API call to capture baseline response
        headers = request.custom_headers or {}
        headers['Content-Type'] = 'application/json'

        # Prepare request
        request_kwargs = {
            'method': request.http_method,
            'url': request.api_url,
            'headers': headers,
            'timeout': 30
        }

        if request.request_body and request.http_method in ['POST', 'PUT', 'PATCH']:
            request_kwargs['json'] = request.request_body

        # Execute request
        import requests
        start_time = datetime.utcnow()
        response = requests.request(**request_kwargs)
        end_time = datetime.utcnow()
        response_time_ms = int((end_time - start_time).total_seconds() * 1000)

        # Parse response
        try:
            response_data = response.json()
        except:
            response_data = {"raw_content": response.text}

        baseline_response = {
            "status_code": response.status_code,
            "response_time_ms": response_time_ms,
            "headers": dict(response.headers),
            "body": response_data
        }

        # Create baseline record
        baseline_id = secrets.token_urlsafe(16)
        new_baseline = RegressionBaselineDB(
            baseline_id=baseline_id,
            baseline_name=request.baseline_name,
            description=request.description,
            api_url=request.api_url,
            http_method=request.http_method,
            request_body=request.request_body,
            custom_headers=request.custom_headers,
            baseline_response=baseline_response,
            expected_status=request.expected_status,
            expected_response_time_ms=request.expected_response_time_ms,
            created_by=user.user_id,
            team_id=request.team_id,
            is_shared=request.is_shared,
            created_at=datetime.utcnow()
        )

        db.add(new_baseline)
        db.commit()
        db.refresh(new_baseline)

        return {
            "baseline_id": new_baseline.baseline_id,
            "baseline_name": new_baseline.baseline_name,
            "baseline_response": baseline_response,
            "message": "Baseline created successfully"
        }

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to capture baseline: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating baseline: {str(e)}")

@app.get("/regression/my-baselines")
async def get_my_baselines(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all regression baselines for the current user"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    baselines = db.query(RegressionBaselineDB).filter(
        RegressionBaselineDB.created_by == user.user_id
    ).order_by(RegressionBaselineDB.created_at.desc()).all()

    baseline_list = []
    for baseline in baselines:
        baseline_list.append({
            "baseline_id": baseline.baseline_id,
            "baseline_name": baseline.baseline_name,
            "description": baseline.description,
            "api_url": baseline.api_url,
            "http_method": baseline.http_method,
            "expected_status": baseline.expected_status,
            "expected_response_time_ms": baseline.expected_response_time_ms,
            "is_shared": baseline.is_shared,
            "created_at": baseline.created_at.isoformat(),
            "updated_at": baseline.updated_at.isoformat()
        })

    return {"baselines": baseline_list}

@app.get("/regression/baselines/{baseline_id}")
async def get_baseline_details(
    baseline_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific baseline"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    baseline = db.query(RegressionBaselineDB).filter(
        RegressionBaselineDB.baseline_id == baseline_id
    ).first()

    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")

    # Check access permissions
    if baseline.created_by != user.user_id and not baseline.is_shared:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "baseline_id": baseline.baseline_id,
        "baseline_name": baseline.baseline_name,
        "description": baseline.description,
        "api_url": baseline.api_url,
        "http_method": baseline.http_method,
        "request_body": baseline.request_body,
        "custom_headers": baseline.custom_headers,
        "baseline_response": baseline.baseline_response,
        "expected_status": baseline.expected_status,
        "expected_response_time_ms": baseline.expected_response_time_ms,
        "is_shared": baseline.is_shared,
        "created_at": baseline.created_at.isoformat(),
        "updated_at": baseline.updated_at.isoformat()
    }

@app.delete("/regression/baselines/{baseline_id}")
async def delete_baseline(
    baseline_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Delete a regression baseline"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    baseline = db.query(RegressionBaselineDB).filter(
        RegressionBaselineDB.baseline_id == baseline_id
    ).first()

    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")

    if baseline.created_by != user.user_id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this baseline")

    # Delete associated test results
    db.query(RegressionTestResultDB).filter(
        RegressionTestResultDB.baseline_id == baseline_id
    ).delete()

    db.delete(baseline)
    db.commit()

    return {"message": "Baseline deleted successfully"}

@app.post("/regression/run-test")
async def run_regression_test(
    request: RunRegressionTestRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Run a regression test against a baseline"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get baseline
    baseline = db.query(RegressionBaselineDB).filter(
        RegressionBaselineDB.baseline_id == request.baseline_id
    ).first()

    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")

    # Check access
    if baseline.created_by != user.user_id and not baseline.is_shared:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        # Make the API call
        import requests
        headers = baseline.custom_headers or {}
        headers['Content-Type'] = 'application/json'

        request_kwargs = {
            'method': baseline.http_method,
            'url': baseline.api_url,
            'headers': headers,
            'timeout': request.timeout
        }

        if baseline.request_body and baseline.http_method in ['POST', 'PUT', 'PATCH']:
            request_kwargs['json'] = baseline.request_body

        # Execute request
        start_time = datetime.utcnow()
        response = requests.request(**request_kwargs)
        end_time = datetime.utcnow()
        response_time_ms = int((end_time - start_time).total_seconds() * 1000)

        # Parse response
        try:
            response_data = response.json()
        except:
            response_data = {"raw_content": response.text}

        test_response = {
            "status_code": response.status_code,
            "response_time_ms": response_time_ms,
            "headers": dict(response.headers),
            "body": response_data
        }

        # Compare with baseline
        differences = []
        passed = True
        error_message = None

        # Check status code
        if response.status_code != baseline.expected_status:
            differences.append({
                "type": "status_code",
                "expected": baseline.expected_status,
                "actual": response.status_code,
                "message": f"Status code mismatch: expected {baseline.expected_status}, got {response.status_code}"
            })
            passed = False

        # Check response time
        if baseline.expected_response_time_ms:
            if response_time_ms > baseline.expected_response_time_ms:
                differences.append({
                    "type": "response_time",
                    "expected_max": baseline.expected_response_time_ms,
                    "actual": response_time_ms,
                    "message": f"Response time exceeded: {response_time_ms}ms > {baseline.expected_response_time_ms}ms"
                })
                passed = False

        # Deep compare response body
        baseline_body = baseline.baseline_response.get("body", {})
        if response_data != baseline_body:
            # Find specific differences
            body_diffs = find_json_differences(baseline_body, response_data)
            if body_diffs:
                differences.append({
                    "type": "response_body",
                    "changes": body_diffs,
                    "message": f"Response body changed: {len(body_diffs)} difference(s) detected"
                })
                passed = False

        # Save test result
        result_id = secrets.token_urlsafe(16)
        test_result = RegressionTestResultDB(
            result_id=result_id,
            baseline_id=baseline.baseline_id,
            user_id=user.user_id,
            test_response=test_response,
            status_code=response.status_code,
            response_time_ms=response_time_ms,
            passed=passed,
            differences={"differences": differences} if differences else None,
            error_message=error_message,
            created_at=datetime.utcnow()
        )

        db.add(test_result)
        db.commit()
        db.refresh(test_result)

        return {
            "result_id": test_result.result_id,
            "passed": passed,
            "test_response": test_response,
            "baseline_response": baseline.baseline_response,
            "differences": differences,
            "summary": {
                "total_checks": 2 + (1 if baseline.expected_response_time_ms else 0),
                "failed_checks": len(differences),
                "status": "PASS" if passed else "FAIL"
            }
        }

    except requests.exceptions.RequestException as e:
        # Save failed test result
        result_id = secrets.token_urlsafe(16)
        error_msg = f"Request failed: {str(e)}"
        test_result = RegressionTestResultDB(
            result_id=result_id,
            baseline_id=baseline.baseline_id,
            user_id=user.user_id,
            test_response={"error": error_msg},
            status_code=0,
            response_time_ms=0,
            passed=False,
            differences=None,
            error_message=error_msg,
            created_at=datetime.utcnow()
        )

        db.add(test_result)
        db.commit()

        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running regression test: {str(e)}")

@app.get("/regression/results/{baseline_id}")
async def get_baseline_test_results(
    baseline_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
    limit: int = 50
):
    """Get test result history for a baseline"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify baseline access
    baseline = db.query(RegressionBaselineDB).filter(
        RegressionBaselineDB.baseline_id == baseline_id
    ).first()

    if not baseline:
        raise HTTPException(status_code=404, detail="Baseline not found")

    if baseline.created_by != user.user_id and not baseline.is_shared:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get test results
    results = db.query(RegressionTestResultDB).filter(
        RegressionTestResultDB.baseline_id == baseline_id
    ).order_by(RegressionTestResultDB.created_at.desc()).limit(limit).all()

    result_list = []
    for result in results:
        result_list.append({
            "result_id": result.result_id,
            "passed": result.passed,
            "status_code": result.status_code,
            "response_time_ms": result.response_time_ms,
            "differences": result.differences,
            "error_message": result.error_message,
            "created_at": result.created_at.isoformat()
        })

    # Calculate statistics
    total_tests = len(result_list)
    passed_tests = sum(1 for r in result_list if r["passed"])
    failed_tests = total_tests - passed_tests
    pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0

    return {
        "baseline_id": baseline_id,
        "baseline_name": baseline.baseline_name,
        "results": result_list,
        "statistics": {
            "total_tests": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "pass_rate": round(pass_rate, 2)
        }
    }

# ============================================
# CONTRACT TESTING ENDPOINTS
# ============================================

@app.post("/contract/ai/generate")
async def ai_generate_contract(
    request: AIContractGenerationRequest,
    username: str = Depends(verify_token)
):
    """AI-powered contract generation from plain English description"""
    try:
        # Get OpenAI API key
        openai_api_key = os.getenv('OPENAI_API_KEY')

        if not openai_api_key:
            raise HTTPException(
                status_code=500,
                detail="OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."
            )

        # Initialize OpenAI client
        from openai import OpenAI
        client = OpenAI(api_key=openai_api_key)

        # Build the AI prompt
        prompt = f"""Generate a complete consumer-driven contract specification based on this description:

"{request.description}"

Requirements:
1. Create a realistic contract with proper naming
2. Generate appropriate consumer and provider names
3. Define the HTTP method and request path
4. Create a detailed JSON Schema for the response body
5. If the description mentions request data, include request_body_schema
6. Use semantic versioning (start with 1.0.0)
7. Set appropriate HTTP status code (usually 200 for GET, 201 for POST)

Return a JSON object with this EXACT structure:
{{
  "contract_name": "descriptive name for the contract",
  "description": "brief description of what this contract validates",
  "consumer_name": "name of the consumer service/application",
  "provider_name": "name of the provider service/API",
  "version": "1.0.0",
  "request_method": "GET|POST|PUT|DELETE|PATCH",
  "request_path": "/api/endpoint/path",
  "request_body_schema": {{"type": "object", "properties": {{}}, "required": []}} or null,
  "response_status": 200,
  "response_body_schema": {{
    "type": "object",
    "properties": {{
      "field_name": {{
        "type": "string|number|boolean|object|array",
        "description": "field description"
      }}
    }},
    "required": ["list", "of", "required", "fields"]
  }}
}}

Make the schema realistic and comprehensive. Include appropriate field types, descriptions, and required fields based on the description."""

        # Call OpenAI GPT-4o
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """You are a Senior API Contract Architect with expertise in:
- Consumer-Driven Contract Testing (PACT, Spring Cloud Contract)
- JSON Schema specification and validation
- RESTful API design and best practices
- Microservices architecture patterns
- API versioning and backward compatibility

Generate professional, production-ready contract specifications that follow industry best practices."""
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )

        # Extract and parse AI response
        ai_response = response.choices[0].message.content
        contract_data = json.loads(ai_response)

        # Validate the generated schema
        if not validate_json_schema(contract_data.get('response_body_schema', {})):
            raise HTTPException(
                status_code=500,
                detail="AI generated an invalid JSON Schema. Please try again."
            )

        return {
            "success": True,
            "contract": contract_data,
            "message": "Contract generated successfully by AI"
        }

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse AI response: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI generation failed: {str(e)}"
        )

@app.post("/contract/create")
async def create_contract(
    request: CreateContractRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Create a new consumer-driven contract"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        # Validate response body schema is valid JSON Schema
        if not validate_json_schema(request.response_body_schema):
            raise HTTPException(status_code=400, detail="Invalid JSON Schema for response body")

        contract_id = secrets.token_urlsafe(16)
        new_contract = ContractDB(
            contract_id=contract_id,
            contract_name=request.contract_name,
            description=request.description,
            consumer_name=request.consumer_name,
            provider_name=request.provider_name,
            version=request.version,
            request_method=request.request_method,
            request_path=request.request_path,
            request_headers_schema=request.request_headers_schema,
            request_body_schema=request.request_body_schema,
            request_query_schema=request.request_query_schema,
            response_status=request.response_status,
            response_headers_schema=request.response_headers_schema,
            response_body_schema=request.response_body_schema,
            state=request.state,
            created_by=user.user_id,
            team_id=request.team_id,
            is_shared=request.is_shared,
            is_active=True,
            created_at=datetime.utcnow()
        )

        db.add(new_contract)
        db.commit()
        db.refresh(new_contract)

        return {
            "contract_id": new_contract.contract_id,
            "contract_name": new_contract.contract_name,
            "version": new_contract.version,
            "message": "Contract created successfully"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating contract: {str(e)}")

@app.get("/contract/my-contracts")
async def get_my_contracts(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get all contracts for the current user"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    contracts = db.query(ContractDB).filter(
        ContractDB.created_by == user.user_id,
        ContractDB.is_active == True
    ).order_by(ContractDB.created_at.desc()).all()

    contract_list = []
    for contract in contracts:
        # Get verification count
        verification_count = db.query(ProviderVerificationDB).filter(
            ProviderVerificationDB.contract_id == contract.contract_id
        ).count()

        # Get last verification status
        last_verification = db.query(ProviderVerificationDB).filter(
            ProviderVerificationDB.contract_id == contract.contract_id
        ).order_by(ProviderVerificationDB.created_at.desc()).first()

        contract_list.append({
            "contract_id": contract.contract_id,
            "contract_name": contract.contract_name,
            "description": contract.description,
            "consumer_name": contract.consumer_name,
            "provider_name": contract.provider_name,
            "version": contract.version,
            "request_method": contract.request_method,
            "request_path": contract.request_path,
            "response_status": contract.response_status,
            "is_shared": contract.is_shared,
            "verification_count": verification_count,
            "last_verification_passed": last_verification.passed if last_verification else None,
            "created_at": contract.created_at.isoformat(),
            "updated_at": contract.updated_at.isoformat()
        })

    return {"contracts": contract_list}

@app.get("/contract/{contract_id}")
async def get_contract_details(
    contract_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific contract"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    contract = db.query(ContractDB).filter(
        ContractDB.contract_id == contract_id
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Check access permissions
    if contract.created_by != user.user_id and not contract.is_shared:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "contract_id": contract.contract_id,
        "contract_name": contract.contract_name,
        "description": contract.description,
        "consumer_name": contract.consumer_name,
        "provider_name": contract.provider_name,
        "version": contract.version,
        "request_method": contract.request_method,
        "request_path": contract.request_path,
        "request_headers_schema": contract.request_headers_schema,
        "request_body_schema": contract.request_body_schema,
        "request_query_schema": contract.request_query_schema,
        "response_status": contract.response_status,
        "response_headers_schema": contract.response_headers_schema,
        "response_body_schema": contract.response_body_schema,
        "state": contract.state,
        "is_shared": contract.is_shared,
        "is_active": contract.is_active,
        "created_at": contract.created_at.isoformat(),
        "updated_at": contract.updated_at.isoformat()
    }

@app.delete("/contract/{contract_id}")
async def delete_contract(
    contract_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Delete a contract"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    contract = db.query(ContractDB).filter(
        ContractDB.contract_id == contract_id
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    if contract.created_by != user.user_id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this contract")

    # Soft delete - mark as inactive
    contract.is_active = False
    db.commit()

    return {"message": "Contract deleted successfully"}

@app.post("/contract/verify-provider")
async def verify_provider(
    request: VerifyProviderRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Verify that a provider meets the contract specifications"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get contract
    contract = db.query(ContractDB).filter(
        ContractDB.contract_id == request.contract_id
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Check access
    if contract.created_by != user.user_id and not contract.is_shared:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        import requests

        # Build request URL
        full_url = request.provider_url.rstrip('/') + contract.request_path

        # Prepare headers
        headers = request.custom_headers or {}
        if contract.request_headers_schema:
            # Add default headers from schema if needed
            for header_name in contract.request_headers_schema.get('properties', {}):
                if header_name not in headers:
                    headers[header_name] = 'test-value'

        # Prepare request kwargs
        request_kwargs = {
            'method': contract.request_method,
            'url': full_url,
            'headers': headers,
            'timeout': request.timeout
        }

        # Add request body if specified in contract
        if contract.request_body_schema and contract.request_method in ['POST', 'PUT', 'PATCH']:
            # Generate sample data from schema
            sample_body = generate_sample_from_schema(contract.request_body_schema)
            request_kwargs['json'] = sample_body

        # Execute request
        start_time = datetime.utcnow()
        response = requests.request(**request_kwargs)
        end_time = datetime.utcnow()
        response_time_ms = int((end_time - start_time).total_seconds() * 1000)

        # Parse response
        try:
            response_data = response.json()
        except:
            response_data = {"raw_content": response.text}

        # Validation
        validation_errors = []
        status_code_match = response.status_code == contract.response_status

        if not status_code_match:
            validation_errors.append({
                "type": "status_code",
                "expected": contract.response_status,
                "actual": response.status_code,
                "message": f"Status code mismatch: expected {contract.response_status}, got {response.status_code}"
            })

        # Validate response body against JSON Schema
        schema_match = True
        schema_errors = validate_against_schema(response_data, contract.response_body_schema)
        if schema_errors:
            schema_match = False
            validation_errors.extend(schema_errors)

        passed = status_code_match and schema_match

        # Save verification result
        verification_id = secrets.token_urlsafe(16)
        verification = ProviderVerificationDB(
            verification_id=verification_id,
            contract_id=contract.contract_id,
            user_id=user.user_id,
            provider_url=request.provider_url,
            passed=passed,
            request_sent={
                "method": contract.request_method,
                "url": full_url,
                "headers": headers,
                "body": request_kwargs.get('json')
            },
            response_received={
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response_data
            },
            validation_errors={"errors": validation_errors} if validation_errors else None,
            status_code_match=status_code_match,
            schema_match=schema_match,
            response_time_ms=response_time_ms,
            error_message=None if passed else f"{len(validation_errors)} validation error(s)",
            created_at=datetime.utcnow()
        )

        db.add(verification)
        db.commit()
        db.refresh(verification)

        return {
            "verification_id": verification.verification_id,
            "passed": passed,
            "status_code_match": status_code_match,
            "schema_match": schema_match,
            "response_time_ms": response_time_ms,
            "validation_errors": validation_errors,
            "response_received": verification.response_received,
            "summary": {
                "contract_name": contract.contract_name,
                "provider": contract.provider_name,
                "consumer": contract.consumer_name,
                "version": contract.version,
                "status": "PASS" if passed else "FAIL"
            }
        }

    except requests.exceptions.RequestException as e:
        # Save failed verification
        verification_id = secrets.token_urlsafe(16)
        error_msg = f"Request failed: {str(e)}"
        verification = ProviderVerificationDB(
            verification_id=verification_id,
            contract_id=contract.contract_id,
            user_id=user.user_id,
            provider_url=request.provider_url,
            passed=False,
            request_sent={"error": error_msg},
            response_received={"error": error_msg},
            validation_errors=None,
            status_code_match=False,
            schema_match=False,
            response_time_ms=0,
            error_message=error_msg,
            created_at=datetime.utcnow()
        )

        db.add(verification)
        db.commit()

        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error verifying provider: {str(e)}")

@app.get("/contract/verifications/{contract_id}")
async def get_contract_verifications(
    contract_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
    limit: int = 50
):
    """Get verification history for a contract"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify contract access
    contract = db.query(ContractDB).filter(
        ContractDB.contract_id == contract_id
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    if contract.created_by != user.user_id and not contract.is_shared:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get verifications
    verifications = db.query(ProviderVerificationDB).filter(
        ProviderVerificationDB.contract_id == contract_id
    ).order_by(ProviderVerificationDB.created_at.desc()).limit(limit).all()

    verification_list = []
    for verification in verifications:
        verification_list.append({
            "verification_id": verification.verification_id,
            "provider_url": verification.provider_url,
            "passed": verification.passed,
            "status_code_match": verification.status_code_match,
            "schema_match": verification.schema_match,
            "response_time_ms": verification.response_time_ms,
            "validation_errors": verification.validation_errors,
            "error_message": verification.error_message,
            "created_at": verification.created_at.isoformat()
        })

    # Calculate statistics
    total_verifications = len(verification_list)
    passed_verifications = sum(1 for v in verification_list if v["passed"])
    failed_verifications = total_verifications - passed_verifications
    pass_rate = (passed_verifications / total_verifications * 100) if total_verifications > 0 else 0

    return {
        "contract_id": contract_id,
        "contract_name": contract.contract_name,
        "verifications": verification_list,
        "statistics": {
            "total_verifications": total_verifications,
            "passed": passed_verifications,
            "failed": failed_verifications,
            "pass_rate": round(pass_rate, 2)
        }
    }

@app.post("/contract/check-compatibility")
async def check_compatibility(
    request: CheckCompatibilityRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Check compatibility between two contract versions"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get both contracts
    old_contract = db.query(ContractDB).filter(
        ContractDB.contract_id == request.old_contract_id
    ).first()
    new_contract = db.query(ContractDB).filter(
        ContractDB.contract_id == request.new_contract_id
    ).first()

    if not old_contract or not new_contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Check access
    if (old_contract.created_by != user.user_id and not old_contract.is_shared) or \
       (new_contract.created_by != user.user_id and not new_contract.is_shared):
        raise HTTPException(status_code=403, detail="Access denied")

    # Analyze compatibility
    breaking_changes = []
    is_backward_compatible = True
    is_forward_compatible = True

    # Check request changes
    if old_contract.request_method != new_contract.request_method:
        breaking_changes.append({
            "type": "request_method",
            "old": old_contract.request_method,
            "new": new_contract.request_method,
            "severity": "breaking",
            "message": "HTTP method changed"
        })
        is_backward_compatible = False

    if old_contract.request_path != new_contract.request_path:
        breaking_changes.append({
            "type": "request_path",
            "old": old_contract.request_path,
            "new": new_contract.request_path,
            "severity": "breaking",
            "message": "API path changed"
        })
        is_backward_compatible = False

    # Check response status
    if old_contract.response_status != new_contract.response_status:
        breaking_changes.append({
            "type": "response_status",
            "old": old_contract.response_status,
            "new": new_contract.response_status,
            "severity": "breaking",
            "message": "Response status code changed"
        })
        is_backward_compatible = False

    # Check response schema changes
    schema_changes = compare_schemas(
        old_contract.response_body_schema,
        new_contract.response_body_schema
    )
    if schema_changes["breaking"]:
        breaking_changes.extend(schema_changes["breaking"])
        is_backward_compatible = False

    # Save compatibility check
    compatibility_id = secrets.token_urlsafe(16)
    compatibility = ContractCompatibilityDB(
        compatibility_id=compatibility_id,
        old_contract_id=request.old_contract_id,
        new_contract_id=request.new_contract_id,
        is_backward_compatible=is_backward_compatible,
        is_forward_compatible=is_forward_compatible,
        breaking_changes={"changes": breaking_changes} if breaking_changes else None,
        created_at=datetime.utcnow()
    )

    db.add(compatibility)
    db.commit()

    return {
        "compatibility_id": compatibility_id,
        "is_backward_compatible": is_backward_compatible,
        "is_forward_compatible": is_forward_compatible,
        "breaking_changes": breaking_changes,
        "summary": {
            "old_version": old_contract.version,
            "new_version": new_contract.version,
            "total_breaking_changes": len(breaking_changes),
            "recommendation": "Safe to deploy" if is_backward_compatible else "⚠️ Contains breaking changes - coordinate with consumers"
        }
    }

# ============================================
# GRAPHQL TESTING ENDPOINTS
# ============================================

@app.post("/graphql/discover-schema")
async def discover_graphql_schema(
    request: Request,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Discover GraphQL schema using introspection query"""
    print(f"=== GraphQL Discover Schema Request ===")
    print(f"Username from token: {username}")

    try:
        # Parse request body
        try:
            body = await request.json()
            print(f"Request body received: {body}")
        except Exception as e:
            print(f"Error parsing request body: {e}")
            raise HTTPException(status_code=400, detail="Invalid JSON in request body")

        if body is None:
            print("ERROR: Request body is None")
            raise HTTPException(status_code=400, detail="Request body is required")

        if not isinstance(body, dict):
            print(f"ERROR: Request body is not a dict, it's: {type(body)}")
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")

        endpoint = body.get('endpoint')
        auth_config = body.get('auth_config', {})

        print(f"Endpoint: {endpoint}")
        print(f"Auth config: {auth_config}")

        if not endpoint:
            raise HTTPException(status_code=400, detail="GraphQL endpoint is required")

        # Build introspection query
        introspection_query = """
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            subscriptionType { name }
            types {
              kind
              name
              description
              fields(includeDeprecated: true) {
                name
                description
                args {
                  name
                  description
                  type {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
                type {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
                isDeprecated
                deprecationReason
              }
              interfaces {
                name
              }
              possibleTypes {
                name
              }
              enumValues(includeDeprecated: true) {
                name
                description
                isDeprecated
                deprecationReason
              }
            }
          }
        }
        """

        # Prepare headers
        headers = {'Content-Type': 'application/json'}

        # Add authentication
        if auth_config.get('type') == 'bearer':
            headers['Authorization'] = f"Bearer {auth_config.get('token')}"
        elif auth_config.get('type') == 'api_key':
            headers[auth_config.get('key_name', 'X-API-Key')] = auth_config.get('api_key')

        # Execute introspection query
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                endpoint,
                json={'query': introspection_query},
                headers=headers
            )

        if response.status_code != 200:
            print(f"GraphQL endpoint returned status {response.status_code}")
            print(f"Response: {response.text[:500]}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch schema: HTTP {response.status_code}"
            )

        try:
            data = response.json()
        except Exception as e:
            print(f"Failed to parse GraphQL response as JSON: {e}")
            print(f"Response text: {response.text[:500]}")
            raise HTTPException(
                status_code=400,
                detail="GraphQL endpoint returned invalid JSON"
            )

        if 'errors' in data:
            print(f"GraphQL returned errors: {data['errors']}")
            raise HTTPException(
                status_code=400,
                detail=f"GraphQL errors: {data['errors']}"
            )

        if 'data' not in data:
            print(f"GraphQL response missing 'data' field: {data}")
            raise HTTPException(
                status_code=400,
                detail="GraphQL response is missing 'data' field. The endpoint may not support introspection."
            )

        schema_data = data.get('data', {}).get('__schema', {})

        if not schema_data:
            print("GraphQL response missing '__schema' field")
            raise HTTPException(
                status_code=400,
                detail="GraphQL endpoint does not support introspection or returned empty schema"
            )

        # Parse schema
        types = schema_data.get('types', [])

        # Safely get query and mutation type names
        query_type = schema_data.get('queryType')
        query_type_name = query_type.get('name') if query_type else None

        mutation_type = schema_data.get('mutationType')
        mutation_type_name = mutation_type.get('name') if mutation_type else None

        # Extract queries
        queries = []
        mutations = []
        custom_types = []

        for type_info in types:
            type_name = type_info.get('name', '')

            # Skip internal types
            if type_name.startswith('__'):
                continue

            if type_name == query_type_name:
                queries = [
                    {
                        'name': field.get('name'),
                        'description': field.get('description'),
                        'args': field.get('args', []),
                        'returnType': field.get('type', {})
                    }
                    for field in type_info.get('fields', [])
                ]
            elif type_name == mutation_type_name:
                mutations = [
                    {
                        'name': field.get('name'),
                        'description': field.get('description'),
                        'args': field.get('args', []),
                        'returnType': field.get('type', {})
                    }
                    for field in type_info.get('fields', [])
                ]
            elif type_info.get('kind') == 'OBJECT':
                custom_types.append({
                    'name': type_name,
                    'description': type_info.get('description'),
                    'fields': type_info.get('fields', [])
                })

        return {
            "schema": {
                "queries": queries,
                "mutations": mutations,
                "types": custom_types
            },
            "message": "Schema discovered successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in discover_graphql_schema: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/graphql/generate-tests")
async def generate_graphql_tests(
    request: Request,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Generate AI-powered GraphQL tests"""
    try:
        body = await request.json()
        endpoint = body.get('endpoint')
        schema = body.get('schema', {})
        test_types = body.get('test_types', {})
        num_tests = body.get('num_tests', 50)

        if not endpoint or not schema:
            raise HTTPException(status_code=400, detail="Endpoint and schema are required")

        tests = []

        # Generate query tests
        if test_types.get('queries', True):
            for query in schema.get('queries', []):
                # Basic query test
                query_str = build_graphql_query(query)
                tests.append({
                    'type': 'query',
                    'name': f"Test Query: {query['name']}",
                    'query': query_str,
                    'description': f"Test {query['name']} query",
                    'expected_status': 200
                })

                # Query with all fields
                if query.get('args'):
                    query_with_args = build_graphql_query_with_args(query)
                    tests.append({
                        'type': 'query',
                        'name': f"Test Query with Args: {query['name']}",
                        'query': query_with_args,
                        'description': f"Test {query['name']} with arguments",
                        'expected_status': 200
                    })

        # Generate mutation tests
        if test_types.get('mutations', True):
            for mutation in schema.get('mutations', []):
                mutation_str = build_graphql_mutation(mutation)
                tests.append({
                    'type': 'mutation',
                    'name': f"Test Mutation: {mutation['name']}",
                    'query': mutation_str,
                    'description': f"Test {mutation['name']} mutation",
                    'expected_status': 200
                })

        # Generate nested query tests
        if test_types.get('nested', True):
            for query in schema.get('queries', [])[:5]:  # Limit to first 5
                nested_query = build_nested_graphql_query(query, schema.get('types', []))
                if nested_query:
                    tests.append({
                        'type': 'nested',
                        'name': f"Test Nested Query: {query['name']}",
                        'query': nested_query,
                        'description': f"Test deeply nested {query['name']} query",
                        'expected_status': 200
                    })

        # Generate error handling tests
        if test_types.get('errors', True):
            tests.extend([
                {
                    'type': 'error',
                    'name': 'Test Invalid Query Syntax',
                    'query': '{ invalid syntax here }',
                    'description': 'Test error handling for invalid syntax',
                    'expected_error': True
                },
                {
                    'type': 'error',
                    'name': 'Test Non-existent Field',
                    'query': '{ nonExistentField }',
                    'description': 'Test error handling for non-existent fields',
                    'expected_error': True
                }
            ])

        # Generate performance tests
        if test_types.get('performance', True):
            for query in schema.get('queries', [])[:3]:  # First 3 queries
                tests.append({
                    'type': 'performance',
                    'name': f"Performance Test: {query['name']}",
                    'query': build_graphql_query(query),
                    'description': f"Performance and N+1 detection for {query['name']}",
                    'expected_status': 200,
                    'check_n_plus_one': True
                })

        # Use AI to enhance tests if OpenAI is configured
        if OPENAI_API_KEY and openai:
            try:
                # Initialize OpenAI client
                from openai import OpenAI
                client = OpenAI(api_key=OPENAI_API_KEY)

                # Get AI suggestions for edge cases
                ai_prompt = f"""
You are a GraphQL API testing expert. Given this GraphQL schema:

Queries: {[q['name'] for q in schema.get('queries', [])]}
Mutations: {[m['name'] for m in schema.get('mutations', [])]}

Generate 5 advanced test scenarios that test edge cases, security concerns, or complex interactions.
For each test, provide:
1. Test name
2. GraphQL query/mutation
3. Description
4. What it tests (edge case, security, performance, etc.)

Return ONLY a JSON array of test objects with these exact fields: type, name, query, description
"""

                response = client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are a GraphQL testing expert. Return only valid JSON."},
                        {"role": "user", "content": ai_prompt}
                    ],
                    temperature=0.7,
                    max_tokens=2000
                )

                ai_tests_text = response.choices[0].message.content.strip()

                # Extract JSON from response
                if '```json' in ai_tests_text:
                    ai_tests_text = ai_tests_text.split('```json')[1].split('```')[0].strip()
                elif '```' in ai_tests_text:
                    ai_tests_text = ai_tests_text.split('```')[1].split('```')[0].strip()

                ai_tests = json.loads(ai_tests_text)

                if isinstance(ai_tests, list):
                    tests.extend(ai_tests[:5])  # Add up to 5 AI-generated tests

            except Exception as e:
                print(f"AI test generation failed: {e}")
                # Continue without AI tests

        # Limit total tests
        tests = tests[:num_tests]

        return {
            "tests": tests,
            "total": len(tests),
            "message": f"Generated {len(tests)} GraphQL tests"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in generate_graphql_tests: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/graphql/run-tests")
async def run_graphql_tests(
    request: Request,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Run GraphQL tests and analyze results"""
    try:
        body = await request.json()
        endpoint = body.get('endpoint')
        auth_config = body.get('auth_config', {})
        tests = body.get('tests', [])

        if not endpoint or not tests:
            raise HTTPException(status_code=400, detail="Endpoint and tests are required")

        results = []
        total_passed = 0
        total_failed = 0
        response_times = []
        n_plus_one_detected = 0

        # Prepare headers
        headers = {'Content-Type': 'application/json'}

        if auth_config.get('type') == 'bearer':
            headers['Authorization'] = f"Bearer {auth_config.get('token')}"
        elif auth_config.get('type') == 'api_key':
            headers[auth_config.get('key_name', 'X-API-Key')] = auth_config.get('api_key')

        # Run tests
        async with httpx.AsyncClient(timeout=30.0) as client:
            for test in tests:
                start_time = time.time()

                try:
                    response = await client.post(
                        endpoint,
                        json={'query': test.get('query')},
                        headers=headers
                    )

                    response_time = int((time.time() - start_time) * 1000)
                    response_times.append(response_time)

                    data = response.json()

                    # Check for errors
                    has_errors = 'errors' in data
                    expected_error = test.get('expected_error', False)

                    # Determine pass/fail
                    if expected_error:
                        status = 'PASS' if has_errors else 'FAIL'
                        error_msg = None if has_errors else "Expected error but got success"
                    else:
                        status = 'PASS' if not has_errors and response.status_code == 200 else 'FAIL'
                        error_msg = str(data.get('errors')) if has_errors else None

                    # N+1 detection for performance tests
                    n_plus_one_warning = False
                    if test.get('check_n_plus_one', False):
                        # Simple heuristic: if response time > 500ms, might be N+1
                        if response_time > 500:
                            n_plus_one_warning = True
                            n_plus_one_detected += 1

                    if status == 'PASS':
                        total_passed += 1
                    else:
                        total_failed += 1

                    results.append({
                        'test_name': test.get('name'),
                        'status': status,
                        'response_time': response_time,
                        'error': error_msg,
                        'n_plus_one_warning': n_plus_one_warning,
                        'data': data.get('data') if not has_errors else None
                    })

                except Exception as e:
                    total_failed += 1
                    results.append({
                        'test_name': test.get('name'),
                        'status': 'FAIL',
                        'response_time': int((time.time() - start_time) * 1000),
                        'error': str(e)
                    })

        # Calculate metrics
        avg_response_time = int(sum(response_times) / len(response_times)) if response_times else 0
        pass_rate = (total_passed / len(tests) * 100) if tests else 0

        # Generate AI insights
        ai_insights = None
        if OPENAI_API_KEY and openai and total_failed > 0:
            try:
                # Initialize OpenAI client
                from openai import OpenAI
                client = OpenAI(api_key=OPENAI_API_KEY)

                failed_tests = [r for r in results if r['status'] == 'FAIL']
                ai_prompt = f"""
Analyze these failed GraphQL tests and provide insights:

Failed Tests:
{json.dumps(failed_tests[:5], indent=2)}

Provide:
1. Root cause analysis
2. 3 specific recommendations to fix the issues
3. Best practices to prevent similar failures

Return a JSON object with: {{"root_cause": "...", "recommendations": ["...", "...", "..."], "best_practices": ["...", "..."]}}
"""

                response = client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are a GraphQL expert. Return only valid JSON."},
                        {"role": "user", "content": ai_prompt}
                    ],
                    temperature=0.7,
                    max_tokens=1000
                )

                ai_text = response.choices[0].message.content.strip()

                if '```json' in ai_text:
                    ai_text = ai_text.split('```json')[1].split('```')[0].strip()
                elif '```' in ai_text:
                    ai_text = ai_text.split('```')[1].split('```')[0].strip()

                ai_insights = json.loads(ai_text)

            except Exception as e:
                print(f"AI insights generation failed: {e}")

        return {
            "results": results,
            "summary": {
                "total": len(tests),
                "passed": total_passed,
                "failed": total_failed,
                "pass_rate": round(pass_rate, 2),
                "avg_response_time": avg_response_time,
                "n_plus_one_detected": n_plus_one_detected
            },
            "ai_insights": ai_insights
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in run_graphql_tests: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/graphql/nl-to-query")
async def natural_language_to_graphql(
    request: Request,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Convert natural language description to GraphQL query using AI"""
    print(f"=== Natural Language to GraphQL Request ===")
    print(f"Username: {username}")

    try:
        body = await request.json()

        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")

        nl_description = body.get('description', '')
        schema = body.get('schema', {})

        print(f"NL Description: {nl_description}")
        print(f"Schema available: {bool(schema)}")

        if not nl_description or not nl_description.strip():
            raise HTTPException(status_code=400, detail="Description is required")

        if not OPENAI_API_KEY or not openai:
            # Fallback: return a basic query without AI
            return {
                "query": "query {\n  # AI not available\n  # Please enter your query manually\n}",
                "explanation": "OpenAI API key not configured. Please set up OpenAI to use Natural Language Query Builder.",
                "confidence": 0.0
            }

        # Build context from schema
        queries_list = [q['name'] for q in schema.get('queries', [])]
        mutations_list = [m['name'] for m in schema.get('mutations', [])]
        types_list = [t['name'] for t in schema.get('types', [])][:20]  # Limit to first 20 types

        schema_context = f"""
Available Queries: {', '.join(queries_list) if queries_list else 'None'}
Available Mutations: {', '.join(mutations_list) if mutations_list else 'None'}
Available Types: {', '.join(types_list) if types_list else 'None'}
"""

        # Create AI prompt
        ai_prompt = f"""
You are a GraphQL expert. Convert the user's natural language description into a valid GraphQL query.

GraphQL Schema Information:
{schema_context}

User's Request:
"{nl_description}"

IMPORTANT RULES:
1. Generate ONLY the GraphQL query, nothing else
2. Use proper GraphQL syntax
3. Include reasonable fields based on the type
4. Add pagination if fetching lists (use "first: 10" by default)
5. Use meaningful field selections (id, name, common fields)
6. If the request is unclear, make reasonable assumptions

Return ONLY the GraphQL query without any explanation or markdown formatting.
"""

        print("Sending request to OpenAI...")

        # Call OpenAI
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a GraphQL query expert. Generate only valid GraphQL queries without any additional text or markdown formatting."},
                {"role": "user", "content": ai_prompt}
            ],
            temperature=0.3,  # Lower temperature for more consistent output
            max_tokens=500
        )

        generated_query = response.choices[0].message.content.strip()

        print(f"Generated query: {generated_query[:100]}...")

        # Clean up the query (remove markdown code blocks if present)
        if '```graphql' in generated_query:
            generated_query = generated_query.split('```graphql')[1].split('```')[0].strip()
        elif '```' in generated_query:
            generated_query = generated_query.split('```')[1].split('```')[0].strip()

        # Generate explanation
        explanation_prompt = f"""
Briefly explain what this GraphQL query does in one sentence:

{generated_query}

Keep it simple and user-friendly.
"""

        explanation_response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Explain GraphQL queries simply."},
                {"role": "user", "content": explanation_prompt}
            ],
            temperature=0.3,
            max_tokens=100
        )

        explanation = explanation_response.choices[0].message.content.strip()

        return {
            "query": generated_query,
            "explanation": explanation,
            "confidence": 0.95,
            "message": "Successfully generated GraphQL query from natural language"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in natural_language_to_graphql: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate query: {str(e)}")


@app.post("/graphql/download-report/{format}")
async def download_graphql_report(
    format: str,
    request: Request,
    username: str = Depends(verify_token)
):
    """Download GraphQL test report in JSON or PDF format"""
    try:
        body = await request.json()
        endpoint = body.get('endpoint')
        results = body.get('results', {})

        if format == 'json':
            report_data = {
                "endpoint": endpoint,
                "timestamp": datetime.utcnow().isoformat(),
                "results": results,
                "generated_by": "Evo-TFX GraphQL Testing"
            }

            return StreamingResponse(
                iter([json.dumps(report_data, indent=2)]),
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename=graphql-report-{int(time.time())}.json"}
            )

        elif format == 'pdf':
            # Create PDF report
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter)
            elements = []

            # Styles
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor=colors.HexColor('#6366f1'),
                spaceAfter=30
            )

            # Title
            elements.append(Paragraph("GraphQL API Test Report", title_style))
            elements.append(Spacer(1, 20))

            # Summary
            summary = results.get('summary', {})
            summary_data = [
                ['Metric', 'Value'],
                ['Total Tests', str(summary.get('total', 0))],
                ['Passed', str(summary.get('passed', 0))],
                ['Failed', str(summary.get('failed', 0))],
                ['Pass Rate', f"{summary.get('pass_rate', 0)}%"],
                ['Avg Response Time', f"{summary.get('avg_response_time', 0)}ms"],
                ['N+1 Detected', str(summary.get('n_plus_one_detected', 0))]
            ]

            summary_table = Table(summary_data, colWidths=[200, 200])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6366f1')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))

            elements.append(summary_table)
            elements.append(Spacer(1, 30))

            # Build PDF
            doc.build(elements)
            buffer.seek(0)

            return StreamingResponse(
                buffer,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=graphql-report-{int(time.time())}.pdf"}
            )

        else:
            raise HTTPException(status_code=400, detail="Invalid format. Use 'json' or 'pdf'")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in download_graphql_report: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Helper functions for GraphQL
def build_graphql_query(query_info):
    """Build a basic GraphQL query string"""
    query_name = query_info.get('name')
    return f"""
query {{
  {query_name} {{
    __typename
  }}
}}
    """.strip()


def build_graphql_query_with_args(query_info):
    """Build GraphQL query with arguments"""
    query_name = query_info.get('name')
    args = query_info.get('args', [])

    if not args:
        return build_graphql_query(query_info)

    # Build argument string with sample values
    arg_strings = []
    for arg in args:
        arg_name = arg.get('name')
        arg_type = arg.get('type', {})
        sample_value = get_sample_value_for_type(arg_type)
        arg_strings.append(f'{arg_name}: {sample_value}')

    args_str = ', '.join(arg_strings)

    return f"""
query {{
  {query_name}({args_str}) {{
    __typename
  }}
}}
    """.strip()


def build_graphql_mutation(mutation_info):
    """Build a GraphQL mutation string"""
    mutation_name = mutation_info.get('name')
    args = mutation_info.get('args', [])

    if not args:
        return f"""
mutation {{
  {mutation_name} {{
    __typename
  }}
}}
        """.strip()

    # Build input
    arg_strings = []
    for arg in args:
        arg_name = arg.get('name')
        arg_type = arg.get('type', {})
        sample_value = get_sample_value_for_type(arg_type)
        arg_strings.append(f'{arg_name}: {sample_value}')

    args_str = ', '.join(arg_strings)

    return f"""
mutation {{
  {mutation_name}({args_str}) {{
    __typename
  }}
}}
    """.strip()


def build_nested_graphql_query(query_info, types):
    """Build a deeply nested GraphQL query"""
    query_name = query_info.get('name')
    return_type = query_info.get('returnType', {})

    # Try to build nested fields
    nested_fields = build_nested_fields(return_type, types, depth=3)

    if not nested_fields:
        return None

    return f"""
query {{
  {query_name} {{
    {nested_fields}
  }}
}}
    """.strip()


def build_nested_fields(type_info, types, depth=3):
    """Recursively build nested field selections"""
    if depth <= 0:
        return "__typename"

    type_name = type_info.get('name')
    of_type = type_info.get('ofType')

    # Handle wrapped types (LIST, NON_NULL)
    if of_type:
        return build_nested_fields(of_type, types, depth)

    # Find the type definition
    type_def = None
    for t in types:
        if t.get('name') == type_name:
            type_def = t
            break

    if not type_def or not type_def.get('fields'):
        return "__typename"

    # Build field selections
    field_selections = ["__typename"]
    for field in type_def.get('fields', [])[:5]:  # Limit to 5 fields
        field_name = field.get('name')
        field_type = field.get('type', {})

        # Check if field has nested type
        nested = build_nested_fields(field_type, types, depth - 1)
        if nested and nested != "__typename":
            field_selections.append(f"{field_name} {{ {nested} }}")
        else:
            field_selections.append(field_name)

    return "\n    ".join(field_selections)


def get_sample_value_for_type(type_info):
    """Get sample value for GraphQL type"""
    type_name = type_info.get('name')
    type_kind = type_info.get('kind')

    if type_kind == 'NON_NULL' or type_kind == 'LIST':
        of_type = type_info.get('ofType', {})
        return get_sample_value_for_type(of_type)

    # Return sample values based on type
    if type_name == 'String':
        return '"test-string"'
    elif type_name == 'Int':
        return '1'
    elif type_name == 'Float':
        return '1.0'
    elif type_name == 'Boolean':
        return 'true'
    elif type_name == 'ID':
        return '"1"'
    else:
        return 'null'


# ============================================
# CONTRACT TESTING HELPER FUNCTIONS
# ============================================

def validate_json_schema(schema):
    """Validate that a schema is valid JSON Schema"""
    try:
        # Basic validation - check if it's a dict with type
        if not isinstance(schema, dict):
            return False
        # JSON Schema should have at least a 'type' or 'properties'
        return 'type' in schema or 'properties' in schema or '$ref' in schema
    except:
        return False

def validate_against_schema(data, schema):
    """Validate data against JSON Schema and return errors"""
    errors = []

    try:
        # Simple validation - check type and required fields
        if schema.get('type') == 'object':
            if not isinstance(data, dict):
                errors.append({
                    "type": "type_mismatch",
                    "path": "root",
                    "expected": "object",
                    "actual": type(data).__name__,
                    "message": f"Expected object, got {type(data).__name__}"
                })
                return errors

            # Check required fields
            required = schema.get('required', [])
            for field in required:
                if field not in data:
                    errors.append({
                        "type": "missing_required_field",
                        "path": field,
                        "expected": field,
                        "actual": None,
                        "message": f"Required field '{field}' is missing"
                    })

            # Check properties
            properties = schema.get('properties', {})
            for field, field_schema in properties.items():
                if field in data:
                    field_errors = validate_field(data[field], field_schema, field)
                    errors.extend(field_errors)

        elif schema.get('type') == 'array':
            if not isinstance(data, list):
                errors.append({
                    "type": "type_mismatch",
                    "path": "root",
                    "expected": "array",
                    "actual": type(data).__name__,
                    "message": f"Expected array, got {type(data).__name__}"
                })

    except Exception as e:
        errors.append({
            "type": "validation_error",
            "path": "root",
            "message": f"Schema validation error: {str(e)}"
        })

    return errors

def validate_field(value, schema, path):
    """Validate a single field against its schema"""
    errors = []
    expected_type = schema.get('type')

    if expected_type == 'string' and not isinstance(value, str):
        errors.append({
            "type": "type_mismatch",
            "path": path,
            "expected": "string",
            "actual": type(value).__name__,
            "message": f"Field '{path}' should be string, got {type(value).__name__}"
        })
    elif expected_type == 'number' and not isinstance(value, (int, float)):
        errors.append({
            "type": "type_mismatch",
            "path": path,
            "expected": "number",
            "actual": type(value).__name__,
            "message": f"Field '{path}' should be number, got {type(value).__name__}"
        })
    elif expected_type == 'integer' and not isinstance(value, int):
        errors.append({
            "type": "type_mismatch",
            "path": path,
            "expected": "integer",
            "actual": type(value).__name__,
            "message": f"Field '{path}' should be integer, got {type(value).__name__}"
        })
    elif expected_type == 'boolean' and not isinstance(value, bool):
        errors.append({
            "type": "type_mismatch",
            "path": path,
            "expected": "boolean",
            "actual": type(value).__name__,
            "message": f"Field '{path}' should be boolean, got {type(value).__name__}"
        })
    elif expected_type == 'object' and not isinstance(value, dict):
        errors.append({
            "type": "type_mismatch",
            "path": path,
            "expected": "object",
            "actual": type(value).__name__,
            "message": f"Field '{path}' should be object, got {type(value).__name__}"
        })
    elif expected_type == 'array' and not isinstance(value, list):
        errors.append({
            "type": "type_mismatch",
            "path": path,
            "expected": "array",
            "actual": type(value).__name__,
            "message": f"Field '{path}' should be array, got {type(value).__name__}"
        })

    return errors

def generate_sample_from_schema(schema):
    """Generate sample data from JSON Schema"""
    if schema.get('type') == 'object':
        sample = {}
        properties = schema.get('properties', {})
        for field, field_schema in properties.items():
            sample[field] = generate_sample_value(field_schema)
        return sample
    elif schema.get('type') == 'array':
        return []
    else:
        return generate_sample_value(schema)

def generate_sample_value(schema):
    """Generate a sample value based on schema type"""
    field_type = schema.get('type', 'string')

    if field_type == 'string':
        return schema.get('example', 'test-string')
    elif field_type == 'number':
        return schema.get('example', 123.45)
    elif field_type == 'integer':
        return schema.get('example', 123)
    elif field_type == 'boolean':
        return schema.get('example', True)
    elif field_type == 'object':
        return generate_sample_from_schema(schema)
    elif field_type == 'array':
        return []
    else:
        return None

def compare_schemas(old_schema, new_schema):
    """Compare two schemas and identify breaking changes"""
    breaking = []

    old_props = old_schema.get('properties', {})
    new_props = new_schema.get('properties', {})
    old_required = old_schema.get('required', [])
    new_required = new_schema.get('required', [])

    # Check for removed fields
    for field in old_props:
        if field not in new_props:
            breaking.append({
                "type": "field_removed",
                "field": field,
                "severity": "breaking",
                "message": f"Field '{field}' was removed"
            })

    # Check for type changes
    for field in old_props:
        if field in new_props:
            old_type = old_props[field].get('type')
            new_type = new_props[field].get('type')
            if old_type != new_type:
                breaking.append({
                    "type": "field_type_changed",
                    "field": field,
                    "old_type": old_type,
                    "new_type": new_type,
                    "severity": "breaking",
                    "message": f"Field '{field}' type changed from {old_type} to {new_type}"
                })

    # Check for newly required fields
    for field in new_required:
        if field not in old_required:
            breaking.append({
                "type": "field_made_required",
                "field": field,
                "severity": "breaking",
                "message": f"Field '{field}' is now required"
            })

    return {"breaking": breaking}

def find_json_differences(baseline, current, path=""):
    """Recursively find differences between two JSON objects"""
    differences = []

    if type(baseline) != type(current):
        differences.append({
            "path": path or "root",
            "baseline_value": baseline,
            "current_value": current,
            "change_type": "type_changed"
        })
        return differences

    if isinstance(baseline, dict):
        all_keys = set(baseline.keys()) | set(current.keys())
        for key in all_keys:
            new_path = f"{path}.{key}" if path else key

            if key not in baseline:
                differences.append({
                    "path": new_path,
                    "baseline_value": None,
                    "current_value": current[key],
                    "change_type": "added"
                })
            elif key not in current:
                differences.append({
                    "path": new_path,
                    "baseline_value": baseline[key],
                    "current_value": None,
                    "change_type": "removed"
                })
            else:
                differences.extend(find_json_differences(baseline[key], current[key], new_path))

    elif isinstance(baseline, list):
        if len(baseline) != len(current):
            differences.append({
                "path": path or "root",
                "baseline_value": f"array[{len(baseline)}]",
                "current_value": f"array[{len(current)}]",
                "change_type": "array_length_changed"
            })
        else:
            for i, (b_item, c_item) in enumerate(zip(baseline, current)):
                new_path = f"{path}[{i}]"
                differences.extend(find_json_differences(b_item, c_item, new_path))

    else:
        if baseline != current:
            differences.append({
                "path": path or "root",
                "baseline_value": baseline,
                "current_value": current,
                "change_type": "value_changed"
            })

    return differences

if __name__ == "__main__":
    import uvicorn
    import sys
    import io

    # Fix Unicode encoding issues on Windows
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

    print("Starting AI API Tester Backend with OAuth...")
    print(f"Database: {DATABASE_URL}")
    print(f"Google OAuth: {'Configured' if os.getenv('GOOGLE_CLIENT_ID') else 'Not Configured'}")
    print(f"GitHub OAuth: {'Configured' if os.getenv('GITHUB_CLIENT_ID') else 'Not Configured'}")
    print(f"GitHub Repo OAuth: {'Configured' if os.getenv('GITHUB_REPO_CLIENT_ID') else 'Not Configured'}")
    uvicorn.run("backend:app", host="0.0.0.0", port=8000, reload=True)