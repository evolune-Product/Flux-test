"""
GitHub Webhook Trigger Module — Flasqo
────────────────────────────────────────
Flasqo-initiated webhook: GitHub pushes an event → Flasqo runs the linked
test suite in the background → posts commit status (✅ / ❌) back to the PR.

Routes  (all prefixed /webhooks):
  POST   /webhooks/github/{config_id}   Receive webhook from GitHub  [HMAC verified, public]
  POST   /webhooks/configs              Create webhook config         [JWT auth]
  GET    /webhooks/configs              List webhook configs          [JWT auth]
  DELETE /webhooks/configs/{config_id}  Delete config + unregister   [JWT auth]
  PATCH  /webhooks/configs/{config_id}  Enable / disable config      [JWT auth]
  GET    /webhooks/runs                 Run history                   [JWT auth]
  GET    /webhooks/runs/{run_id}        Single run detail             [JWT auth]

Design notes
────────────
• Fully self-contained — owns its own SQLAlchemy Base + engine.
• Cross-module table lookups (users, test_suites) use raw SQL via text()
  to avoid ForeignKey resolution errors across different Base objects.
• GitHub API calls in background tasks use synchronous httpx.Client so
  there is no asyncio event-loop contention with the main FastAPI loop.
• Webhook secrets are stored as plaintext (they are 64-char random hex
  strings we generate — not user-provided passwords). They are required
  at HMAC verification time so hashing is not appropriate here.
"""

import hashlib
import hmac
import json
import os
import secrets
import sys
import time
from datetime import datetime
from typing import List, Optional

import httpx
import jwt
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Integer, String, create_engine, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

# ── Path: ensure v3.py is importable ─────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from v3 import APITester  # noqa: E402

# ── Database ──────────────────────────────────────────────────────────────────
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


# ── Config ────────────────────────────────────────────────────────────────────
_SECRET_KEY  = os.getenv("SECRET_KEY", "")
_ALGORITHM   = "HS256"
_BACKEND_URL = os.getenv("BACKEND_URL", "https://flasqo.com").rstrip("/")
_security    = HTTPBearer()


# ── Models ────────────────────────────────────────────────────────────────────

class WebhookConfigDB(Base):
    __tablename__ = "webhook_configs"

    config_id          = Column(String,  primary_key=True)
    user_id            = Column(String,  nullable=False, index=True)   # ref: users.user_id
    suite_id           = Column(String,  nullable=False)               # ref: test_suites.suite_id
    suite_name         = Column(String,  nullable=False)               # denormalized for display
    repo_full_name     = Column(String,  nullable=False)               # "owner/repo"
    branch_filter      = Column(String,  nullable=False, default="*")  # "*" = all branches
    events             = Column(JSONB,   nullable=False)               # ["push","pull_request"]
    webhook_id         = Column(Integer, nullable=True)                # GitHub hook ID for management
    webhook_secret     = Column(String,  nullable=False)               # raw HMAC secret (64-char hex)
    is_active          = Column(Boolean, nullable=False, default=True)
    post_commit_status = Column(Boolean, nullable=False, default=True)
    created_at         = Column(DateTime, default=datetime.utcnow)
    updated_at         = Column(DateTime, default=datetime.utcnow)


class WebhookRunDB(Base):
    __tablename__ = "webhook_runs"

    run_id               = Column(String,  primary_key=True)
    config_id            = Column(String,  nullable=False, index=True) # ref: webhook_configs.config_id
    user_id              = Column(String,  nullable=False, index=True) # ref: users.user_id
    suite_id             = Column(String,  nullable=False)
    repo_full_name       = Column(String,  nullable=False)
    branch               = Column(String,  nullable=True)
    commit_sha           = Column(String,  nullable=True)
    event_type           = Column(String,  nullable=True)              # "push" | "pull_request"
    pr_number            = Column(Integer, nullable=True)
    status               = Column(String,  nullable=False, default="queued")  # queued|running|passed|failed|error
    total                = Column(Integer, nullable=True)
    passed               = Column(Integer, nullable=True)
    failed               = Column(Integer, nullable=True)
    duration_ms          = Column(Integer, nullable=True)
    results              = Column(JSONB,   nullable=True)
    error                = Column(String,  nullable=True)
    commit_status_posted = Column(Boolean, nullable=False, default=False)
    created_at           = Column(DateTime, default=datetime.utcnow)
    completed_at         = Column(DateTime, nullable=True)


# Create tables on startup (existing tables untouched)
Base.metadata.create_all(bind=_engine)


# ── Pydantic Schemas ──────────────────────────────────────────────────────────

class CreateConfigRequest(BaseModel):
    repo_full_name:     str
    suite_id:           str
    branch_filter:      str       = "*"
    events:             List[str] = ["push", "pull_request"]
    post_commit_status: bool      = True


class PatchConfigRequest(BaseModel):
    is_active: bool


class ConfigResponse(BaseModel):
    config_id:          str
    repo_full_name:     str
    suite_id:           str
    suite_name:         str
    branch_filter:      str
    events:             List[str]
    is_active:          bool
    post_commit_status: bool
    webhook_url:        str
    created_at:         str


class RunResponse(BaseModel):
    run_id:               str
    config_id:            str
    repo_full_name:       str
    branch:               Optional[str]
    commit_sha:           Optional[str]
    event_type:           Optional[str]
    pr_number:            Optional[int]
    status:               str
    total:                Optional[int]
    passed:               Optional[int]
    failed:               Optional[int]
    duration_ms:          Optional[int]
    error:                Optional[str]
    commit_status_posted: bool
    created_at:           str
    completed_at:         Optional[str]


# ── Auth Helpers ──────────────────────────────────────────────────────────────

def _verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(_security)) -> str:
    """Decode JWT; return username or raise 401."""
    try:
        payload  = jwt.decode(credentials.credentials, _SECRET_KEY, algorithms=[_ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _get_user(username: str, db: Session) -> dict:
    """Return user row dict; raises 404 if not found."""
    row = db.execute(
        text("SELECT user_id, github_token, github_username FROM users WHERE username = :u"),
        {"u": username},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user_id": row[0], "github_token": row[1], "github_username": row[2]}


def _get_suite(suite_id: str, user_id: str, db: Session) -> dict:
    """Return suite dict; checks ownership or team membership."""
    row = db.execute(text("""
        SELECT ts.suite_id, ts.suite_name, ts.api_url, ts.test_cases, ts.auth_config
        FROM   test_suites ts
        WHERE  ts.suite_id = :sid
          AND  (
            ts.created_by = :uid
            OR ts.team_id IN (
                SELECT team_id FROM team_members WHERE user_id = :uid
            )
          )
    """), {"sid": suite_id, "uid": user_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Test suite not found or access denied")
    return {
        "suite_id":   row[0],
        "suite_name": row[1],
        "api_url":    row[2],
        "test_cases": row[3] or [],
        "auth_config": row[4] or {},
    }


# ── HMAC Signature Verification ───────────────────────────────────────────────

def _verify_signature(body: bytes, secret: str, sig_header: str) -> bool:
    """Constant-time HMAC-SHA256 verification of GitHub webhook signature."""
    if not sig_header or not sig_header.startswith("sha256="):
        return False
    mac      = hmac.new(secret.encode("utf-8"), body, hashlib.sha256)
    expected = "sha256=" + mac.hexdigest()
    return hmac.compare_digest(expected, sig_header)


# ── Synchronous GitHub API Helpers (used from background threads) ─────────────

_GH_HEADERS = {
    "Accept":               "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


def _gh_register_webhook_sync(
    token: str,
    repo_full_name: str,
    webhook_url: str,
    secret: str,
    events: List[str],
) -> int:
    """Register webhook on GitHub; return webhook ID."""
    url     = f"https://api.github.com/repos/{repo_full_name}/hooks"
    headers = {**_GH_HEADERS, "Authorization": f"token {token}"}
    payload = {
        "name":   "web",
        "active": True,
        "events": events,
        "config": {
            "url":          webhook_url,
            "content_type": "json",
            "secret":       secret,
            "insecure_ssl": "0",
        },
    }
    with httpx.Client(timeout=20) as client:
        resp = client.post(url, headers=headers, json=payload)

    if resp.status_code == 422:
        raise HTTPException(status_code=409, detail="A webhook already exists for this URL on this repo")
    if resp.status_code not in (200, 201):
        msg = resp.json().get("message", resp.text)
        raise HTTPException(status_code=502, detail=f"GitHub API error: {msg}")
    return resp.json()["id"]


def _gh_delete_webhook_sync(token: str, repo_full_name: str, webhook_id: int) -> None:
    """Delete webhook from GitHub (best-effort)."""
    if not webhook_id:
        return
    url     = f"https://api.github.com/repos/{repo_full_name}/hooks/{webhook_id}"
    headers = {**_GH_HEADERS, "Authorization": f"token {token}"}
    with httpx.Client(timeout=15) as client:
        client.delete(url, headers=headers)  # ignore errors — hook may already be gone


def _gh_post_commit_status_sync(
    token: str,
    repo_full_name: str,
    commit_sha: str,
    state: str,          # "pending" | "success" | "failure" | "error"
    description: str,
    target_url: str = "",
) -> None:
    """Post a commit status to the GitHub Commit Status API."""
    url     = f"https://api.github.com/repos/{repo_full_name}/statuses/{commit_sha}"
    headers = {**_GH_HEADERS, "Authorization": f"token {token}"}
    payload = {
        "state":       state,
        "description": description[:140],   # GitHub hard limit
        "context":     "flasqo/quality-gate",
        "target_url":  target_url or "",
    }
    with httpx.Client(timeout=15) as client:
        client.post(url, headers=headers, json=payload)


# ── Background Test Runner ────────────────────────────────────────────────────

def _background_run(run_id: str, config_id: str) -> None:
    """
    Runs in a FastAPI BackgroundTask thread.
    1. Load run + config + suite from DB.
    2. Post "pending" commit status to GitHub.
    3. Execute the test suite via APITester.
    4. Save results, post "success"/"failure" commit status.
    """
    db = _Session()
    try:
        run    = db.query(WebhookRunDB).filter(WebhookRunDB.run_id == run_id).first()
        config = db.query(WebhookConfigDB).filter(WebhookConfigDB.config_id == config_id).first()

        if not run or not config:
            if run:
                run.status = "error"
                run.error  = "Config missing"
                db.commit()
            return

        # Fetch suite
        suite_row = db.execute(text("""
            SELECT api_url, test_cases, auth_config
            FROM   test_suites
            WHERE  suite_id = :sid
        """), {"sid": run.suite_id}).fetchone()

        if not suite_row:
            run.status = "error"
            run.error  = "Test suite not found"
            db.commit()
            return

        api_url, test_cases, auth_cfg = suite_row
        test_cases = test_cases or []
        auth_cfg   = auth_cfg   or {}

        # Fetch user's GitHub token for commit status posting
        user_row     = db.execute(
            text("SELECT github_token FROM users WHERE user_id = :uid"),
            {"uid": run.user_id},
        ).fetchone()
        github_token = user_row[0] if user_row else None

        # Mark running + post "pending" to GitHub
        run.status = "running"
        db.commit()

        if config.post_commit_status and github_token and run.commit_sha:
            try:
                _gh_post_commit_status_sync(
                    github_token, run.repo_full_name, run.commit_sha,
                    "pending", "Flasqo quality gate is running…",
                )
            except Exception:
                pass  # Never let a GitHub API failure kill the test run

        # ── Execute suite ─────────────────────────────────────────────────────
        t_start = time.time()
        try:
            tester = APITester(
                base_url=api_url,
                auth_config=auth_cfg,
                enable_ai_analysis=False,   # speed over insight for CI gates
            )
            tester.run_ai_generated_tests(test_cases)
            results  = tester.results
            total    = len(results)
            passed_n = sum(1 for r in results if r.get("status") == "PASS")
            failed_n = total - passed_n
            suite_ok = failed_n == 0
        except Exception as exc:
            run.status       = "error"
            run.error        = str(exc)[:500]
            run.completed_at = datetime.utcnow()
            db.commit()
            if config.post_commit_status and github_token and run.commit_sha:
                try:
                    _gh_post_commit_status_sync(
                        github_token, run.repo_full_name, run.commit_sha,
                        "error", f"Flasqo error: {str(exc)[:100]}",
                    )
                except Exception:
                    pass
            return
        # ─────────────────────────────────────────────────────────────────────

        duration_ms = int((time.time() - t_start) * 1000)

        run.status       = "passed" if suite_ok else "failed"
        run.total        = total
        run.passed       = passed_n
        run.failed       = failed_n
        run.duration_ms  = duration_ms
        run.results      = results
        run.completed_at = datetime.utcnow()

        # Post final commit status
        if config.post_commit_status and github_token and run.commit_sha:
            gh_state  = "success" if suite_ok else "failure"
            desc      = (f"All {total} tests passed" if suite_ok
                         else f"{failed_n} of {total} tests failed")
            run_url   = f"{_BACKEND_URL}/webhooks/runs/{run.run_id}"
            try:
                _gh_post_commit_status_sync(
                    github_token, run.repo_full_name, run.commit_sha,
                    gh_state, desc, run_url,
                )
                run.commit_status_posted = True
            except Exception:
                pass

        db.commit()

    except Exception as exc:
        try:
            run = db.query(WebhookRunDB).filter(WebhookRunDB.run_id == run_id).first()
            if run:
                run.status       = "error"
                run.error        = str(exc)[:500]
                run.completed_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _config_to_response(c: WebhookConfigDB) -> ConfigResponse:
    return ConfigResponse(
        config_id          = c.config_id,
        repo_full_name     = c.repo_full_name,
        suite_id           = c.suite_id,
        suite_name         = c.suite_name,
        branch_filter      = c.branch_filter,
        events             = c.events,
        is_active          = c.is_active,
        post_commit_status = c.post_commit_status,
        webhook_url        = f"{_BACKEND_URL}/webhooks/github/{c.config_id}",
        created_at         = c.created_at.isoformat(),
    )


def _run_to_response(r: WebhookRunDB) -> RunResponse:
    return RunResponse(
        run_id               = r.run_id,
        config_id            = r.config_id,
        repo_full_name       = r.repo_full_name,
        branch               = r.branch,
        commit_sha           = r.commit_sha,
        event_type           = r.event_type,
        pr_number            = r.pr_number,
        status               = r.status,
        total                = r.total,
        passed               = r.passed,
        failed               = r.failed,
        duration_ms          = r.duration_ms,
        error                = r.error,
        commit_status_posted = r.commit_status_posted,
        created_at           = r.created_at.isoformat(),
        completed_at         = r.completed_at.isoformat() if r.completed_at else None,
    )


# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter(tags=["GitHub Webhook Trigger"])


# ── Public: receive GitHub webhook ────────────────────────────────────────────

@router.post("/webhooks/github/{config_id}", status_code=200)
async def receive_github_webhook(
    config_id:        str,
    request:          Request,
    background_tasks: BackgroundTasks,
    db:               Session = Depends(get_db),
):
    """
    Public endpoint — GitHub POSTs here on push / pull_request events.
    Verifies HMAC-SHA256 signature, creates a run record, enqueues the
    background test execution and returns 200 immediately so GitHub does
    not retry.
    """
    body       = await request.body()
    sig_header = request.headers.get("X-Hub-Signature-256", "")
    event_type = request.headers.get("X-GitHub-Event", "")

    config = db.query(WebhookConfigDB).filter(
        WebhookConfigDB.config_id == config_id,
        WebhookConfigDB.is_active == True,
    ).first()

    if not config:
        # Return 200 — stops GitHub retries when a config is deleted or disabled
        return {"status": "ignored", "reason": "config not found or disabled"}

    if not _verify_signature(body, config.webhook_secret, sig_header):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # ── Extract fields per event type ─────────────────────────────────────────
    commit_sha = None
    branch     = None
    pr_number  = None

    if event_type == "push":
        commit_sha = payload.get("after")
        ref        = payload.get("ref", "")
        branch     = ref.removeprefix("refs/heads/") if ref.startswith("refs/heads/") else ref

    elif event_type == "pull_request":
        action    = payload.get("action", "")
        if action not in ("opened", "synchronize", "reopened"):
            return {"status": "ignored", "reason": f"PR action '{action}' skipped"}
        pr_data   = payload.get("pull_request", {})
        head      = pr_data.get("head", {})
        commit_sha = head.get("sha")
        branch     = head.get("ref")
        pr_number  = payload.get("number")

    else:
        return {"status": "ignored", "reason": f"Event '{event_type}' not handled"}

    # Branch filter
    if config.branch_filter != "*" and branch != config.branch_filter:
        return {"status": "ignored", "reason": f"Branch '{branch}' filtered (expected '{config.branch_filter}')"}

    # Repo guard
    repo_name = payload.get("repository", {}).get("full_name", "")
    if repo_name and repo_name != config.repo_full_name:
        return {"status": "ignored", "reason": "Repo name mismatch"}

    # Create run record
    run_id = f"wh_{secrets.token_urlsafe(12)}"
    run = WebhookRunDB(
        run_id         = run_id,
        config_id      = config_id,
        user_id        = config.user_id,
        suite_id       = config.suite_id,
        repo_full_name = config.repo_full_name,
        branch         = branch,
        commit_sha     = commit_sha,
        event_type     = event_type,
        pr_number      = pr_number,
        status         = "queued",
    )
    db.add(run)
    db.commit()

    background_tasks.add_task(_background_run, run_id, config_id)

    return {"status": "queued", "run_id": run_id}


# ── JWT-protected config management ──────────────────────────────────────────

@router.post("/webhooks/configs", response_model=ConfigResponse, status_code=201)
def create_config(
    body:     CreateConfigRequest,
    username: str     = Depends(_verify_jwt),
    db:       Session = Depends(get_db),
):
    """
    Create a webhook config and register the webhook on the user's GitHub repo.
    The user must have GitHub connected (github_token stored via /github/connect).
    """
    user  = _get_user(username, db)
    suite = _get_suite(body.suite_id, user["user_id"], db)

    if not user["github_token"]:
        raise HTTPException(
            status_code=400,
            detail="GitHub is not connected. Go to your profile and connect GitHub first."
        )

    if "/" not in body.repo_full_name or body.repo_full_name.count("/") != 1:
        raise HTTPException(status_code=422, detail="repo_full_name must be 'owner/repo'")

    allowed_events = {"push", "pull_request"}
    invalid = set(body.events) - allowed_events
    if invalid:
        raise HTTPException(status_code=422, detail=f"Unsupported events: {invalid}. Allowed: {allowed_events}")

    config_id      = f"wc_{secrets.token_urlsafe(12)}"
    webhook_secret = secrets.token_hex(32)
    webhook_url    = f"{_BACKEND_URL}/webhooks/github/{config_id}"

    webhook_id = _gh_register_webhook_sync(
        user["github_token"],
        body.repo_full_name,
        webhook_url,
        webhook_secret,
        body.events,
    )

    config = WebhookConfigDB(
        config_id          = config_id,
        user_id            = user["user_id"],
        suite_id           = suite["suite_id"],
        suite_name         = suite["suite_name"],
        repo_full_name     = body.repo_full_name,
        branch_filter      = body.branch_filter,
        events             = body.events,
        webhook_id         = webhook_id,
        webhook_secret     = webhook_secret,
        is_active          = True,
        post_commit_status = body.post_commit_status,
    )
    db.add(config)
    db.commit()

    return _config_to_response(config)


@router.get("/webhooks/configs", response_model=List[ConfigResponse])
def list_configs(
    username: str     = Depends(_verify_jwt),
    db:       Session = Depends(get_db),
):
    user    = _get_user(username, db)
    configs = (
        db.query(WebhookConfigDB)
        .filter(WebhookConfigDB.user_id == user["user_id"])
        .order_by(WebhookConfigDB.created_at.desc())
        .all()
    )
    return [_config_to_response(c) for c in configs]


@router.delete("/webhooks/configs/{config_id}", status_code=200)
def delete_config(
    config_id: str,
    username:  str     = Depends(_verify_jwt),
    db:        Session = Depends(get_db),
):
    """Delete config and unregister the webhook from GitHub (best-effort)."""
    user   = _get_user(username, db)
    config = db.query(WebhookConfigDB).filter(
        WebhookConfigDB.config_id == config_id,
        WebhookConfigDB.user_id   == user["user_id"],
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    if user["github_token"] and config.webhook_id:
        try:
            _gh_delete_webhook_sync(user["github_token"], config.repo_full_name, config.webhook_id)
        except Exception:
            pass  # Don't block deletion if GitHub call fails

    db.delete(config)
    db.commit()
    return {"status": "deleted", "config_id": config_id}


@router.patch("/webhooks/configs/{config_id}", response_model=ConfigResponse)
def toggle_config(
    config_id: str,
    body:      PatchConfigRequest,
    username:  str     = Depends(_verify_jwt),
    db:        Session = Depends(get_db),
):
    user   = _get_user(username, db)
    config = db.query(WebhookConfigDB).filter(
        WebhookConfigDB.config_id == config_id,
        WebhookConfigDB.user_id   == user["user_id"],
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    config.is_active  = body.is_active
    config.updated_at = datetime.utcnow()
    db.commit()
    return _config_to_response(config)


@router.get("/webhooks/runs", response_model=List[RunResponse])
def list_runs(
    config_id: Optional[str] = None,
    limit:     int            = 50,
    username:  str            = Depends(_verify_jwt),
    db:        Session        = Depends(get_db),
):
    user  = _get_user(username, db)
    query = db.query(WebhookRunDB).filter(WebhookRunDB.user_id == user["user_id"])
    if config_id:
        query = query.filter(WebhookRunDB.config_id == config_id)
    runs = query.order_by(WebhookRunDB.created_at.desc()).limit(min(limit, 200)).all()
    return [_run_to_response(r) for r in runs]


@router.get("/webhooks/runs/{run_id}", response_model=RunResponse)
def get_run(
    run_id:   str,
    username: str     = Depends(_verify_jwt),
    db:       Session = Depends(get_db),
):
    user = _get_user(username, db)
    run  = db.query(WebhookRunDB).filter(
        WebhookRunDB.run_id  == run_id,
        WebhookRunDB.user_id == user["user_id"],
    ).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_response(run)
