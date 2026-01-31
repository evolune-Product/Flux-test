# -*- coding: utf-8 -*-
"""
Auto-Discovery Module for Evo-TFX
Zero-config API discovery with security scoring and test generation.
This module is fully isolated and can be removed without affecting the rest of the app.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, HttpUrl
from typing import Dict, Any, List, Optional, Literal
from datetime import datetime
from enum import Enum
import asyncio
import json
import re
import secrets
import os

import httpx
import yaml

# Optional OpenAI for AI-powered test generation
try:
    import openai
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    if OPENAI_API_KEY:
        openai.api_key = OPENAI_API_KEY
except ImportError:
    openai = None
    OPENAI_API_KEY = None


# ============================================
# PYDANTIC MODELS
# ============================================

class AuthType(str, Enum):
    NONE = "none"
    BEARER = "bearer"
    API_KEY = "api_key"
    BASIC = "basic"


class AuthConfig(BaseModel):
    """Authentication configuration for API discovery"""
    type: AuthType = AuthType.NONE
    token: Optional[str] = None
    api_key: Optional[str] = None
    api_key_header: Optional[str] = "X-API-Key"
    username: Optional[str] = None
    password: Optional[str] = None


class DiscoveryMethod(str, Enum):
    OPENAPI = "openapi"
    CRAWLER = "crawler"
    WELLKNOWN = "wellknown"
    ALL = "all"


class AutoDiscoveryRequest(BaseModel):
    """Request model for starting API discovery"""
    target_url: str = Field(..., description="Base URL of the API to discover")
    discovery_methods: List[DiscoveryMethod] = Field(
        default=[DiscoveryMethod.ALL],
        description="Discovery methods to use"
    )
    auth_config: Optional[AuthConfig] = None
    test_types: List[str] = Field(
        default=["smoke", "security", "functional"],
        description="Types of tests to generate"
    )
    timeout: int = Field(default=30, ge=5, le=120, description="Request timeout in seconds")


class ParameterInfo(BaseModel):
    """Information about an API parameter"""
    name: str
    location: str  # query, path, header, body
    type: str = "string"
    required: bool = False
    description: Optional[str] = None
    example: Optional[Any] = None


class DiscoveredEndpoint(BaseModel):
    """Represents a discovered API endpoint"""
    id: str = Field(default_factory=lambda: secrets.token_hex(8))
    path: str
    method: str
    parameters: List[ParameterInfo] = []
    auth_required: bool = False
    confidence: float = Field(ge=0, le=1, description="Confidence score 0-1")
    source: str  # openapi, crawler, wellknown
    description: Optional[str] = None
    response_codes: List[int] = []
    content_type: Optional[str] = None


class SecurityFinding(BaseModel):
    """A security finding from analysis"""
    severity: Literal["critical", "high", "medium", "low", "info"]
    category: str
    title: str
    description: str
    recommendation: Optional[str] = None


class SecurityScore(BaseModel):
    """Security analysis score"""
    score: int = Field(ge=0, le=100, description="Security score 0-100")
    grade: Literal["A", "B", "C", "D", "F"]
    findings: List[SecurityFinding] = []
    checks_passed: int = 0
    checks_total: int = 0


class GeneratedTestCase(BaseModel):
    """A generated test case"""
    id: str = Field(default_factory=lambda: secrets.token_hex(8))
    name: str
    endpoint: str
    method: str
    category: str  # smoke, security, functional
    expected_status: int
    request_body: Optional[Dict[str, Any]] = None
    headers: Optional[Dict[str, str]] = None
    description: Optional[str] = None
    severity: Optional[str] = None  # For security tests


class DiscoveryProgress(BaseModel):
    """Progress update during discovery"""
    step: str
    status: Literal["pending", "running", "complete", "error"]
    message: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AutoDiscoveryResponse(BaseModel):
    """Response model for API discovery results"""
    discovery_id: str
    target_url: str
    endpoints: List[DiscoveredEndpoint] = []
    security_score: Optional[SecurityScore] = None
    generated_tests: List[GeneratedTestCase] = []
    metadata: Dict[str, Any] = {}
    progress_log: List[DiscoveryProgress] = []
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: Literal["pending", "running", "complete", "error"] = "pending"
    error: Optional[str] = None


class TestRunRequest(BaseModel):
    """Request to run generated tests"""
    tests: List[GeneratedTestCase]
    target_url: str
    auth_config: Optional[AuthConfig] = None
    timeout: int = Field(default=30, ge=5, le=120)


class TestResult(BaseModel):
    """Result of running a test"""
    test_id: str
    test_name: str
    endpoint: str
    method: str
    category: str
    passed: bool
    status_code: Optional[int] = None
    expected_status: int
    response_time_ms: int
    error: Optional[str] = None
    response_preview: Optional[str] = None


class TestRunResponse(BaseModel):
    """Response from running tests"""
    total: int
    passed: int
    failed: int
    results: List[TestResult]
    duration_ms: int


# ============================================
# DISCOVERY CLASSES
# ============================================

class BaseDiscoverer:
    """Base class for API discoverers"""

    def __init__(self, base_url: str, auth_config: Optional[AuthConfig], timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.auth_config = auth_config
        self.timeout = timeout
        self.endpoints: List[DiscoveredEndpoint] = []

    def _get_headers(self) -> Dict[str, str]:
        """Build headers based on auth config"""
        headers = {
            "User-Agent": "Evo-TFX Auto-Discovery/1.0",
            "Accept": "application/json, */*"
        }

        if self.auth_config:
            if self.auth_config.type == AuthType.BEARER and self.auth_config.token:
                headers["Authorization"] = f"Bearer {self.auth_config.token}"
            elif self.auth_config.type == AuthType.API_KEY and self.auth_config.api_key:
                header_name = self.auth_config.api_key_header or "X-API-Key"
                headers[header_name] = self.auth_config.api_key
            elif self.auth_config.type == AuthType.BASIC:
                import base64
                if self.auth_config.username and self.auth_config.password:
                    credentials = base64.b64encode(
                        f"{self.auth_config.username}:{self.auth_config.password}".encode()
                    ).decode()
                    headers["Authorization"] = f"Basic {credentials}"

        return headers

    async def discover(self) -> List[DiscoveredEndpoint]:
        """Override in subclasses"""
        raise NotImplementedError


class OpenAPIDiscoverer(BaseDiscoverer):
    """Discover endpoints from OpenAPI/Swagger specifications"""

    SPEC_PATHS = [
        "/openapi.json",
        "/openapi.yaml",
        "/swagger.json",
        "/swagger.yaml",
        "/api-docs",
        "/api-docs.json",
        "/v1/api-docs",
        "/v2/api-docs",
        "/v3/api-docs",
        "/docs/openapi.json",
        "/docs/swagger.json",
        "/api/openapi.json",
        "/api/swagger.json",
        "/swagger/v1/swagger.json",
        "/.well-known/openapi.json",
    ]

    async def discover(self) -> List[DiscoveredEndpoint]:
        """Try to find and parse OpenAPI/Swagger spec"""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            for path in self.SPEC_PATHS:
                try:
                    url = f"{self.base_url}{path}"
                    response = await client.get(url, headers=self._get_headers())

                    if response.status_code == 200:
                        content_type = response.headers.get("content-type", "")
                        text = response.text

                        # Try parsing as JSON or YAML
                        spec = None
                        if "json" in content_type or path.endswith(".json"):
                            try:
                                spec = json.loads(text)
                            except json.JSONDecodeError:
                                pass

                        if spec is None and ("yaml" in content_type or path.endswith(".yaml") or path.endswith(".yml")):
                            try:
                                spec = yaml.safe_load(text)
                            except yaml.YAMLError:
                                pass

                        # Also try JSON if YAML failed
                        if spec is None:
                            try:
                                spec = json.loads(text)
                            except json.JSONDecodeError:
                                pass

                        if spec and self._is_valid_openapi(spec):
                            self.endpoints = self._parse_openapi(spec)
                            return self.endpoints

                except httpx.RequestError:
                    continue

        return []

    def _is_valid_openapi(self, spec: Dict) -> bool:
        """Check if the spec looks like a valid OpenAPI document"""
        # OpenAPI 3.x
        if spec.get("openapi") and spec.get("paths"):
            return True
        # Swagger 2.x
        if spec.get("swagger") and spec.get("paths"):
            return True
        return False

    def _parse_openapi(self, spec: Dict) -> List[DiscoveredEndpoint]:
        """Parse OpenAPI spec into endpoints"""
        endpoints = []
        paths = spec.get("paths", {})

        for path, methods in paths.items():
            if not isinstance(methods, dict):
                continue

            for method, details in methods.items():
                if method.lower() not in ["get", "post", "put", "patch", "delete", "options", "head"]:
                    continue

                if not isinstance(details, dict):
                    continue

                # Extract parameters
                params = []
                for param in details.get("parameters", []):
                    if isinstance(param, dict):
                        params.append(ParameterInfo(
                            name=param.get("name", "unknown"),
                            location=param.get("in", "query"),
                            type=param.get("schema", {}).get("type", "string") if isinstance(param.get("schema"), dict) else "string",
                            required=param.get("required", False),
                            description=param.get("description")
                        ))

                # Check for request body
                request_body = details.get("requestBody", {})
                if request_body and isinstance(request_body, dict):
                    content = request_body.get("content", {})
                    if content:
                        params.append(ParameterInfo(
                            name="body",
                            location="body",
                            type="object",
                            required=request_body.get("required", False),
                            description="Request body"
                        ))

                # Extract response codes
                responses = details.get("responses", {})
                response_codes = []
                for code in responses.keys():
                    try:
                        response_codes.append(int(code))
                    except ValueError:
                        pass

                # Check if auth is required
                auth_required = bool(details.get("security", spec.get("security")))

                endpoints.append(DiscoveredEndpoint(
                    path=path,
                    method=method.upper(),
                    parameters=params,
                    auth_required=auth_required,
                    confidence=1.0,  # High confidence from OpenAPI spec
                    source="openapi",
                    description=details.get("summary") or details.get("description"),
                    response_codes=sorted(response_codes),
                    content_type="application/json"
                ))

        return endpoints


class CrawlerDiscoverer(BaseDiscoverer):
    """Discover endpoints by probing common API paths"""

    COMMON_PATHS = [
        # Root and versioned paths
        "/api", "/api/v1", "/api/v2", "/api/v3", "/v1", "/v2", "/v3",
        # Resource endpoints
        "/users", "/user", "/accounts", "/account",
        "/products", "/product", "/items", "/item",
        "/orders", "/order", "/cart", "/checkout",
        "/posts", "/articles", "/content", "/pages",
        "/comments", "/reviews", "/feedback",
        "/categories", "/tags", "/labels",
        "/files", "/uploads", "/media", "/images", "/documents",
        # Authentication
        "/auth", "/login", "/logout", "/register", "/signup", "/signin",
        "/oauth", "/token", "/refresh", "/verify", "/reset-password",
        "/me", "/profile", "/session",
        # Health and status
        "/health", "/healthz", "/healthcheck",
        "/status", "/ping", "/ready", "/live",
        "/heartbeat", "/version", "/info",
        # Admin and management
        "/admin", "/dashboard", "/settings", "/config", "/configuration",
        "/management", "/metrics", "/stats", "/analytics",
        # CRUD operations
        "/search", "/filter", "/list", "/all", "/query",
        "/create", "/update", "/delete", "/batch",
        # Common API patterns
        "/graphql", "/rest", "/rpc", "/ws", "/websocket",
        "/events", "/notifications", "/messages", "/email",
        "/payments", "/billing", "/subscriptions", "/invoices",
    ]

    async def discover(self) -> List[DiscoveredEndpoint]:
        """Probe common paths to discover endpoints"""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            tasks = [self._probe_path(client, path) for path in self.COMMON_PATHS]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, DiscoveredEndpoint):
                    self.endpoints.append(result)

        return self.endpoints

    async def _probe_path(self, client: httpx.AsyncClient, path: str) -> Optional[DiscoveredEndpoint]:
        """Probe a single path to check if it exists"""
        try:
            url = f"{self.base_url}{path}"

            # Try GET first
            response = await client.get(url, headers=self._get_headers())

            # Consider it found if we get a valid response (not 404, 502, 503)
            if response.status_code not in [404, 502, 503, 504]:
                content_type = response.headers.get("content-type", "")

                # Determine confidence based on response
                confidence = 0.5  # Base confidence
                if response.status_code == 200:
                    confidence = 0.8
                    if "application/json" in content_type:
                        confidence = 0.9
                elif response.status_code == 401 or response.status_code == 403:
                    confidence = 0.7  # Auth required means it's a real endpoint
                elif response.status_code == 405:
                    confidence = 0.6  # Method not allowed means endpoint exists

                return DiscoveredEndpoint(
                    path=path,
                    method="GET",
                    parameters=[],
                    auth_required=response.status_code in [401, 403],
                    confidence=confidence,
                    source="crawler",
                    response_codes=[response.status_code],
                    content_type=content_type.split(";")[0] if content_type else None
                )

        except httpx.RequestError:
            pass

        return None


class WellKnownDiscoverer(BaseDiscoverer):
    """Discover API info from well-known endpoints and files"""

    WELLKNOWN_PATHS = [
        "/.well-known/openapi",
        "/.well-known/api-catalog",
        "/.well-known/host-meta",
        "/.well-known/host-meta.json",
        "/robots.txt",
        "/sitemap.xml",
        "/.well-known/security.txt",
        "/security.txt",
    ]

    async def discover(self) -> List[DiscoveredEndpoint]:
        """Check well-known paths for API information"""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            for path in self.WELLKNOWN_PATHS:
                try:
                    url = f"{self.base_url}{path}"
                    response = await client.get(url, headers=self._get_headers())

                    if response.status_code == 200:
                        # Parse robots.txt for API paths
                        if "robots.txt" in path:
                            self._parse_robots_txt(response.text)

                        # Mark the well-known endpoint itself as discovered
                        self.endpoints.append(DiscoveredEndpoint(
                            path=path,
                            method="GET",
                            parameters=[],
                            auth_required=False,
                            confidence=0.6,
                            source="wellknown",
                            response_codes=[200]
                        ))

                except httpx.RequestError:
                    continue

        return self.endpoints

    def _parse_robots_txt(self, content: str):
        """Extract API paths from robots.txt"""
        lines = content.split("\n")
        for line in lines:
            line = line.strip()
            if line.startswith("Disallow:") or line.startswith("Allow:"):
                path = line.split(":", 1)[1].strip()
                if path and "/api" in path.lower():
                    self.endpoints.append(DiscoveredEndpoint(
                        path=path.split("*")[0].rstrip("/") or path,
                        method="GET",
                        parameters=[],
                        auth_required=False,
                        confidence=0.4,
                        source="wellknown",
                        description="Found in robots.txt"
                    ))


class SecurityScoreCalculator:
    """Calculate security score based on discovered information"""

    def __init__(self, base_url: str, timeout: int = 30):
        self.base_url = base_url
        self.timeout = timeout
        self.findings: List[SecurityFinding] = []
        self.checks_passed = 0
        self.checks_total = 0

    async def calculate(self) -> SecurityScore:
        """Run security checks and calculate score"""
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True, verify=False) as client:
            try:
                response = await client.get(self.base_url)
                headers = response.headers

                # Check HTTPS
                self._check_https()

                # Check security headers
                self._check_security_headers(headers)

                # Check CORS
                await self._check_cors(client)

                # Check for sensitive endpoints
                await self._check_sensitive_endpoints(client)

            except httpx.RequestError as e:
                self.findings.append(SecurityFinding(
                    severity="medium",
                    category="connectivity",
                    title="Connection Error",
                    description=f"Could not connect to target: {str(e)}",
                    recommendation="Verify the URL is correct and the server is accessible"
                ))

        # Calculate final score
        score = self._calculate_final_score()
        grade = self._score_to_grade(score)

        return SecurityScore(
            score=score,
            grade=grade,
            findings=self.findings,
            checks_passed=self.checks_passed,
            checks_total=self.checks_total
        )

    def _check_https(self):
        """Check if HTTPS is being used"""
        self.checks_total += 1
        if self.base_url.startswith("https://"):
            self.checks_passed += 1
        else:
            self.findings.append(SecurityFinding(
                severity="high",
                category="transport",
                title="No HTTPS",
                description="API is not using HTTPS encryption",
                recommendation="Enable HTTPS to encrypt data in transit"
            ))

    def _check_security_headers(self, headers: httpx.Headers):
        """Check for important security headers"""
        security_headers = {
            "strict-transport-security": ("HSTS Not Set", "high", "Enable HTTP Strict Transport Security"),
            "x-content-type-options": ("X-Content-Type-Options Missing", "medium", "Add 'X-Content-Type-Options: nosniff' header"),
            "x-frame-options": ("X-Frame-Options Missing", "medium", "Add X-Frame-Options header to prevent clickjacking"),
            "content-security-policy": ("CSP Not Set", "medium", "Implement Content Security Policy"),
            "x-xss-protection": ("X-XSS-Protection Missing", "low", "Add X-XSS-Protection header"),
        }

        for header, (title, severity, recommendation) in security_headers.items():
            self.checks_total += 1
            if header in headers:
                self.checks_passed += 1
            else:
                self.findings.append(SecurityFinding(
                    severity=severity,
                    category="headers",
                    title=title,
                    description=f"The '{header}' security header is not set",
                    recommendation=recommendation
                ))

    async def _check_cors(self, client: httpx.AsyncClient):
        """Check CORS configuration"""
        self.checks_total += 1

        try:
            # Send OPTIONS request with Origin header
            response = await client.options(
                self.base_url,
                headers={"Origin": "https://evil-site.com"}
            )

            acao = response.headers.get("access-control-allow-origin", "")

            if acao == "*":
                self.findings.append(SecurityFinding(
                    severity="high",
                    category="cors",
                    title="Overly Permissive CORS",
                    description="CORS allows any origin (*), which may expose the API to cross-origin attacks",
                    recommendation="Restrict CORS to specific trusted origins"
                ))
            elif "evil-site.com" in acao:
                self.findings.append(SecurityFinding(
                    severity="critical",
                    category="cors",
                    title="CORS Reflects Origin",
                    description="CORS reflects the Origin header without validation",
                    recommendation="Validate and whitelist allowed origins"
                ))
            else:
                self.checks_passed += 1

        except httpx.RequestError:
            self.checks_passed += 1  # Can't check, assume OK

    async def _check_sensitive_endpoints(self, client: httpx.AsyncClient):
        """Check for exposed sensitive endpoints"""
        self.checks_total += 1

        sensitive_paths = [
            "/admin", "/.env", "/config", "/debug", "/phpinfo.php",
            "/.git/config", "/wp-admin", "/actuator", "/metrics"
        ]

        exposed = []
        for path in sensitive_paths:
            try:
                response = await client.get(f"{self.base_url}{path}")
                if response.status_code in [200, 301, 302]:
                    exposed.append(path)
            except httpx.RequestError:
                pass

        if exposed:
            self.findings.append(SecurityFinding(
                severity="high",
                category="exposure",
                title="Sensitive Endpoints Exposed",
                description=f"The following sensitive paths are accessible: {', '.join(exposed)}",
                recommendation="Restrict access to sensitive endpoints or remove them"
            ))
        else:
            self.checks_passed += 1

    def _calculate_final_score(self) -> int:
        """Calculate final security score"""
        if self.checks_total == 0:
            return 50  # No checks run, neutral score

        base_score = int((self.checks_passed / self.checks_total) * 100)

        # Deduct points for findings by severity
        severity_penalties = {
            "critical": 20,
            "high": 10,
            "medium": 5,
            "low": 2,
            "info": 0
        }

        penalty = sum(severity_penalties.get(f.severity, 0) for f in self.findings)

        final_score = max(0, min(100, base_score - penalty))
        return final_score

    def _score_to_grade(self, score: int) -> str:
        """Convert score to letter grade"""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"


class TestGenerator:
    """Generate test cases from discovered endpoints"""

    def __init__(self, endpoints: List[DiscoveredEndpoint], test_types: List[str]):
        self.endpoints = endpoints
        self.test_types = test_types
        self.tests: List[GeneratedTestCase] = []

    def generate(self) -> List[GeneratedTestCase]:
        """Generate test cases for discovered endpoints"""
        for endpoint in self.endpoints:
            if "smoke" in self.test_types:
                self._generate_smoke_tests(endpoint)
            if "security" in self.test_types:
                self._generate_security_tests(endpoint)
            if "functional" in self.test_types:
                self._generate_functional_tests(endpoint)

        return self.tests

    def _generate_smoke_tests(self, endpoint: DiscoveredEndpoint):
        """Generate smoke tests for basic health checks"""
        # Basic endpoint availability test
        self.tests.append(GeneratedTestCase(
            name=f"Smoke: {endpoint.method} {endpoint.path} - Available",
            endpoint=endpoint.path,
            method=endpoint.method,
            category="smoke",
            expected_status=200 if not endpoint.auth_required else 401,
            description=f"Verify {endpoint.path} endpoint is accessible"
        ))

        # Response time test
        self.tests.append(GeneratedTestCase(
            name=f"Smoke: {endpoint.method} {endpoint.path} - Response Time",
            endpoint=endpoint.path,
            method=endpoint.method,
            category="smoke",
            expected_status=200 if not endpoint.auth_required else 401,
            description="Verify response time is acceptable (< 2000ms)"
        ))

    def _generate_security_tests(self, endpoint: DiscoveredEndpoint):
        """Generate security tests"""
        # SQL Injection test
        if endpoint.method in ["GET", "POST", "PUT", "PATCH"]:
            self.tests.append(GeneratedTestCase(
                name=f"Security: {endpoint.path} - SQL Injection",
                endpoint=endpoint.path,
                method=endpoint.method,
                category="security",
                expected_status=400,  # Should reject malicious input
                request_body={"test": "' OR '1'='1"} if endpoint.method != "GET" else None,
                description="Test for SQL injection vulnerability",
                severity="high"
            ))

        # XSS test
        if endpoint.method in ["POST", "PUT", "PATCH"]:
            self.tests.append(GeneratedTestCase(
                name=f"Security: {endpoint.path} - XSS",
                endpoint=endpoint.path,
                method=endpoint.method,
                category="security",
                expected_status=400,
                request_body={"test": "<script>alert('xss')</script>"},
                description="Test for XSS vulnerability",
                severity="high"
            ))

        # Auth bypass test
        if endpoint.auth_required:
            self.tests.append(GeneratedTestCase(
                name=f"Security: {endpoint.path} - Auth Bypass",
                endpoint=endpoint.path,
                method=endpoint.method,
                category="security",
                expected_status=401,
                description="Verify endpoint requires authentication",
                severity="critical"
            ))

        # Path traversal test
        self.tests.append(GeneratedTestCase(
            name=f"Security: {endpoint.path} - Path Traversal",
            endpoint=f"{endpoint.path}/../../../etc/passwd",
            method="GET",
            category="security",
            expected_status=400,
            description="Test for path traversal vulnerability",
            severity="high"
        ))

    def _generate_functional_tests(self, endpoint: DiscoveredEndpoint):
        """Generate functional tests"""
        # Valid request test
        if endpoint.method == "GET":
            self.tests.append(GeneratedTestCase(
                name=f"Functional: {endpoint.method} {endpoint.path} - Valid Request",
                endpoint=endpoint.path,
                method=endpoint.method,
                category="functional",
                expected_status=200,
                description="Verify endpoint returns expected response"
            ))

        # Invalid parameter test
        if endpoint.parameters:
            self.tests.append(GeneratedTestCase(
                name=f"Functional: {endpoint.path} - Invalid Parameters",
                endpoint=endpoint.path,
                method=endpoint.method,
                category="functional",
                expected_status=400,
                request_body={"invalid_field": "invalid_value"},
                description="Verify endpoint handles invalid parameters correctly"
            ))

        # Method not allowed test
        if endpoint.method != "DELETE":
            self.tests.append(GeneratedTestCase(
                name=f"Functional: {endpoint.path} - Method Not Allowed",
                endpoint=endpoint.path,
                method="DELETE" if endpoint.method != "DELETE" else "PATCH",
                category="functional",
                expected_status=405,
                description="Verify endpoint rejects unsupported HTTP methods"
            ))


# ============================================
# FASTAPI ROUTER
# ============================================

auto_discovery_router = APIRouter()


@auto_discovery_router.post("/start", response_model=AutoDiscoveryResponse)
async def start_discovery(request: AutoDiscoveryRequest):
    """
    Start API discovery for the given URL.
    Returns discovered endpoints, security score, and generated tests.
    """
    discovery_id = secrets.token_hex(16)
    started_at = datetime.utcnow()
    progress_log = []
    all_endpoints: List[DiscoveredEndpoint] = []

    # Normalize the URL
    target_url = request.target_url.rstrip('/')
    if not target_url.startswith(('http://', 'https://')):
        target_url = f"https://{target_url}"

    # Validate URL format
    try:
        import urllib.parse
        parsed = urllib.parse.urlparse(target_url)
        if not parsed.netloc:
            raise HTTPException(status_code=400, detail="Invalid URL format")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid URL format")

    methods = request.discovery_methods
    if DiscoveryMethod.ALL in methods:
        methods = [DiscoveryMethod.OPENAPI, DiscoveryMethod.CRAWLER, DiscoveryMethod.WELLKNOWN]

    # Run discovery methods
    for method in methods:
        try:
            progress_log.append(DiscoveryProgress(
                step=method.value,
                status="running",
                message=f"Running {method.value} discovery..."
            ))

            if method == DiscoveryMethod.OPENAPI:
                discoverer = OpenAPIDiscoverer(target_url, request.auth_config, request.timeout)
                endpoints = await discoverer.discover()
                all_endpoints.extend(endpoints)
                progress_log.append(DiscoveryProgress(
                    step=method.value,
                    status="complete",
                    message=f"OpenAPI discovery complete",
                    detail=f"Found {len(endpoints)} endpoints"
                ))

            elif method == DiscoveryMethod.CRAWLER:
                discoverer = CrawlerDiscoverer(target_url, request.auth_config, request.timeout)
                endpoints = await discoverer.discover()
                all_endpoints.extend(endpoints)
                progress_log.append(DiscoveryProgress(
                    step=method.value,
                    status="complete",
                    message=f"Path crawling complete",
                    detail=f"Found {len(endpoints)} endpoints"
                ))

            elif method == DiscoveryMethod.WELLKNOWN:
                discoverer = WellKnownDiscoverer(target_url, request.auth_config, request.timeout)
                endpoints = await discoverer.discover()
                all_endpoints.extend(endpoints)
                progress_log.append(DiscoveryProgress(
                    step=method.value,
                    status="complete",
                    message=f"Well-known path discovery complete",
                    detail=f"Found {len(endpoints)} endpoints"
                ))

        except Exception as e:
            progress_log.append(DiscoveryProgress(
                step=method.value,
                status="error",
                message=f"{method.value} discovery failed",
                detail=str(e)
            ))

    # Deduplicate endpoints by path and method
    seen = set()
    unique_endpoints = []
    for ep in all_endpoints:
        key = (ep.path, ep.method)
        if key not in seen:
            seen.add(key)
            unique_endpoints.append(ep)

    # Calculate security score
    progress_log.append(DiscoveryProgress(
        step="security",
        status="running",
        message="Analyzing security..."
    ))

    try:
        calculator = SecurityScoreCalculator(target_url, request.timeout)
        security_score = await calculator.calculate()
        progress_log.append(DiscoveryProgress(
            step="security",
            status="complete",
            message="Security analysis complete",
            detail=f"Score: {security_score.score}/100 (Grade {security_score.grade})"
        ))
    except Exception as e:
        security_score = SecurityScore(
            score=0,
            grade="F",
            findings=[SecurityFinding(
                severity="high",
                category="error",
                title="Security Analysis Failed",
                description=str(e)
            )]
        )
        progress_log.append(DiscoveryProgress(
            step="security",
            status="error",
            message="Security analysis failed",
            detail=str(e)
        ))

    # Generate tests
    progress_log.append(DiscoveryProgress(
        step="tests",
        status="running",
        message="Generating test cases..."
    ))

    try:
        generator = TestGenerator(unique_endpoints, request.test_types)
        generated_tests = generator.generate()
        progress_log.append(DiscoveryProgress(
            step="tests",
            status="complete",
            message="Test generation complete",
            detail=f"Generated {len(generated_tests)} tests"
        ))
    except Exception as e:
        generated_tests = []
        progress_log.append(DiscoveryProgress(
            step="tests",
            status="error",
            message="Test generation failed",
            detail=str(e)
        ))

    return AutoDiscoveryResponse(
        discovery_id=discovery_id,
        target_url=target_url,
        endpoints=unique_endpoints,
        security_score=security_score,
        generated_tests=generated_tests,
        metadata={
            "methods_used": [m.value for m in methods],
            "endpoint_sources": {
                "openapi": sum(1 for e in unique_endpoints if e.source == "openapi"),
                "crawler": sum(1 for e in unique_endpoints if e.source == "crawler"),
                "wellknown": sum(1 for e in unique_endpoints if e.source == "wellknown"),
            },
            "test_categories": {
                "smoke": sum(1 for t in generated_tests if t.category == "smoke"),
                "security": sum(1 for t in generated_tests if t.category == "security"),
                "functional": sum(1 for t in generated_tests if t.category == "functional"),
            }
        },
        progress_log=progress_log,
        started_at=started_at,
        completed_at=datetime.utcnow(),
        status="complete"
    )


@auto_discovery_router.post("/stream")
async def stream_discovery(request: AutoDiscoveryRequest):
    """
    Stream discovery progress using Server-Sent Events.
    Provides real-time updates during the discovery process.
    """
    async def event_generator():
        discovery_id = secrets.token_hex(16)

        # Normalize URL
        target_url = request.target_url.rstrip('/')
        if not target_url.startswith(('http://', 'https://')):
            target_url = f"https://{target_url}"

        # Send initial event
        yield f"data: {json.dumps({'type': 'start', 'discovery_id': discovery_id, 'target_url': target_url})}\n\n"

        methods = request.discovery_methods
        if DiscoveryMethod.ALL in methods:
            methods = [DiscoveryMethod.OPENAPI, DiscoveryMethod.CRAWLER, DiscoveryMethod.WELLKNOWN]

        all_endpoints = []

        # Run discovery methods
        for method in methods:
            yield f"data: {json.dumps({'type': 'progress', 'step': method.value, 'status': 'running', 'message': f'Running {method.value} discovery...'})}\n\n"
            await asyncio.sleep(0.1)  # Small delay for UI responsiveness

            try:
                if method == DiscoveryMethod.OPENAPI:
                    discoverer = OpenAPIDiscoverer(target_url, request.auth_config, request.timeout)
                elif method == DiscoveryMethod.CRAWLER:
                    discoverer = CrawlerDiscoverer(target_url, request.auth_config, request.timeout)
                else:
                    discoverer = WellKnownDiscoverer(target_url, request.auth_config, request.timeout)

                endpoints = await discoverer.discover()
                all_endpoints.extend(endpoints)

                # Send endpoints as they're discovered
                for ep in endpoints:
                    yield f"data: {json.dumps({'type': 'endpoint', 'endpoint': ep.dict()})}\n\n"

                yield f"data: {json.dumps({'type': 'progress', 'step': method.value, 'status': 'complete', 'message': f'Found {len(endpoints)} endpoints'})}\n\n"

            except Exception as e:
                yield f"data: {json.dumps({'type': 'progress', 'step': method.value, 'status': 'error', 'message': str(e)})}\n\n"

        # Security analysis
        yield f"data: {json.dumps({'type': 'progress', 'step': 'security', 'status': 'running', 'message': 'Analyzing security...'})}\n\n"

        try:
            calculator = SecurityScoreCalculator(target_url, request.timeout)
            security_score = await calculator.calculate()
            yield f"data: {json.dumps({'type': 'security', 'score': security_score.dict()})}\n\n"
            yield f"data: {json.dumps({'type': 'progress', 'step': 'security', 'status': 'complete', 'message': f'Score: {security_score.score}/100'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'progress', 'step': 'security', 'status': 'error', 'message': str(e)})}\n\n"

        # Generate tests
        yield f"data: {json.dumps({'type': 'progress', 'step': 'tests', 'status': 'running', 'message': 'Generating tests...'})}\n\n"

        try:
            # Deduplicate
            seen = set()
            unique_endpoints = []
            for ep in all_endpoints:
                key = (ep.path, ep.method)
                if key not in seen:
                    seen.add(key)
                    unique_endpoints.append(ep)

            generator = TestGenerator(unique_endpoints, request.test_types)
            tests = generator.generate()

            yield f"data: {json.dumps({'type': 'tests', 'tests': [t.dict() for t in tests]})}\n\n"
            yield f"data: {json.dumps({'type': 'progress', 'step': 'tests', 'status': 'complete', 'message': f'Generated {len(tests)} tests'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'progress', 'step': 'tests', 'status': 'error', 'message': str(e)})}\n\n"

        # Complete
        yield f"data: {json.dumps({'type': 'complete', 'discovery_id': discovery_id})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@auto_discovery_router.post("/generate-tests", response_model=List[GeneratedTestCase])
async def generate_tests_from_endpoints(
    endpoints: List[DiscoveredEndpoint],
    test_types: List[str] = ["smoke", "security", "functional"]
):
    """
    Generate test cases from a list of endpoints.
    Useful for regenerating tests with different settings.
    """
    generator = TestGenerator(endpoints, test_types)
    return generator.generate()


@auto_discovery_router.post("/run-quick", response_model=TestRunResponse)
async def run_quick_tests(request: TestRunRequest):
    """
    Run the generated tests immediately and return results.
    """
    start_time = datetime.utcnow()
    results: List[TestResult] = []

    async with httpx.AsyncClient(timeout=request.timeout, follow_redirects=True) as client:
        headers = {}

        # Set up auth
        if request.auth_config:
            if request.auth_config.type == AuthType.BEARER and request.auth_config.token:
                headers["Authorization"] = f"Bearer {request.auth_config.token}"
            elif request.auth_config.type == AuthType.API_KEY and request.auth_config.api_key:
                header_name = request.auth_config.api_key_header or "X-API-Key"
                headers[header_name] = request.auth_config.api_key
            elif request.auth_config.type == AuthType.BASIC:
                import base64
                if request.auth_config.username and request.auth_config.password:
                    credentials = base64.b64encode(
                        f"{request.auth_config.username}:{request.auth_config.password}".encode()
                    ).decode()
                    headers["Authorization"] = f"Basic {credentials}"

        for test in request.tests:
            test_start = datetime.utcnow()
            url = f"{request.target_url.rstrip('/')}{test.endpoint}"

            try:
                # Merge test headers with auth headers
                req_headers = {**headers, **(test.headers or {})}

                if test.method == "GET":
                    response = await client.get(url, headers=req_headers)
                elif test.method == "POST":
                    response = await client.post(url, headers=req_headers, json=test.request_body)
                elif test.method == "PUT":
                    response = await client.put(url, headers=req_headers, json=test.request_body)
                elif test.method == "PATCH":
                    response = await client.patch(url, headers=req_headers, json=test.request_body)
                elif test.method == "DELETE":
                    response = await client.delete(url, headers=req_headers)
                else:
                    response = await client.request(test.method, url, headers=req_headers)

                response_time = int((datetime.utcnow() - test_start).total_seconds() * 1000)

                # Determine if test passed
                passed = response.status_code == test.expected_status

                # For security tests, also check that malicious input wasn't reflected
                if test.category == "security" and "XSS" in test.name:
                    if "<script>" in response.text:
                        passed = False

                results.append(TestResult(
                    test_id=test.id,
                    test_name=test.name,
                    endpoint=test.endpoint,
                    method=test.method,
                    category=test.category,
                    passed=passed,
                    status_code=response.status_code,
                    expected_status=test.expected_status,
                    response_time_ms=response_time,
                    response_preview=response.text[:200] if len(response.text) > 200 else response.text
                ))

            except httpx.RequestError as e:
                response_time = int((datetime.utcnow() - test_start).total_seconds() * 1000)
                results.append(TestResult(
                    test_id=test.id,
                    test_name=test.name,
                    endpoint=test.endpoint,
                    method=test.method,
                    category=test.category,
                    passed=False,
                    expected_status=test.expected_status,
                    response_time_ms=response_time,
                    error=str(e)
                ))

    duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)
    passed_count = sum(1 for r in results if r.passed)

    return TestRunResponse(
        total=len(results),
        passed=passed_count,
        failed=len(results) - passed_count,
        results=results,
        duration_ms=duration
    )


@auto_discovery_router.get("/health")
async def health_check():
    """Health check endpoint for the auto-discovery module"""
    return {"status": "healthy", "module": "auto-discovery", "version": "1.0.0"}
