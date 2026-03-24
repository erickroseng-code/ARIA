"""
Script standalone para pesquisa de Reels do Instagram.
Chamado pelo endpoint /api/sherlock/instagram-research.
Imprime JSON no stdout ao finalizar.
"""
import asyncio
import json
import sys
import argparse
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")
logging.basicConfig(level=logging.WARNING)  # silencioso no stdout

sys.path.insert(0, str(Path(__file__).parent))

from scrapers.instagram import InstagramScraper, _format_views


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keywords", nargs="+", required=True)
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--min-views", type=int, default=100_000)
    return parser.parse_args()


async def main():
    args = parse_args()
    scraper = InstagramScraper(
        keywords=args.keywords,
        days=args.days,
        min_views=args.min_views,
    )
    reels = await scraper.fetch_trends()

    result = [
        {
            "url": r["url"],
            "title": r["title"],
            "views": _format_views(int(r["engagement"])),
            "views_raw": int(r["engagement"]),
            "keyword": r["title"].replace("Reel: ", "").replace("Reel #", ""),
            "published_at": r["published_at"].isoformat() if hasattr(r["published_at"], "isoformat") else str(r["published_at"]),
        }
        for r in reels
    ]

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
