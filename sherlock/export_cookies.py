"""
Exporta cookies do perfil Playwright local para uso no GitHub Actions.

USO:
  python sherlock/export_cookies.py

OUTPUT:
  Imprime o valor base64 que deve ser adicionado como GitHub Secret
  com o nome PLAYWRIGHT_COOKIES.

PASSOS:
  1. Rode este script localmente (com as sessões já logadas)
  2. Copie o valor impresso
  3. No GitHub: Settings → Secrets → Actions → New secret
     Name: PLAYWRIGHT_COOKIES
     Value: <valor copiado>
"""
import asyncio
import base64
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from scrapers._chrome import PLAYWRIGHT_USER_DATA
from playwright.async_api import async_playwright


DOMAINS_TO_EXPORT = [
    "instagram.com",
    "tiktok.com",
    "x.com",
    "twitter.com",
    "reddit.com",
]


async def export():
    print(f"[INFO] Abrindo perfil em: {PLAYWRIGHT_USER_DATA}")
    print("[INFO] Navegando para verificar sessões...")

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=PLAYWRIGHT_USER_DATA,
            headless=False,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            locale="pt-BR",
        )

        # Abre uma página para cada domínio para garantir que os cookies carreguem
        page = await context.new_page()
        for domain in DOMAINS_TO_EXPORT:
            try:
                await page.goto(f"https://www.{domain}/", timeout=15000, wait_until="domcontentloaded")
                await page.wait_for_timeout(1500)
                print(f"  OK {domain}")
            except Exception as e:
                print(f"  FAIL {domain}: {e}")

        await page.close()

        # Exporta todos os cookies
        all_cookies = await context.cookies()
        relevant = [
            c for c in all_cookies
            if any(d in c.get("domain", "") for d in DOMAINS_TO_EXPORT)
        ]

        await context.close()

    if not relevant:
        print("\n[AVISO] Nenhum cookie encontrado. Verifique se está logado nos sites.")
        return

    # Serializa e codifica em base64
    cookies_json = json.dumps(relevant)
    encoded = base64.b64encode(cookies_json.encode("utf-8")).decode("utf-8")

    print(f"\n[OK] {len(relevant)} cookies exportados de {len(DOMAINS_TO_EXPORT)} domínios.")
    print("\n" + "=" * 60)
    print("PLAYWRIGHT_COOKIES (adicione como GitHub Secret):")
    print("=" * 60)
    print(encoded)
    print("=" * 60)
    print("\nPara atualizar, re-execute este script após fazer login nos sites.")


if __name__ == "__main__":
    asyncio.run(export())
