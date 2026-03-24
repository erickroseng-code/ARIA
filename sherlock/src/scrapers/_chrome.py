"""Shared Playwright/Chromium config for all Sherlock scrapers."""
import os
import json
import base64
import tempfile
import logging

logger = logging.getLogger(__name__)

# Em CI (GitHub Actions), usa diretório temporário e headless forçado.
# Localmente, usa o perfil persistente salvo.
IS_CI = os.environ.get("CI", "").lower() in ("true", "1")

PLAYWRIGHT_PERSISTENT_DIR = os.environ.get(
    "PLAYWRIGHT_USER_DATA_DIR",
    os.path.join(
        os.environ.get("LOCALAPPDATA", r"C:\Users\erick\AppData\Local"),
        "Playwright",
        "sherlock-scraper",
    ),
)


def _load_cookies_from_env() -> list | None:
    """Carrega cookies do env PLAYWRIGHT_COOKIES (base64 JSON) para injeção em CI."""
    raw = os.environ.get("PLAYWRIGHT_COOKIES", "")
    if not raw:
        return None
    try:
        decoded = base64.b64decode(raw).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        return None


def _is_profile_locked(user_data_dir: str) -> bool:
    """Verifica se o lockfile do perfil está em uso."""
    lock_path = os.path.join(user_data_dir, "lockfile")
    if not os.path.exists(lock_path):
        return False
    try:
        os.rename(lock_path, lock_path)
        return False
    except OSError:
        return True


async def new_persistent_context(p, headless: bool = True):
    """Launch a persistent Chromium context.

    - Local: tenta usar sessão salva (cookies preservados). Se o perfil estiver
      bloqueado por outro Chrome, cai para diretório temporário automaticamente.
    - CI: usa diretório temporário + injeta cookies do secret PLAYWRIGHT_COOKIES.
    """
    effective_headless = True if IS_CI else headless

    if IS_CI:
        user_data_dir = os.path.join(tempfile.gettempdir(), "playwright-scraper-ci")
    elif _is_profile_locked(PLAYWRIGHT_PERSISTENT_DIR):
        user_data_dir = tempfile.mkdtemp(prefix="sherlock-scraper-")
        logger.warning(
            f"Perfil persistente bloqueado. Usando diretório temporário: {user_data_dir}"
        )
    else:
        user_data_dir = PLAYWRIGHT_PERSISTENT_DIR

    context = await p.chromium.launch_persistent_context(
        user_data_dir=user_data_dir,
        headless=effective_headless,
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

    # Injeta cookies (CI via secret, local via env se disponível)
    cookies = _load_cookies_from_env()
    if cookies:
        await context.add_cookies(cookies)
        logger.info(f"Injetados {len(cookies)} cookies no contexto Playwright.")

    return context
