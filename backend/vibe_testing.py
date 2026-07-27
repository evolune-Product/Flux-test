"""
Vibe Testing Module — Fully isolated microservice.
Remove this file and the feature disappears entirely.
"""

import os
import re
import base64
import zipfile
import tempfile
import asyncio
from typing import Optional, List, Dict, Any, Tuple
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

# Optional imports — graceful degradation if missing
try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

try:
    import openai
    HAS_OPENAI = bool(os.environ.get("OPENAI_API_KEY"))
    if HAS_OPENAI:
        openai_client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    else:
        openai_client = None
except ImportError:
    HAS_OPENAI = False
    openai_client = None

try:
    import pyaxmlparser
    HAS_PYAXML = True
except ImportError:
    HAS_PYAXML = False

try:
    from playwright.async_api import async_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

import uuid
import json
from pathlib import Path
from datetime import datetime, timezone


# ============================================================
# Pydantic Models
# ============================================================

class TestScenario(BaseModel):
    title: str
    steps: List[str]
    expected_outcome: str
    priority: str  # high | medium | low
    category: str


class CrawlRequest(BaseModel):
    url: str
    max_pages: int = 10
    js_rendering: bool = False


class CrawlResponse(BaseModel):
    pages_crawled: int
    state_graph: Dict[str, Any]
    test_scenarios: List[TestScenario]
    fallback_used: bool = False
    spa_detected: bool = False
    crawler_used: str = "httpx"


class ScreenshotResponse(BaseModel):
    ui_elements: List[str]
    accessibility_notes: List[str]
    test_scenarios: List[TestScenario]


class CodeUploadResponse(BaseModel):
    routes_confirmed: List[str]
    components_confirmed: List[str]
    files_analyzed: int
    test_scenarios: List[TestScenario]


class ApkResponse(BaseModel):
    package_name: str
    activities: List[str]
    services: List[str]
    permissions: List[str]
    min_sdk: Optional[str]
    target_sdk: Optional[str]
    parse_method: str  # "pyaxmlparser" | "regex"
    test_scenarios: List[TestScenario]


class HealthResponse(BaseModel):
    status: str
    capabilities: Dict[str, bool]


# ============================================================
# Visual Regression — Storage Helpers
# ============================================================

BASELINES_DIR = Path("vibe_baselines")


def _ensure_baselines_dir():
    BASELINES_DIR.mkdir(exist_ok=True)


def _save_baseline(data: dict):
    _ensure_baselines_dir()
    (BASELINES_DIR / f"{data['session_id']}.json").write_text(json.dumps(data))


def _load_baseline(session_id: str) -> dict:
    path = BASELINES_DIR / f"{session_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Baseline session '{session_id}' not found")
    return json.loads(path.read_text())


def _list_baselines() -> list:
    _ensure_baselines_dir()
    sessions = []
    for p in sorted(BASELINES_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(p.read_text())
            sessions.append({k: data[k] for k in
                ('session_id', 'url', 'label', 'captured_at', 'source', 'viewport') if k in data})
        except Exception:
            continue
    return sessions


def _delete_baseline(session_id: str):
    path = BASELINES_DIR / f"{session_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Baseline session '{session_id}' not found")
    path.unlink()


# ============================================================
# Visual Regression — Pydantic Models
# ============================================================

class VisualCaptureRequest(BaseModel):
    url: str
    label: str = ""
    viewport_width: int = 1280
    viewport_height: int = 800
    full_page: bool = True


class VisualBaselineResponse(BaseModel):
    session_id: str
    url: str
    label: str
    screenshot_b64: str
    captured_at: str
    source: str          # "playwright" | "upload"
    viewport: Dict[str, int]


class VisualSessionMeta(BaseModel):
    session_id: str
    url: str
    label: str
    captured_at: str
    source: str
    viewport: Dict[str, int]


class VisualSessionsResponse(BaseModel):
    sessions: List[VisualSessionMeta]


class VisualChange(BaseModel):
    element: str
    change_type: str
    severity: str        # critical | major | minor
    description: str
    location: str


class VisualCompareRequest(BaseModel):
    session_id: str
    viewport_width: int = 1280
    viewport_height: int = 800
    full_page: bool = True


class VisualCompareResponse(BaseModel):
    session_id: str
    url: str
    overall_status: str            # pass | warning | fail
    changes: List[VisualChange]
    summary: str
    pixel_diff_score: float
    baseline_screenshot_b64: str
    current_screenshot_b64: str
    diff_screenshot_b64: str       # baseline with red highlights on changed pixels
    compared_at: str
    fallback_used: bool = False


# ============================================================
# Router
# ============================================================
vibe_testing_router = APIRouter()


# ============================================================
# Health Endpoint
# ============================================================

@vibe_testing_router.get("/health", response_model=HealthResponse)
async def vibe_health():
    return HealthResponse(
        status="ok",
        capabilities={
            "web_crawl": HAS_HTTPX,
            "html_parsing": HAS_BS4,
            "ai_generation": HAS_OPENAI,
            "apk_native_parse": HAS_PYAXML,
            "screenshot_analysis": HAS_OPENAI,
            "code_analysis": HAS_OPENAI,
            "headless_crawl": HAS_PLAYWRIGHT,
            "visual_regression": HAS_PLAYWRIGHT and HAS_OPENAI,
        }
    )


# ============================================================
# SPA Detection
# ============================================================

def _is_spa(html: str, link_count: int) -> bool:
    """Return True if the page is likely a JavaScript SPA."""
    # 1. React/Vue/Nuxt/Next mount points
    if re.search(r'<div[^>]+id=["\'](?:root|app|__nuxt|__next)["\']', html, re.IGNORECASE):
        return True
    # 2. React SSR marker
    if 'data-reactroot' in html:
        return True
    # 3. Angular bootstrap attribute
    if 'ng-version' in html:
        return True
    # 4. Webpack/Vite hashed bundle
    if re.search(r'<script[^>]+src=["\'][^"\']*bundle\.[0-9a-f]{6,}\.js["\']', html, re.IGNORECASE):
        return True
    # 5. Generic hashed JS (8+ hex chars before .js)
    if re.search(r'<script[^>]+src=["\'][^"\']*[0-9a-f]{8,}\.js["\']', html, re.IGNORECASE):
        return True
    # 6. Sparse body text combined with few links
    body_text = re.sub(r'<[^>]+>', '', html)
    body_text = re.sub(r'\s+', ' ', body_text).strip()
    if len(body_text) < 200 and link_count < 3:
        return True
    # 7. SSR global state markers
    if any(marker in html for marker in ('window.__NEXT_DATA__', 'window.__NUXT__', 'window.__INITIAL_STATE__')):
        return True
    # 8. Vue 3 / Svelte patterns
    if re.search(r"createApp\(|mount\('#app'\)", html):
        return True
    return False


# ============================================================
# Web App Crawler
# ============================================================

class WebAppCrawler:
    SKIP_EXTENSIONS = {
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
        '.css', '.js', '.woff', '.woff2', '.ttf', '.eot', '.map',
        '.pdf', '.zip', '.tar', '.gz'
    }

    def __init__(self, base_url: str, max_pages: int = 10):
        self.base_url = base_url.rstrip('/')
        self.max_pages = max_pages
        from urllib.parse import urlparse
        parsed = urlparse(base_url)
        self.origin = f"{parsed.scheme}://{parsed.netloc}"

    def _is_same_origin(self, url: str) -> bool:
        from urllib.parse import urlparse
        try:
            return urlparse(url).netloc == urlparse(self.origin).netloc
        except Exception:
            return False

    def _should_skip(self, url: str) -> bool:
        from urllib.parse import urlparse
        path = urlparse(url).path.lower()
        return any(path.endswith(ext) for ext in self.SKIP_EXTENSIONS)

    def _extract_links_bs4(self, html: str, page_url: str) -> List[str]:
        from urllib.parse import urljoin
        soup = BeautifulSoup(html, 'lxml' if HAS_BS4 else 'html.parser')
        links = []
        for tag in soup.find_all('a', href=True):
            href = urljoin(page_url, tag['href'])
            if self._is_same_origin(href) and not self._should_skip(href):
                links.append(href.split('#')[0])
        return links

    def _extract_links_regex(self, html: str, page_url: str) -> List[str]:
        from urllib.parse import urljoin
        hrefs = re.findall(r'href=["\']([^"\']+)["\']', html)
        links = []
        for href in hrefs:
            full = urljoin(page_url, href)
            if self._is_same_origin(full) and not self._should_skip(full):
                links.append(full.split('#')[0])
        return links

    def _extract_forms(self, html: str) -> List[Dict]:
        forms = []
        if HAS_BS4:
            soup = BeautifulSoup(html, 'lxml' if HAS_BS4 else 'html.parser')
            for form in soup.find_all('form'):
                inputs = [
                    {'name': i.get('name', ''), 'type': i.get('type', 'text')}
                    for i in form.find_all(['input', 'textarea', 'select'])
                ]
                forms.append({
                    'action': form.get('action', ''),
                    'method': form.get('method', 'get').upper(),
                    'inputs': inputs
                })
        else:
            for m in re.finditer(r'<form[^>]*>', html, re.IGNORECASE):
                action = re.search(r'action=["\']([^"\']*)["\']', m.group(0))
                method = re.search(r'method=["\']([^"\']*)["\']', m.group(0))
                forms.append({
                    'action': action.group(1) if action else '',
                    'method': (method.group(1) if method else 'GET').upper(),
                    'inputs': []
                })
        return forms

    def _get_title(self, html: str) -> str:
        if HAS_BS4:
            soup = BeautifulSoup(html, 'lxml' if HAS_BS4 else 'html.parser')
            title_tag = soup.find('title')
            return title_tag.get_text(strip=True) if title_tag else ''
        m = re.search(r'<title[^>]*>([^<]+)</title>', html, re.IGNORECASE)
        return m.group(1).strip() if m else ''

    async def _fetch_first_page_html(self) -> str:
        """Single httpx GET of base_url; returns raw HTML or '' on failure."""
        if not HAS_HTTPX:
            return ''
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(self.base_url, headers={'User-Agent': 'VibeTest-Crawler/1.0'})
                return resp.text
        except Exception:
            return ''

    async def _crawl_with_playwright(self) -> Dict[str, Any]:
        """Headless Chromium crawl for SPAs. Returns same shape as crawl()."""
        from urllib.parse import urlparse, urljoin

        visited: set = set()
        queue = [self.base_url]
        nodes: Dict[str, Any] = {}
        edges: List[Dict] = []

        init_script = """
() => {
    window.__vibeRoutes = new Set();
    const _push = history.pushState.bind(history);
    const _replace = history.replaceState.bind(history);
    history.pushState = function(state, title, url) {
        if (url) window.__vibeRoutes.add(new URL(url, location.href).href);
        return _push(state, title, url);
    };
    history.replaceState = function(state, title, url) {
        if (url) window.__vibeRoutes.add(new URL(url, location.href).href);
        return _replace(state, title, url);
    };
}
"""

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote']
            )
            try:
                context = await browser.new_context(
                    viewport={'width': 1280, 'height': 800},
                    user_agent='VibeTest-Playwright/1.0',
                    ignore_https_errors=True
                )
                await context.add_init_script(init_script)
                page = await context.new_page()

                while queue and len(visited) < self.max_pages:
                    url = queue.pop(0)
                    # Normalize: strip fragment, strip trailing slash
                    url = url.split('#')[0].rstrip('/')
                    if not url:
                        url = self.base_url
                    if url in visited:
                        continue
                    if not self._is_same_origin(url) or self._should_skip(url):
                        continue
                    visited.add(url)

                    # Navigate
                    try:
                        await page.goto(url, wait_until='networkidle', timeout=20000)
                    except Exception:
                        try:
                            await page.goto(url, wait_until='domcontentloaded', timeout=20000)
                            await asyncio.sleep(2)
                        except Exception:
                            continue

                    # Scroll to trigger lazy loading
                    try:
                        for scroll_y in range(300, 3001, 300):
                            await page.evaluate(f'window.scrollTo(0, {scroll_y})')
                            await asyncio.sleep(0.1)
                        await page.evaluate('window.scrollTo(0, 0)')
                    except Exception:
                        pass

                    # Extract rendered DOM links
                    try:
                        dom_links = await page.eval_on_selector_all(
                            'a[href]', 'els => els.map(e => e.href)'
                        )
                    except Exception:
                        dom_links = []

                    # Extract SPA-navigated routes
                    try:
                        spa_routes = await page.evaluate('() => Array.from(window.__vibeRoutes || [])')
                    except Exception:
                        spa_routes = []

                    # Combine, normalize, deduplicate
                    all_links = set()
                    for raw in list(dom_links) + list(spa_routes):
                        try:
                            normalized = raw.split('#')[0].rstrip('/')
                            if normalized and self._is_same_origin(normalized) and not self._should_skip(normalized):
                                all_links.add(normalized)
                        except Exception:
                            pass

                    # Extract rendered forms
                    try:
                        forms = await page.evaluate("""() => {
                            return Array.from(document.querySelectorAll('form')).map(f => ({
                                action: f.getAttribute('action') || '',
                                method: (f.getAttribute('method') || 'get').toUpperCase(),
                                inputs: Array.from(f.querySelectorAll('input,textarea,select')).map(i => ({
                                    name: i.getAttribute('name') || '',
                                    type: i.getAttribute('type') || 'text'
                                }))
                            }));
                        }""")
                    except Exception:
                        forms = []

                    # Page title
                    try:
                        title = await page.title()
                    except Exception:
                        title = ''

                    nodes[url] = {'title': title, 'forms': forms}

                    for link in all_links:
                        if link not in visited:
                            queue.append(link)
                            if link not in [e['to'] for e in edges if e['from'] == url]:
                                edges.append({'from': url, 'to': link})

            finally:
                await browser.close()

        return {'nodes': nodes, 'edges': edges}

    async def crawl(self) -> Dict[str, Any]:
        visited = set()
        queue = [self.base_url]
        nodes: Dict[str, Any] = {}
        edges: List[Dict] = []

        if not HAS_HTTPX:
            return {'nodes': {}, 'edges': [], 'error': 'httpx not available'}

        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            while queue and len(visited) < self.max_pages:
                url = queue.pop(0)
                if url in visited:
                    continue
                visited.add(url)

                try:
                    resp = await client.get(url, headers={'User-Agent': 'VibeTest-Crawler/1.0'})
                    html = resp.text
                except Exception:
                    continue

                title = self._get_title(html)
                forms = self._extract_forms(html)
                nodes[url] = {'title': title, 'forms': forms}

                if HAS_BS4:
                    links = self._extract_links_bs4(html, url)
                else:
                    links = self._extract_links_regex(html, url)

                for link in links:
                    if link not in visited:
                        queue.append(link)
                        if link not in [e['to'] for e in edges if e['from'] == url]:
                            edges.append({'from': url, 'to': link})

        return {'nodes': nodes, 'edges': edges}


def _build_crawl_summary(graph: Dict) -> str:
    nodes = graph.get('nodes', {})
    edges = graph.get('edges', [])
    lines = [f"Pages crawled: {len(nodes)}", f"Links found: {len(edges)}", ""]
    for url, data in list(nodes.items())[:15]:
        lines.append(f"URL: {url}")
        if data.get('title'):
            lines.append(f"  Title: {data['title']}")
        for form in data.get('forms', [])[:3]:
            inputs = ', '.join(i['name'] for i in form.get('inputs', []) if i.get('name'))
            lines.append(f"  Form [{form['method']}] -> {form['action']} (inputs: {inputs})")
    return '\n'.join(lines)


def _fallback_crawl_scenarios(graph: Dict) -> List[TestScenario]:
    scenarios = []
    nodes = graph.get('nodes', {})
    for url, data in nodes.items():
        for form in data.get('forms', []):
            inputs = form.get('inputs', [])
            scenarios.append(TestScenario(
                title=f"Submit form at {url}",
                steps=[
                    f"Navigate to {url}",
                    f"Fill in: {', '.join(i['name'] for i in inputs if i.get('name')) or 'form fields'}",
                    f"Submit form via {form['method']}"
                ],
                expected_outcome="Form submitted successfully, appropriate response received",
                priority="medium",
                category="form-submission"
            ))
    if not scenarios:
        scenarios.append(TestScenario(
            title="Basic page load test",
            steps=["Navigate to the target URL", "Verify page loads without errors"],
            expected_outcome="Page returns HTTP 200 with valid content",
            priority="high",
            category="smoke"
        ))
    return scenarios[:10]


def _parse_gpt_scenarios(raw: str) -> List[TestScenario]:
    """Parse GPT JSON array response into TestScenario list."""
    import json
    try:
        # Try direct parse
        data = json.loads(raw)
        if isinstance(data, list):
            results = []
            for item in data:
                if isinstance(item, dict):
                    results.append(TestScenario(
                        title=item.get('title', 'Test Scenario'),
                        steps=item.get('steps', []),
                        expected_outcome=item.get('expected_outcome', ''),
                        priority=item.get('priority', 'medium'),
                        category=item.get('category', 'general')
                    ))
            return results
    except Exception:
        pass

    # Extract JSON array from markdown code block
    m = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', raw, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(1))
            return [TestScenario(**item) for item in data if isinstance(item, dict)]
        except Exception:
            pass

    return []


SCENARIO_SCHEMA = """{
  "title": "string",
  "steps": ["string"],
  "expected_outcome": "string",
  "priority": "high|medium|low",
  "category": "string"
}"""


@vibe_testing_router.post("/crawl", response_model=CrawlResponse)
async def crawl_web_app(req: CrawlRequest):
    crawler = WebAppCrawler(req.url, max_pages=min(req.max_pages, 20))

    # 1. Always run httpx crawl first
    graph = await crawler.crawl()
    link_count = len(graph.get('edges', []))

    spa_detected = False
    use_playwright = False
    crawler_used = "httpx"

    # 2. Decide whether to use Playwright
    if req.js_rendering:
        if not HAS_PLAYWRIGHT:
            raise HTTPException(
                status_code=503,
                detail=(
                    "JS rendering requires Playwright. Install it with: "
                    "pip install playwright && python -m playwright install chromium"
                )
            )
        use_playwright = True
        spa_detected = True
    elif HAS_PLAYWRIGHT:
        # Auto-detect SPA from first page HTML
        first_html = await crawler._fetch_first_page_html()
        if _is_spa(first_html, link_count):
            use_playwright = True
            spa_detected = True

    # 3. Run Playwright crawl if needed
    if use_playwright:
        try:
            pw_graph = await crawler._crawl_with_playwright()
            if pw_graph.get('nodes'):
                graph = pw_graph
                crawler_used = "playwright"
        except Exception:
            # Playwright failed — keep httpx graph, crawler_used stays "httpx"
            pass

    # 4. Generate scenarios (unchanged)
    fallback_used = False

    if HAS_OPENAI and openai_client:
        summary = _build_crawl_summary(graph)
        prompt = f"""You are a QA engineer. Analyze this web app structure and generate 8–12 test scenarios.

{summary}

Return a JSON array only. Each element:
{SCENARIO_SCHEMA}"""
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=2000
            )
            scenarios = _parse_gpt_scenarios(response.choices[0].message.content)
            if not scenarios:
                raise ValueError("empty parse")
        except Exception:
            scenarios = _fallback_crawl_scenarios(graph)
            fallback_used = True
    else:
        scenarios = _fallback_crawl_scenarios(graph)
        fallback_used = True

    return CrawlResponse(
        pages_crawled=len(graph.get('nodes', {})),
        state_graph=graph,
        test_scenarios=scenarios,
        fallback_used=fallback_used,
        spa_detected=spa_detected,
        crawler_used=crawler_used
    )


# ============================================================
# Screenshot Analyzer
# ============================================================

class ScreenshotAnalyzer:
    def analyze(self, image_bytes: bytes, mime_type: str) -> ScreenshotResponse:
        if not HAS_OPENAI or not openai_client:
            raise HTTPException(
                status_code=503,
                detail="Screenshot analysis requires an OpenAI API key. Set OPENAI_API_KEY environment variable."
            )

        b64 = base64.b64encode(image_bytes).decode()
        prompt = f"""Analyze this UI screenshot and return a JSON object with exactly these keys:
{{
  "ui_elements": ["list of identified UI elements"],
  "accessibility_notes": ["list of accessibility observations"],
  "test_scenarios": [
    {SCENARIO_SCHEMA}
  ]
}}

Generate 6–10 test scenarios covering: navigation, form interactions, error states, accessibility, and edge cases.
Return JSON only, no markdown."""

        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}}
                    ]
                }],
                temperature=0.3,
                max_tokens=2500
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI analysis request failed: {str(e)}")

        import json
        raw = response.choices[0].message.content
        # Strip markdown code fences if present
        raw = re.sub(r'^```(?:json)?\s*', '', raw.strip())
        raw = re.sub(r'\s*```$', '', raw)

        try:
            data = json.loads(raw)
            scenarios = [TestScenario(**s) for s in data.get('test_scenarios', [])]
            return ScreenshotResponse(
                ui_elements=data.get('ui_elements', []),
                accessibility_notes=data.get('accessibility_notes', []),
                test_scenarios=scenarios
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")


@vibe_testing_router.post("/screenshot", response_model=ScreenshotResponse)
async def analyze_screenshot(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be under 10 MB")

    mime_type = file.content_type or 'image/png'
    analyzer = ScreenshotAnalyzer()
    return analyzer.analyze(content, mime_type)


# ============================================================
# Code Analyzer (ZIP upload)
# ============================================================

SKIP_DIRS = {'node_modules', '.git', 'dist', '__pycache__', '.next', 'build', 'coverage', '.venv', 'venv'}
SKIP_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot',
             '.map', '.lock', '.zip', '.tar', '.gz', '.bin', '.exe', '.dll', '.so', '.dylib',
             '.pyc', '.pyo', '.min.js', '.min.css'}
PRIORITY_PATTERNS = ['route', 'controller', 'api', 'handler', 'app', 'main', 'index', 'server', 'endpoint']


class CodeAnalyzer:
    MAX_CHARS = 30_000

    def _should_skip_path(self, path: str) -> bool:
        parts = path.replace('\\', '/').split('/')
        if any(p in SKIP_DIRS for p in parts):
            return True
        ext = os.path.splitext(path)[1].lower()
        return ext in SKIP_EXTS

    def _priority_score(self, name: str) -> int:
        lower = name.lower()
        return sum(1 for p in PRIORITY_PATTERNS if p in lower)

    def extract_routes_regex(self, content: str) -> List[str]:
        routes = []
        # Express/Flask/FastAPI route patterns
        patterns = [
            r'@app\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']',
            r'router\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']',
            r'Route\s+path=["\']([^"\']+)["\']',
            r'path=["\']([/][^"\']+)["\']',
            r"@(Get|Post|Put|Delete|Patch)\(['\"]([^'\"]+)['\"]",
        ]
        for pat in patterns:
            for m in re.finditer(pat, content):
                groups = m.groups()
                route = groups[-1]
                if route not in routes:
                    routes.append(route)
        return routes[:20]

    def extract_components_regex(self, content: str) -> List[str]:
        comps = []
        patterns = [
            r'(?:function|const|class)\s+([A-Z][A-Za-z0-9]+)(?:\s*=|\s*\(|\s+extends)',
            r'export\s+(?:default\s+)?(?:function|class)\s+([A-Z][A-Za-z0-9]+)',
        ]
        for pat in patterns:
            for m in re.finditer(pat, content):
                name = m.group(1)
                if name not in comps:
                    comps.append(name)
        return comps[:20]

    def read_zip(self, zip_bytes: bytes) -> Tuple[str, List[str], List[str], int]:
        """Returns (codebase_summary, routes, components, file_count)"""
        all_routes: List[str] = []
        all_components: List[str] = []
        file_texts: List[Tuple[int, str, str]] = []  # (priority, path, content)
        file_count = 0

        import io
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                if self._should_skip_path(info.filename):
                    continue
                file_count += 1
                try:
                    content = zf.read(info.filename).decode('utf-8', errors='replace')
                except Exception:
                    continue

                score = self._priority_score(os.path.basename(info.filename))
                file_texts.append((score, info.filename, content))

                routes = self.extract_routes_regex(content)
                all_routes.extend(r for r in routes if r not in all_routes)

                comps = self.extract_components_regex(content)
                all_components.extend(c for c in comps if c not in all_components)

        # Sort by priority score, take most relevant first
        file_texts.sort(key=lambda x: x[0], reverse=True)

        summary_parts = []
        total_chars = 0
        for _, path, content in file_texts:
            snippet = f"\n=== {path} ===\n{content[:3000]}"
            if total_chars + len(snippet) > self.MAX_CHARS:
                break
            summary_parts.append(snippet)
            total_chars += len(snippet)

        return '\n'.join(summary_parts), all_routes[:30], all_components[:30], file_count

    def analyze(self, zip_bytes: bytes) -> CodeUploadResponse:
        if not HAS_OPENAI or not openai_client:
            raise HTTPException(
                status_code=503,
                detail="Code analysis requires an OpenAI API key. Set OPENAI_API_KEY environment variable."
            )

        codebase_summary, routes, components, file_count = self.read_zip(zip_bytes)

        prompt = f"""You are a senior QA engineer. Analyze this codebase and generate comprehensive test scenarios.

Detected routes: {routes}
Detected components: {components}

Codebase excerpt:
{codebase_summary[:25000]}

Return a JSON object:
{{
  "routes_confirmed": ["confirmed route strings"],
  "components_confirmed": ["confirmed component names"],
  "test_scenarios": [{SCENARIO_SCHEMA}]
}}

Generate 10–15 test scenarios. JSON only, no markdown."""

        import json
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=3000
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI analysis request failed: {str(e)}")

        raw = response.choices[0].message.content
        raw = re.sub(r'^```(?:json)?\s*', '', raw.strip())
        raw = re.sub(r'\s*```$', '', raw)

        try:
            data = json.loads(raw)
            scenarios = [TestScenario(**s) for s in data.get('test_scenarios', [])]
            return CodeUploadResponse(
                routes_confirmed=data.get('routes_confirmed', routes),
                components_confirmed=data.get('components_confirmed', components),
                files_analyzed=file_count,
                test_scenarios=scenarios
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")


@vibe_testing_router.post("/code-upload", response_model=CodeUploadResponse)
async def analyze_code(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="ZIP must be under 50 MB")

    if not zipfile.is_zipfile(__import__('io').BytesIO(content)):
        raise HTTPException(status_code=400, detail="File must be a valid ZIP archive")

    analyzer = CodeAnalyzer()
    return analyzer.analyze(content)


# ============================================================
# APK Analyzer
# ============================================================

PERMISSION_SCENARIOS = {
    'CAMERA': TestScenario(
        title="Camera permission flow",
        steps=["Launch app", "Trigger camera feature", "Accept permission", "Verify camera opens"],
        expected_outcome="Camera launches and captures correctly",
        priority="high", category="permissions"
    ),
    'LOCATION': TestScenario(
        title="Location permission denial test",
        steps=["Launch app", "Trigger location feature", "Deny permission", "Verify graceful fallback"],
        expected_outcome="App handles denial gracefully without crash",
        priority="high", category="permissions"
    ),
    'MICROPHONE': TestScenario(
        title="Microphone recording test",
        steps=["Grant microphone permission", "Start recording", "Stop recording", "Verify audio saved"],
        expected_outcome="Audio recorded and saved successfully",
        priority="medium", category="permissions"
    ),
    'READ_EXTERNAL_STORAGE': TestScenario(
        title="Storage read permission test",
        steps=["Grant storage permission", "Access file picker", "Select a file", "Verify file opened"],
        expected_outcome="File accessed successfully",
        priority="medium", category="permissions"
    ),
    'WRITE_EXTERNAL_STORAGE': TestScenario(
        title="Storage write permission test",
        steps=["Grant write permission", "Trigger save/export", "Verify file created"],
        expected_outcome="File written to storage successfully",
        priority="medium", category="permissions"
    ),
    'INTERNET': TestScenario(
        title="Network connectivity test",
        steps=["Disable network", "Attempt network operation", "Re-enable network", "Verify recovery"],
        expected_outcome="App handles offline state gracefully",
        priority="high", category="network"
    ),
    'BLUETOOTH': TestScenario(
        title="Bluetooth connectivity test",
        steps=["Enable Bluetooth", "Scan for devices", "Pair a device", "Verify connection"],
        expected_outcome="Bluetooth pairing and connection succeed",
        priority="medium", category="connectivity"
    ),
    'VIBRATE': TestScenario(
        title="Haptic feedback test",
        steps=["Trigger action that should vibrate", "Verify haptic response"],
        expected_outcome="Device vibrates as expected",
        priority="low", category="ui"
    ),
}


class ApkAnalyzer:
    def _parse_with_pyaxmlparser(self, apk_bytes: bytes) -> Dict:
        tmp = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.apk', delete=False) as f:
                f.write(apk_bytes)
                tmp = f.name

            apk = pyaxmlparser.APK(tmp)
            return {
                'package_name': apk.get_package() or '',
                'activities': list(apk.get_activities() or []),
                'services': list(apk.get_services() or []),
                'receivers': list(apk.get_receivers() or []),
                'providers': list(apk.get_providers() or []),
                'permissions': list(apk.get_permissions() or []),
                'min_sdk': str(apk.get_min_sdk_version() or ''),
                'target_sdk': str(apk.get_target_sdk_version() or ''),
                'parse_method': 'pyaxmlparser'
            }
        finally:
            if tmp and os.path.exists(tmp):
                os.unlink(tmp)

    def _parse_with_regex(self, apk_bytes: bytes) -> Dict:
        """Regex fallback — extracts strings from binary AXML."""
        import io

        manifest_bytes = b''
        try:
            with zipfile.ZipFile(io.BytesIO(apk_bytes)) as zf:
                if 'AndroidManifest.xml' in zf.namelist():
                    manifest_bytes = zf.read('AndroidManifest.xml')
        except Exception:
            pass

        # Attempt UTF-16LE decode (AXML string pool), fallback to UTF-8
        text = ''
        for enc in ('utf-16-le', 'utf-8', 'latin-1'):
            try:
                text = manifest_bytes.decode(enc, errors='replace')
                break
            except Exception:
                pass

        # Strip non-printable chars
        text = re.sub(r'[^\x20-\x7E\n]', ' ', text)
        tokens = text.split()

        # Extract reverse-domain package names
        pkg_pattern = re.compile(r'\b([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,})\b')
        packages = [m.group(1) for m in pkg_pattern.finditer(text) if '.' in m.group(1)]
        package_name = packages[0] if packages else ''

        # Permissions
        perm_pattern = re.compile(r'android\.permission\.\w+')
        permissions = list(dict.fromkeys(perm_pattern.findall(text)))

        # Activities / Services / Receivers
        class_pattern = re.compile(r'\b([A-Za-z][A-Za-z0-9_]*(?:Activity|Service|Receiver|Provider|Fragment))\b')
        class_names = list(dict.fromkeys(class_pattern.findall(text)))
        activities = [c for c in class_names if 'Activity' in c]
        services = [c for c in class_names if 'Service' in c]

        # SDK versions via simple regex on raw bytes
        min_sdk = ''
        target_sdk = ''
        sdk_m = re.search(rb'\x01\x00\x08\x00(.{4})', manifest_bytes)  # rough heuristic
        if not sdk_m:
            # try text
            m = re.search(r'minSdkVersion["\s:=]+(\d+)', text)
            if m:
                min_sdk = m.group(1)
            m = re.search(r'targetSdkVersion["\s:=]+(\d+)', text)
            if m:
                target_sdk = m.group(1)

        return {
            'package_name': package_name,
            'activities': activities[:15],
            'services': services[:10],
            'receivers': [],
            'providers': [],
            'permissions': permissions[:20],
            'min_sdk': min_sdk,
            'target_sdk': target_sdk,
            'parse_method': 'regex'
        }

    def _rule_based_scenarios(self, manifest: Dict) -> List[TestScenario]:
        scenarios = []
        permissions = manifest.get('permissions', [])
        for perm in permissions:
            for key, scenario in PERMISSION_SCENARIOS.items():
                if key in perm.upper():
                    scenarios.append(scenario)
                    break

        activities = manifest.get('activities', [])
        if activities:
            scenarios.append(TestScenario(
                title="App launch and main activity test",
                steps=["Install APK", "Launch app", f"Verify {activities[0]} loads"],
                expected_outcome="Main activity renders without crash",
                priority="high",
                category="smoke"
            ))

        services = manifest.get('services', [])
        if services:
            scenarios.append(TestScenario(
                title="Background service lifecycle test",
                steps=["Start app", "Verify background services start", "Kill app", "Verify services stop cleanly"],
                expected_outcome="Services start and stop without ANR or crash",
                priority="medium",
                category="lifecycle"
            ))

        if not scenarios:
            scenarios.append(TestScenario(
                title="Basic APK install and launch",
                steps=["Install APK", "Grant required permissions", "Launch app", "Verify no crash on launch"],
                expected_outcome="App installs and launches successfully",
                priority="high",
                category="smoke"
            ))

        return scenarios[:12]

    def _gpt_scenarios(self, manifest: Dict) -> List[TestScenario]:
        prompt = f"""You are a mobile QA engineer. Generate 8–12 test scenarios for this Android app.

Manifest data:
- Package: {manifest['package_name']}
- Activities: {manifest['activities'][:8]}
- Services: {manifest['services'][:5]}
- Permissions: {manifest['permissions'][:15]}
- Min SDK: {manifest['min_sdk']}
- Target SDK: {manifest['target_sdk']}

Return a JSON array only. Each element:
{SCENARIO_SCHEMA}"""

        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2500
        )
        return _parse_gpt_scenarios(response.choices[0].message.content)

    def analyze(self, apk_bytes: bytes) -> ApkResponse:
        # Try pyaxmlparser first, fall back to regex
        if HAS_PYAXML:
            try:
                manifest = self._parse_with_pyaxmlparser(apk_bytes)
            except Exception:
                manifest = self._parse_with_regex(apk_bytes)
        else:
            manifest = self._parse_with_regex(apk_bytes)

        # Generate scenarios
        if HAS_OPENAI and openai_client:
            try:
                scenarios = self._gpt_scenarios(manifest)
                if not scenarios:
                    raise ValueError("empty")
            except Exception:
                scenarios = self._rule_based_scenarios(manifest)
        else:
            scenarios = self._rule_based_scenarios(manifest)

        return ApkResponse(
            package_name=manifest.get('package_name', ''),
            activities=manifest.get('activities', []),
            services=manifest.get('services', []),
            permissions=manifest.get('permissions', []),
            min_sdk=manifest.get('min_sdk') or None,
            target_sdk=manifest.get('target_sdk') or None,
            parse_method=manifest.get('parse_method', 'unknown'),
            test_scenarios=scenarios
        )


@vibe_testing_router.post("/apk", response_model=ApkResponse)
async def analyze_apk(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="APK must be under 100 MB")

    if not file.filename or not file.filename.lower().endswith('.apk'):
        raise HTTPException(status_code=400, detail="File must have .apk extension")

    analyzer = ApkAnalyzer()
    return analyzer.analyze(content)


# ============================================================
# Visual Regression Testing
# ============================================================

class VisualRegressionTester:

    async def take_screenshot(self, url: str, viewport_width=1280,
                               viewport_height=800, full_page=True) -> str:
        if not HAS_PLAYWRIGHT:
            raise HTTPException(503,
                "Visual capture requires Playwright. Run: "
                "pip install playwright && python -m playwright install chromium")
        async with async_playwright() as pw:
            try:
                browser = await pw.chromium.launch(
                    headless=True,
                    args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote']
                )
            except Exception as e:
                raise HTTPException(503,
                    f"Playwright browser is not installed on the server. Run: "
                    f"python -m playwright install chromium ({str(e)})")
            try:
                context = await browser.new_context(
                    viewport={'width': viewport_width, 'height': viewport_height},
                    user_agent='VibeTest-Visual/1.0',
                    ignore_https_errors=True
                )
                page = await context.new_page()
                try:
                    await page.goto(url, wait_until='networkidle', timeout=30000)
                except Exception:
                    await page.goto(url, wait_until='domcontentloaded', timeout=30000)
                    await asyncio.sleep(2)
                await asyncio.sleep(1)   # let animations settle
                screenshot_bytes = await page.screenshot(full_page=full_page, type='png')
                return base64.b64encode(screenshot_bytes).decode()
            finally:
                await browser.close()

    def compute_pixel_diff(self, baseline_b64: str, current_b64: str) -> Tuple[str, float]:
        """Pure Pillow diff — no numpy."""
        from PIL import Image, ImageChops
        import io as _io

        baseline_img = Image.open(_io.BytesIO(base64.b64decode(baseline_b64))).convert('RGB')
        current_img  = Image.open(_io.BytesIO(base64.b64decode(current_b64))).convert('RGB')
        if baseline_img.size != current_img.size:
            current_img = current_img.resize(baseline_img.size, Image.LANCZOS)

        diff = ImageChops.difference(baseline_img, current_img)

        # Score via histogram (fast, no numpy)
        hist = diff.histogram()   # 256*3 values R|G|B
        total_px = baseline_img.width * baseline_img.height
        unchanged = (hist[0] + hist[256] + hist[512]) / 3
        score = round(((total_px - unchanged) / total_px) * 100, 2) if total_px > 0 else 0.0

        # Red highlight overlay on changed pixels
        diff_mask = diff.convert('L').point(lambda x: 255 if x > 15 else 0)
        overlay   = Image.new('RGB', baseline_img.size, (220, 38, 38))
        result    = baseline_img.copy()
        result.paste(overlay, mask=diff_mask)

        buf = _io.BytesIO()
        result.save(buf, format='PNG')
        return base64.b64encode(buf.getvalue()).decode(), score

    async def compare_with_ai(self, baseline_b64: str,
                               current_b64: str) -> Tuple[str, str, List[VisualChange], bool]:
        """GPT-4o vision comparison."""
        if not HAS_OPENAI or not openai_client:
            return "warning", "AI comparison unavailable (no OpenAI key)", [], True

        prompt = """You are a visual regression testing expert. Compare these two UI screenshots:
- Image 1: BASELINE (before deployment)
- Image 2: CURRENT (after deployment)

Return JSON ONLY (no markdown):
{
  "overall_status": "pass" | "warning" | "fail",
  "summary": "one concise sentence",
  "changes": [
    {
      "element": "UI element name",
      "change_type": "layout_shift" | "color_change" | "text_change" | "element_missing" | "element_added" | "size_change" | "style_change" | "image_change",
      "severity": "critical" | "major" | "minor",
      "description": "what changed and how",
      "location": "where on the page"
    }
  ]
}
Rules: fail = any critical change. warning = major changes, no critical. pass = minor or no changes."""

        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{baseline_b64}"}},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{current_b64}"}}
                ]}],
                temperature=0.2,
                max_tokens=2000
            )
            raw = response.choices[0].message.content.strip()
            raw = re.sub(r'^```(?:json)?\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            data = json.loads(raw)
            changes = [VisualChange(**c) for c in data.get('changes', []) if isinstance(c, dict)]
            return data.get('overall_status', 'warning'), data.get('summary', ''), changes, False
        except Exception:
            return "warning", "AI comparison failed — review screenshots manually", [], True


@vibe_testing_router.post("/visual/capture", response_model=VisualBaselineResponse)
async def visual_capture_baseline(req: VisualCaptureRequest):
    tester = VisualRegressionTester()
    screenshot_b64 = await tester.take_screenshot(
        req.url, req.viewport_width, req.viewport_height, req.full_page)
    session_id = str(uuid.uuid4())
    data = {
        "session_id": session_id, "url": req.url,
        "label": req.label or req.url,
        "screenshot_b64": screenshot_b64,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "source": "playwright",
        "viewport": {"width": req.viewport_width, "height": req.viewport_height}
    }
    _save_baseline(data)
    return VisualBaselineResponse(**data)


@vibe_testing_router.post("/visual/upload-baseline", response_model=VisualBaselineResponse)
async def visual_upload_baseline(
    file: UploadFile = File(...),
    url: str = Form(...),
    label: str = Form(""),
    viewport_width: int = Form(1280),
    viewport_height: int = Form(800)
):
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(413, "Screenshot must be under 20 MB")
    session_id = str(uuid.uuid4())
    data = {
        "session_id": session_id, "url": url,
        "label": label or url,
        "screenshot_b64": base64.b64encode(content).decode(),
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "source": "upload",
        "viewport": {"width": viewport_width, "height": viewport_height}
    }
    _save_baseline(data)
    return VisualBaselineResponse(**data)


@vibe_testing_router.get("/visual/baselines", response_model=VisualSessionsResponse)
async def visual_list_baselines():
    return VisualSessionsResponse(sessions=[VisualSessionMeta(**s) for s in _list_baselines()])


@vibe_testing_router.post("/visual/compare", response_model=VisualCompareResponse)
async def visual_compare(req: VisualCompareRequest):
    baseline = _load_baseline(req.session_id)
    tester = VisualRegressionTester()
    current_b64 = await tester.take_screenshot(
        baseline["url"], req.viewport_width, req.viewport_height, req.full_page)
    diff_b64, score = tester.compute_pixel_diff(baseline["screenshot_b64"], current_b64)
    status, summary, changes, fallback = await tester.compare_with_ai(
        baseline["screenshot_b64"], current_b64)
    return VisualCompareResponse(
        session_id=req.session_id, url=baseline["url"],
        overall_status=status, changes=changes, summary=summary,
        pixel_diff_score=score,
        baseline_screenshot_b64=baseline["screenshot_b64"],
        current_screenshot_b64=current_b64,
        diff_screenshot_b64=diff_b64,
        compared_at=datetime.now(timezone.utc).isoformat(),
        fallback_used=fallback
    )


@vibe_testing_router.post("/visual/compare-upload", response_model=VisualCompareResponse)
async def visual_compare_upload(file: UploadFile = File(...), session_id: str = Form(...)):
    baseline = _load_baseline(session_id)
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(413, "Screenshot must be under 20 MB")
    current_b64 = base64.b64encode(content).decode()
    tester = VisualRegressionTester()
    diff_b64, score = tester.compute_pixel_diff(baseline["screenshot_b64"], current_b64)
    status, summary, changes, fallback = await tester.compare_with_ai(
        baseline["screenshot_b64"], current_b64)
    return VisualCompareResponse(
        session_id=session_id, url=baseline["url"],
        overall_status=status, changes=changes, summary=summary,
        pixel_diff_score=score,
        baseline_screenshot_b64=baseline["screenshot_b64"],
        current_screenshot_b64=current_b64,
        diff_screenshot_b64=diff_b64,
        compared_at=datetime.now(timezone.utc).isoformat(),
        fallback_used=fallback
    )


@vibe_testing_router.delete("/visual/baseline/{session_id}")
async def visual_delete_baseline(session_id: str):
    _delete_baseline(session_id)
    return {"deleted": True, "session_id": session_id}

