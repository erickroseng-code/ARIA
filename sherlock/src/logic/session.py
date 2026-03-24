import json
import logging
import os
from pathlib import Path
from typing import List, Dict

logger = logging.getLogger(__name__)

SESSION_DIR = Path(__file__).parent.parent.parent / "sessions"
SESSION_DIR.mkdir(parents=True, exist_ok=True)

def save_cookies(platform: str, cookies: List[Dict]):
    """Save playwright cookies to a JSON file."""
    path = SESSION_DIR / f"{platform}_cookies.json"
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(cookies, f)
        logger.info(f"Saved {len(cookies)} cookies for {platform}")
    except Exception as e:
        logger.error(f"Failed to save cookies for {platform}: {e}")

def load_cookies(platform: str) -> List[Dict]:
    """Load playwright cookies from a JSON file."""
    path = SESSION_DIR / f"{platform}_cookies.json"
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            cookies = json.load(f)
        logger.info(f"Loaded {len(cookies)} cookies for {platform}")
        return cookies
    except Exception as e:
        logger.error(f"Failed to load cookies for {platform}: {e}")
        return []
