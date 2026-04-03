import asyncio
import sys

from playwright.async_api import async_playwright

from src.scrapers._chrome import new_persistent_context, save_context_cookies


async def main():
    print("Iniciando navegador em modo visivel para login manual...")
    async with async_playwright() as p:
        context = None
        try:
            context = await new_persistent_context(p, headless=False)

            urls = [
                "https://www.instagram.com/",
                "https://x.com/home",
                "https://www.tiktok.com/login",
            ]
            for url in urls:
                page = await context.new_page()
                await page.goto(url, wait_until="domcontentloaded")
                await page.wait_for_timeout(1200)

            print("=========================================================")
            print("Navegador aberto para login manual.")
            print("1. Faca login no Instagram, X e TikTok")
            print("2. Confirme que cada aba mostra conta autenticada")
            print("3. Feche as abas ao terminar")
            print("A janela fica aberta por 10 minutos.")
            print("=========================================================")

            await asyncio.sleep(600)
            await save_context_cookies(context)
            print("Cookies de sessao salvos com sucesso.")

        except Exception as e:
            print(f"Erro ao abrir sessao de login: {e}")
            sys.exit(1)
        finally:
            try:
                if context:
                    await context.close()
            except Exception:
                pass


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
