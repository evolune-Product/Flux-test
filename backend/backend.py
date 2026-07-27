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
import uuid
import time
import asyncio
import base64
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
from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Text, Integer, Float, ForeignKey, text
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.exc import IntegrityError
from sqlalchemy import JSON as _SA_JSON
from sqlalchemy.dialects.postgresql import JSONB as _PG_JSONB

# Cross-database JSON column: JSONB on PostgreSQL, generic JSON elsewhere (SQLite for desktop/local mode)
JSONB = _SA_JSON().with_variant(_PG_JSONB(), "postgresql")

# Import classes from your existing v3.py
from v3 import APITester, OpenAITestGenerator, generate_pdf_report

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Error monitoring (Sentry/GlitchTip)
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

# OpenAI for GraphQL testing
try:
    import openai
except ImportError:
    openai = None

load_dotenv()

# ============================================
# ERROR MONITORING (Sentry/GlitchTip)
# ============================================

# Initialize Sentry/GlitchTip if DSN is provided
if os.getenv("SENTRY_DSN"):
    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN"),
        environment=os.getenv("ENVIRONMENT", "development"),
        integrations=[
            StarletteIntegration(transaction_style="url"),
            FastApiIntegration(transaction_style="url"),
        ],
        # Performance monitoring - adjust based on traffic
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),  # 10% of requests
        # Error sampling - capture all errors in production
        sample_rate=1.0,
        # Release tracking (optional)
        release=os.getenv("APP_VERSION", "1.0.0"),
        # Send PII (Personally Identifiable Information) - disabled for privacy
        send_default_pii=False,
        # Before send hook - filter sensitive data
        before_send=lambda event, hint: event if os.getenv("ENVIRONMENT") == "production" else None,
    )
    print(f"✅ Sentry/GlitchTip initialized: {os.getenv('ENVIRONMENT')} environment")
else:
    print("⚠️  SENTRY_DSN not set - error monitoring disabled")

# Desktop/local mode flag: no login required, SQLite storage
FLASQO_LOCAL = os.getenv("FLASQO_LOCAL", "0") == "1"
FLASQO_DATA_DIR = os.getenv("FLASQO_DATA_DIR", os.path.expanduser("~/.flasqo"))

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# OpenAI API Key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=not FLASQO_LOCAL)

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

if FLASQO_LOCAL:
    os.makedirs(FLASQO_DATA_DIR, exist_ok=True)
    DATABASE_URL = f"sqlite:///{os.path.join(FLASQO_DATA_DIR, 'flasqo.db')}"
else:
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/evo_tfx")

# Render.com provides postgres:// but SQLAlchemy 1.4+ requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

_engine_kwargs = {"connect_args": {"check_same_thread": False}} if DATABASE_URL.startswith("sqlite") else {}

# Production database connection pooling configuration
if not DATABASE_URL.startswith("sqlite"):
    _engine_kwargs.update({
        "pool_size": int(os.getenv("DB_POOL_SIZE", "20")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "40")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "30")),
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "3600")),
        "pool_pre_ping": True,  # Verify connections before using them
        "echo": os.getenv("DB_ECHO", "False").lower() == "true"
    })

engine = create_engine(DATABASE_URL, **_engine_kwargs)
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

# Test Run Session model (history dashboard)
class TestRunSessionDB(Base):
    __tablename__ = "test_run_sessions"

    session_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey('users.user_id'), nullable=False)
    module = Column(String, nullable=False)   # functional, smoke, performance, etc.
    api_url = Column(String, nullable=False)
    total_tests = Column(Integer, nullable=False, default=0)
    passed = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)
    duration_ms = Column(Integer, nullable=True)
    overall_status = Column(String, nullable=False, default='PASS')  # PASS, FAIL
    share_token = Column(String, nullable=True, unique=True, index=True)
    result_json = Column(JSONB, nullable=True)
    executed_at = Column(DateTime, default=datetime.utcnow)

# Dashboard share token — one persistent token per user
class DashboardShareDB(Base):
    __tablename__ = "dashboard_shares"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(String, ForeignKey('users.user_id'), nullable=False, unique=True)
    token      = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# Saved Flow model (Visual Builder)
class FlowDB(Base):
    __tablename__ = "saved_flows"

    flow_id     = Column(String, primary_key=True)
    user_id     = Column(String, ForeignKey('users.user_id'), nullable=False)
    name        = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    base_url    = Column(String, nullable=False, default='')
    auth_config = Column(JSONB, nullable=True)
    nodes       = Column(JSONB, nullable=False, default=list)
    edges       = Column(JSONB, nullable=False, default=list)
    share_token = Column(String, nullable=True, unique=True, index=True)
    custom_slug = Column(String, nullable=True, unique=True, index=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Integration Testing Scenario model
class IntegrationScenarioDB(Base):
    __tablename__ = "integration_scenarios"
    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id     = Column(String, ForeignKey("users.user_id"))
    name        = Column(String, nullable=False)
    description = Column(String)
    services    = Column(JSONB)   # [{id, name, base_url, auth_config}]
    steps       = Column(JSONB)   # [{service_id, name, method, endpoint, body, params, headers, expected_status, extractions, assertions}]
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ╔══════════════════════════════════════════════════════════════╗
# ║  PROD-GATE MODULE — DB Models                               ║
# ║  To remove: delete this block + PROD-GATE routes below      ║
# ╚══════════════════════════════════════════════════════════════╝
# PROD-GATE: START
class ProdGateProfileDB(Base):
    __tablename__ = "prod_gate_profiles"
    profile_id   = Column(String, primary_key=True)
    user_id      = Column(String, ForeignKey("users.user_id"), nullable=False)
    name         = Column(String, nullable=False)
    base_url     = Column(String, nullable=False)
    auth_config  = Column(JSONB, default=dict)
    custom_headers = Column(JSONB, default=dict)
    load_config  = Column(JSONB, default=dict)
    endpoints    = Column(JSONB, default=list)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow)

class ProdGateSessionDB(Base):
    __tablename__ = "prod_gate_sessions"
    session_id    = Column(String, primary_key=True)
    user_id       = Column(String, ForeignKey("users.user_id"), nullable=False)
    profile_name  = Column(String, nullable=True)
    base_url      = Column(String, nullable=False)
    score         = Column(Integer, default=0)
    gate_decision = Column(String, default="UNKNOWN")
    suites_run    = Column(JSONB, default=list)
    result_json   = Column(JSONB, default=dict)
    executed_at   = Column(DateTime, default=datetime.utcnow)
# PROD-GATE: END (models)

Base.metadata.create_all(bind=engine)

# Migrations
try:
    from sqlalchemy import text as _text
    with engine.connect() as _conn:
        _conn.execute(_text("ALTER TABLE saved_flows ADD COLUMN IF NOT EXISTS share_token VARCHAR UNIQUE"))
        _conn.execute(_text("ALTER TABLE saved_flows ADD COLUMN IF NOT EXISTS custom_slug VARCHAR UNIQUE"))
        _conn.commit()
except Exception:
    pass

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

# Rate limiting setup
def get_client_ip(request: Request) -> str:
    """Get real client IP from X-Forwarded-For header (Nginx proxy) or fallback to remote_addr"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can be comma-separated list; take first IP
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

limiter = Limiter(key_func=get_client_ip)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# IMPORTANT: Add middlewares in reverse order (last added = first executed)
# CORS should be added AFTER SessionMiddleware

# Get allowed origins from environment variable or use defaults
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "https://flasqo.com",
    "https://www.flasqo.com",
    "https://flasqo.evolune.in",
    FRONTEND_URL
]
allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip()]

# Production: Use ALLOWED_ORIGINS from .env; Development: Allow all for local testing
_is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
_cors_origins = allowed_origins if _is_production else ["*"]

print("ENVIRONMENT:", os.getenv("ENVIRONMENT", "development"))
print("ALLOWED ORIGINS:", _cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers middleware (production only)
if os.getenv("ENABLE_SECURITY_HEADERS", "False").lower() == "true":
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if os.getenv("HTTPS_ONLY", "False").lower() == "true":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

# SessionMiddleware MUST be added last (so it executes first)
_https_only = os.getenv('HTTPS_ONLY', 'False').lower() == 'true'
_same_site = os.getenv('SESSION_SAME_SITE', 'lax' if not _https_only else 'none')
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    max_age=3600,
    same_site=_same_site,
    https_only=_https_only
)

# ============================================
# AUTO-DISCOVERY MODULE (Optional - fully isolated)
# ============================================
try:
    from auto_discovery import auto_discovery_router
    app.include_router(auto_discovery_router, prefix="/discovery", tags=["Auto-Discovery"])
except ImportError:
    pass  # Feature disabled if module missing

# ============================================
# VIBE TESTING MODULE (Optional - fully isolated)
# ============================================
try:
    from vibe_testing import vibe_testing_router
    app.include_router(vibe_testing_router, prefix="/vibe", tags=["Vibe-Testing"])
except ImportError:
    pass  # Feature disabled if module missing

# ============================================
# FULLSEND MODULE (Optional - fully isolated)
# Drop a URL → full-send all 5 test suites → GPT-4 unified report
# ============================================
try:
    from full_send import full_send_router
    app.include_router(full_send_router, prefix="/fullsend", tags=["FullSend"])
except ImportError:
    pass  # Feature disabled if module missing

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

LOCAL_USERNAME = "local"

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if FLASQO_LOCAL:
        return LOCAL_USERNAME
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return username
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

def ensure_local_user():
    """Create the built-in local user for desktop mode (no login)."""
    if not FLASQO_LOCAL:
        return
    db = SessionLocal()
    try:
        user = db.query(UserDB).filter(UserDB.username == LOCAL_USERNAME).first()
        if not user:
            user = UserDB(
                user_id="local",
                username=LOCAL_USERNAME,
                email="local@flasqo.desktop",
                full_name="Local Workspace",
                oauth_provider=None,
            )
            db.add(user)
            db.commit()
    finally:
        db.close()

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
# VISUAL FLOW BUILDER MODELS
# ============================================

class FlowNodeData(BaseModel):
    label: str
    method: str = "GET"
    endpoint: str = ""
    description: str = ""
    expected_status: int = 200
    body: Optional[Dict[str, Any]] = None
    params: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, Any]] = None
    extractions: Optional[List[Dict[str, str]]] = None  # [{name, jsonpath}]

class FlowNode(BaseModel):
    id: str
    data: FlowNodeData

class FlowEdge(BaseModel):
    id: str
    source: str
    target: str

class RunFlowRequest(BaseModel):
    base_url: str
    auth_config: Dict[str, Any] = {}
    timeout: int = 10
    nodes: List[FlowNode]
    edges: List[FlowEdge]

class SaveFlowRequest(BaseModel):
    name: str
    description: Optional[str] = None
    base_url: str = ''
    auth_config: Dict[str, Any] = {}
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

# ============================================
# INTEGRATION TESTING MODELS
# ============================================

class IntegrationService(BaseModel):
    id: str
    name: str
    base_url: str
    auth_config: Dict[str, Any] = {}

class IntegrationStep(BaseModel):
    id: str
    service_id: str
    name: str
    method: str = "GET"
    endpoint: str = ""
    body: Optional[Dict[str, Any]] = None
    params: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, Any]] = None
    expected_status: int = 200
    extractions: List[Dict[str, Any]] = []
    assertions: List[Dict[str, Any]] = []

class RunIntegrationRequest(BaseModel):
    services: List[IntegrationService]
    steps: List[IntegrationStep]
    timeout: int = 10

class SaveIntegrationScenarioRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    services: List[IntegrationService]
    steps: List[IntegrationStep]

class UpdateFlowRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_url: Optional[str] = None
    auth_config: Optional[Dict[str, Any]] = None
    nodes: Optional[List[Dict[str, Any]]] = None

    edges: Optional[List[Dict[str, Any]]] = None

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
@limiter.limit(os.getenv("RATE_LIMIT_AUTH_PER_MINUTE", "5") + "/minute")
async def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    """User login endpoint"""
    user = db.query(UserDB).filter(UserDB.username == credentials.username).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if not user.password_hash:
        raise HTTPException(status_code=401, detail="This account uses OAuth login. Please use Google or GitHub.")

    if not verify_password(credentials.password, user.password_hash):
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
async def google_login(request: Request, desktop: bool = False):
    """Initiate Google OAuth login. Pass ?desktop=1 from the Electron app."""
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    redirect_uri = f"{backend_url}/auth/google/callback"
    if desktop:
        request.session['oauth_desktop'] = True
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """Handle Google OAuth callback"""
    is_desktop = request.session.pop('oauth_desktop', False)

    def _redirect_success(access_token, user):
        params = f"token={access_token}&user_id={user.user_id}&username={user.username}&email={user.email}"
        target = f"flasqo://auth/callback?{params}" if is_desktop else f"{FRONTEND_URL}?{params}"
        return RedirectResponse(url=target)

    def _redirect_error(reason: str):
        target = f"flasqo://auth/callback?error={reason}" if is_desktop else f"{FRONTEND_URL}?error={reason}"
        return RedirectResponse(url=target)

    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get('userinfo')

        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to get user info from Google")

        email = user_info.get('email')
        name = user_info.get('name', email.split('@')[0])
        google_id = user_info.get('sub')

        user = get_or_create_oauth_user(
            db=db,
            email=email,
            username=name.replace(' ', '_').lower(),
            provider='google',
            oauth_id=google_id
        )
        access_token = create_access_token(data={"sub": user.username})
        return _redirect_success(access_token, user)

    except Exception as e:
        print(f"Google OAuth error: {str(e)}")
        return _redirect_error("google_auth_failed")

# ============================================
# GITHUB OAUTH ENDPOINTS
# ============================================

@app.get("/auth/github")
async def github_login(request: Request, desktop: bool = False):
    """Initiate GitHub OAuth login. Pass ?desktop=1 from the Electron app."""
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    redirect_uri = f"{backend_url}/auth/github/callback"
    if desktop:
        request.session['oauth_desktop'] = True
    return await oauth.github.authorize_redirect(request, redirect_uri)

@app.get("/auth/github/callback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    """Handle GitHub OAuth callback"""
    is_desktop = request.session.pop('oauth_desktop', False)

    def _redirect_success(access_token, user):
        params = f"token={access_token}&user_id={user.user_id}&username={user.username}&email={user.email}"
        target = f"flasqo://auth/callback?{params}" if is_desktop else f"{FRONTEND_URL}?{params}"
        return RedirectResponse(url=target)

    def _redirect_error(reason: str):
        target = f"flasqo://auth/callback?error={reason}" if is_desktop else f"{FRONTEND_URL}?error={reason}"
        return RedirectResponse(url=target)

    try:
        token = await oauth.github.authorize_access_token(request)

        async with httpx.AsyncClient() as client:
            headers = {'Authorization': f'token {token["access_token"]}'}

            user_response = await client.get('https://api.github.com/user', headers=headers)
            user_info = user_response.json()

            email = user_info.get('email')
            if not email:
                email_response = await client.get('https://api.github.com/user/emails', headers=headers)
                emails = email_response.json()
                primary_email = next((e for e in emails if e['primary']), None)
                email = primary_email['email'] if primary_email else None

            if not email:
                raise HTTPException(status_code=400, detail="Could not get email from GitHub")

        username  = user_info.get('login', email.split('@')[0])
        github_id = str(user_info.get('id'))

        user = get_or_create_oauth_user(
            db=db,
            email=email,
            username=username,
            provider='github',
            oauth_id=github_id
        )
        access_token = create_access_token(data={"sub": user.username})
        return _redirect_success(access_token, user)

    except Exception as e:
        print(f"GitHub OAuth error: {str(e)}")
        return _redirect_error("github_auth_failed")

# ============================================
# OTHER AUTH ENDPOINTS
# ============================================

@app.get("/auth/local")
async def local_login(db: Session = Depends(get_db)):
    """Desktop/local mode auto-login: returns the built-in local user and a token."""
    if not FLASQO_LOCAL:
        raise HTTPException(status_code=404, detail="Not available")
    ensure_local_user()
    user = db.query(UserDB).filter(UserDB.username == LOCAL_USERNAME).first()
    access_token = create_access_token(data={"sub": user.username})
    return {
        "token": access_token,
        "user": {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "oauth_provider": user.oauth_provider,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
    }

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

@app.get("/sentry-debug")
async def trigger_error():
    """Debug endpoint to test Sentry/GlitchTip integration - Remove in production after testing"""
    division_by_zero = 1 / 0
    return {"status": "This will never be returned"}

@app.get("/")
async def root():
    if FLASQO_LOCAL:
        from fastapi.responses import FileResponse
        _static = os.getenv("FLASQO_STATIC_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "static"))
        index = os.path.join(_static, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
    return {
        "message": "AI API Tester Backend",
        "version": "1.0.0",
        "database": "PostgreSQL",
        "oauth": "Google & GitHub enabled"
    }

@app.post("/generate-tests")
@limiter.limit(os.getenv("RATE_LIMIT_PER_MINUTE", "60") + "/minute")
async def generate_tests(request: Request, payload: GenerateTestsRequest):
    """Generate AI-powered test cases"""
    try:
        openai_api_key = os.getenv('OPENAI_API_KEY')

        if not openai_api_key:
            generator = OpenAITestGenerator("dummy_key")
            test_cases = generator._generate_fallback_tests(
                api_url=payload.api_url,
                sample_data=payload.sample_data,
                num=payload.num_tests,
                has_auth=payload.has_auth
            )

            return {
                "success": True,
                "test_cases": test_cases,
                "used_fallback": True,
                "count": len(test_cases),
                "message": f"Generated {len(test_cases)} test cases using fallback"
            }

        try:
            generator = OpenAITestGenerator(openai_api_key)

            test_cases, used_fallback = generator.generate_test_cases(
                api_url=payload.api_url,
                sample_data=payload.sample_data,
                num_tests=payload.num_tests,
                test_types=payload.test_types,
                has_auth=payload.has_auth,
                status_container=None
            )

            return {
                "success": True,
                "test_cases": test_cases,
                "used_fallback": used_fallback,
                "count": len(test_cases),
                "message": f"Generated {len(test_cases)} test cases" +
                          (" using fallback" if used_fallback else " using AI")
            }

        except Exception as ai_error:
            generator = OpenAITestGenerator(openai_api_key)
            test_cases = generator._generate_fallback_tests(
                api_url=payload.api_url,
                sample_data=payload.sample_data,
                num=payload.num_tests,
                has_auth=payload.has_auth
            )

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
@limiter.limit(os.getenv("RATE_LIMIT_PER_MINUTE", "60") + "/minute")
async def run_tests(request: Request, payload: RunTestsRequest):
    """Run test cases against the API with AI-powered root cause analysis"""
    try:
        # Initialize APITester with AI analysis enabled (Hybrid Option 3)
        tester = APITester(
            base_url=payload.base_url,
            auth_config=payload.auth_config,
            timeout=payload.timeout,
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            enable_ai_analysis=True  # Auto-analyze critical failures
        )

        for idx, test_case in enumerate(payload.test_cases, 1):
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
                'executed_at': record.executed_at.isoformat() + 'Z'
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
        db.execute(text("SELECT 1"))
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
async def connect_github_repo(request: Request, redirect_path: str = "/functional", username: str = Depends(verify_token), db: Session = Depends(get_db)):
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

        # Create new OAuth state entry - store redirect_path in provider field
        oauth_state = OAuthStateDB(
            state=state,
            username=username,
            provider=f'github_repo:{redirect_path}',  # Store redirect path
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(minutes=10)  # 10 minute expiry
        )

        db.add(oauth_state)
        db.commit()

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
        # Verify state from database - provider starts with 'github_repo'
        oauth_state = db.query(OAuthStateDB).filter(
            OAuthStateDB.state == state,
            OAuthStateDB.provider.like('github_repo%')
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

        # Extract redirect path from provider field (format: 'github_repo:/path')
        redirect_path = '/functional'  # default
        if ':' in oauth_state.provider:
            redirect_path = oauth_state.provider.split(':', 1)[1]

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

        # Redirect back to the original page
        return RedirectResponse(url=f"{FRONTEND_URL}{redirect_path}?github_connected=true")

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
    baseline_request: CreateBaselineRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Create a new regression baseline by capturing current API response"""
    import requests as http_requests  # Renamed to avoid collision

    print(f"📝 Creating baseline for user: {username}")
    print(f"   Baseline name: {baseline_request.baseline_name}")
    print(f"   API URL: {baseline_request.api_url}")
    print(f"   HTTP Method: {baseline_request.http_method}")

    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        print(f"❌ User not found: {username}")
        raise HTTPException(status_code=404, detail="User not found")

    try:
        # Make the API call to capture baseline response
        headers = baseline_request.custom_headers.copy() if baseline_request.custom_headers else {}
        if 'Content-Type' not in headers:
            headers['Content-Type'] = 'application/json'

        # Prepare request kwargs
        http_kwargs = {
            'method': baseline_request.http_method,
            'url': baseline_request.api_url,
            'headers': headers,
            'timeout': 30,
            'verify': True  # SSL verification
        }

        if baseline_request.request_body and baseline_request.http_method in ['POST', 'PUT', 'PATCH']:
            http_kwargs['json'] = baseline_request.request_body

        print(f"🌐 Making API call to: {baseline_request.api_url}")

        # Execute the HTTP request to capture baseline
        start_time = datetime.utcnow()
        api_response = http_requests.request(**http_kwargs)
        end_time = datetime.utcnow()
        response_time_ms = int((end_time - start_time).total_seconds() * 1000)

        print(f"✅ API call successful: Status {api_response.status_code}, Time {response_time_ms}ms")

        # Parse response body
        try:
            response_data = api_response.json()
        except Exception:
            response_data = {"raw_content": api_response.text[:5000] if api_response.text else ""}

        baseline_response = {
            "status_code": api_response.status_code,
            "response_time_ms": response_time_ms,
            "headers": dict(api_response.headers),
            "body": response_data
        }

        # Create baseline record
        baseline_id = secrets.token_urlsafe(16)
        print(f"💾 Creating database record with ID: {baseline_id}")

        new_baseline = RegressionBaselineDB(
            baseline_id=baseline_id,
            baseline_name=baseline_request.baseline_name,
            description=baseline_request.description,
            api_url=baseline_request.api_url,
            http_method=baseline_request.http_method,
            request_body=baseline_request.request_body,
            custom_headers=baseline_request.custom_headers,
            baseline_response=baseline_response,
            expected_status=baseline_request.expected_status,
            expected_response_time_ms=baseline_request.expected_response_time_ms,
            created_by=user.user_id,
            team_id=baseline_request.team_id,
            is_shared=baseline_request.is_shared,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(new_baseline)
        db.commit()
        db.refresh(new_baseline)

        print(f"✅ Baseline created successfully: {baseline_id}")

        return {
            "baseline_id": new_baseline.baseline_id,
            "baseline_name": new_baseline.baseline_name,
            "baseline_response": baseline_response,
            "message": "Baseline created successfully"
        }

    except http_requests.exceptions.Timeout:
        print(f"❌ API call timed out: {baseline_request.api_url}")
        raise HTTPException(status_code=408, detail=f"API call timed out after 30 seconds. The target API at {baseline_request.api_url} did not respond in time.")
    except http_requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error: {str(e)}")
        raise HTTPException(status_code=502, detail=f"Could not connect to {baseline_request.api_url}. Please check if the URL is correct and accessible.")
    except http_requests.exceptions.RequestException as e:
        print(f"❌ Request error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to capture baseline: {str(e)}")
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
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
    test_request: RunRegressionTestRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Run a regression test against a baseline"""
    import requests as http_requests  # Renamed to avoid collision

    print(f"🧪 Running regression test for user: {username}")
    print(f"   Baseline ID: {test_request.baseline_id}")

    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        print(f"❌ User not found: {username}")
        raise HTTPException(status_code=404, detail="User not found")

    # Get baseline
    baseline = db.query(RegressionBaselineDB).filter(
        RegressionBaselineDB.baseline_id == test_request.baseline_id
    ).first()

    if not baseline:
        print(f"❌ Baseline not found: {test_request.baseline_id}")
        raise HTTPException(status_code=404, detail="Baseline not found")

    # Check access
    if baseline.created_by != user.user_id and not baseline.is_shared:
        print(f"❌ Access denied for user {username} to baseline {test_request.baseline_id}")
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        # Make the API call
        headers = baseline.custom_headers.copy() if baseline.custom_headers else {}
        if 'Content-Type' not in headers:
            headers['Content-Type'] = 'application/json'

        http_kwargs = {
            'method': baseline.http_method,
            'url': baseline.api_url,
            'headers': headers,
            'timeout': test_request.timeout,
            'verify': True
        }

        if baseline.request_body and baseline.http_method in ['POST', 'PUT', 'PATCH']:
            http_kwargs['json'] = baseline.request_body

        print(f"🌐 Making API call to: {baseline.api_url}")

        # Execute request
        start_time = datetime.utcnow()
        api_response = http_requests.request(**http_kwargs)
        end_time = datetime.utcnow()
        response_time_ms = int((end_time - start_time).total_seconds() * 1000)

        print(f"✅ API response: Status {api_response.status_code}, Time {response_time_ms}ms")

        # Parse response
        try:
            response_data = api_response.json()
        except Exception:
            response_data = {"raw_content": api_response.text[:5000] if api_response.text else ""}

        test_response = {
            "status_code": api_response.status_code,
            "response_time_ms": response_time_ms,
            "headers": dict(api_response.headers),
            "body": response_data
        }

        # Compare with baseline
        differences = []
        passed = True
        error_message = None

        # Check status code
        if api_response.status_code != baseline.expected_status:
            differences.append({
                "type": "status_code",
                "expected": baseline.expected_status,
                "actual": api_response.status_code,
                "message": f"Status code mismatch: expected {baseline.expected_status}, got {api_response.status_code}"
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
            status_code=api_response.status_code,
            response_time_ms=response_time_ms,
            passed=passed,
            differences={"differences": differences} if differences else None,
            error_message=error_message,
            created_at=datetime.utcnow()
        )

        db.add(test_result)
        db.commit()
        db.refresh(test_result)

        print(f"✅ Test completed: {'PASS' if passed else 'FAIL'} ({len(differences)} differences)")

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

    except http_requests.exceptions.Timeout:
        print(f"❌ API call timed out: {baseline.api_url}")
        error_msg = f"Request timed out after {test_request.timeout} seconds"
        # Save failed test result
        result_id = secrets.token_urlsafe(16)
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
        raise HTTPException(status_code=408, detail=error_msg)

    except http_requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error: {str(e)}")
        error_msg = f"Could not connect to {baseline.api_url}"
        result_id = secrets.token_urlsafe(16)
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
        raise HTTPException(status_code=502, detail=error_msg)

    except http_requests.exceptions.RequestException as e:
        print(f"❌ Request error: {str(e)}")
        error_msg = f"Request failed: {str(e)}"
        result_id = secrets.token_urlsafe(16)
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
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
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

@app.patch("/contract/{contract_id}")
async def update_contract(
    contract_id: str,
    payload: dict,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    """Update an existing contract"""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    contract = db.query(ContractDB).filter(
        ContractDB.contract_id == contract_id,
        ContractDB.is_active == True
    ).first()

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    if contract.created_by != user.user_id:
        raise HTTPException(status_code=403, detail="Only the creator can edit this contract")

    # Update allowed fields
    updatable = ['contract_name', 'description', 'consumer_name', 'provider_name',
                 'version', 'request_method', 'request_path', 'response_status',
                 'response_body_schema']
    for field in updatable:
        if field in payload:
            setattr(contract, field, payload[field])

    contract.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(contract)

    return {
        "contract_id": contract.contract_id,
        "contract_name": contract.contract_name,
        "message": "Contract updated successfully"
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
            'timeout': float(request.timeout)
        }

        # Add request body if specified in contract
        if contract.request_body_schema and contract.request_method in ['POST', 'PUT', 'PATCH']:
            # Generate sample data from schema
            sample_body = generate_sample_from_schema(contract.request_body_schema)
            request_kwargs['json'] = sample_body

        # Execute request using async httpx (already imported) to avoid blocking the event loop
        start_time = datetime.utcnow()
        async with httpx.AsyncClient(timeout=float(request.timeout), follow_redirects=True) as client:
            response = await client.request(**request_kwargs)
        end_time = datetime.utcnow()
        response_time_ms = int((end_time - start_time).total_seconds() * 1000)

        # Parse response
        try:
            response_data = response.json()
        except Exception:
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

    except (httpx.RequestError, httpx.HTTPStatusError) as e:
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
    try:
        body = await request.json()

        if body is None:
            raise HTTPException(status_code=400, detail="Request body is required")

        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")

        endpoint = body.get('endpoint')
        auth_config = body.get('auth_config', {})

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
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch schema: HTTP {response.status_code}"
            )

        try:
            data = response.json()
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail="GraphQL endpoint returned invalid JSON"
            )

        if 'errors' in data:
            raise HTTPException(
                status_code=400,
                detail=f"GraphQL errors: {data['errors']}"
            )

        if 'data' not in data:
            raise HTTPException(
                status_code=400,
                detail="GraphQL response is missing 'data' field. The endpoint may not support introspection."
            )

        schema_data = data.get('data', {}).get('__schema', {})

        if not schema_data:
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
    try:
        body = await request.json()

        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")

        nl_description = body.get('description', '')
        schema = body.get('schema', {})

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

        # Call OpenAI
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a GraphQL query expert. Generate only valid GraphQL queries without any additional text or markdown formatting."},
                {"role": "user", "content": ai_prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )

        generated_query = response.choices[0].message.content.strip()

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
                "generated_by": "Flasqo GraphQL Testing"
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

# ============================================
# TEST HISTORY / RUN SESSION ENDPOINTS
# ============================================

@app.post("/history/runs/save")
async def save_history_run(
    data: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save a complete test run session to history.
    Body: { module, api_url, total_tests, passed, failed, duration_ms, overall_status }
    """
    try:
        user = db.query(UserDB).filter(UserDB.username == current_user['username']).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        session_id = secrets.token_urlsafe(16)
        session = TestRunSessionDB(
            session_id=session_id,
            user_id=user.user_id,
            module=data.get('module', 'unknown'),
            api_url=data.get('api_url', ''),
            total_tests=data.get('total_tests', 0),
            passed=data.get('passed', 0),
            failed=data.get('failed', 0),
            duration_ms=data.get('duration_ms'),
            overall_status=data.get('overall_status', 'PASS'),
            result_json=data.get('result_json'),
            executed_at=datetime.utcnow()
        )
        db.add(session)
        db.commit()
        return {'success': True, 'session_id': session_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history/runs")
async def get_history_runs(
    module: str = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return paginated test run history for the current user.
    Query params: module (filter), page, limit (max 50)
    """
    try:
        user = db.query(UserDB).filter(UserDB.username == current_user['username']).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        limit = min(limit, 50)
        offset = (max(page, 1) - 1) * limit

        query = db.query(TestRunSessionDB).filter(TestRunSessionDB.user_id == user.user_id)
        if module:
            query = query.filter(TestRunSessionDB.module == module)

        total = query.count()
        runs = query.order_by(TestRunSessionDB.executed_at.desc()).offset(offset).limit(limit).all()

        return {
            'success': True,
            'total': total,
            'page': page,
            'limit': limit,
            'runs': [
                {
                    'session_id': r.session_id,
                    'module': r.module,
                    'api_url': r.api_url,
                    'total_tests': r.total_tests,
                    'passed': r.passed,
                    'failed': r.failed,
                    'duration_ms': r.duration_ms,
                    'overall_status': r.overall_status,
                    'share_token': r.share_token,
                    'result_json': r.result_json,
                    'executed_at': r.executed_at.isoformat() + 'Z'
                }
                for r in runs
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history/stats")
async def get_history_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Return summary stats for the history dashboard:
    - total_runs, total_passed, total_failed, pass_rate
    - modules breakdown (count per module)
    - daily_trend: last 7 days [{date, passed, failed}]
    """
    try:
        user = db.query(UserDB).filter(UserDB.username == current_user['username']).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        all_runs = db.query(TestRunSessionDB).filter(TestRunSessionDB.user_id == user.user_id).all()

        total_runs = len(all_runs)
        total_passed = sum(r.passed for r in all_runs)
        total_failed = sum(r.failed for r in all_runs)
        total_tests = total_passed + total_failed
        pass_rate = round((total_passed / total_tests * 100), 1) if total_tests > 0 else 0

        # Module breakdown
        modules: dict = {}
        for r in all_runs:
            modules[r.module] = modules.get(r.module, 0) + 1

        # 7-day daily trend
        from collections import defaultdict
        daily: dict = defaultdict(lambda: {'passed': 0, 'failed': 0})
        cutoff = datetime.utcnow() - timedelta(days=7)
        for r in all_runs:
            if r.executed_at >= cutoff:
                day = r.executed_at.strftime('%Y-%m-%d')
                daily[day]['passed'] += r.passed
                daily[day]['failed'] += r.failed

        # Fill in all 7 days
        trend = []
        for i in range(6, -1, -1):
            day = (datetime.utcnow() - timedelta(days=i)).strftime('%Y-%m-%d')
            trend.append({
                'date': day,
                'passed': daily[day]['passed'],
                'failed': daily[day]['failed']
            })

        return {
            'success': True,
            'total_runs': total_runs,
            'total_passed': total_passed,
            'total_failed': total_failed,
            'pass_rate': pass_rate,
            'modules': modules,
            'daily_trend': trend
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/history/runs/{session_id}/share")
async def share_test_run(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate (or return existing) a public share token for a test run.
    Only the owner of the run can generate a share link.
    Returns: { share_token }
    """
    try:
        user = db.query(UserDB).filter(UserDB.username == current_user['username']).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        run = db.query(TestRunSessionDB).filter(
            TestRunSessionDB.session_id == session_id,
            TestRunSessionDB.user_id == user.user_id
        ).first()

        if not run:
            raise HTTPException(status_code=404, detail="Run not found")

        # Re-use existing token if already generated
        if not run.share_token:
            import uuid
            run.share_token = uuid.uuid4().hex
            db.commit()
            db.refresh(run)

        return {'success': True, 'share_token': run.share_token}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/report/{share_token}")
async def get_shared_report(
    share_token: str,
    db: Session = Depends(get_db)
):
    """
    Public endpoint — no authentication required.
    Returns the test run data for a given share token.
    """
    run = db.query(TestRunSessionDB).filter(
        TestRunSessionDB.share_token == share_token
    ).first()

    if not run:
        raise HTTPException(status_code=404, detail="Report not found or link has expired")

    pass_rate = round((run.passed / run.total_tests * 100), 1) if run.total_tests > 0 else 0

    return {
        'success': True,
        'run': {
            'session_id': run.session_id,
            'module': run.module,
            'api_url': run.api_url,
            'total_tests': run.total_tests,
            'passed': run.passed,
            'failed': run.failed,
            'duration_ms': run.duration_ms,
            'overall_status': run.overall_status,
            'pass_rate': pass_rate,
            'result_json': run.result_json,
            'executed_at': run.executed_at.isoformat() + 'Z'
        }
    }


# ── Dashboard share endpoints ─────────────────────────────────────

@app.post("/dashboard/share")
async def create_dashboard_share(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create (or return existing) a persistent public dashboard token for the
    logged-in user.  One token per user — idempotent.
    """
    try:
        user = db.query(UserDB).filter(UserDB.username == current_user['username']).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        existing = db.query(DashboardShareDB).filter(
            DashboardShareDB.user_id == user.user_id
        ).first()

        if existing:
            return {'success': True, 'token': existing.token}

        token = secrets.token_urlsafe(20)
        share = DashboardShareDB(user_id=user.user_id, token=token)
        db.add(share)
        db.commit()
        return {'success': True, 'token': token}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard/{token}")
async def get_shared_dashboard(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Public endpoint — no authentication required.
    Returns full dashboard data (stats + recent 20 runs) for the given token.
    """
    try:
        share = db.query(DashboardShareDB).filter(
            DashboardShareDB.token == token
        ).first()
        if not share:
            raise HTTPException(status_code=404, detail="Dashboard not found")

        user = db.query(UserDB).filter(UserDB.user_id == share.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        all_runs = db.query(TestRunSessionDB).filter(
            TestRunSessionDB.user_id == share.user_id
        ).all()

        total_runs   = len(all_runs)
        total_passed = sum(r.passed for r in all_runs)
        total_failed = sum(r.failed for r in all_runs)
        total_tests  = total_passed + total_failed
        pass_rate    = round((total_passed / total_tests * 100), 1) if total_tests > 0 else 0

        # Module breakdown
        modules: dict = {}
        for r in all_runs:
            modules[r.module] = modules.get(r.module, 0) + 1

        # 7-day daily trend
        from collections import defaultdict
        daily: dict = defaultdict(lambda: {'passed': 0, 'failed': 0})
        cutoff = datetime.utcnow() - timedelta(days=7)
        for r in all_runs:
            if r.executed_at >= cutoff:
                day = r.executed_at.strftime('%Y-%m-%d')
                daily[day]['passed'] += r.passed
                daily[day]['failed'] += r.failed

        trend = []
        for i in range(6, -1, -1):
            day = (datetime.utcnow() - timedelta(days=i)).strftime('%Y-%m-%d')
            trend.append({'date': day, 'passed': daily[day]['passed'], 'failed': daily[day]['failed']})

        # Recent 20 runs
        recent = (
            db.query(TestRunSessionDB)
            .filter(TestRunSessionDB.user_id == share.user_id)
            .order_by(TestRunSessionDB.executed_at.desc())
            .limit(20)
            .all()
        )
        recent_runs = [
            {
                'session_id':     r.session_id,
                'module':         r.module,
                'api_url':        r.api_url,
                'total_tests':    r.total_tests,
                'passed':         r.passed,
                'failed':         r.failed,
                'overall_status': r.overall_status,
                'executed_at':    r.executed_at.isoformat() + 'Z',
            }
            for r in recent
        ]

        return {
            'success':     True,
            'username':    user.username,
            'total_runs':  total_runs,
            'total_passed': total_passed,
            'total_failed': total_failed,
            'pass_rate':   pass_rate,
            'modules':     modules,
            'daily_trend': trend,
            'recent_runs': recent_runs,
            'refreshed_at': datetime.utcnow().isoformat() + 'Z',
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# VISUAL FLOW BUILDER — HELPER FUNCTIONS
# ============================================

def _topological_sort(nodes: List[FlowNode], edges: List[FlowEdge]) -> List[str]:
    """Kahn's BFS topological sort. Returns node IDs in execution order.
    Raises ValueError if a cycle is detected."""
    from collections import deque

    node_ids = {n.id for n in nodes}
    in_degree: Dict[str, int] = {nid: 0 for nid in node_ids}
    adjacency: Dict[str, List[str]] = {nid: [] for nid in node_ids}

    for edge in edges:
        if edge.source in node_ids and edge.target in node_ids:
            adjacency[edge.source].append(edge.target)
            in_degree[edge.target] += 1

    queue = deque(nid for nid in node_ids if in_degree[nid] == 0)
    order: List[str] = []

    while queue:
        current = queue.popleft()
        order.append(current)
        for neighbor in adjacency[current]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(order) != len(node_ids):
        raise ValueError("Flow graph contains a cycle — execution aborted.")

    return order


def _substitute_variables(value: Any, var_store: Dict[str, Any]) -> Any:
    """Recursively replace {{varName}} tokens in strings, dicts, and lists."""
    import re
    if isinstance(value, str):
        def replacer(match):
            key = match.group(1).strip()
            return str(var_store.get(key, match.group(0)))
        return re.sub(r'\{\{(\w+)\}\}', replacer, value)
    elif isinstance(value, dict):
        return {k: _substitute_variables(v, var_store) for k, v in value.items()}
    elif isinstance(value, list):
        return [_substitute_variables(item, var_store) for item in value]
    return value


def _find_unresolved_vars(value: Any) -> List[str]:
    """Return list of {{varName}} tokens that survived substitution (i.e. were not in var_store)."""
    import re
    found: List[str] = []
    if isinstance(value, str):
        found.extend(re.findall(r'\{\{(\w+)\}\}', value))
    elif isinstance(value, dict):
        for v in value.values():
            found.extend(_find_unresolved_vars(v))
    elif isinstance(value, list):
        for item in value:
            found.extend(_find_unresolved_vars(item))
    return found


def _resolve_jsonpath(data: Any, path: str) -> Optional[str]:
    """Minimal $.key.nested[0].field JSONPath resolver. Returns str or None."""
    import re
    if not path.startswith('$'):
        return None
    # Remove leading '$'
    segments_raw = path[1:]
    # Split by '.' but keep array indices
    parts = re.split(r'\.(?![^\[]*\])', segments_raw)
    current = data
    for part in parts:
        if not part:
            continue
        # Bare array index notation: [0]
        bare_arr_match = re.match(r'^\[(\d+)\]$', part)
        if bare_arr_match:
            idx = int(bare_arr_match.group(1))
            if isinstance(current, list) and idx < len(current):
                current = current[idx]
            else:
                return None
        # Array index with key notation: key[0]
        elif re.match(r'^(\w+)\[(\d+)\]$', part):
            arr_match = re.match(r'^(\w+)\[(\d+)\]$', part)
            key, idx = arr_match.group(1), int(arr_match.group(2))
            if isinstance(current, dict):
                current = current.get(key)
            if isinstance(current, list):
                current = current[idx] if idx < len(current) else None
        elif part.isdigit():
            idx = int(part)
            if isinstance(current, list) and idx < len(current):
                current = current[idx]
            else:
                return None
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None
        if current is None:
            return None
    if current is None:
        return None
    return str(current)


# ============================================
# FLOW SAVE / LOAD (Visual Builder persistence)
# ============================================

@app.post("/flows")
async def save_flow(
    request: SaveFlowRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Save a new named flow for the authenticated user."""
    import uuid
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    flow = FlowDB(
        flow_id=str(uuid.uuid4()),
        user_id=user.user_id,
        name=request.name.strip(),
        description=request.description,
        base_url=request.base_url,
        auth_config=request.auth_config,
        nodes=request.nodes,
        edges=request.edges,
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return {
        "flow_id": flow.flow_id,
        "name": flow.name,
        "created_at": flow.created_at.isoformat() + "Z",
    }


@app.get("/flows")
async def list_flows(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """List all saved flows for the authenticated user (metadata only)."""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    flows = (
        db.query(FlowDB)
        .filter(FlowDB.user_id == user.user_id)
        .order_by(FlowDB.updated_at.desc())
        .all()
    )
    return {
        "flows": [
            {
                "flow_id": f.flow_id,
                "name": f.name,
                "description": f.description,
                "base_url": f.base_url,
                "node_count": len(f.nodes) if f.nodes else 0,
                "created_at": f.created_at.isoformat() + "Z",
                "updated_at": f.updated_at.isoformat() + "Z",
            }
            for f in flows
        ]
    }


@app.get("/flows/{flow_id}")
async def get_flow(
    flow_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Load a specific saved flow (full data)."""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    flow = db.query(FlowDB).filter(FlowDB.flow_id == flow_id, FlowDB.user_id == user.user_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    return {
        "flow_id": flow.flow_id,
        "name": flow.name,
        "description": flow.description,
        "base_url": flow.base_url,
        "auth_config": flow.auth_config or {},
        "nodes": flow.nodes or [],
        "edges": flow.edges or [],
        "created_at": flow.created_at.isoformat() + "Z",
        "updated_at": flow.updated_at.isoformat() + "Z",
    }


@app.put("/flows/{flow_id}")
async def update_flow(
    flow_id: str,
    request: UpdateFlowRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Update an existing saved flow."""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    flow = db.query(FlowDB).filter(FlowDB.flow_id == flow_id, FlowDB.user_id == user.user_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    if request.name is not None:
        flow.name = request.name.strip()
    if request.description is not None:
        flow.description = request.description
    if request.base_url is not None:
        flow.base_url = request.base_url
    if request.auth_config is not None:
        flow.auth_config = request.auth_config
    if request.nodes is not None:
        flow.nodes = request.nodes
    if request.edges is not None:
        flow.edges = request.edges
    flow.updated_at = datetime.utcnow()
    db.commit()
    return {"flow_id": flow.flow_id, "name": flow.name, "updated_at": flow.updated_at.isoformat() + "Z"}


@app.delete("/flows/{flow_id}")
async def delete_flow(
    flow_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Delete a saved flow."""
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    flow = db.query(FlowDB).filter(FlowDB.flow_id == flow_id, FlowDB.user_id == user.user_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    db.delete(flow)
    db.commit()
    return {"deleted": True}


class ShareFlowRequest(BaseModel):
    custom_slug: Optional[str] = None  # None = auto-generate from flow name, "" = clear slug

@app.post("/flows/{flow_id}/share")
async def generate_share_token(
    flow_id: str,
    request: ShareFlowRequest = None,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Generate share token. Uses custom_slug if provided, else auto-generates from flow name."""
    import re
    if request is None:
        request = ShareFlowRequest()
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    flow = db.query(FlowDB).filter(FlowDB.flow_id == flow_id, FlowDB.user_id == user.user_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    if not flow.share_token:
        flow.share_token = secrets.token_urlsafe(16)

    if request.custom_slug is not None:
        # User provided a slug — validate and apply it
        slug = request.custom_slug.strip()
        if slug:
            if not re.match(r'^[a-zA-Z0-9_-]{1,60}$', slug):
                raise HTTPException(status_code=400, detail="Slug must be 1–60 chars: letters, numbers, hyphens, underscores only.")
            conflict = db.query(FlowDB).filter(FlowDB.custom_slug == slug, FlowDB.flow_id != flow_id).first()
            if conflict:
                raise HTTPException(status_code=409, detail="That URL is already taken. Try a different name.")
            flow.custom_slug = slug
        else:
            flow.custom_slug = None
    elif not flow.custom_slug:
        # Auto-generate from flow name
        slug = flow.name.lower()
        slug = re.sub(r'[^a-z0-9]+', '-', slug)
        slug = slug.strip('-')[:60]
        if slug and db.query(FlowDB).filter(FlowDB.custom_slug == slug, FlowDB.flow_id != flow_id).first():
            slug = slug[:54] + '-' + flow.flow_id[:5]
        if slug:
            flow.custom_slug = slug

    db.commit()
    return {"share_token": flow.share_token, "custom_slug": flow.custom_slug}


@app.get("/flows/shared/{token}")
async def get_shared_flow(token: str, db: Session = Depends(get_db)):
    """Public endpoint — return flow structure by share token or custom slug (no auth required)."""
    flow = db.query(FlowDB).filter(
        (FlowDB.share_token == token) | (FlowDB.custom_slug == token)
    ).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Shared flow not found or link has expired")
    owner = db.query(UserDB).filter(UserDB.user_id == flow.user_id).first()
    return {
        "flow_id": flow.flow_id,
        "name": flow.name,
        "description": flow.description,
        "node_count": len(flow.nodes) if flow.nodes else 0,
        "nodes": flow.nodes or [],
        "edges": flow.edges or [],
        "owner": owner.username if owner else "unknown",
        "created_at": flow.created_at.isoformat() + "Z",
        "updated_at": flow.updated_at.isoformat() + "Z",
    }


@app.post("/flows/shared/{token}/fork")
async def fork_shared_flow(
    token: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Fork a shared flow into the authenticated user's workspace."""
    import uuid
    source = db.query(FlowDB).filter(
        (FlowDB.share_token == token) | (FlowDB.custom_slug == token)
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Shared flow not found")
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    forked = FlowDB(
        flow_id=str(uuid.uuid4()),
        user_id=user.user_id,
        name=f"{source.name} (forked)",
        description=source.description,
        base_url=source.base_url,
        auth_config=source.auth_config,
        nodes=source.nodes,
        edges=source.edges,
    )
    db.add(forked)
    db.commit()
    db.refresh(forked)
    return {
        "flow_id": forked.flow_id,
        "name": forked.name,
        "message": "Flow forked into your workspace successfully",
    }


# ============================================
# POST /run-flow — Execute a Visual Flow
# ============================================

@app.post("/run-flow")
async def run_flow(request: RunFlowRequest, username: str = Depends(verify_token)):
    """Execute a visual flow: topological sort → variable substitution → HTTP requests → extraction."""
    import requests as req_lib

    try:
        # 1. Topological sort
        try:
            execution_order = _topological_sort(request.nodes, request.edges)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        # Build node lookup map
        node_map = {n.id: n for n in request.nodes}

        # 2. Build auth headers from auth_config
        auth_headers: Dict[str, str] = {}
        auth_cfg = request.auth_config or {}
        auth_type = auth_cfg.get('type', 'none')

        if auth_type == 'bearer':
            token_val = auth_cfg.get('token', '')
            if token_val:
                auth_headers['Authorization'] = f'Bearer {token_val}'
        elif auth_type == 'basic':
            import base64
            uname = auth_cfg.get('username', '')
            passwd = auth_cfg.get('password', '')
            if uname:
                creds = base64.b64encode(f'{uname}:{passwd}'.encode()).decode()
                auth_headers['Authorization'] = f'Basic {creds}'
        elif auth_type == 'api_key':
            header_name = auth_cfg.get('header_name', 'X-API-Key')
            api_key_val = auth_cfg.get('api_key', '')
            if api_key_val:
                auth_headers[header_name] = api_key_val

        # 3. Execute nodes in order
        var_store: Dict[str, Any] = {}
        results = []
        session = req_lib.Session()
        base_url = request.base_url.rstrip('/')

        for node_id in execution_order:
            node = node_map.get(node_id)
            if not node:
                continue

            d = node.data

            # Substitute variables into endpoint, body, params, headers
            endpoint = _substitute_variables((d.endpoint or '').strip(), var_store)
            body = _substitute_variables(d.body, var_store) if d.body else None
            params = _substitute_variables(d.params, var_store) if d.params else None
            node_headers = _substitute_variables(d.headers or {}, var_store)

            # Merge auth headers (node headers take precedence)
            merged_headers = {**auth_headers, **node_headers}

            # Guard: fail immediately if any {{var}} was not resolved
            unresolved = list(set(
                _find_unresolved_vars(endpoint) +
                _find_unresolved_vars(body) +
                _find_unresolved_vars(node_headers)
            ))
            if unresolved:
                var_list = ', '.join(f'{{{{{v}}}}}' for v in unresolved)
                results.append({
                    'node_id': node_id,
                    'test': f'{d.method} {endpoint} — {d.label}',
                    'status': 'FAIL',
                    'details': f'Unresolved variable(s): {var_list}. Connect this node to the node that extracts these variables first.',
                    'response_data': None,
                    'extracted_vars': {},
                })
                continue

            url = base_url + ('/' + endpoint.lstrip('/') if endpoint else '')

            start_time = time.time()
            actual_status = 0
            response_body: Any = None
            error_msg: Optional[str] = None

            try:
                req_kwargs: Dict[str, Any] = {
                    'method': d.method.upper(),
                    'url': url,
                    'headers': merged_headers,
                    'timeout': request.timeout,
                }
                if body is not None:
                    req_kwargs['json'] = body
                if params is not None:
                    req_kwargs['params'] = params
                resp = session.request(**req_kwargs)
                elapsed = round(time.time() - start_time, 3)
                actual_status = resp.status_code
                try:
                    response_body = resp.json()
                except Exception:
                    response_body = resp.text
            except req_lib.exceptions.Timeout:
                elapsed = round(time.time() - start_time, 3)
                error_msg = f'Request timed out after {request.timeout}s'
            except Exception as exc:
                elapsed = round(time.time() - start_time, 3)
                error_msg = str(exc)

            # 4. Determine PASS/FAIL
            if error_msg:
                status = 'FAIL'
                details = f'Error: {error_msg}'
            elif actual_status == d.expected_status:
                status = 'PASS'
                details = f'Status: {actual_status} (expected {d.expected_status}), Time: {elapsed}s'
            else:
                status = 'FAIL'
                details = f'Status: {actual_status} (expected {d.expected_status}), Time: {elapsed}s'

            # 5. Run extractions
            extracted_vars: Dict[str, Any] = {}
            if status == 'PASS' and d.extractions and isinstance(response_body, (dict, list)):
                for extraction in d.extractions:
                    var_name = extraction.get('name', '').strip()
                    jsonpath = extraction.get('jsonpath', '').strip()
                    if var_name and jsonpath:
                        value = _resolve_jsonpath(response_body, jsonpath)
                        if value is not None:
                            var_store[var_name] = value
                            extracted_vars[var_name] = value

            results.append({
                'node_id': node_id,
                'test': f'{d.method} {endpoint} — {d.label}',
                'status': status,
                'details': details,
                'response_data': {
                    'status': actual_status,
                    'time': elapsed,
                    'body': response_body,
                },
                'extracted_vars': extracted_vars,
            })

        # 6. Compute summary
        total = len(results)
        passed = sum(1 for r in results if r['status'] == 'PASS')
        failed = total - passed
        pass_rate = round((passed / total * 100) if total > 0 else 0, 1)

        return {
            'success': True,
            'summary': {
                'total': total,
                'passed': passed,
                'failed': failed,
                'pass_rate': pass_rate,
            },
            'results': results,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# INTEGRATION TESTING ROUTES
# ============================================

@app.post("/run-integration-tests")
async def run_integration_tests(request: RunIntegrationRequest):
    """Execute a multi-service integration scenario."""
    import requests as req_lib

    try:
        # Build service map
        service_map = {svc.id: svc for svc in request.services}
        var_store: Dict[str, Any] = {}
        results = []
        session = req_lib.Session()

        for step in request.steps:
            svc = service_map.get(step.service_id)
            if not svc:
                results.append({
                    'step_id': step.id,
                    'step_name': step.name,
                    'service_id': step.service_id,
                    'service_name': 'Unknown',
                    'status': 'FAIL',
                    'details': f'Service {step.service_id} not found in registry.',
                    'extracted_vars': {},
                    'ai_analysis': None,
                })
                continue

            # Build auth headers for this service
            auth_headers: Dict[str, str] = {}
            auth_cfg = svc.auth_config or {}
            auth_type = auth_cfg.get('type', 'none')
            if auth_type == 'bearer':
                token_val = auth_cfg.get('token', '')
                if token_val:
                    auth_headers['Authorization'] = f'Bearer {token_val}'
            elif auth_type == 'basic':
                import base64
                uname = auth_cfg.get('username', '')
                passwd = auth_cfg.get('password', '')
                if uname:
                    creds = base64.b64encode(f'{uname}:{passwd}'.encode()).decode()
                    auth_headers['Authorization'] = f'Basic {creds}'
            elif auth_type == 'api_key':
                header_name = auth_cfg.get('header_name', 'X-API-Key')
                api_key_val = auth_cfg.get('api_key', '')
                if api_key_val:
                    auth_headers[header_name] = api_key_val

            # Substitute {{vars}} in endpoint, body, params, headers
            endpoint = _substitute_variables((step.endpoint or '').strip(), var_store)
            body = _substitute_variables(step.body, var_store) if step.body else None
            params = _substitute_variables(step.params, var_store) if step.params else None
            step_headers = _substitute_variables(step.headers or {}, var_store)
            merged_headers = {**auth_headers, **step_headers}

            base_url = svc.base_url.strip().rstrip('/')
            url = base_url + ('/' + endpoint.lstrip('/') if endpoint else '')

            start_time = time.time()
            actual_status = 0
            response_body: Any = None
            error_msg: Optional[str] = None

            try:
                req_kwargs: Dict[str, Any] = {
                    'method': step.method.upper(),
                    'url': url,
                    'headers': merged_headers,
                    'timeout': request.timeout,
                }
                if body is not None:
                    req_kwargs['json'] = body
                if params is not None:
                    req_kwargs['params'] = params
                resp = session.request(**req_kwargs)
                elapsed = round(time.time() - start_time, 3)
                actual_status = resp.status_code
                try:
                    response_body = resp.json()
                except Exception:
                    response_body = resp.text
            except req_lib.exceptions.Timeout:
                elapsed = round(time.time() - start_time, 3)
                error_msg = f'Request timed out after {request.timeout}s'
            except Exception as exc:
                elapsed = round(time.time() - start_time, 3)
                error_msg = str(exc)

            # Determine PASS/FAIL
            if error_msg:
                status = 'FAIL'
                details = f'Error: {error_msg}'
            elif actual_status == step.expected_status:
                status = 'PASS'
                details = f'Status: {actual_status} (expected {step.expected_status}), Time: {elapsed}s'
            else:
                status = 'FAIL'
                details = f'Status: {actual_status} (expected {step.expected_status}), Time: {elapsed}s'

            # Run assertions
            assertion_failures = []
            for assertion in (step.assertions or []):
                a_type = assertion.get('type', '')
                if a_type == 'status':
                    op = assertion.get('operator', 'eq')
                    expected_val = assertion.get('value')
                    if op == 'eq' and actual_status != expected_val:
                        assertion_failures.append(f'Status assertion failed: {actual_status} != {expected_val}')
                elif a_type == 'body_field' and isinstance(response_body, (dict, list)):
                    field = assertion.get('field', '')
                    op = assertion.get('operator', 'eq')
                    expected_val = assertion.get('value')
                    actual_val = _resolve_jsonpath(response_body, field)
                    if op == 'eq' and str(actual_val) != str(expected_val):
                        assertion_failures.append(f'Body assertion failed: {field} = {actual_val}, expected {expected_val}')
                    elif op == 'contains' and expected_val not in str(actual_val or ''):
                        assertion_failures.append(f'Body assertion failed: {field} does not contain {expected_val}')
                    elif op == 'exists' and actual_val is None:
                        assertion_failures.append(f'Body assertion failed: {field} does not exist')

            if assertion_failures:
                status = 'FAIL'
                details += ' | Assertions: ' + '; '.join(assertion_failures)

            # Run extractions on PASS
            extracted_vars: Dict[str, Any] = {}
            if status == 'PASS' and step.extractions and isinstance(response_body, (dict, list)):
                for extraction in step.extractions:
                    var_name = extraction.get('name', '').strip()
                    jsonpath = extraction.get('jsonpath', '').strip()
                    if var_name and jsonpath:
                        value = _resolve_jsonpath(response_body, jsonpath)
                        if value is not None:
                            var_store[var_name] = value
                            extracted_vars[var_name] = value

            # AI analysis on failure (if OpenAI key available)
            ai_analysis = None
            if status == 'FAIL' and OPENAI_API_KEY and openai:
                try:
                    client = openai.OpenAI(api_key=OPENAI_API_KEY)
                    ai_resp = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{
                            "role": "user",
                            "content": (
                                f"An integration test step failed.\n"
                                f"Service: {svc.name} ({svc.base_url})\n"
                                f"Step: {step.name}\n"
                                f"Request: {step.method} {url}\n"
                                f"Details: {details}\n"
                                f"Response body: {str(response_body)[:500]}\n\n"
                                "Provide a brief explanation of the likely cause and a suggested fix in 2-3 sentences."
                            )
                        }],
                        max_tokens=200
                    )
                    ai_analysis = ai_resp.choices[0].message.content
                except Exception:
                    pass

            results.append({
                'step_id': step.id,
                'step_name': step.name,
                'service_id': svc.id,
                'service_name': svc.name,
                'status': status,
                'details': details,
                'extracted_vars': extracted_vars,
                'ai_analysis': ai_analysis,
            })

        # Build per-service summary
        service_summaries: Dict[str, Any] = {}
        for svc in request.services:
            svc_results = [r for r in results if r['service_id'] == svc.id]
            svc_passed = sum(1 for r in svc_results if r['status'] == 'PASS')
            service_summaries[svc.id] = {
                'name': svc.name,
                'total': len(svc_results),
                'passed': svc_passed,
                'failed': len(svc_results) - svc_passed,
            }

        total = len(results)
        passed = sum(1 for r in results if r['status'] == 'PASS')
        failed = total - passed
        pass_rate = round((passed / total * 100) if total > 0 else 0.0, 1)

        return {
            'success': True,
            'summary': {'total': total, 'passed': passed, 'failed': failed, 'pass_rate': pass_rate},
            'service_summaries': service_summaries,
            'results': results,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/integration-scenarios")
async def save_integration_scenario(
    request: SaveIntegrationScenarioRequest,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    scenario = IntegrationScenarioDB(
        id=str(uuid.uuid4()),
        user_id=user.user_id,
        name=request.name,
        description=request.description,
        services=[s.dict() for s in request.services],
        steps=[s.dict() for s in request.steps],
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return {
        'id': scenario.id,
        'name': scenario.name,
        'description': scenario.description,
        'services': scenario.services,
        'steps': scenario.steps,
        'created_at': scenario.created_at.isoformat(),
    }


@app.get("/integration-scenarios")
async def list_integration_scenarios(
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    scenarios = db.query(IntegrationScenarioDB).filter(
        IntegrationScenarioDB.user_id == user.user_id
    ).order_by(IntegrationScenarioDB.created_at.desc()).all()
    return [
        {
            'id': s.id,
            'name': s.name,
            'description': s.description,
            'services': s.services,
            'steps': s.steps,
            'created_at': s.created_at.isoformat(),
        }
        for s in scenarios
    ]


@app.get("/integration-scenarios/{scenario_id}")
async def get_integration_scenario(
    scenario_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    scenario = db.query(IntegrationScenarioDB).filter(
        IntegrationScenarioDB.id == scenario_id,
        IntegrationScenarioDB.user_id == user.user_id
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {
        'id': scenario.id,
        'name': scenario.name,
        'description': scenario.description,
        'services': scenario.services,
        'steps': scenario.steps,
        'created_at': scenario.created_at.isoformat(),
    }


@app.delete("/integration-scenarios/{scenario_id}")
async def delete_integration_scenario(
    scenario_id: str,
    username: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    scenario = db.query(IntegrationScenarioDB).filter(
        IntegrationScenarioDB.id == scenario_id,
        IntegrationScenarioDB.user_id == user.user_id
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(scenario)
    db.commit()
    return {'success': True}


# ╔══════════════════════════════════════════════════════════════╗
# ║  PROD-GATE MODULE — Routes & Suite Runners                  ║
# ║  To remove: delete this entire block down to PROD-GATE: END ║
# ╚══════════════════════════════════════════════════════════════╝
# PROD-GATE: START

async def _pg_build_headers(auth_config: dict, custom_headers: dict) -> dict:
    h = {"Content-Type": "application/json", "User-Agent": "Flasqo-ProdGate/1.0"}
    h.update(custom_headers or {})
    atype = (auth_config or {}).get("type", "none")
    if atype == "bearer":
        h["Authorization"] = f"Bearer {auth_config.get('token', '')}"
    elif atype == "api_key":
        h[auth_config.get("header", "X-API-Key")] = auth_config.get("key", "")
    elif atype == "basic":
        raw = f"{auth_config.get('username', '')}:{auth_config.get('password', '')}"
        h["Authorization"] = "Basic " + base64.b64encode(raw.encode()).decode()
    return h


async def _pg_health_suite(client, base_url, endpoints, logs):
    tests, findings = [], []
    probes = [(base_url, "GET")] + [
        (base_url.rstrip("/") + ep.get("path", "/"), ep.get("method", "GET"))
        for ep in (endpoints or [])[:4]
    ]
    for url, method in probes[:5]:
        try:
            t0 = time.time()
            r = await client.request(method, url)
            ms = (time.time() - t0) * 1000
            ok = r.status_code < 500
            tests.append({"name": f"{method} {url}", "status": "PASS" if ok else "FAIL",
                           "detail": f"HTTP {r.status_code} in {ms:.0f}ms", "latency": round(ms)})
            logs.append(f"[health] {method} {url} → {r.status_code} ({ms:.0f}ms)")
            if ms > 3000:
                findings.append({"severity": "WARN", "message": f"Slow: {url} took {ms:.0f}ms"})
            if r.status_code >= 500:
                findings.append({"severity": "CRITICAL", "message": f"{url} returned HTTP {r.status_code}"})
        except Exception as e:
            tests.append({"name": f"{method} {url}", "status": "FAIL",
                           "detail": str(e)[:120], "latency": 0})
            findings.append({"severity": "CRITICAL", "message": f"Cannot reach {url}: {str(e)[:80]}"})

    passed = sum(1 for t in tests if t["status"] == "PASS")
    latencies = [t["latency"] for t in tests if t["latency"] > 0]
    avg_ms = sum(latencies) / len(latencies) if latencies else 0
    score = round((passed / len(tests)) * 100) if tests else 0
    if avg_ms > 2000: score = min(score, 70)
    elif avg_ms > 1000: score = min(score, 85)
    return {
        "suiteId": "health", "score": score,
        "status": "PASS" if score >= 80 else ("WARN" if score >= 50 else "FAIL"),
        "tests": tests, "findings": findings,
        "summary": f"{passed}/{len(tests)} endpoints healthy · avg {avg_ms:.0f}ms",
    }


async def _pg_security_suite(client, base_url, endpoints, logs):
    tests, findings = [], []
    probes = [
        ("sql_injection",  "' OR '1'='1"),
        ("sql_union",      "'; SELECT 1--"),
        ("xss_basic",      "<script>alert(1)</script>"),
        ("path_traversal", "../../etc/passwd"),
        ("null_byte",      "test\x00payload"),
        ("oversized",      "A" * 4096),
        ("template_inject","{{7*7}}${7*7}"),
    ]
    test_url = (base_url.rstrip("/") + endpoints[0].get("path", "/")) if endpoints else base_url
    for probe_name, payload in probes:
        try:
            t0 = time.time()
            r = await client.post(test_url, json={"input": payload, "query": payload, "id": payload}, timeout=6.0)
            ms = (time.time() - t0) * 1000
            safe = r.status_code in (400, 401, 403, 422, 429)
            internal_err = r.status_code >= 500
            body = r.text[:500].lower()
            reflected = (len(payload) < 30 and payload[:15].lower() in body and r.status_code == 200)
            status = "PASS" if safe else ("FAIL" if (internal_err or reflected) else "WARN")
            tests.append({"name": f"Probe: {probe_name}", "status": status,
                           "detail": f"HTTP {r.status_code} in {ms:.0f}ms", "latency": round(ms)})
            logs.append(f"[security] {probe_name} → {r.status_code}")
            if internal_err:
                findings.append({"severity": "CRITICAL", "message": f"'{probe_name}' caused HTTP {r.status_code} — unhandled error"})
            elif reflected:
                findings.append({"severity": "CRITICAL", "message": f"'{probe_name}' reflected in response — possible injection"})
            elif not safe:
                findings.append({"severity": "WARN", "message": f"'{probe_name}' returned {r.status_code} — review input validation"})
        except Exception:
            tests.append({"name": f"Probe: {probe_name}", "status": "PASS",
                           "detail": "Connection rejected (good)", "latency": 0})
            logs.append(f"[security] {probe_name} → rejected by server")

    passed = sum(1 for t in tests if t["status"] == "PASS")
    warns  = sum(1 for t in tests if t["status"] == "WARN")
    score  = round(((passed + warns * 0.5) / len(tests)) * 100) if tests else 0
    return {
        "suiteId": "security", "score": score,
        "status": "PASS" if score >= 80 else ("WARN" if score >= 55 else "FAIL"),
        "tests": tests, "findings": findings,
        "summary": f"{passed}/{len(tests)} probes handled safely · {len(findings)} findings",
    }


async def _pg_load_suite(client, base_url, endpoints, concurrent_users, timeout_s, logs):
    test_url = (base_url.rstrip("/") + endpoints[0].get("path", "/")) if endpoints else base_url
    n = min(max(int(concurrent_users), 5), 50)

    async def single():
        t0 = time.time()
        try:
            r = await client.get(test_url, timeout=timeout_s)
            return {"ok": r.status_code < 500, "ms": (time.time() - t0) * 1000, "sc": r.status_code}
        except Exception:
            return {"ok": False, "ms": (time.time() - t0) * 1000, "sc": 0}

    logs.append(f"[load] Sending {n} concurrent requests → {test_url}")
    t_wall = time.time()
    responses = await asyncio.gather(*[single() for _ in range(n)])
    wall_ms = (time.time() - t_wall) * 1000

    lats = sorted(r["ms"] for r in responses)
    ok_n = sum(1 for r in responses if r["ok"])
    err_rate = (n - ok_n) / n * 100
    avg_ms = sum(lats) / len(lats) if lats else 0
    p95_ms = lats[int(len(lats) * 0.95)] if lats else 0
    p99_ms = lats[int(len(lats) * 0.99)] if lats else 0
    rps    = n / (wall_ms / 1000) if wall_ms > 0 else 0

    logs.append(f"[load] {ok_n}/{n} ok · avg {avg_ms:.0f}ms · p95 {p95_ms:.0f}ms · {rps:.1f} req/s")
    tests = [
        {"name": "Concurrent Availability",
         "status": "PASS" if err_rate < 5 else ("WARN" if err_rate < 20 else "FAIL"),
         "detail": f"{ok_n}/{n} succeeded ({100-err_rate:.0f}%)", "latency": round(avg_ms)},
        {"name": "Avg Response Time",
         "status": "PASS" if avg_ms < 500 else ("WARN" if avg_ms < 2000 else "FAIL"),
         "detail": f"{avg_ms:.0f}ms average", "latency": round(avg_ms)},
        {"name": "P95 Latency",
         "status": "PASS" if p95_ms < 1000 else ("WARN" if p95_ms < 3000 else "FAIL"),
         "detail": f"{p95_ms:.0f}ms at p95", "latency": round(p95_ms)},
        {"name": "P99 Latency",
         "status": "PASS" if p99_ms < 2000 else ("WARN" if p99_ms < 5000 else "FAIL"),
         "detail": f"{p99_ms:.0f}ms at p99", "latency": round(p99_ms)},
        {"name": "Throughput",
         "status": "PASS", "detail": f"{rps:.1f} req/s", "latency": 0},
    ]
    findings = []
    if err_rate >= 20: findings.append({"severity": "CRITICAL", "message": f"High error rate under load: {err_rate:.0f}% failed"})
    elif err_rate >= 5: findings.append({"severity": "WARN",     "message": f"Some failures under load: {err_rate:.0f}% failed"})
    if p95_ms > 3000:  findings.append({"severity": "WARN",     "message": f"P95 latency {p95_ms:.0f}ms is high — check connection pooling"})
    if avg_ms > 1000:  findings.append({"severity": "WARN",     "message": f"Avg latency {avg_ms:.0f}ms under {n} concurrent users"})

    passed = sum(1 for t in tests if t["status"] == "PASS")
    score  = round((passed / len(tests)) * 100)
    if err_rate >= 20: score = min(score, 40)
    elif err_rate >= 10: score = min(score, 65)
    return {
        "suiteId": "load", "score": score,
        "status": "PASS" if score >= 80 else ("WARN" if score >= 55 else "FAIL"),
        "tests": tests, "findings": findings,
        "summary": f"{ok_n}/{n} ok · p95={p95_ms:.0f}ms · {rps:.1f} req/s",
    }


async def _pg_functional_suite(client, base_url, endpoints, logs):
    if not endpoints:
        return {"suiteId": "functional", "score": 0, "status": "WARN", "tests": [],
                "findings": [{"severity": "WARN", "message": "No endpoints provided — add paths in profile config"}],
                "summary": "No endpoints configured"}
    tests, findings = [], []
    for ep in (endpoints or [])[:5]:
        url    = base_url.rstrip("/") + ep.get("path", "/")
        method = ep.get("method", "GET")
        try:
            t0 = time.time()
            r  = await client.request(method, url, timeout=8.0)
            ms = (time.time() - t0) * 1000
            ct = r.headers.get("content-type", "")
            try: r.json(); json_ok = True
            except Exception: json_ok = False
            ok = r.status_code < 400
            tests.append({"name": f"{method} {ep.get('path','/')}",
                           "status": "PASS" if (ok and json_ok) else ("WARN" if ok else "FAIL"),
                           "detail": f"HTTP {r.status_code} · {'JSON' if json_ok else 'non-JSON'} · {ms:.0f}ms",
                           "latency": round(ms)})
            logs.append(f"[functional] {method} {url} → {r.status_code}")
            if ok and not json_ok:
                findings.append({"severity": "WARN", "message": f"{url} not returning JSON (got: {ct[:40]})"})
        except Exception as e:
            tests.append({"name": f"{method} {ep.get('path','/')}", "status": "FAIL",
                           "detail": str(e)[:100], "latency": 0})
            findings.append({"severity": "CRITICAL", "message": f"Cannot reach {url}: {str(e)[:80]}"})

    passed = sum(1 for t in tests if t["status"] == "PASS")
    warns  = sum(1 for t in tests if t["status"] == "WARN")
    score  = round(((passed + warns * 0.7) / len(tests)) * 100) if tests else 0
    return {
        "suiteId": "functional", "score": score,
        "status": "PASS" if score >= 80 else ("WARN" if score >= 55 else "FAIL"),
        "tests": tests, "findings": findings,
        "summary": f"{passed}/{len(tests)} endpoints functional",
    }


async def _pg_rate_limit_suite(client, base_url, endpoints, logs):
    test_url = (base_url.rstrip("/") + endpoints[0].get("path", "/")) if endpoints else base_url
    logs.append(f"[rate-limit] Burst of 15 requests → {test_url}")
    resps = []
    for _ in range(15):
        try:
            r = await client.get(test_url, timeout=5.0)
            resps.append({"sc": r.status_code, "hdrs": dict(r.headers)})
        except Exception:
            resps.append({"sc": 0, "hdrs": {}})

    got_429    = any(r["sc"] == 429 for r in resps)
    has_rl_hdr = any(any(k.lower().startswith(("x-ratelimit", "ratelimit", "x-rate-limit"))
                         for k in r["hdrs"]) for r in resps)
    retry_after = any("retry-after" in r["hdrs"] for r in resps)

    tests = [
        {"name": "Rate-Limit Headers", "status": "PASS" if has_rl_hdr else "WARN",
         "detail": "X-RateLimit-* headers present" if has_rl_hdr else "No rate-limit headers in responses", "latency": 0},
        {"name": "429 Throttle Response", "status": "PASS" if got_429 else "WARN",
         "detail": "Got 429 Too Many Requests" if got_429 else "No 429 after burst — unlimited?", "latency": 0},
        {"name": "Retry-After Header", "status": "PASS" if retry_after else "WARN",
         "detail": "Retry-After header present" if retry_after else "No Retry-After header", "latency": 0},
    ]
    findings = []
    if not has_rl_hdr:
        findings.append({"severity": "WARN", "message": "Add X-RateLimit-Limit/Remaining/Reset headers to responses"})
    if not got_429:
        findings.append({"severity": "WARN", "message": "No throttling detected — configure rate limiting for production"})

    passed = sum(1 for t in tests if t["status"] == "PASS")
    score  = round((passed / len(tests)) * 100)
    return {
        "suiteId": "rate_limit", "score": score,
        "status": "PASS" if score >= 80 else "WARN",
        "tests": tests, "findings": findings,
        "summary": "Rate limiting detected" if (got_429 or has_rl_hdr) else "No rate limiting detected",
    }


async def _pg_data_integrity_suite(client, base_url, endpoints, logs):
    if not endpoints:
        return {"suiteId": "data_integrity", "score": 50, "status": "WARN", "tests": [],
                "findings": [{"severity": "WARN", "message": "No endpoints configured for consistency check"}],
                "summary": "No endpoints configured"}
    test_url = base_url.rstrip("/") + endpoints[0].get("path", "/")
    logs.append(f"[data-integrity] 3-sample consistency check → {test_url}")
    runs = []
    for _ in range(3):
        try:
            r = await client.get(test_url, timeout=8.0)
            runs.append({"sc": r.status_code, "ct": r.headers.get("content-type", ""), "body": r.text[:500]})
        except Exception as e:
            runs.append({"sc": 0, "ct": "", "body": "", "err": str(e)})

    valid = [r for r in runs if r["sc"] > 0]
    sc_ok = len(set(r["sc"] for r in valid)) <= 1
    ct_ok = len(set(r["ct"].split(";")[0] for r in valid)) <= 1
    has_json_ct = any("json" in r["ct"] for r in valid)

    tests = [
        {"name": "Status Code Consistency", "status": "PASS" if sc_ok else "FAIL",
         "detail": "Same status across 3 requests" if sc_ok else "Status varies — possible flap", "latency": 0},
        {"name": "Content-Type Consistency", "status": "PASS" if ct_ok else "WARN",
         "detail": "Consistent Content-Type" if ct_ok else "Content-Type varies between requests", "latency": 0},
        {"name": "JSON Content-Type", "status": "PASS" if has_json_ct else "WARN",
         "detail": "application/json returned" if has_json_ct else "Non-JSON Content-Type", "latency": 0},
    ]
    findings = []
    if not sc_ok:    findings.append({"severity": "WARN", "message": "Inconsistent status codes — possible flapping endpoint"})
    if not has_json_ct: findings.append({"severity": "WARN", "message": "API not returning application/json Content-Type"})

    passed = sum(1 for t in tests if t["status"] == "PASS")
    score  = round((passed / len(tests)) * 100) if tests else 0
    return {
        "suiteId": "data_integrity", "score": score,
        "status": "PASS" if score >= 80 else "WARN",
        "tests": tests, "findings": findings,
        "summary": "Consistent" if (sc_ok and ct_ok) else "Consistency issues detected",
    }


@app.post("/prod-gate/suite")
async def prod_gate_run_suite(data: dict, username: str = Depends(verify_token), db: Session = Depends(get_db)):
    suite_id = data.get("suiteId", "health")
    base_url = (data.get("baseUrl") or "").rstrip("/")
    if not base_url:
        raise HTTPException(status_code=400, detail="baseUrl is required")

    auth_config    = data.get("authConfig", {}) or {}
    raw_headers    = data.get("customHeaders", {}) or {}
    custom_headers = raw_headers if isinstance(raw_headers, dict) else {}
    endpoints      = data.get("endpoints", []) or []
    load_cfg       = data.get("loadConfig", {}) or {}
    concurrent     = int(load_cfg.get("concurrentUsers", 20))
    timeout_s      = float(load_cfg.get("timeout", 5000)) / 1000.0
    logs           = []

    try:
        headers = await _pg_build_headers(auth_config, custom_headers)
        async with httpx.AsyncClient(headers=headers, timeout=max(timeout_s, 10.0),
                                     follow_redirects=True, verify=False) as client:
            if suite_id == "health":
                result = await _pg_health_suite(client, base_url, endpoints, logs)
            elif suite_id == "security":
                result = await _pg_security_suite(client, base_url, endpoints, logs)
            elif suite_id == "load":
                result = await _pg_load_suite(client, base_url, endpoints, concurrent, timeout_s, logs)
            elif suite_id == "functional":
                result = await _pg_functional_suite(client, base_url, endpoints, logs)
            elif suite_id == "rate_limit":
                result = await _pg_rate_limit_suite(client, base_url, endpoints, logs)
            elif suite_id == "data_integrity":
                result = await _pg_data_integrity_suite(client, base_url, endpoints, logs)
            else:
                raise HTTPException(status_code=400, detail=f"Unknown suite: {suite_id}")
        result["logs"] = logs
        return result
    except HTTPException:
        raise
    except Exception as e:
        return {"suiteId": suite_id, "score": 0, "status": "FAIL", "tests": [],
                "findings": [{"severity": "CRITICAL", "message": str(e)[:200]}],
                "logs": logs + [f"Suite error: {str(e)[:200]}"],
                "summary": f"Suite failed: {str(e)[:80]}"}


@app.post("/prod-gate/profiles")
async def save_prod_gate_profile(data: dict, username: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    profile = ProdGateProfileDB(
        profile_id=secrets.token_urlsafe(12), user_id=user.user_id,
        name=data.get("name", "Untitled"), base_url=data.get("baseUrl", ""),
        auth_config=data.get("authConfig", {}), custom_headers=data.get("customHeaders", {}),
        load_config=data.get("loadConfig", {}), endpoints=data.get("endpoints", []),
        created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
    )
    db.add(profile); db.commit()
    return {"success": True, "profileId": profile.profile_id}


@app.get("/prod-gate/profiles")
async def get_prod_gate_profiles(username: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    rows = db.query(ProdGateProfileDB).filter(ProdGateProfileDB.user_id == user.user_id)\
              .order_by(ProdGateProfileDB.updated_at.desc()).all()
    return [{"profileId": p.profile_id, "name": p.name, "baseUrl": p.base_url,
             "authConfig": p.auth_config, "customHeaders": p.custom_headers,
             "loadConfig": p.load_config, "endpoints": p.endpoints,
             "createdAt": p.created_at.isoformat()} for p in rows]


@app.delete("/prod-gate/profiles/{profile_id}")
async def delete_prod_gate_profile(profile_id: str, username: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    p = db.query(ProdGateProfileDB).filter(ProdGateProfileDB.profile_id == profile_id,
                                            ProdGateProfileDB.user_id == user.user_id).first()
    if not p: raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(p); db.commit()
    return {"success": True}


@app.post("/prod-gate/sessions")
async def save_prod_gate_session(data: dict, username: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    s = ProdGateSessionDB(
        session_id=secrets.token_urlsafe(12), user_id=user.user_id,
        profile_name=data.get("profileName", ""), base_url=data.get("baseUrl", ""),
        score=int(data.get("score", 0)), gate_decision=data.get("gateDecision", "UNKNOWN"),
        suites_run=data.get("suitesRun", []), result_json=data.get("resultJson", {}),
        executed_at=datetime.utcnow(),
    )
    db.add(s); db.commit()
    return {"success": True, "sessionId": s.session_id}


@app.get("/prod-gate/sessions")
async def get_prod_gate_sessions(username: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    rows = db.query(ProdGateSessionDB).filter(ProdGateSessionDB.user_id == user.user_id)\
              .order_by(ProdGateSessionDB.executed_at.desc()).limit(20).all()
    return [{"sessionId": s.session_id, "profileName": s.profile_name, "baseUrl": s.base_url,
             "score": s.score, "gateDecision": s.gate_decision, "suitesRun": s.suites_run,
             "executedAt": s.executed_at.isoformat()} for s in rows]

# PROD-GATE: END

# ============================================
# REQUEST BUILDER MODULE (manual API client — Postman-style)
# ============================================
try:
    from request_builder import request_builder_router
    app.include_router(request_builder_router, prefix="/rb", tags=["Request-Builder"])
except ImportError:
    pass  # Feature disabled if module missing

# ============================================
# BUILT-IN TEST LIBRARY (offline test cases — no API cost)
# ============================================
try:
    from test_library import test_library_router
    app.include_router(test_library_router, prefix="/library", tags=["Test-Library"])
except ImportError:
    pass  # Feature disabled if module missing

# ============================================
# CLOUD ACCOUNT (hybrid: optional sign-in to flasqo.com; local testing stays local)
# ============================================
try:
    from cloud_account import cloud_account_router
    app.include_router(cloud_account_router, prefix="/account", tags=["Cloud-Account"])
except ImportError:
    pass  # Feature disabled if module missing

# Create built-in local user for desktop mode
ensure_local_user()

# ============================================
# DESKTOP MODE: serve the built frontend (SPA)
# Must be registered last so API routes take priority.
# ============================================
if FLASQO_LOCAL:
    from fastapi.responses import FileResponse
    _static_dir = os.getenv("FLASQO_STATIC_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "static"))
    if os.path.isdir(_static_dir):
        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa_static(full_path: str):
            candidate = os.path.normpath(os.path.join(_static_dir, full_path))
            if candidate.startswith(os.path.normpath(_static_dir)) and full_path and os.path.isfile(candidate):
                return FileResponse(candidate)
            return FileResponse(os.path.join(_static_dir, "index.html"))


if __name__ == "__main__":
    import uvicorn
    import sys
    import io

    # Fix Unicode encoding issues on Windows
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

    print("Starting AI API Tester Backend")
    _port = int(os.getenv("PORT", "8000"))
    if os.getenv("FLASQO_RELOAD", "0") == "1":
        uvicorn.run("backend:app", host="127.0.0.1", port=_port, reload=True)
    else:
        # PyInstaller-compatible: pass the app object directly (no import string, no reload)
        uvicorn.run(app, host="127.0.0.1", port=_port)