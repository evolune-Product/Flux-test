"""
CI/CD Trigger Module — Flasqo
──────────────────────────────
API key management + pipeline-triggered test execution.

Routes  (all prefixed /ci):
  POST   /ci/keys              Create API key          [JWT auth]
  GET    /ci/keys              List API keys           [JWT auth]
  DELETE /ci/keys/{key_id}     Revoke API key          [JWT auth]
  POST   /ci/trigger           Sync suite execution    [API key auth]
  POST   /ci/trigger/async     Async suite execution   [API key auth]
  GET    /ci/run/{run_id}      Poll async run status   [API key auth]
  GET    /ci/runs              Dashboard run history   [JWT auth]
"""

import hashlib
import json
import os
import secrets
import sys
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Integer, String, create_engine, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

# ── Path — ensure v3.py is importable ─────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from v3 import APITester  # noqa: E402

# ── Database ───────────────────────────────────────────────────────────────────
_DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/evo_tfx")
if _DB_URL.startswith("postgres://"):
    _DB_URL = _DB_URL.replace("postgres://", "postgresql://", 1)

_engine  = create_engine(_DB_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
Base     = declarative_base()


def get_db():
    db = _Session()
    try:
        yield db
    finally:
        db.close()


# ── Config ─────────────────────────────────────────────────────────────────────
_SECRET_KEY  = os.getenv("SECRET_KEY", "")
_ALGORITHM   = "HS256"
_KEY_PREFIX  = "flq_live_"
_BACKEND_URL = os.getenv("BACKEND_URL", "https://flasqo.com")
_security    = HTTPBearer()


# ── SQLAlchemy Models ──────────────────────────────────────────────────────────

class APIKeyDB(Base):
    __tablename__ = "api_keys"

    key_id       = Column(String, primary_key=True)
    user_id      = Column(String, nullable=False, index=True)     # ref: users.user_id
    name         = Column(String,  nullable=False)
    key_hash     = Column(String,  nullable=False, unique=True)   # SHA-256 — never expose
    key_prefix   = Column(String,  nullable=False)                # first 16 chars for display
    is_active    = Column(Boolean, nullable=False, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    expires_at   = Column(DateTime, nullable=True)


class CIRunDB(Base):
    __tablename__ = "ci_runs"

    run_id            = Column(String, primary_key=True)
    suite_id          = Column(String, nullable=False, index=True) # ref: test_suites.suite_id
    user_id           = Column(String, nullable=False, index=True) # ref: users.user_id
    api_key_id        = Column(String, nullable=False)             # ref: api_keys.key_id
    status            = Column(String,  nullable=False, default="queued")  # queued|running|passed|failed|error
    triggered_by      = Column(String,  nullable=True)
    branch            = Column(String,  nullable=True)
    commit_sha        = Column(String,  nullable=True)
    environment       = Column(String,  nullable=True)
    base_url_override = Column(String,  nullable=True)
    total             = Column(Integer, nullable=True)
    passed            = Column(Integer, nullable=True)
    failed            = Column(Integer, nullable=True)
    duration_ms       = Column(Integer, nullable=True)
    results           = Column(JSONB,   nullable=True)
    error             = Column(String,  nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)
    completed_at      = Column(DateTime, nullable=True)


# Create new tables on startup (existing tables are untouched)
Base.metadata.create_all(bind=_engine)


# ── Pydantic Schemas ───────────────────────────────────────────────────────────

class CreateKeyRequest(BaseModel):
    name: str
    expires_in_days: Optional[int] = None   # None = never expires


class CreateKeyResponse(BaseModel):
    key_id: str
    name: str
    key: str                                # Full key — shown ONCE, never stored
    key_prefix: str
    created_at: str
    expires_at: Optional[str] = None


class KeyListItem(BaseModel):
    key_id: str
    name: str
    key_prefix: str
    is_active: bool
    created_at: str
    last_used_at: Optional[str] = None
    expires_at: Optional[str]   = None


class TriggerRequest(BaseModel):
    suite_id: str
    environment: Optional[str]       = None
    base_url_override: Optional[str] = None
    triggered_by: Optional[str]      = "api"
    branch: Optional[str]            = None
    commit_sha: Optional[str]        = None
    timeout: Optional[int]           = 30


class FailureItem(BaseModel):
    test: str
    details: str


class TriggerResponse(BaseModel):
    run_id: str
    status: str
    suite_name: str
    total: int
    passed: int
    failed: int
    pass_rate: float
    duration_ms: int
    triggered_at: str
    completed_at: str
    report_url: str
    failures: List[FailureItem]


class AsyncTriggerResponse(BaseModel):
    run_id: str
    status: str
    poll_url: str
    message: str


class RunStatusResponse(BaseModel):
    run_id: str
    status: str
    suite_id: str
    total: Optional[int]               = None
    passed: Optional[int]              = None
    failed: Optional[int]              = None
    pass_rate: Optional[float]         = None
    duration_ms: Optional[int]         = None
    triggered_at: str
    completed_at: Optional[str]        = None
    report_url: Optional[str]          = None
    failures: Optional[List[FailureItem]] = None
    error: Optional[str]               = None


# ── Auth ───────────────────────────────────────────────────────────────────────

def _hash_key(raw: str) -> str:
    """SHA-256 of a raw API key. Fast & appropriate for long random tokens."""
    return hashlib.sha256(raw.encode()).hexdigest()


def _verify_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
) -> str:
    """Validate JWT bearer token (browser session). Returns username."""
    try:
        payload  = jwt.decode(credentials.credentials, _SECRET_KEY, algorithms=[_ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _verify_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    db: Session = Depends(get_db),
) -> Dict[str, str]:
    """Validate Flasqo API key (CI pipelines). Returns {user_id, key_id}."""
    raw = credentials.credentials

    if not raw.startswith(_KEY_PREFIX):
        raise HTTPException(status_code=401, detail="Invalid API key — expected flq_live_...")

    record = db.query(APIKeyDB).filter(
        APIKeyDB.key_hash == _hash_key(raw),
        APIKeyDB.is_active == True,
    ).first()

    if not record:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key")

    if record.expires_at and record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="API key has expired")

    record.last_used_at = datetime.utcnow()
    db.commit()

    return {"user_id": record.user_id, "key_id": record.key_id}


# ── DB Helpers (raw SQL avoids cross-module SQLAlchemy model conflicts) ─────────

def _get_user_id(username: str, db: Session) -> str:
    row = db.execute(
        text("SELECT user_id FROM users WHERE username = :u"),
        {"u": username},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row[0]


def _get_suite(suite_id: str, user_id: str, db: Session) -> Dict[str, Any]:
    """Fetch suite and verify ownership (direct or via team membership)."""
    row = db.execute(
        text("""
            SELECT s.suite_id, s.suite_name, s.api_url, s.auth_config, s.test_cases
            FROM   test_suites s
            WHERE  s.suite_id = :sid
              AND (
                    s.created_by = :uid
                    OR EXISTS (
                        SELECT 1 FROM team_members tm
                        WHERE  tm.team_id = s.team_id
                          AND  tm.user_id = :uid
                    )
                  )
        """),
        {"sid": suite_id, "uid": user_id},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Suite not found or access denied")

    def _coerce(val):
        if val is None:
            return None
        return val if isinstance(val, (dict, list)) else json.loads(val)

    return {
        "suite_id":   row[0],
        "suite_name": row[1],
        "api_url":    row[2],
        "auth_config": _coerce(row[3]) or {},
        "test_cases":  _coerce(row[4]) or [],
    }


# ── Execution ──────────────────────────────────────────────────────────────────

def _run_suite(suite: Dict[str, Any], req: TriggerRequest) -> Dict[str, Any]:
    """Execute every test case in the suite. Returns structured result dict."""
    base_url = req.base_url_override or suite["api_url"]
    t0       = int(time.time() * 1000)

    tester = APITester(
        base_url         = base_url,
        auth_config      = suite["auth_config"],
        timeout          = req.timeout or 30,
        openai_api_key   = os.getenv("OPENAI_API_KEY"),
        enable_ai_analysis = False,    # CI runs must be fast — AI analysis disabled
    )

    for tc in suite["test_cases"]:
        tester.test_request(
            method          = tc.get("method", "GET"),
            endpoint        = tc.get("endpoint", ""),
            data            = tc.get("data") or tc.get("body"),
            expected_status = tc.get("expected_status", 200),
            headers         = tc.get("headers"),
            test_name       = tc.get("name") or tc.get("test_name") or tc.get("description"),
            params          = tc.get("params"),
            expected_schema = tc.get("expected_schema"),
            validate_body   = tc.get("validate_body", False),
        )

    duration_ms = int(time.time() * 1000) - t0
    results     = tester.results
    total       = len(results)
    passed      = sum(1 for r in results if r["status"] == "PASS")

    return {
        "total":       total,
        "passed":      passed,
        "failed":      total - passed,
        "duration_ms": duration_ms,
        "results":     results,
        "failures": [
            {"test": r["test"], "details": r["details"]}
            for r in results if r["status"] != "PASS"
        ],
    }


def _background_run(run_id: str, suite: Dict[str, Any], req: TriggerRequest) -> None:
    """Background task: runs outside request context — owns its own DB session."""
    db = _Session()
    try:
        run        = db.query(CIRunDB).filter(CIRunDB.run_id == run_id).first()
        run.status = "running"
        db.commit()

        data = _run_suite(suite, req)

        run.status       = "passed" if data["failed"] == 0 else "failed"
        run.total        = data["total"]
        run.passed       = data["passed"]
        run.failed       = data["failed"]
        run.duration_ms  = data["duration_ms"]
        run.results      = data["results"]
        run.completed_at = datetime.utcnow()

    except Exception as exc:
        run = db.query(CIRunDB).filter(CIRunDB.run_id == run_id).first()
        if run:
            run.status       = "error"
            run.error        = str(exc)
            run.completed_at = datetime.utcnow()
    finally:
        db.commit()
        db.close()


# ── Shared response builder ────────────────────────────────────────────────────

def _build_run_response(run: CIRunDB) -> RunStatusResponse:
    failures  = None
    pass_rate = None

    if run.status in ("passed", "failed") and run.results:
        failures  = [
            FailureItem(test=r["test"], details=r["details"])
            for r in run.results if r.get("status") != "PASS"
        ]
        pass_rate = round(run.passed / run.total * 100, 1) if run.total else 0.0

    return RunStatusResponse(
        run_id       = run.run_id,
        status       = run.status,
        suite_id     = run.suite_id,
        total        = run.total,
        passed       = run.passed,
        failed       = run.failed,
        pass_rate    = pass_rate,
        duration_ms  = run.duration_ms,
        triggered_at = run.created_at.isoformat(),
        completed_at = run.completed_at.isoformat() if run.completed_at else None,
        report_url   = (
            f"{_BACKEND_URL}/report/{run.run_id}"
            if run.status in ("passed", "failed") else None
        ),
        failures     = failures,
        error        = run.error,
    )


# ── Router ─────────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/ci", tags=["CI/CD Trigger"])


# ── Key Management ──────────────────────────────────────────────────────────────

@router.post("/keys", response_model=CreateKeyResponse, status_code=201)
async def create_api_key(
    req: CreateKeyRequest,
    username: str  = Depends(_verify_jwt),
    db: Session    = Depends(get_db),
):
    """
    Create a CI/CD API key.
    The full key is returned **once only** — store it immediately and securely.
    It cannot be retrieved again after this response.
    """
    user_id = _get_user_id(username, db)
    raw_key = _KEY_PREFIX + secrets.token_urlsafe(32)
    key_id  = "key_" + secrets.token_urlsafe(12)

    expires_at = (
        datetime.utcnow() + timedelta(days=req.expires_in_days)
        if req.expires_in_days else None
    )

    db.add(APIKeyDB(
        key_id     = key_id,
        user_id    = user_id,
        name       = req.name.strip(),
        key_hash   = _hash_key(raw_key),
        key_prefix = raw_key[:16],
        is_active  = True,
        created_at = datetime.utcnow(),
        expires_at = expires_at,
    ))
    db.commit()

    return CreateKeyResponse(
        key_id     = key_id,
        name       = req.name,
        key        = raw_key,
        key_prefix = raw_key[:16],
        created_at = datetime.utcnow().isoformat(),
        expires_at = expires_at.isoformat() if expires_at else None,
    )


@router.get("/keys", response_model=List[KeyListItem])
async def list_api_keys(
    username: str = Depends(_verify_jwt),
    db: Session   = Depends(get_db),
):
    """List all CI/CD API keys belonging to the current user."""
    user_id = _get_user_id(username, db)
    keys    = (
        db.query(APIKeyDB)
        .filter(APIKeyDB.user_id == user_id)
        .order_by(APIKeyDB.created_at.desc())
        .all()
    )
    return [
        KeyListItem(
            key_id       = k.key_id,
            name         = k.name,
            key_prefix   = k.key_prefix,
            is_active    = k.is_active,
            created_at   = k.created_at.isoformat(),
            last_used_at = k.last_used_at.isoformat() if k.last_used_at else None,
            expires_at   = k.expires_at.isoformat() if k.expires_at else None,
        )
        for k in keys
    ]


@router.delete("/keys/{key_id}", status_code=200)
async def revoke_api_key(
    key_id: str,
    username: str = Depends(_verify_jwt),
    db: Session   = Depends(get_db),
):
    """
    Revoke an API key immediately.
    Any CI pipeline using it will fail authentication on the next run.
    """
    user_id = _get_user_id(username, db)
    key     = db.query(APIKeyDB).filter(
        APIKeyDB.key_id  == key_id,
        APIKeyDB.user_id == user_id,
    ).first()

    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    key.is_active = False
    db.commit()
    return {"message": "API key revoked"}


# ── Trigger — Synchronous ──────────────────────────────────────────────────────

@router.post("/trigger", response_model=TriggerResponse)
async def trigger_sync(
    req: TriggerRequest,
    fail_on_error: bool = Query(
        default=False,
        description=(
            "Return HTTP 422 when tests fail. "
            "Use with `curl --fail-with-body` to halt the pipeline on failure."
        ),
    ),
    auth: Dict = Depends(_verify_api_key),
    db: Session = Depends(get_db),
):
    """
    Run a saved test suite synchronously and return full results.

    **Minimal GitHub Actions step:**
    ```yaml
    - name: Flasqo Quality Gate
      run: |
        curl -sX POST "${{ env.FLASQO_URL }}/ci/trigger?fail_on_error=true" \\
          -H "Authorization: Bearer ${{ secrets.FLASQO_API_KEY }}" \\
          -H "Content-Type: application/json" \\
          -d '{"suite_id":"YOUR_SUITE_ID","branch":"${{ github.ref_name }}","commit_sha":"${{ github.sha }}","triggered_by":"github-actions"}' \\
          --fail-with-body
    ```
    """
    suite   = _get_suite(req.suite_id, auth["user_id"], db)
    run_id  = "run_" + secrets.token_urlsafe(12)
    started = datetime.utcnow()

    ci_run = CIRunDB(
        run_id            = run_id,
        suite_id          = req.suite_id,
        user_id           = auth["user_id"],
        api_key_id        = auth["key_id"],
        status            = "running",
        triggered_by      = req.triggered_by,
        branch            = req.branch,
        commit_sha        = req.commit_sha,
        environment       = req.environment,
        base_url_override = req.base_url_override,
        created_at        = started,
    )
    db.add(ci_run)
    db.commit()

    try:
        data = _run_suite(suite, req)
    except Exception as exc:
        ci_run.status       = "error"
        ci_run.error        = str(exc)
        ci_run.completed_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=500, detail=f"Execution error: {exc}")

    finished   = datetime.utcnow()
    run_status = "passed" if data["failed"] == 0 else "failed"

    ci_run.status       = run_status
    ci_run.total        = data["total"]
    ci_run.passed       = data["passed"]
    ci_run.failed       = data["failed"]
    ci_run.duration_ms  = data["duration_ms"]
    ci_run.results      = data["results"]
    ci_run.completed_at = finished
    db.commit()

    pass_rate = round(data["passed"] / data["total"] * 100, 1) if data["total"] else 0.0
    failures  = [FailureItem(**f) for f in data["failures"]]

    response = TriggerResponse(
        run_id       = run_id,
        status       = run_status,
        suite_name   = suite["suite_name"],
        total        = data["total"],
        passed       = data["passed"],
        failed       = data["failed"],
        pass_rate    = pass_rate,
        duration_ms  = data["duration_ms"],
        triggered_at = started.isoformat(),
        completed_at = finished.isoformat(),
        report_url   = f"{_BACKEND_URL}/report/{run_id}",
        failures     = failures,
    )

    if fail_on_error and run_status == "failed":
        raise HTTPException(status_code=422, detail=response.model_dump())

    return response


# ── Trigger — Asynchronous ─────────────────────────────────────────────────────

@router.post("/trigger/async", response_model=AsyncTriggerResponse, status_code=202)
async def trigger_async(
    req: TriggerRequest,
    background_tasks: BackgroundTasks,
    auth: Dict = Depends(_verify_api_key),
    db: Session = Depends(get_db),
):
    """
    Queue a test suite run and return a run_id immediately (HTTP 202).
    Poll `GET /ci/run/{run_id}` until status is `passed`, `failed`, or `error`.

    Use this for large suites that exceed gateway timeout limits (>30 s).
    """
    suite  = _get_suite(req.suite_id, auth["user_id"], db)
    run_id = "run_" + secrets.token_urlsafe(12)

    db.add(CIRunDB(
        run_id            = run_id,
        suite_id          = req.suite_id,
        user_id           = auth["user_id"],
        api_key_id        = auth["key_id"],
        status            = "queued",
        triggered_by      = req.triggered_by,
        branch            = req.branch,
        commit_sha        = req.commit_sha,
        environment       = req.environment,
        base_url_override = req.base_url_override,
        created_at        = datetime.utcnow(),
    ))
    db.commit()

    background_tasks.add_task(_background_run, run_id, suite, req)

    poll_url = f"{_BACKEND_URL}/ci/run/{run_id}"
    return AsyncTriggerResponse(
        run_id   = run_id,
        status   = "queued",
        poll_url = poll_url,
        message  = f"Suite queued. Poll {poll_url} for results.",
    )


# ── Run Status & History ───────────────────────────────────────────────────────

@router.get("/run/{run_id}", response_model=RunStatusResponse)
async def get_run_status(
    run_id: str,
    auth: Dict  = Depends(_verify_api_key),
    db: Session = Depends(get_db),
):
    """Poll the status of an async CI run by run_id."""
    run = db.query(CIRunDB).filter(
        CIRunDB.run_id  == run_id,
        CIRunDB.user_id == auth["user_id"],
    ).first()

    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return _build_run_response(run)


@router.get("/runs", response_model=List[RunStatusResponse])
async def list_runs(
    limit: int    = Query(default=20, le=100, description="Max runs to return"),
    username: str = Depends(_verify_jwt),
    db: Session   = Depends(get_db),
):
    """Return recent CI runs for the dashboard (JWT auth)."""
    user_id = _get_user_id(username, db)
    runs    = (
        db.query(CIRunDB)
        .filter(CIRunDB.user_id == user_id)
        .order_by(CIRunDB.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_build_run_response(r) for r in runs]
