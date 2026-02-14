"""TikTok scraper using Playwright for browser automation.

Strategy:
  1. Load the profile page and extract the embedded JSON
     (__UNIVERSAL_DATA_FOR_REHYDRATION__) for profile stats.
  2. Intercept TikTok's internal /api/post/item_list/ XHR responses
     to capture video data that the page fetches dynamically.
  3. If interception yields nothing, try scrolling + DOM fallback.

Uses sync Playwright wrapped in asyncio.to_thread() for Windows compat.
"""

import asyncio
import json
import re
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
DATA_DIR.mkdir(exist_ok=True)


def parse_count(text: str) -> int:
    """Convert human-readable counts like '1.2M', '500K', '45.3K' to integers.

    Args:
        text: Count string from TikTok (e.g. "1.2M", "500K", "1234").

    Returns:
        Integer value.
    """
    if not text:
        return 0

    text = text.strip().upper().replace(",", "")

    multipliers = {
        "K": 1_000,
        "M": 1_000_000,
        "B": 1_000_000_000,
    }

    for suffix, multiplier in multipliers.items():
        if text.endswith(suffix):
            try:
                return int(float(text[:-1]) * multiplier)
            except ValueError:
                return 0

    try:
        return int(float(text))
    except ValueError:
        return 0


def _scrape_tiktok_user_sync(username: str, video_limit: int = 30) -> list[dict]:
    """Synchronous scraper — runs Playwright in the calling thread."""
    username = username.lstrip("@")
    profile_url = f"https://www.tiktok.com/@{username}"
    videos = []
    api_videos = []  # Captured from XHR interception

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 720},
        )

        page = context.new_page()

        # Intercept TikTok's internal video-list API responses
        def handle_response(response):
            url = response.url
            if "/api/post/item_list" in url or "/api/comment/list" in url:
                try:
                    data = response.json()
                    items = data.get("itemList", data.get("items", []))
                    for item in items:
                        api_videos.append(_parse_api_video(item, username))
                except Exception:
                    pass

        page.on("response", handle_response)

        try:
            page.goto(profile_url, wait_until="networkidle", timeout=30000)
            time.sleep(5)

            # ----- Step 1: Extract from embedded JSON -----
            html = page.content()
            profile, json_videos = _extract_from_embedded_json(html, username)

            # Debug: save screenshot
            debug_dir = DATA_DIR / "debug"
            debug_dir.mkdir(exist_ok=True)
            page.screenshot(path=str(debug_dir / f"{username}.png"), full_page=True)

            # ----- Step 2: Scroll to trigger API calls -----
            for _ in range(min(10, video_limit // 3)):
                page.evaluate("window.scrollBy(0, 1000)")
                time.sleep(2)

            # Also try clicking Refresh if the video grid failed
            refresh_btn = page.query_selector('button:has-text("Refresh")')
            if refresh_btn:
                print(f"  [info] Clicking Refresh button for @{username}")
                refresh_btn.click()
                time.sleep(5)
                # Scroll again after refresh
                for _ in range(5):
                    page.evaluate("window.scrollBy(0, 1000)")
                    time.sleep(2)

            # ----- Step 3: DOM fallback -----
            dom_videos = _extract_videos_from_dom(page, username, video_limit)

            # ----- Merge results: prefer API data > JSON data > DOM data -----
            if api_videos:
                videos = api_videos[:video_limit]
                print(f"  [source] Got {len(videos)} videos from API interception")
            elif json_videos:
                videos = json_videos[:video_limit]
                print(f"  [source] Got {len(videos)} videos from embedded JSON")
            elif dom_videos:
                videos = dom_videos[:video_limit]
                print(f"  [source] Got {len(videos)} videos from DOM extraction")
            else:
                print(f"  [warn] No videos found for @{username}")

        except Exception as e:
            print(f"Error scraping @{username}: {e}")
        finally:
            time.sleep(5)
            browser.close()

    # Save results
    output = {
        "username": username,
        "scraped_at": datetime.utcnow().isoformat(),
        "profile": profile if 'profile' in dir() else {},
        "video_count": len(videos),
        "videos": videos,
    }
    output_path = DATA_DIR / f"{username}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Saved {len(videos)} videos to {output_path}")
    return {"profile": output.get("profile", {}), "videos": videos}


async def scrape_tiktok_user(username: str, video_limit: int = 30) -> dict:
    """Async wrapper that runs the sync scraper in a thread.

    Returns:
        Dict with 'profile' (dict) and 'videos' (list[dict]).
    """
    return await asyncio.to_thread(_scrape_tiktok_user_sync, username, video_limit)


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def _extract_from_embedded_json(html: str, username: str) -> tuple[dict, list[dict]]:
    """Extract profile info and video list from __UNIVERSAL_DATA_FOR_REHYDRATION__."""
    profile = {"username": username, "followers": 0, "following": 0, "likes": 0, "video_count": 0}
    videos = []

    match = re.search(
        r'id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>', html
    )
    if not match:
        print(f"  [warn] No embedded JSON found for @{username}")
        return profile, videos

    try:
        data = json.loads(match.group(1))
        default_scope = data.get("__DEFAULT_SCOPE__", {})

        # Profile stats
        user_detail = default_scope.get("webapp.user-detail", {})
        user_info = user_detail.get("userInfo", {})
        user = user_info.get("user", {})
        stats = user_info.get("stats", {})

        profile = {
            "username": user.get("uniqueId", username),
            "nickname": user.get("nickname", ""),
            "bio": user.get("signature", ""),
            "followers": stats.get("followerCount", 0),
            "following": stats.get("followingCount", 0),
            "likes": stats.get("heartCount", 0),
            "video_count": stats.get("videoCount", 0),
        }
        print(f"  [profile] @{profile['username']}: {profile['followers']} followers, {profile['video_count']} videos")

        # Some pages embed video items in the JSON
        # Check for itemList in various locations
        for key in default_scope:
            scope_val = default_scope[key]
            if not isinstance(scope_val, dict):
                continue
            for subkey, subval in scope_val.items():
                if subkey == "itemList" and isinstance(subval, list):
                    for item in subval:
                        v = _parse_api_video(item, username)
                        if v:
                            videos.append(v)

    except (json.JSONDecodeError, KeyError) as e:
        print(f"  [warn] Error parsing embedded JSON: {e}")

    return profile, videos


def _parse_api_video(item: dict, username: str) -> dict | None:
    """Parse a single video item from TikTok's API / embedded JSON format."""
    try:
        video_id = str(item.get("id", item.get("video_id", "")))
        if not video_id:
            return None

        stats = item.get("stats", {})
        return {
            "username": username,
            "url": f"https://www.tiktok.com/@{username}/video/{video_id}",
            "video_id": video_id,
            "caption": item.get("desc", ""),
            "views": stats.get("playCount", 0),
            "likes": stats.get("diggCount", stats.get("likeCount", 0)),
            "comments": stats.get("commentCount", 0),
            "shares": stats.get("shareCount", 0),
            "duration": item.get("video", {}).get("duration", 0),
            "hashtags": ",".join(
                t.get("hashtagName", "") for t in item.get("textExtra", [])
                if t.get("hashtagName")
            ),
        }
    except Exception:
        return None


def _extract_videos_from_dom(page, username: str, limit: int) -> list[dict]:
    """Last-resort DOM extraction: find video links and view counts."""
    videos = []
    seen_ids = set()

    try:
        # Try data-e2e selectors first (TikTok's test attributes)
        items = page.query_selector_all('[data-e2e="user-post-item"]')

        # Fall back to any link containing /video/
        if not items:
            items = page.query_selector_all('a[href*="/video/"]')

        for item in items[:limit]:
            # Get href — might be on the item itself or a child <a>
            href = item.get_attribute("href")
            if not href:
                link = item.query_selector("a")
                if link:
                    href = link.get_attribute("href")
            if not href:
                continue

            match = re.search(r"/video/(\d+)", href)
            if not match or match.group(1) in seen_ids:
                continue

            video_id = match.group(1)
            seen_ids.add(video_id)

            views = 0
            views_el = item.query_selector('[data-e2e="video-views"], strong')
            if views_el:
                views = parse_count(views_el.inner_text())

            videos.append({
                "username": username,
                "url": href if href.startswith("http") else f"https://www.tiktok.com{href}",
                "video_id": video_id,
                "caption": "",
                "views": views,
                "likes": 0,
                "comments": 0,
                "shares": 0,
            })

    except Exception as e:
        print(f"  [warn] DOM extraction error: {e}")

    return videos
