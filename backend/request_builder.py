# -*- coding: utf-8 -*-
"""
Request Builder — the manual API client (Postman-style core).

Self-contained module following the same pattern as auto_discovery / full_send:
own router, own storage (stdlib sqlite3), no coupling to backend.py internals.

Provides:
  POST   /rb/send                        proxy-send any HTTP request, returns full response + timing
  GET    /rb/collections                 list collections with their requests
  POST   /rb/collections                 create collection
  PUT    /rb/collections/{cid}           rename collection
  DELETE /rb/collections/{cid}           delete collection (and its requests)
  POST   /rb/collections/{cid}/requests  save request into collection
  PUT    /rb/requests/{rid}              update saved request
  DELETE /rb/requests/{rid}              delete saved request
  GET    /rb/environments                list environments
  POST   /rb/environments                create environment
  PUT    /rb/environments/{eid}          update environment (name/vars/active)
  DELETE /rb/environments/{eid}          delete environment
  GET    /rb/history                     recent request history
  DELETE /rb/history                     clear history
  POST   /rb/import/postman              import a Postman Collection v2.x JSON
  POST   /rb/import/curl                 parse a cURL command into a request definition
  GET    /rb/collections/{cid}/export    export as Postman Collection v2.1 JSON
"""

import base64
import json
import os
import re
import shlex
import sqlite3
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

request_builder_router = APIRouter()

# ──────────────────────────────────────────────────────────
# Storage
# ──────────────────────────────────────────────────────────

_DATA_DIR = os.getenv("FLASQO_DATA_DIR", os.path.expanduser("~/.flasqo"))
os.makedirs(_DATA_DIR, exist_ok=True)
_DB_PATH = os.path.join(_DATA_DIR, "request_builder.db")


def _db():
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _init_db():
    with _db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS requests (
                id TEXT PRIMARY KEY,
                collection_id TEXT NOT NULL,
                name TEXT NOT NULL,
                sort INTEGER NOT NULL DEFAULT 0,
                definition TEXT NOT NULL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS environments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                variables TEXT NOT NULL DEFAULT '[]',
                is_active INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                method TEXT NOT NULL,
                url TEXT NOT NULL,
                status INTEGER,
                time_ms REAL,
                size_bytes INTEGER,
                definition TEXT NOT NULL,
                created_at REAL NOT NULL
            );
            """
        )


_init_db()

# ──────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────


class KV(BaseModel):
    key: str = ""
    value: str = ""
    enabled: bool = True


class AuthConfig(BaseModel):
    type: str = "none"  # none | bearer | basic | apikey
    token: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    key: Optional[str] = None
    value: Optional[str] = None
    add_to: str = "header"  # header | query


class BodyConfig(BaseModel):
    mode: str = "none"  # none | json | raw | urlencoded | formdata | graphql
    raw: Optional[str] = None
    content_type: Optional[str] = None
    urlencoded: List[KV] = []
    formdata: List[KV] = []
    graphql_query: Optional[str] = None
    graphql_variables: Optional[str] = None


class Assertion(BaseModel):
    """Client-evaluated test assertion attached to a request (Postman-style 'Tests')."""
    type: str = "status_equals"  # status_equals | body_contains | json_path_equals | time_below_ms | header_exists
    target: str = ""             # json path / header name (when applicable)
    value: str = ""              # expected value
    enabled: bool = True


class RequestDefinition(BaseModel):
    method: str = "GET"
    url: str
    params: List[KV] = []
    headers: List[KV] = []
    auth: AuthConfig = AuthConfig()
    body: BodyConfig = BodyConfig()
    tests: List[Assertion] = []
    timeout: float = 30.0
    follow_redirects: bool = True
    verify_ssl: bool = True


class SendRequest(BaseModel):
    request: RequestDefinition
    save_history: bool = True


class SaveRequestBody(BaseModel):
    name: str
    definition: RequestDefinition
    sort: Optional[int] = None


class CollectionBody(BaseModel):
    name: str


class EnvironmentBody(BaseModel):
    name: Optional[str] = None
    variables: Optional[List[KV]] = None
    is_active: Optional[bool] = None


class PostmanImportBody(BaseModel):
    collection_json: str


class CurlImportBody(BaseModel):
    curl: str


# ──────────────────────────────────────────────────────────
# Send engine
# ──────────────────────────────────────────────────────────


def _build_httpx_kwargs(d: RequestDefinition) -> Dict[str, Any]:
    headers: Dict[str, str] = {}
    for h in d.headers:
        if h.enabled and h.key:
            headers[h.key] = h.value

    params: List[tuple] = [(p.key, p.value) for p in d.params if p.enabled and p.key]

    # Auth
    if d.auth.type == "bearer" and d.auth.token:
        headers.setdefault("Authorization", f"Bearer {d.auth.token}")
    elif d.auth.type == "basic" and d.auth.username is not None:
        cred = base64.b64encode(f"{d.auth.username}:{d.auth.password or ''}".encode()).decode()
        headers.setdefault("Authorization", f"Basic {cred}")
    elif d.auth.type == "apikey" and d.auth.key:
        if d.auth.add_to == "query":
            params.append((d.auth.key, d.auth.value or ""))
        else:
            headers.setdefault(d.auth.key, d.auth.value or "")

    kwargs: Dict[str, Any] = {"headers": headers, "params": params or None}

    # Body
    b = d.body
    if b.mode == "json" and b.raw is not None:
        headers.setdefault("Content-Type", "application/json")
        kwargs["content"] = b.raw.encode()
    elif b.mode == "raw" and b.raw is not None:
        if b.content_type:
            headers.setdefault("Content-Type", b.content_type)
        kwargs["content"] = b.raw.encode()
    elif b.mode == "urlencoded":
        kwargs["data"] = {kv.key: kv.value for kv in b.urlencoded if kv.enabled and kv.key}
    elif b.mode == "formdata":
        kwargs["data"] = {kv.key: kv.value for kv in b.formdata if kv.enabled and kv.key}
    elif b.mode == "graphql":
        headers.setdefault("Content-Type", "application/json")
        variables = {}
        if b.graphql_variables:
            try:
                variables = json.loads(b.graphql_variables)
            except json.JSONDecodeError:
                variables = {}
        kwargs["content"] = json.dumps({"query": b.graphql_query or "", "variables": variables}).encode()

    return kwargs


@request_builder_router.post("/send")
async def send_request(body: SendRequest):
    d = body.request
    kwargs = _build_httpx_kwargs(d)
    started = time.perf_counter()
    error = None
    result: Dict[str, Any] = {}

    try:
        async with httpx.AsyncClient(
            timeout=d.timeout, follow_redirects=d.follow_redirects, verify=d.verify_ssl
        ) as client:
            resp = await client.request(d.method.upper(), d.url, **kwargs)
        elapsed_ms = (time.perf_counter() - started) * 1000

        raw = resp.content
        is_text = True
        try:
            text = raw.decode(resp.encoding or "utf-8")
        except (UnicodeDecodeError, LookupError):
            is_text = False
            text = None

        result = {
            "ok": True,
            "status": resp.status_code,
            "status_text": resp.reason_phrase,
            "http_version": resp.http_version,
            "headers": [{"key": k, "value": v} for k, v in resp.headers.items()],
            "cookies": [{"key": k, "value": v} for k, v in resp.cookies.items()],
            "is_text": is_text,
            "body": text,
            "body_base64": base64.b64encode(raw).decode() if not is_text else None,
            "size_bytes": len(raw),
            "time_ms": round(elapsed_ms, 2),
            "final_url": str(resp.url),
        }
    except Exception as e:
        elapsed_ms = (time.perf_counter() - started) * 1000
        error = f"{type(e).__name__}: {e}"
        result = {"ok": False, "error": error, "time_ms": round(elapsed_ms, 2)}

    if body.save_history:
        with _db() as conn:
            conn.execute(
                "INSERT INTO history (id, method, url, status, time_ms, size_bytes, definition, created_at)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (
                    uuid.uuid4().hex,
                    d.method.upper(),
                    d.url,
                    result.get("status"),
                    result.get("time_ms"),
                    result.get("size_bytes"),
                    d.model_dump_json(),
                    time.time(),
                ),
            )
            # Keep history bounded
            conn.execute(
                "DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY created_at DESC LIMIT 500)"
            )

    return result


# ──────────────────────────────────────────────────────────
# Collections & requests
# ──────────────────────────────────────────────────────────


@request_builder_router.get("/collections")
async def list_collections():
    with _db() as conn:
        cols = conn.execute("SELECT * FROM collections ORDER BY created_at").fetchall()
        reqs = conn.execute("SELECT * FROM requests ORDER BY sort, created_at").fetchall()
    by_col: Dict[str, List[Dict]] = {}
    for r in reqs:
        by_col.setdefault(r["collection_id"], []).append(
            {
                "id": r["id"],
                "name": r["name"],
                "sort": r["sort"],
                "definition": json.loads(r["definition"]),
            }
        )
    return [
        {"id": c["id"], "name": c["name"], "requests": by_col.get(c["id"], [])}
        for c in cols
    ]


@request_builder_router.post("/collections")
async def create_collection(body: CollectionBody):
    cid = uuid.uuid4().hex
    with _db() as conn:
        conn.execute(
            "INSERT INTO collections (id, name, created_at) VALUES (?,?,?)",
            (cid, body.name.strip() or "New Collection", time.time()),
        )
    return {"id": cid, "name": body.name, "requests": []}


@request_builder_router.put("/collections/{cid}")
async def rename_collection(cid: str, body: CollectionBody):
    with _db() as conn:
        cur = conn.execute("UPDATE collections SET name=? WHERE id=?", (body.name, cid))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Collection not found")
    return {"ok": True}


@request_builder_router.delete("/collections/{cid}")
async def delete_collection(cid: str):
    with _db() as conn:
        conn.execute("DELETE FROM requests WHERE collection_id=?", (cid,))
        conn.execute("DELETE FROM collections WHERE id=?", (cid,))
    return {"ok": True}


@request_builder_router.post("/collections/{cid}/requests")
async def save_request(cid: str, body: SaveRequestBody):
    with _db() as conn:
        col = conn.execute("SELECT id FROM collections WHERE id=?", (cid,)).fetchone()
        if not col:
            raise HTTPException(status_code=404, detail="Collection not found")
        rid = uuid.uuid4().hex
        sort = body.sort
        if sort is None:
            row = conn.execute(
                "SELECT COALESCE(MAX(sort),0)+1 AS s FROM requests WHERE collection_id=?", (cid,)
            ).fetchone()
            sort = row["s"]
        now = time.time()
        conn.execute(
            "INSERT INTO requests (id, collection_id, name, sort, definition, created_at, updated_at)"
            " VALUES (?,?,?,?,?,?,?)",
            (rid, cid, body.name, sort, body.definition.model_dump_json(), now, now),
        )
    return {"id": rid, "name": body.name, "sort": sort, "definition": body.definition.model_dump()}


@request_builder_router.put("/requests/{rid}")
async def update_request(rid: str, body: SaveRequestBody):
    with _db() as conn:
        cur = conn.execute(
            "UPDATE requests SET name=?, definition=?, updated_at=? WHERE id=?",
            (body.name, body.definition.model_dump_json(), time.time(), rid),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Request not found")
    return {"ok": True}


@request_builder_router.delete("/requests/{rid}")
async def delete_request(rid: str):
    with _db() as conn:
        conn.execute("DELETE FROM requests WHERE id=?", (rid,))
    return {"ok": True}


# ──────────────────────────────────────────────────────────
# Environments
# ──────────────────────────────────────────────────────────


@request_builder_router.get("/environments")
async def list_environments():
    with _db() as conn:
        rows = conn.execute("SELECT * FROM environments ORDER BY rowid").fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "variables": json.loads(r["variables"]),
            "is_active": bool(r["is_active"]),
        }
        for r in rows
    ]


@request_builder_router.post("/environments")
async def create_environment(body: EnvironmentBody):
    eid = uuid.uuid4().hex
    variables = [v.model_dump() for v in (body.variables or [])]
    with _db() as conn:
        conn.execute(
            "INSERT INTO environments (id, name, variables, is_active) VALUES (?,?,?,0)",
            (eid, body.name or "New Environment", json.dumps(variables)),
        )
    return {"id": eid, "name": body.name or "New Environment", "variables": variables, "is_active": False}


@request_builder_router.put("/environments/{eid}")
async def update_environment(eid: str, body: EnvironmentBody):
    with _db() as conn:
        row = conn.execute("SELECT * FROM environments WHERE id=?", (eid,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Environment not found")
        name = body.name if body.name is not None else row["name"]
        variables = (
            json.dumps([v.model_dump() for v in body.variables])
            if body.variables is not None
            else row["variables"]
        )
        if body.is_active:
            conn.execute("UPDATE environments SET is_active=0")
        is_active = (1 if body.is_active else 0) if body.is_active is not None else row["is_active"]
        conn.execute(
            "UPDATE environments SET name=?, variables=?, is_active=? WHERE id=?",
            (name, variables, is_active, eid),
        )
    return {"ok": True}


@request_builder_router.delete("/environments/{eid}")
async def delete_environment(eid: str):
    with _db() as conn:
        conn.execute("DELETE FROM environments WHERE id=?", (eid,))
    return {"ok": True}


# ──────────────────────────────────────────────────────────
# History
# ──────────────────────────────────────────────────────────


@request_builder_router.get("/history")
async def get_history(limit: int = 100):
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM history ORDER BY created_at DESC LIMIT ?", (min(limit, 500),)
        ).fetchall()
    return [
        {
            "id": r["id"],
            "method": r["method"],
            "url": r["url"],
            "status": r["status"],
            "time_ms": r["time_ms"],
            "size_bytes": r["size_bytes"],
            "definition": json.loads(r["definition"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@request_builder_router.delete("/history")
async def clear_history():
    with _db() as conn:
        conn.execute("DELETE FROM history")
    return {"ok": True}


# ──────────────────────────────────────────────────────────
# Import / export
# ──────────────────────────────────────────────────────────


def _postman_item_to_definition(item: Dict) -> Optional[Dict]:
    req = item.get("request")
    if not req:
        return None
    if isinstance(req, str):
        return RequestDefinition(method="GET", url=req).model_dump()

    url = req.get("url", "")
    params: List[Dict] = []
    if isinstance(url, dict):
        for q in url.get("query", []) or []:
            params.append({"key": q.get("key", ""), "value": q.get("value", "") or "", "enabled": not q.get("disabled", False)})
        url = url.get("raw", "")
        # strip query from raw url since we carry it in params
        if "?" in url and params:
            url = url.split("?", 1)[0]

    headers = [
        {"key": h.get("key", ""), "value": h.get("value", "") or "", "enabled": not h.get("disabled", False)}
        for h in (req.get("header") or [])
    ]

    auth = {"type": "none"}
    pauth = req.get("auth") or {}
    ptype = pauth.get("type")
    def _authval(section, key):
        for entry in pauth.get(section, []) or []:
            if entry.get("key") == key:
                return entry.get("value")
        return None
    if ptype == "bearer":
        auth = {"type": "bearer", "token": _authval("bearer", "token") or ""}
    elif ptype == "basic":
        auth = {"type": "basic", "username": _authval("basic", "username") or "", "password": _authval("basic", "password") or ""}
    elif ptype == "apikey":
        auth = {
            "type": "apikey",
            "key": _authval("apikey", "key") or "",
            "value": _authval("apikey", "value") or "",
            "add_to": "query" if _authval("apikey", "in") == "query" else "header",
        }

    body = {"mode": "none"}
    pbody = req.get("body") or {}
    mode = pbody.get("mode")
    if mode == "raw":
        lang = ((pbody.get("options") or {}).get("raw") or {}).get("language", "")
        body = {"mode": "json" if lang == "json" else "raw", "raw": pbody.get("raw", "")}
    elif mode == "urlencoded":
        body = {
            "mode": "urlencoded",
            "urlencoded": [
                {"key": e.get("key", ""), "value": e.get("value", "") or "", "enabled": not e.get("disabled", False)}
                for e in pbody.get("urlencoded", []) or []
            ],
        }
    elif mode == "formdata":
        body = {
            "mode": "formdata",
            "formdata": [
                {"key": e.get("key", ""), "value": e.get("value", "") or "", "enabled": not e.get("disabled", False)}
                for e in pbody.get("formdata", []) or []
                if e.get("type") != "file"
            ],
        }
    elif mode == "graphql":
        gql = pbody.get("graphql") or {}
        body = {"mode": "graphql", "graphql_query": gql.get("query", ""), "graphql_variables": gql.get("variables", "")}

    return RequestDefinition(
        method=req.get("method", "GET"),
        url=url if isinstance(url, str) else "",
        params=params,
        headers=headers,
        auth=auth,
        body=body,
    ).model_dump()


def _flatten_postman_items(items: List[Dict], prefix: str = "") -> List[Dict]:
    out = []
    for item in items or []:
        name = item.get("name", "Request")
        if "item" in item:  # folder
            out.extend(_flatten_postman_items(item["item"], prefix=f"{prefix}{name} / "))
        else:
            d = _postman_item_to_definition(item)
            if d:
                out.append({"name": f"{prefix}{name}", "definition": d})
    return out


@request_builder_router.post("/import/postman")
async def import_postman(body: PostmanImportBody):
    try:
        data = json.loads(body.collection_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    info = data.get("info") or {}
    name = info.get("name", "Imported Collection")
    flat = _flatten_postman_items(data.get("item", []))
    if not flat:
        raise HTTPException(status_code=400, detail="No requests found in collection")

    cid = uuid.uuid4().hex
    now = time.time()
    with _db() as conn:
        conn.execute("INSERT INTO collections (id, name, created_at) VALUES (?,?,?)", (cid, name, now))
        for i, entry in enumerate(flat):
            conn.execute(
                "INSERT INTO requests (id, collection_id, name, sort, definition, created_at, updated_at)"
                " VALUES (?,?,?,?,?,?,?)",
                (uuid.uuid4().hex, cid, entry["name"], i, json.dumps(entry["definition"]), now, now),
            )
    return {"id": cid, "name": name, "imported": len(flat)}


@request_builder_router.get("/collections/{cid}/export")
async def export_postman(cid: str):
    with _db() as conn:
        col = conn.execute("SELECT * FROM collections WHERE id=?", (cid,)).fetchone()
        if not col:
            raise HTTPException(status_code=404, detail="Collection not found")
        reqs = conn.execute(
            "SELECT * FROM requests WHERE collection_id=? ORDER BY sort, created_at", (cid,)
        ).fetchall()

    items = []
    for r in reqs:
        d = RequestDefinition(**json.loads(r["definition"]))
        url_raw = d.url
        query = [
            {"key": p.key, "value": p.value, **({"disabled": True} if not p.enabled else {})}
            for p in d.params
            if p.key
        ]
        pm_req: Dict[str, Any] = {
            "method": d.method,
            "header": [
                {"key": h.key, "value": h.value, **({"disabled": True} if not h.enabled else {})}
                for h in d.headers
                if h.key
            ],
            "url": {"raw": url_raw, "query": query} if query else url_raw,
        }
        if d.auth.type == "bearer":
            pm_req["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": d.auth.token or "", "type": "string"}]}
        elif d.auth.type == "basic":
            pm_req["auth"] = {
                "type": "basic",
                "basic": [
                    {"key": "username", "value": d.auth.username or "", "type": "string"},
                    {"key": "password", "value": d.auth.password or "", "type": "string"},
                ],
            }
        elif d.auth.type == "apikey":
            pm_req["auth"] = {
                "type": "apikey",
                "apikey": [
                    {"key": "key", "value": d.auth.key or "", "type": "string"},
                    {"key": "value", "value": d.auth.value or "", "type": "string"},
                    {"key": "in", "value": d.auth.add_to, "type": "string"},
                ],
            }
        b = d.body
        if b.mode in ("json", "raw") and b.raw:
            pm_req["body"] = {
                "mode": "raw",
                "raw": b.raw,
                "options": {"raw": {"language": "json" if b.mode == "json" else "text"}},
            }
        elif b.mode == "urlencoded":
            pm_req["body"] = {"mode": "urlencoded", "urlencoded": [{"key": e.key, "value": e.value} for e in b.urlencoded]}
        elif b.mode == "formdata":
            pm_req["body"] = {"mode": "formdata", "formdata": [{"key": e.key, "value": e.value, "type": "text"} for e in b.formdata]}
        elif b.mode == "graphql":
            pm_req["body"] = {"mode": "graphql", "graphql": {"query": b.graphql_query or "", "variables": b.graphql_variables or ""}}

        items.append({"name": r["name"], "request": pm_req})

    return {
        "info": {
            "name": col["name"],
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            "_postman_id": col["id"],
        },
        "item": items,
    }


# ──────────────────────────────────────────────────────────
# cURL import
# ──────────────────────────────────────────────────────────


@request_builder_router.post("/import/curl")
async def import_curl(body: CurlImportBody):
    text = body.curl.strip()
    # Join line continuations
    text = re.sub(r"\\\s*\n", " ", text)
    if text.lower().startswith("curl"):
        text = text[4:].strip()

    try:
        tokens = shlex.split(text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Could not parse cURL: {e}")

    method = None
    url = ""
    headers: List[Dict] = []
    data_parts: List[str] = []
    is_form = False
    formdata: List[Dict] = []
    user = None

    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t in ("-X", "--request") and i + 1 < len(tokens):
            method = tokens[i + 1].upper()
            i += 2
        elif t in ("-H", "--header") and i + 1 < len(tokens):
            raw = tokens[i + 1]
            if ":" in raw:
                k, v = raw.split(":", 1)
                headers.append({"key": k.strip(), "value": v.strip(), "enabled": True})
            i += 2
        elif t in ("-d", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode") and i + 1 < len(tokens):
            data_parts.append(tokens[i + 1])
            i += 2
        elif t in ("-F", "--form") and i + 1 < len(tokens):
            is_form = True
            raw = tokens[i + 1]
            if "=" in raw:
                k, v = raw.split("=", 1)
                formdata.append({"key": k, "value": v.lstrip("@"), "enabled": True})
            i += 2
        elif t in ("-u", "--user") and i + 1 < len(tokens):
            user = tokens[i + 1]
            i += 2
        elif t in ("-L", "--location", "-s", "--silent", "-k", "--insecure", "--compressed", "-i", "--include", "-v", "--verbose"):
            i += 1
        elif t in ("-o", "--output", "-A", "--user-agent", "-e", "--referer", "-b", "--cookie", "--connect-timeout", "-m", "--max-time") and i + 1 < len(tokens):
            if t in ("-A", "--user-agent"):
                headers.append({"key": "User-Agent", "value": tokens[i + 1], "enabled": True})
            elif t in ("-e", "--referer"):
                headers.append({"key": "Referer", "value": tokens[i + 1], "enabled": True})
            elif t in ("-b", "--cookie"):
                headers.append({"key": "Cookie", "value": tokens[i + 1], "enabled": True})
            i += 2
        elif not t.startswith("-") and not url:
            url = t
            i += 1
        else:
            i += 1

    if not url:
        raise HTTPException(status_code=400, detail="No URL found in cURL command")

    body_cfg: Dict[str, Any] = {"mode": "none"}
    if is_form:
        body_cfg = {"mode": "formdata", "formdata": formdata}
    elif data_parts:
        joined = "&".join(data_parts) if len(data_parts) > 1 else data_parts[0]
        content_type = next((h["value"] for h in headers if h["key"].lower() == "content-type"), "")
        stripped = joined.strip()
        if "json" in content_type.lower() or stripped.startswith("{") or stripped.startswith("["):
            body_cfg = {"mode": "json", "raw": joined}
        else:
            pairs = []
            for part in joined.split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    pairs.append({"key": k, "value": v, "enabled": True})
            body_cfg = {"mode": "urlencoded", "urlencoded": pairs} if pairs else {"mode": "raw", "raw": joined}

    auth_cfg: Dict[str, Any] = {"type": "none"}
    if user:
        u, _, p = user.partition(":")
        auth_cfg = {"type": "basic", "username": u, "password": p}

    if method is None:
        method = "POST" if (data_parts or is_form) else "GET"

    # Split query string off the URL into params
    params: List[Dict] = []
    if "?" in url:
        url, _, qs = url.partition("?")
        for part in qs.split("&"):
            if part:
                k, _, v = part.partition("=")
                params.append({"key": k, "value": v, "enabled": True})

    definition = RequestDefinition(
        method=method, url=url, params=params, headers=headers, auth=auth_cfg, body=body_cfg
    )
    return {"definition": definition.model_dump()}
