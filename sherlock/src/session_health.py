"""Session health check for social sources (Instagram, X, TikTok)."""
import asyncio
import json
import logging
from datetime import datetime

from playwright.async_api import async_playwright

from scrapers._chrome import new_persistent_context

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _check_instagram(context) -> dict:
    page = await context.new_page()
    try:
        # Probe pagina que exige autenticacao. Se redirecionar para login, sessao caiu.
        await page.goto("https://www.instagram.com/accounts/edit/", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2500)
        current = page.url.lower()
        if "/accounts/login" in current:
            return {"ok": True, "logged_in": False}

        html = (await page.content()).lower()
        logged = any(
            k in html
            for k in [
                "edit profile",
                "editar perfil",
                "accounts/edit",
                "data-pagelet",
            ]
        )
        return {"ok": True, "logged_in": bool(logged)}
    except Exception as e:
        return {"ok": False, "logged_in": False, "error": str(e)}
    finally:
        await page.close()


async def _check_x(context) -> dict:
    page = await context.new_page()
    try:
        await page.goto("https://x.com/home", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2500)
        html = (await page.content()).lower()
        logged = "data-testid=\"sideNav_AccountSwitcher_Button\"" in html or "data-testid=\"AppTabBar_Home_Link\"" in html
        if not logged:
            # fallback check in case html serialization changes
            current = page.url.lower()
            logged = "/home" in current and "login" not in current
        return {"ok": True, "logged_in": bool(logged)}
    except Exception as e:
        return {"ok": False, "logged_in": False, "error": str(e)}
    finally:
        await page.close()


async def _check_tiktok(context) -> dict:
    page = await context.new_page()
    try:
        await page.goto("https://www.tiktok.com/", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2500)
        html = (await page.content()).lower()
        logged = "logout" in html or "profile" in html and "log in" not in html
        return {"ok": True, "logged_in": bool(logged)}
    except Exception as e:
        return {"ok": False, "logged_in": False, "error": str(e)}
    finally:
        await page.close()


async def main() -> None:
    result = {
        "timestamp": datetime.utcnow().isoformat(),
        "instagram": {"ok": False, "logged_in": False},
        "x": {"ok": False, "logged_in": False},
        "tiktok": {"ok": False, "logged_in": False},
    }

    async with async_playwright() as p:
        context = await new_persistent_context(p, headless=True)
        try:
            result["instagram"] = await _check_instagram(context)
            result["x"] = await _check_x(context)
            result["tiktok"] = await _check_tiktok(context)
        finally:
            await context.close()

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
