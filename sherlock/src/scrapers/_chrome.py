"""Shared Playwright/Chromium config for all Sherlock scrapers."""
import os
import json
import base64
import tempfile
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# In CI (GitHub Actions), use temporary profile and forced headless.
IS_CI = os.environ.get("CI", "").lower() in ("true", "1")

PLAYWRIGHT_PERSISTENT_DIR = os.environ.get(
    "PLAYWRIGHT_USER_DATA_DIR",
    os.path.join(
        os.environ.get("LOCALAPPDATA", r"C:\Users\erick\AppData\Local"),
        "Playwright",
        "sherlock-scraper",
    ),
)

COOKIE_CACHE_FILE = Path(__file__).resolve().parents[2] / "sessions" / "playwright_cookies.json"
COOKIE_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)


def _load_cookies_from_env() -> list | None:
    """Load cookies from PLAYWRIGHT_COOKIES env var (base64 JSON)."""
    raw = os.environ.get("PLAYWRIGHT_COOKIES", "")
    if not raw:
        return None
    try:
        decoded = base64.b64decode(raw).decode("utf-8")
        cookies = json.loads(decoded)
        return cookies if isinstance(cookies, list) else None
    except Exception:
        return None


def _load_cached_cookies() -> list | None:
    """Load cookies from local cache file to keep auth when profile is locked."""
    if not COOKIE_CACHE_FILE.exists():
        return None
    try:
        data = json.loads(COOKIE_CACHE_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else None
    except Exception:
        return None


async def _save_cached_cookies(context) -> None:
    """Persist cookies after context startup for future fallback runs."""
    try:
        cookies = await context.cookies()
        if cookies:
            COOKIE_CACHE_FILE.write_text(json.dumps(cookies), encoding="utf-8")
    except Exception:
        pass


async def save_context_cookies(context) -> None:
    """Public helper to persist cookies after manual login or pipeline run."""
    await _save_cached_cookies(context)


async def _launch_context(p, user_data_dir: str, headless: bool):
    return await p.chromium.launch_persistent_context(
        user_data_dir=user_data_dir,
        headless=headless,
        args=[
            "--no-sandbox",
            "--no-first-run",
            "--disable-blink-features=AutomationControlled",
        ],
        locale="pt-BR",
        timezone_id="America/Sao_Paulo",
        viewport={"width": 1280, "height": 900},
        geolocation={"latitude": -23.5505, "longitude": -46.6333},
        permissions=["geolocation"],
    )


async def new_persistent_context(p, headless: bool = True):
    """Launch persistent Chromium context with resilient session strategy.

    Strategy:
    1. Prefer persistent profile (even if lockfile exists; try anyway).
    2. If launch fails, fallback to temp profile.
    3. Inject cookies from env and local cache.
    """
    effective_headless = True if IS_CI else headless

    if IS_CI:
        user_data_dir = os.path.join(tempfile.gettempdir(), "playwright-scraper-ci")
        context = await _launch_context(p, user_data_dir, effective_headless)
    else:
        try:
            context = await _launch_context(p, PLAYWRIGHT_PERSISTENT_DIR, effective_headless)
            logger.info(f"Playwright usando perfil persistente: {PLAYWRIGHT_PERSISTENT_DIR}")
        except Exception as e:
            fallback_dir = tempfile.mkdtemp(prefix="sherlock-scraper-")
            logger.warning(
                f"Falha ao abrir perfil persistente ({e}). Usando temporario: {fallback_dir}"
            )
            context = await _launch_context(p, fallback_dir, effective_headless)

    cookies = _load_cookies_from_env() or _load_cached_cookies()
    if cookies:
        try:
            await context.add_cookies(cookies)
            logger.info(f"Injetados {len(cookies)} cookies no contexto Playwright.")
        except Exception as e:
            logger.warning(f"Falha ao injetar cookies: {e}")

    await _save_cached_cookies(context)
    return context
