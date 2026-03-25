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

from scrapers._chrome import PLAYWRIGHT_PERSISTENT_DIR as PLAYWRIGHT_USER_DATA
from playwright.async_api import async_playwright


DOMAINS_TO_EXPORT = [
    "instagram.com",
    "tiktok.com",
    "x.com",
    "twitter.com",
    "reddit.com",
]


async def export():
    print(f"\n[INFO] Abrindo perfil persistente em: {PLAYWRIGHT_USER_DATA}")
    print("[INFO] O navegador vai abrir. Você tem 10 minutos para fazer login.\n")

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=PLAYWRIGHT_USER_DATA,
            headless=False,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            locale="pt-BR",
        )

        # Abre uma página inicial
        page = await context.new_page()

        print("📋 INSTRUÇÕES:")
        print("  1. Navegue para cada site (Reddit, Instagram, TikTok, X, etc)")
        print("  2. Faça login em cada um")
        print("  3. Feche o navegador quando terminar")
        print("  4. Este script exportará os cookies automaticamente\n")
        print("⏳ Esperando você fechar o navegador...")

        # Navega para uma página inicial
        try:
            await page.goto("https://reddit.com/", timeout=10000)
        except:
            await page.goto("about:blank")

        # Espera o navegador fechar (polling robusto)
        print("⏳ Esperando você fechar o navegador (ou pressione Ctrl+C para exportar agora)...")
        try:
            while True:
                await asyncio.sleep(1)
                try:
                    pages = context.pages
                    if len(pages) == 0:
                        print("\n[INFO] Todas as abas foram fechadas.")
                        break
                except Exception:
                    print("\n[INFO] Navegador fechado.")
                    break
        except (KeyboardInterrupt, asyncio.CancelledError):
            print("\n[INFO] Exportando cookies agora...")

        # Exporta todos os cookies antes de fechar o contexto
        try:
            all_cookies = await context.cookies()
        except Exception:
            all_cookies = []
        relevant = [
            c for c in all_cookies
            if any(d in c.get("domain", "") for d in DOMAINS_TO_EXPORT)
        ]

        await context.close()

    if not relevant:
        print("\n[⚠️ AVISO] Nenhum cookie encontrado.")
        print("Verifique se você fez login nos sites antes de fechar o navegador.")
        return

    # Serializa e codifica em base64
    cookies_json = json.dumps(relevant)
    encoded = base64.b64encode(cookies_json.encode("utf-8")).decode("utf-8")

    print(f"\n✅ [OK] {len(relevant)} cookies exportados!")
    print("\n" + "=" * 70)
    print("PLAYWRIGHT_COOKIES (copie este valor inteiro):")
    print("=" * 70)
    print(encoded)
    print("=" * 70)
    print("\n📌 Próximo passo:")
    print("  GitHub Settings → Secrets and variables → Actions")
    print("  → New repository secret")
    print("  Name: PLAYWRIGHT_COOKIES")
    print("  Value: [cole o valor acima]")


if __name__ == "__main__":
    asyncio.run(export())
