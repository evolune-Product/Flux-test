"""
FullSend — Zero-Config URL Testing Engine
Drop a URL. We go full send. No cap.

Five parallel test suites:
  1. Smoke        — all routes respond correctly
  2. Functional   — GPT-4-generated API test cases
  3. Visual       — full-page screenshots (regression baseline)
  4. Security     — headers, fuzz probes, info-leak checks
  5. Performance  — response-time baseline across all routes

One GPT-4 unified report. One public shareable link. Zero config.
"""

import os
import re
import sys
import json
import uuid
import time
import base64
import asyncio
import traceback
import concurrent.futures
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

try:
    import openai
    _oai_key = os.environ.get("OPENAI_API_KEY", "")
    HAS_OPENAI = bool(_oai_key)
    openai_client = openai.OpenAI(api_key=_oai_key) if HAS_OPENAI else None
except ImportError:
    HAS_OPENAI = False
    openai_client = None

try:
    from playwright.async_api import async_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

# ──────────────────────────────────────────────────────────
# Storage
# ──────────────────────────────────────────────────────────
REPORTS_DIR = Path(__file__).parent / "fullsend_reports"
REPORTS_DIR.mkdir(exist_ok=True)

# In-memory progress tracker (scan_id → status dict)
scan_store: Dict[str, Dict] = {}

# ──────────────────────────────────────────────────────────
# Router
# ──────────────────────────────────────────────────────────
full_send_router = APIRouter()


# ──────────────────────────────────────────────────────────
# Pydantic models
# ──────────────────────────────────────────────────────────
class FullSendRequest(BaseModel):
    url: str
    user_id: Optional[str] = None


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────
def _norm_url(raw: str) -> str:
    raw = raw.strip()
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    return raw.rstrip("/")


def _same_origin(href: str, base: str) -> bool:
    try:
        return urlparse(href).netloc == urlparse(base).netloc
    except Exception:
        return False


def _set_progress(scan_id: str, pct: int, phase: str):
    if scan_id in scan_store:
        scan_store[scan_id]["progress"] = pct
        scan_store[scan_id]["phase"] = phase


def _save_report(report_token: str, data: Dict):
    path = REPORTS_DIR / f"{report_token}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _load_report(report_token: str) -> Optional[Dict]:
    path = REPORTS_DIR / f"{report_token}.json"
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ──────────────────────────────────────────────────────────
# PHASE 1 — Playwright Crawler
# ──────────────────────────────────────────────────────────
async def _crawl_page(browser, url: str, base_url: str, semaphore: asyncio.Semaphore):
    """Open a single page, harvest links/forms/network calls/screenshot."""
    async with semaphore:
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            ),
            ignore_https_errors=True,
        )
        page = await context.new_page()

        api_calls: List[Dict] = []

        def _on_request(req):
            if req.resource_type in ("fetch", "xhr"):
                api_calls.append(
                    {
                        "url": req.url,
                        "method": req.method,
                        "post_data": req.post_data or "",
                    }
                )

        page.on("request", _on_request)

        result = {
            "url": url,
            "title": "",
            "status_code": 0,
            "screenshot_b64": None,
            "links": [],
            "forms": [],
            "api_calls": [],
            "error": None,
        }

        try:
            response = await page.goto(
                url, timeout=7000, wait_until="domcontentloaded"
            )
            await page.wait_for_timeout(400)

            result["status_code"] = response.status if response else 0
            result["title"] = await page.title()

            # Screenshot (JPEG 70% quality keeps it small)
            try:
                shot = await page.screenshot(
                    full_page=True, type="jpeg", quality=70
                )
                result["screenshot_b64"] = base64.b64encode(shot).decode()
            except Exception:
                pass

            # Links
            hrefs = await page.eval_on_selector_all(
                "a[href]", "els => els.map(e => e.href)"
            )
            result["links"] = [
                h for h in hrefs if _same_origin(h, base_url) and h.startswith("http")
            ]

            # Forms
            forms_raw = await page.eval_on_selector_all(
                "form",
                """forms => forms.map(f => ({
                    action: f.action,
                    method: f.method || 'GET',
                    fields: Array.from(f.elements).map(e => ({name: e.name, type: e.type}))
                }))""",
            )
            result["forms"] = forms_raw

            result["api_calls"] = api_calls[:20]

        except Exception as exc:
            result["error"] = "Failed to crawl page"
            print(f"[Crawl Error] {type(exc).__name__}")

        finally:
            await page.close()
            await context.close()

        return result


async def _crawl_async(url: str, scan_id: str, max_pages: int = 12) -> Dict:
    """
    Core Playwright BFS crawl — must run inside a ProactorEventLoop on Windows.
    Called via _run_playwright_crawl_sync → run_in_executor.
    """
    visited: set = set()
    queue: List[str] = [url]
    all_pages: List[Dict] = []
    all_api_calls: List[Dict] = []

    async with async_playwright() as pw:
        # Try system Chrome first (no binary download needed),
        # fall back to Playwright's own Chromium build if not found.
        _browser_args = ["--no-sandbox", "--disable-dev-shm-usage"]
        try:
            browser = await pw.chromium.launch(
                channel="chrome", headless=True, args=_browser_args
            )
        except Exception:
            browser = await pw.chromium.launch(headless=True, args=_browser_args)

        semaphore = asyncio.Semaphore(4)  # 4 concurrent pages

        while queue and len(visited) < max_pages:
            batch = []
            while queue and len(visited) + len(batch) < max_pages:
                candidate = queue.pop(0)
                if candidate not in visited:
                    visited.add(candidate)
                    batch.append(candidate)

            if not batch:
                break

            tasks = [_crawl_page(browser, u, url, semaphore) for u in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for res in results:
                if isinstance(res, Exception):
                    continue
                all_pages.append(res)
                all_api_calls.extend(res.get("api_calls", []))
                for link in res.get("links", []):
                    clean = link.split("?")[0].split("#")[0].rstrip("/")
                    if clean and clean not in visited and _same_origin(clean, url):
                        queue.append(clean)

            _set_progress(scan_id, 20, f"Crawled {len(all_pages)} pages...")

        await browser.close()

    # De-dup API calls by URL+method
    seen_api: set = set()
    deduped_api: List[Dict] = []
    for call in all_api_calls:
        key = f"{call['method']}::{call['url']}"
        if key not in seen_api:
            seen_api.add(key)
            deduped_api.append(call)

    return {
        "pages": all_pages,
        "routes": list({p["url"] for p in all_pages}),
        "api_calls": deduped_api[:30],
    }


def _run_playwright_crawl_sync(url: str, scan_id: str, max_pages: int) -> Dict:
    """
    Sync wrapper that runs _crawl_async inside a brand-new ProactorEventLoop.

    On Windows, Uvicorn's default SelectorEventLoop cannot spawn subprocesses,
    which breaks Playwright's browser launch. Running in a dedicated thread
    with a fresh ProactorEventLoop bypasses this entirely.
    """
    if sys.platform == "win32":
        loop = asyncio.ProactorEventLoop()
    else:
        loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_crawl_async(url, scan_id, max_pages))
    finally:
        loop.close()
        asyncio.set_event_loop(None)


async def crawl_application(url: str, scan_id: str, max_pages: int = 12) -> Dict:
    """
    BFS crawl of the target app.
    Returns aggregated pages, routes, forms, discovered API calls.
    """
    if not HAS_PLAYWRIGHT:
        # Fallback: single HTTP fetch to at least get the root
        pages = []
        if HAS_HTTPX:
            try:
                async with httpx.AsyncClient(
                    timeout=10, follow_redirects=True, verify=False
                ) as client:
                    r = await client.get(url)
                    pages.append(
                        {
                            "url": url,
                            "title": url,
                            "status_code": r.status_code,
                            "screenshot_b64": None,
                            "links": [],
                            "forms": [],
                            "api_calls": [],
                        }
                    )
            except Exception as e:
                pages.append({"url": url, "error": "Request failed", "status_code": 0})
                print(f"[Page Error] {url}: {type(e).__name__}")
        return {"pages": pages, "routes": [url], "api_calls": []}

    # Run Playwright in a dedicated thread with a ProactorEventLoop.
    # This is required on Windows where Uvicorn uses SelectorEventLoop,
    # which cannot spawn subprocesses (Playwright needs to launch a browser).
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        _run_playwright_crawl_sync,
        url,
        scan_id,
        max_pages,
    )


# ──────────────────────────────────────────────────────────
# PHASE 2a — Smoke Tests
# ──────────────────────────────────────────────────────────
async def run_smoke_tests(crawl_data: Dict) -> Dict:
    routes = crawl_data.get("routes", [])
    results = []

    if not HAS_HTTPX or not routes:
        return {"type": "smoke", "results": [], "passed": 0, "failed": 0, "total": 0}

    async with httpx.AsyncClient(
        timeout=7, follow_redirects=True, verify=False
    ) as client:
        async def _check(url):
            t0 = time.perf_counter()
            try:
                r = await client.get(url)
                ms = round((time.perf_counter() - t0) * 1000)
                # 401/403 = auth-protected, not a real failure
                # Only 5xx and network errors are true smoke failures
                if r.status_code in (401, 403):
                    return {
                        "url": url,
                        "status_code": r.status_code,
                        "response_ms": ms,
                        "passed": True,
                        "note": "Auth required (expected)",
                        "warn": True,
                    }
                passed = r.status_code < 500
                return {
                    "url": url,
                    "status_code": r.status_code,
                    "response_ms": ms,
                    "passed": passed,
                    "note": "OK" if passed else f"Server error HTTP {r.status_code}",
                }
            except Exception as e:
                ms = round((time.perf_counter() - t0) * 1000)
                return {
                    "url": url,
                    "status_code": 0,
                    "response_ms": ms,
                    "passed": False,
                    "note": str(e)[:120],
                }

        tasks = [_check(r) for r in routes[:20]]
        results = await asyncio.gather(*tasks)

    results = list(results)
    passed = sum(1 for r in results if r["passed"])
    return {
        "type": "smoke",
        "results": results,
        "passed": passed,
        "failed": len(results) - passed,
        "total": len(results),
    }


# ──────────────────────────────────────────────────────────
# PHASE 2b — AI Functional Tests
# ──────────────────────────────────────────────────────────
async def run_ai_functional_tests(crawl_data: Dict) -> Dict:
    api_calls = crawl_data.get("api_calls", [])
    pages = crawl_data.get("pages", [])
    results = []

    # Build endpoint list: discovered XHR calls + page URLs as GET endpoints
    endpoints: List[Dict] = []
    for call in api_calls[:6]:
        endpoints.append({"url": call["url"], "method": call["method"], "body": call.get("post_data", "")})
    # Add some page routes as GET endpoints if we have room
    for page in pages[:4]:
        if len(endpoints) >= 8:
            break
        endpoints.append({"url": page["url"], "method": "GET", "body": ""})

    if not endpoints or not HAS_OPENAI:
        return {"type": "functional", "results": [], "passed": 0, "failed": 0, "total": 0, "ai_used": HAS_OPENAI}

    # Ask GPT-4o to generate test assertions for each endpoint
    endpoint_summary = "\n".join(
        f"- {e['method']} {e['url']}"
        for e in endpoints
    )

    try:
        gpt_resp = await asyncio.to_thread(
            openai_client.chat.completions.create,
            model="gpt-4o",
            temperature=0.2,
            max_tokens=1200,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert API test engineer. Given a list of endpoints, "
                        "output a JSON array of test objects. Each object must have: "
                        "url (string), method (string), expected_status (int), "
                        "description (string), category (string: happy|edge|security|negative). "
                        "Return ONLY the JSON array, no markdown fences."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Generate functional tests for these endpoints:\n{endpoint_summary}",
                },
            ],
        )
        raw = gpt_resp.choices[0].message.content.strip()
        # Strip markdown fences if present
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        test_cases = json.loads(raw)
    except Exception as e:
        # Fallback: basic test cases for each endpoint
        test_cases = [
            {
                "url": e["url"],
                "method": e["method"],
                "expected_status": 200,
                "description": f"Verify {e['method']} {e['url']} returns 200",
                "category": "happy",
            }
            for e in endpoints
        ]

    # Execute the test cases
    if HAS_HTTPX:
        async with httpx.AsyncClient(
            timeout=7, follow_redirects=True, verify=False
        ) as client:
            async def _exec(tc):
                t0 = time.perf_counter()
                try:
                    method = tc.get("method", "GET").upper()
                    if method == "GET":
                        r = await client.get(tc["url"])
                    elif method == "POST":
                        r = await client.post(tc["url"], json={})
                    elif method == "PUT":
                        r = await client.put(tc["url"], json={})
                    elif method == "DELETE":
                        r = await client.delete(tc["url"])
                    else:
                        r = await client.get(tc["url"])
                    ms = round((time.perf_counter() - t0) * 1000)
                    expected = tc.get("expected_status", 200)
                    passed = abs(r.status_code - expected) <= 100 or r.status_code < 400
                    return {
                        **tc,
                        "actual_status": r.status_code,
                        "response_ms": ms,
                        "passed": passed,
                        "note": "OK" if passed else f"Got {r.status_code}, expected ~{expected}",
                    }
                except Exception as exc:
                    ms = round((time.perf_counter() - t0) * 1000)
                    return {**tc, "actual_status": 0, "response_ms": ms, "passed": False, "note": "Request failed"}

            tasks = [_exec(tc) for tc in test_cases[:12]]
            results = list(await asyncio.gather(*tasks))
    else:
        results = [{**tc, "actual_status": 0, "response_ms": 0, "passed": False, "note": "httpx not available"} for tc in test_cases]

    passed = sum(1 for r in results if r["passed"])
    return {
        "type": "functional",
        "results": results,
        "passed": passed,
        "failed": len(results) - passed,
        "total": len(results),
        "ai_used": HAS_OPENAI,
    }


# ──────────────────────────────────────────────────────────
# PHASE 2c — Visual Baseline
# ──────────────────────────────────────────────────────────
async def run_visual_baseline(crawl_data: Dict) -> Dict:
    pages = crawl_data.get("pages", [])
    results = []

    for page in pages:
        has_shot = bool(page.get("screenshot_b64"))
        # Detect potential visual issues
        issues = []
        if page.get("status_code", 0) >= 400:
            issues.append("Error page detected")
        if not page.get("title"):
            issues.append("Missing page title")
        results.append(
            {
                "url": page["url"],
                "title": page.get("title", ""),
                "has_screenshot": has_shot,
                "screenshot_b64": page.get("screenshot_b64"),  # included in report
                "status_code": page.get("status_code", 0),
                "issues": issues,
                "baseline_saved": has_shot,
            }
        )

    return {
        "type": "visual",
        "results": results,
        "total_pages": len(results),
        "screenshots_captured": sum(1 for r in results if r["has_screenshot"]),
        "issues_found": sum(len(r["issues"]) for r in results),
    }


# ──────────────────────────────────────────────────────────
# PHASE 2d — Security Checks
# ──────────────────────────────────────────────────────────
SECURITY_HEADERS = [
    ("strict-transport-security", "HSTS", "critical"),
    ("content-security-policy", "CSP", "high"),
    ("x-content-type-options", "X-Content-Type-Options", "medium"),
    ("x-frame-options", "X-Frame-Options", "medium"),
    ("referrer-policy", "Referrer-Policy", "low"),
    ("permissions-policy", "Permissions-Policy", "low"),
]

FUZZ_PAYLOADS = [
    ("' OR '1'='1", "sql_injection"),
    ("<script>alert(1)</script>", "xss"),
    ("../../../etc/passwd", "path_traversal"),
    ("${7*7}", "ssti"),
]


async def run_security_checks(crawl_data: Dict) -> Dict:
    routes = crawl_data.get("routes", [])
    results = []
    all_issues = []

    if not HAS_HTTPX or not routes:
        return {"type": "security", "results": [], "issues": [], "critical": 0, "high": 0, "medium": 0, "low": 0}

    async with httpx.AsyncClient(
        timeout=6, follow_redirects=True, verify=False
    ) as client:

        async def _check_route(url):
            route_issues = []
            headers_present = []
            headers_missing = []
            fuzz_findings = []

            # 1. Header checks
            try:
                r = await client.get(url)
                resp_headers = {k.lower(): v for k, v in r.headers.items()}

                for header_key, header_name, severity in SECURITY_HEADERS:
                    if header_key in resp_headers:
                        headers_present.append(header_name)
                    else:
                        headers_missing.append({"header": header_name, "severity": severity})
                        route_issues.append(
                            {
                                "type": "missing_header",
                                "severity": severity,
                                "title": f"Missing {header_name} header",
                                "url": url,
                                "detail": f"The {header_name} security header is absent.",
                            }
                        )

                # Check for sensitive info in response body
                body_text = r.text[:4000]
                sensitive_patterns = [
                    (r"password\s*[:=]\s*\S+", "Password exposed in response", "critical"),
                    (r"api[_-]?key\s*[:=]\s*['\"]?\w{16,}", "API key exposed", "critical"),
                    (r"secret\s*[:=]\s*['\"]?\w{8,}", "Secret value exposed", "high"),
                    (r"-----BEGIN .* PRIVATE KEY-----", "Private key exposed", "critical"),
                    (r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}", "JWT token in response body", "medium"),
                ]
                for pattern, title, severity in sensitive_patterns:
                    if re.search(pattern, body_text, re.IGNORECASE):
                        route_issues.append(
                            {"type": "info_leak", "severity": severity, "title": title, "url": url, "detail": "Sensitive data found in response body."}
                        )

            except Exception:
                pass

            # 2. Fuzz probes (query string injection)
            for payload, ptype in FUZZ_PAYLOADS[:2]:  # limit to 2 probes per route for speed
                fuzz_url = f"{url}?q={payload}&id={payload}"
                try:
                    r2 = await client.get(fuzz_url)
                    if r2.status_code == 500:
                        fuzz_findings.append(
                            {
                                "type": "fuzz_500",
                                "severity": "high",
                                "title": f"500 error on {ptype} probe",
                                "url": fuzz_url,
                                "detail": "Server returned 500 when fuzz payload was injected.",
                            }
                        )
                        route_issues.extend(fuzz_findings)
                except Exception:
                    pass

            return {
                "url": url,
                "headers_present": headers_present,
                "headers_missing": [h["header"] for h in headers_missing],
                "issues": route_issues,
                "fuzz_findings": fuzz_findings,
            }

        # Only check first 8 routes for speed
        tasks = [_check_route(r) for r in routes[:8]]
        results = list(await asyncio.gather(*tasks, return_exceptions=True))
        results = [r for r in results if not isinstance(r, Exception)]

    for r in results:
        all_issues.extend(r.get("issues", []))

    # Deduplicate issues by title — same issue on multiple routes
    # becomes one entry with an affected_urls count.
    seen: Dict[str, Dict] = {}
    for issue in all_issues:
        key = issue.get("title", "")
        if key not in seen:
            seen[key] = {**issue, "affected_urls": 1}
        else:
            seen[key]["affected_urls"] += 1

    deduped_issues = list(seen.values())

    severity_count = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for issue in deduped_issues:
        sev = issue.get("severity", "low")
        severity_count[sev] = severity_count.get(sev, 0) + 1

    return {
        "type": "security",
        "results": results,
        "issues": deduped_issues,
        **severity_count,
    }


# ──────────────────────────────────────────────────────────
# PHASE 2e — Performance Baseline
# ──────────────────────────────────────────────────────────
async def run_performance_baseline(crawl_data: Dict) -> Dict:
    routes = crawl_data.get("routes", [])
    results = []

    if not HAS_HTTPX or not routes:
        return {"type": "performance", "results": [], "avg_ms": 0, "slowest": None, "fastest": None}

    async with httpx.AsyncClient(
        timeout=8, follow_redirects=True, verify=False
    ) as client:

        async def _measure(url):
            timings = []
            for _ in range(2):  # 2 samples for speed
                t0 = time.perf_counter()
                try:
                    await client.get(url)
                    timings.append(round((time.perf_counter() - t0) * 1000))
                except Exception:
                    timings.append(9999)
            avg = round(sum(timings) / len(timings))
            rating = "fast" if avg < 400 else ("acceptable" if avg < 1200 else ("slow" if avg < 3000 else "critical"))
            return {"url": url, "avg_ms": avg, "samples": timings, "rating": rating}

        tasks = [_measure(r) for r in routes[:15]]
        results = list(await asyncio.gather(*tasks, return_exceptions=True))
        results = [r for r in results if not isinstance(r, Exception)]

    if results:
        valid = [r for r in results if r["avg_ms"] < 9999]
        overall_avg = round(sum(r["avg_ms"] for r in valid) / len(valid)) if valid else 0
        slowest = max(valid, key=lambda r: r["avg_ms"]) if valid else None
        fastest = min(valid, key=lambda r: r["avg_ms"]) if valid else None
    else:
        overall_avg, slowest, fastest = 0, None, None

    return {
        "type": "performance",
        "results": results,
        "avg_ms": overall_avg,
        "slowest": slowest,
        "fastest": fastest,
        "slow_routes": [r for r in results if r["rating"] in ("slow", "critical")],
    }


# ──────────────────────────────────────────────────────────
# PHASE 3 — GPT-4 Unified Report Synthesis
# ──────────────────────────────────────────────────────────
async def synthesize_report(
    url: str,
    crawl_data: Dict,
    smoke: Dict,
    functional: Dict,
    visual: Dict,
    security: Dict,
    performance: Dict,
) -> Dict:
    pages_count = len(crawl_data.get("pages", []))
    routes_count = len(crawl_data.get("routes", []))
    api_count = len(crawl_data.get("api_calls", []))

    # Build a compact context for GPT-4
    security_issues = security.get("issues", [])[:15]
    perf_slow = performance.get("slow_routes", [])[:5]
    smoke_failures = [r for r in smoke.get("results", []) if not r["passed"]][:5]
    func_failures = [r for r in functional.get("results", []) if not r["passed"]][:5]

    context_summary = {
        "target_url": url,
        "pages_discovered": pages_count,
        "routes_tested": routes_count,
        "api_calls_found": api_count,
        "smoke": {"total": smoke["total"], "passed": smoke["passed"], "failed": smoke["failed"], "failures": smoke_failures},
        "functional": {"total": functional["total"], "passed": functional["passed"], "failed": functional["failed"], "failures": func_failures},
        "security": {"critical": security["critical"], "high": security["high"], "medium": security["medium"], "low": security["low"], "issues": security_issues},
        "performance": {"avg_ms": performance["avg_ms"], "slow_routes": perf_slow},
        "visual": {"pages_captured": visual["screenshots_captured"], "visual_issues": visual["issues_found"]},
    }

    # App health score (0-100)
    # Each category is capped so that a single bad area can't collapse the entire score.
    # Security counts are already deduplicated by title, so we're counting unique issue types.
    sec_deduction = min(35, (
        security["critical"] * 15
        + security["high"] * 8
        + security["medium"] * 4
        + security["low"] * 2
    ))
    # smoke["failed"] only counts real failures; 401/403 warnings are passed=True
    smoke_deduction = min(25, smoke["failed"] * 8)
    func_deduction  = min(20, functional["failed"] * 5)
    perf_deduction  = min(10, len(perf_slow) * 3)
    visual_deduction = min(10, visual["issues_found"] * 3)

    total_deduction = sec_deduction + smoke_deduction + func_deduction + perf_deduction + visual_deduction
    health_score = max(10, 100 - total_deduction)

    ai_insights = None
    ai_issues = []

    if HAS_OPENAI:
        try:
            prompt = (
                "You are a senior QA engineer and security specialist. "
                "Analyze this automated test report for a web app and return a JSON object with:\n"
                "- executive_summary (string, 2-3 sentences, plain English)\n"
                "- issues (array of objects, each with: id, title, severity (critical/high/medium/low/info), "
                "  type (security/performance/smoke/functional/visual), url, root_cause, business_impact, fix_recommendation)\n"
                "- positive_findings (array of strings, things that work well)\n"
                "- priority_actions (array of strings, top 5 things to fix immediately)\n\n"
                "Return ONLY valid JSON, no markdown fences.\n\n"
                f"Test data:\n{json.dumps(context_summary, ensure_ascii=False)}"
            )

            gpt_resp = await asyncio.to_thread(
                openai_client.chat.completions.create,
                model="gpt-4o",
                temperature=0.15,
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = gpt_resp.choices[0].message.content.strip()
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
            parsed = json.loads(raw)
            ai_insights = parsed.get("executive_summary", "")
            ai_issues = parsed.get("issues", [])
            positive_findings = parsed.get("positive_findings", [])
            priority_actions = parsed.get("priority_actions", [])
        except Exception as e:
            # Never expose raw error messages - they may contain API keys or sensitive data
            ai_insights = "AI synthesis unavailable. Please check your OpenAI API configuration."
            ai_issues = []
            positive_findings = []
            priority_actions = []
            # Log the actual error securely (not shown to users)
            print(f"[FullSend AI Error] {type(e).__name__}: {str(e)[:100]}")
    else:
        ai_insights = "AI synthesis disabled (no OpenAI key configured)."
        positive_findings = []
        priority_actions = []

    return {
        "app_health_score": health_score,
        "executive_summary": ai_insights,
        "ai_issues": ai_issues,
        "positive_findings": positive_findings,
        "priority_actions": priority_actions,
        "context_summary": context_summary,
    }


# ──────────────────────────────────────────────────────────
# Main Orchestration
# ──────────────────────────────────────────────────────────
async def run_full_scan(scan_id: str, raw_url: str, report_token: str):
    t_start = time.perf_counter()

    try:
        url = _norm_url(raw_url)
        scan_store[scan_id]["status"] = "crawling"
        _set_progress(scan_id, 5, "Launching headless browser...")

        # ── Phase 1: Crawl ────────────────────────────────
        try:
            crawl_data = await asyncio.wait_for(
                crawl_application(url, scan_id, max_pages=8), timeout=40
            )
        except asyncio.TimeoutError:
            crawl_data = {"pages": [], "routes": [url], "api_calls": []}

        _set_progress(scan_id, 30, "Running 5 test suites in parallel...")
        scan_store[scan_id]["status"] = "testing"

        # ── Phase 2: Five parallel suites ─────────────────
        smoke, functional, visual, security, performance = await asyncio.gather(
            asyncio.wait_for(run_smoke_tests(crawl_data), timeout=20),
            asyncio.wait_for(run_ai_functional_tests(crawl_data), timeout=30),
            asyncio.wait_for(run_visual_baseline(crawl_data), timeout=5),
            asyncio.wait_for(run_security_checks(crawl_data), timeout=20),
            asyncio.wait_for(run_performance_baseline(crawl_data), timeout=20),
            return_exceptions=True,
        )

        # Replace exceptions with empty results
        def _safe(result, test_type):
            if isinstance(result, Exception):
                return {"type": test_type, "results": [], "passed": 0, "failed": 0, "total": 0, "error": str(result)}
            return result

        smoke = _safe(smoke, "smoke")
        functional = _safe(functional, "functional")
        visual = _safe(visual, "visual") if not isinstance(visual, Exception) else {"type": "visual", "results": [], "screenshots_captured": 0, "issues_found": 0}
        security = _safe(security, "security") if not isinstance(security, Exception) else {"type": "security", "results": [], "issues": [], "critical": 0, "high": 0, "medium": 0, "low": 0}
        performance = _safe(performance, "performance") if not isinstance(performance, Exception) else {"type": "performance", "results": [], "avg_ms": 0, "slow_routes": []}

        _set_progress(scan_id, 80, "GPT-4 synthesizing unified report...")
        scan_store[scan_id]["status"] = "synthesizing"

        # ── Phase 3: GPT-4 synthesis ─────────────────────
        synthesis = await asyncio.wait_for(
            synthesize_report(url, crawl_data, smoke, functional, visual, security, performance),
            timeout=20,
        )

        elapsed = round(time.perf_counter() - t_start, 1)

        # ── Assemble final report ─────────────────────────
        report = {
            "report_token": report_token,
            "scan_id": scan_id,
            "target_url": url,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "elapsed_seconds": elapsed,
            "app_health_score": synthesis["app_health_score"],
            "executive_summary": synthesis["executive_summary"],
            "ai_issues": synthesis["ai_issues"],
            "positive_findings": synthesis["positive_findings"],
            "priority_actions": synthesis["priority_actions"],
            "pages_discovered": len(crawl_data.get("pages", [])),
            "routes_tested": len(crawl_data.get("routes", [])),
            "api_calls_found": len(crawl_data.get("api_calls", [])),
            "smoke": smoke,
            "functional": functional,
            "visual": {
                **visual,
                # Strip heavy screenshot data from the results list for storage
                "results": [
                    {k: v for k, v in r.items() if k != "screenshot_b64"}
                    for r in visual.get("results", [])
                ],
            },
            "security": security,
            "performance": performance,
            # Keep one screenshot per page for the report viewer
            "page_screenshots": [
                {"url": p["url"], "title": p.get("title", ""), "screenshot_b64": p.get("screenshot_b64")}
                for p in crawl_data.get("pages", [])
                if p.get("screenshot_b64")
            ][:8],
        }

        _save_report(report_token, report)

        scan_store[scan_id]["status"] = "complete"
        scan_store[scan_id]["progress"] = 100
        scan_store[scan_id]["phase"] = f"Done in {elapsed}s"

    except Exception as exc:
        scan_store[scan_id]["status"] = "error"
        scan_store[scan_id]["error"] = "Scan failed. Please try again."
        scan_store[scan_id]["phase"] = "Scan failed"
        print(f"[FullSend Scan Error] {scan_id}: {type(exc).__name__}: {str(exc)[:200]}")
        # Save a minimal error report so the token still resolves
        _save_report(report_token, {
            "report_token": report_token,
            "scan_id": scan_id,
            "target_url": raw_url,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "error": str(exc),
            "traceback": traceback.format_exc()[-2000:],
        })


# ──────────────────────────────────────────────────────────
# FastAPI Endpoints
# ──────────────────────────────────────────────────────────
@full_send_router.post("/scan")
async def start_fullsend_scan(
    request: FullSendRequest, background_tasks: BackgroundTasks
):
    """Kick off a FullSend scan. Returns scan_id and report_token immediately."""
    scan_id = str(uuid.uuid4())
    report_token = uuid.uuid4().hex[:24]

    scan_store[scan_id] = {
        "status": "pending",
        "progress": 0,
        "phase": "Queued — warming up engines...",
        "report_token": report_token,
        "url": request.url,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "error": None,
    }

    background_tasks.add_task(run_full_scan, scan_id, request.url, report_token)

    return {
        "scan_id": scan_id,
        "report_token": report_token,
        "report_url": f"/report/fullsend/{report_token}",
    }


@full_send_router.get("/status/{scan_id}")
async def get_scan_status(scan_id: str):
    """Poll scan progress."""
    if scan_id not in scan_store:
        raise HTTPException(status_code=404, detail="Scan not found")
    scan = scan_store[scan_id]
    return {
        "scan_id": scan_id,
        "status": scan["status"],
        "progress": scan["progress"],
        "phase": scan["phase"],
        "report_token": scan.get("report_token"),
        "error": scan.get("error"),
    }


@full_send_router.get("/report/{report_token}")
async def get_fullsend_report(report_token: str):
    """
    Public endpoint — no auth required.
    Returns the completed FullSend report JSON.
    """
    # Try in-memory first (report might still be in progress)
    for sid, scan in scan_store.items():
        if scan.get("report_token") == report_token and scan["status"] not in ("complete", "error"):
            raise HTTPException(status_code=202, detail="Report is still being generated")

    # Read from disk
    report = _load_report(report_token)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    if "error" in report and "app_health_score" not in report:
        raise HTTPException(status_code=500, detail=report.get("error", "Scan failed"))

    return report


@full_send_router.get("/")
async def redirect_to_home():
    """
    Redirect direct access to /fullsend to homepage.
    Testing modules require authentication and should be accessed via the app.
    """
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/", status_code=302)
