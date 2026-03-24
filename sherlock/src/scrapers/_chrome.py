"""Shared Playwright/Chromium config for all Sherlock scrapers."""
import os
import json
import base64
import tempfile

# Em CI (GitHub Actions), usa diretório temporário e headless forçado.
# Localmente, usa o perfil persistente salvo.
IS_CI = os.environ.get("CI", "").lower() in ("true", "1")

if IS_CI:
    PLAYWRIGHT_USER_DATA = os.path.join(tempfile.gettempdir(), "playwright-scraper")
else:
    PLAYWRIGHT_USER_DATA = os.environ.get(
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


async def new_persistent_context(p, headless: bool = True):
    """Launch a persistent Chromium context.

    - Local: reutiliza sessão salva em PLAYWRIGHT_USER_DATA (cookies preservados).
    - CI: usa diretório temporário + injeta cookies do secret PLAYWRIGHT_COOKIES.
    - Sem channel='chrome': roda em paralelo com o Chrome aberto sem conflito.
    """
    # Em CI, sempre headless
    effective_headless = True if IS_CI else headless

    context = await p.chromium.launch_persistent_context(
        user_data_dir=PLAYWRIGHT_USER_DATA,
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

    # Injeta cookies salvos (só relevante em CI)
    if IS_CI:
        cookies = _load_cookies_from_env()
        if cookies:
            await context.add_cookies(cookies)

    return context
