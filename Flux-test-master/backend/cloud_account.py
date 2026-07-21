# -*- coding: utf-8 -*-
"""
Cloud Account — hybrid model.

The desktop app runs fully local (SQLite, no login) for testing. Optionally, a user can
sign in to their flasqo.com account. This module proxies account calls from the local
backend to the production server, so:
  • the renderer never hits flasqo.com directly (no CORS headaches from the 127.0.0.1 origin)
  • the cloud token is stored locally (SQLite) and persists across launches
  • testing keeps running locally regardless of sign-in state

Subscription is STUBBED for now (no billing system exists yet on the server): every signed-in
account is reported as the "Free" plan until real billing is built.

Endpoints (mounted at /account):
    POST /account/signup            → forwards to {CLOUD}/auth/signup
    POST /account/login             → forwards to {CLOUD}/auth/login, stores token
    GET  /account/session           → current signed-in account (from stored token) or null
    PUT  /account/profile           → forwards profile update
    POST /account/logout            → clears stored cloud token
    GET  /account/subscription      → stubbed plan info (Free)
"""

import json
import os
import sqlite3
import time
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

cloud_account_router = APIRouter()

CLOUD_API = os.getenv("FLASQO_CLOUD_API", "https://flasqo.com").rstrip("/")

_DATA_DIR = os.getenv("FLASQO_DATA_DIR", os.path.expanduser("~/.flasqo"))
os.makedirs(_DATA_DIR, exist_ok=True)
_DB_PATH = os.path.join(_DATA_DIR, "account.db")


def _db():
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init():
    with _db() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS session (id INTEGER PRIMARY KEY CHECK (id=1), token TEXT, profile TEXT, updated_at REAL)"
        )


_init()


def _save_session(token: str, profile: Dict[str, Any]):
    with _db() as conn:
        conn.execute(
            "INSERT INTO session (id, token, profile, updated_at) VALUES (1, ?, ?, ?)"
            " ON CONFLICT(id) DO UPDATE SET token=excluded.token, profile=excluded.profile, updated_at=excluded.updated_at",
            (token, json.dumps(profile), time.time()),
        )


def _load_session() -> Optional[Dict[str, Any]]:
    with _db() as conn:
        row = conn.execute("SELECT token, profile FROM session WHERE id=1").fetchone()
    if not row or not row["token"]:
        return None
    try:
        profile = json.loads(row["profile"] or "{}")
    except json.JSONDecodeError:
        profile = {}
    return {"token": row["token"], "profile": profile}


def _clear_session():
    with _db() as conn:
        conn.execute("DELETE FROM session WHERE id=1")


def _plan_for(profile: Dict[str, Any]) -> Dict[str, Any]:
    # Stub: no billing system yet. Report whatever the server says if it ever adds a
    # plan field, else default to Free.
    plan = (profile or {}).get("plan") or (profile or {}).get("subscription") or "free"
    plan = str(plan).lower()
    known = {
        "free": {"name": "Free", "price": "$0", "features": [
            "Unlimited local API testing", "Request Builder & collections",
            "Built-in test library (offline)", "1 workspace",
        ], "limits": {"cloud_sync": False, "teams": False}},
        "pro": {"name": "Pro", "price": "—", "features": ["Everything in Free", "Cloud sync", "Teams"], "limits": {"cloud_sync": True, "teams": True}},
    }
    info = known.get(plan, known["free"])
    return {"plan": plan, "billing_available": False, **info}


# ──────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────

class SignupBody(BaseModel):
    username: str
    email: str
    password: str


class LoginBody(BaseModel):
    username: str
    password: str


class ProfileBody(BaseModel):
    full_name: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

async def _cloud_get_me(token: str) -> Optional[Dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{CLOUD_API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        if r.status_code == 200:
            return r.json()
    except httpx.HTTPError:
        return None
    return None


def _session_payload(token: str, profile: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "signed_in": True,
        "cloud_api": CLOUD_API,
        "user": {
            "user_id": profile.get("user_id"),
            "username": profile.get("username"),
            "email": profile.get("email"),
            "full_name": profile.get("full_name"),
            "linkedin_url": profile.get("linkedin_url"),
            "github_url": profile.get("github_url"),
            "oauth_provider": profile.get("oauth_provider"),
            "created_at": profile.get("created_at"),
        },
        "subscription": _plan_for(profile),
    }


# ──────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────

@cloud_account_router.get("/config")
async def account_config():
    return {"cloud_api": CLOUD_API, "billing_available": False}


@cloud_account_router.get("/session")
async def account_session():
    sess = _load_session()
    if not sess:
        return {"signed_in": False, "cloud_api": CLOUD_API}
    # Refresh profile from server; if the token is dead, sign out.
    fresh = await _cloud_get_me(sess["token"])
    if fresh is None:
        # keep the cached profile but flag that we couldn't refresh (offline or expired)
        return {**_session_payload(sess["token"], sess["profile"]), "stale": True}
    _save_session(sess["token"], fresh)
    return _session_payload(sess["token"], fresh)


@cloud_account_router.post("/login")
async def account_login(body: LoginBody):
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(f"{CLOUD_API}/auth/login", json=body.model_dump())
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach flasqo.com: {e}")
    if r.status_code != 200:
        detail = "Invalid username or password"
        try:
            detail = r.json().get("detail", detail)
        except Exception:
            pass
        raise HTTPException(status_code=r.status_code, detail=detail)
    data = r.json()
    token = data.get("token")
    profile = await _cloud_get_me(token) or data
    _save_session(token, profile)
    return _session_payload(token, profile)


@cloud_account_router.post("/signup")
async def account_signup(body: SignupBody):
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(f"{CLOUD_API}/auth/signup", json=body.model_dump())
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach flasqo.com: {e}")
    if r.status_code != 200:
        detail = "Signup failed"
        try:
            detail = r.json().get("detail", detail)
        except Exception:
            pass
        raise HTTPException(status_code=r.status_code, detail=detail)
    data = r.json()
    token = data.get("token")
    profile = await _cloud_get_me(token) or data
    _save_session(token, profile)
    return _session_payload(token, profile)


@cloud_account_router.put("/profile")
async def account_profile(body: ProfileBody):
    sess = _load_session()
    if not sess:
        raise HTTPException(status_code=401, detail="Not signed in")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.put(
                f"{CLOUD_API}/auth/profile",
                headers={"Authorization": f"Bearer {sess['token']}"},
                json={k: v for k, v in body.model_dump().items() if v is not None},
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach flasqo.com: {e}")
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail="Profile update failed")
    fresh = await _cloud_get_me(sess["token"]) or sess["profile"]
    _save_session(sess["token"], fresh)
    return _session_payload(sess["token"], fresh)


@cloud_account_router.get("/subscription")
async def account_subscription():
    sess = _load_session()
    profile = sess["profile"] if sess else {}
    return {"signed_in": bool(sess), **_plan_for(profile)}


@cloud_account_router.post("/logout")
async def account_logout():
    _clear_session()
    return {"signed_in": False}
