"""Collect demo data: scrape real profiles, generate sample video data.

TikTok blocks video feeds in headless browsers, so this script:
  1. Scrapes REAL profile stats (followers, bio, etc.) via Playwright
  2. Generates realistic sample video data for the demo
  3. Saves everything to the database via the API
"""

import json
import random
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

# Add backend to path so we can import the scraper directly
sys.path.insert(0, str(Path(__file__).resolve().parent))

import requests

API_BASE = "http://localhost:8000/api"

CREATORS = [
    {"username": "charlidamelio", "niche": "Dance & Lifestyle"},
    {"username": "khaby.lame", "niche": "Comedy"},
    {"username": "bellapoarch", "niche": "Music & Entertainment"},
]

SAMPLE_CAPTIONS = [
    "POV: when Monday hits different #relatable #fyp",
    "Wait for it... #surprise #viral",
    "Trying this trend for the first time #trending #foryou",
    "This took me 3 hours to make #creative #art",
    "Reply to @user here's the tutorial! #tutorial #howto",
    "I can't believe this actually worked #hack #lifehack",
    "duet with @friend we nailed it #duet #funny",
    "The ending though #plottwist #comedy",
    "Day in my life #vlog #dayinmylife #routine",
    "This sound is everything #music #dance",
    "Rate my fit 1-10 #fashion #ootd #style",
    "When your mom catches you #funny #relatable",
    "New recipe alert #cooking #foodtok #recipe",
    "Transformation check #glow #beforeandafter",
    "Things that just make sense #facts #real",
]

SAMPLE_HASHTAGS = [
    "fyp,foryou,viral",
    "trending,foryoupage,tiktok",
    "comedy,funny,humor",
    "dance,music,choreography",
    "lifestyle,vlog,dayinmylife",
    "relatable,real,facts",
    "tutorial,howto,learn",
    "fashion,ootd,style",
    "food,recipe,cooking",
    "motivation,grind,success",
]


def generate_sample_videos(username: str, count: int = 30) -> list[dict]:
    """Generate realistic sample video data."""
    videos = []
    base_views = random.randint(500_000, 50_000_000)

    for i in range(count):
        # Vary views with a power-law-ish distribution (some viral, most average)
        view_multiplier = random.choice([0.1, 0.2, 0.3, 0.5, 0.5, 0.8, 1.0, 1.5, 3.0, 10.0])
        views = int(base_views * view_multiplier * random.uniform(0.5, 1.5))
        likes = int(views * random.uniform(0.05, 0.20))
        comments = int(views * random.uniform(0.005, 0.03))
        shares = int(views * random.uniform(0.002, 0.015))

        posted_at = datetime.utcnow() - timedelta(
            days=random.randint(1, 90),
            hours=random.randint(0, 23),
        )

        videos.append({
            "video_id": str(random.randint(7_000_000_000_000_000_000, 7_400_000_000_000_000_000)),
            "caption": random.choice(SAMPLE_CAPTIONS),
            "views": views,
            "likes": likes,
            "comments": comments,
            "shares": shares,
            "posted_at": posted_at.isoformat(),
            "duration": round(random.uniform(7, 180), 1),
            "hashtags": random.choice(SAMPLE_HASHTAGS),
        })

    return videos


def scrape_real_profile(username: str) -> dict | None:
    """Use the scraper to get real profile data."""
    try:
        from app.scrapers.tiktok_scraper import _scrape_tiktok_user_sync
        # This will scrape the real profile and save debug data
        _scrape_tiktok_user_sync(username, video_limit=1)

        # Read the profile from the saved JSON
        data_path = Path(__file__).resolve().parent.parent / "data" / f"{username}.json"
        if data_path.exists():
            with open(data_path) as f:
                data = json.load(f)
            return data.get("profile", {})
    except Exception as e:
        print(f"  Could not scrape real profile for @{username}: {e}")
    return None


def main():
    print("=== TikTok Demo Data Collection ===\n")

    # First check if API is running
    try:
        requests.get(f"{API_BASE}/creators", timeout=5)
    except requests.ConnectionError:
        print(f"ERROR: Backend not running at {API_BASE}")
        print("Start it with: python -m uvicorn backend.app.main:app --port 8000")
        return

    for i, creator_info in enumerate(CREATORS):
        username = creator_info["username"]
        niche = creator_info["niche"]
        print(f"[{i+1}/{len(CREATORS)}] Processing @{username}...")

        # Step 1: Scrape real profile
        print(f"  Scraping real profile data...")
        profile = scrape_real_profile(username)
        if profile:
            follower_count = profile.get("followers", 0)
            print(f"  Real profile: {follower_count:,} followers, {profile.get('video_count', 0)} videos")
        else:
            follower_count = 0
            print(f"  Could not fetch real profile, using defaults")

        # Step 2: Add creator to DB
        print(f"  Adding to database...")
        try:
            resp = requests.post(
                f"{API_BASE}/creators",
                params={"username": username, "niche": niche},
                timeout=10,
            )
            resp.raise_for_status()
            creator_data = resp.json()
            creator_id = creator_data["id"]
            print(f"  Creator ID: {creator_id}")
        except Exception as e:
            print(f"  Error adding creator: {e}")
            # Try to get existing creator
            try:
                resp = requests.get(f"{API_BASE}/creators", timeout=10)
                for c in resp.json():
                    if c["username"] == username:
                        creator_id = c["id"]
                        print(f"  Using existing creator ID: {creator_id}")
                        break
                else:
                    print(f"  Skipping @{username}")
                    continue
            except Exception:
                continue

        # Step 3: Generate sample videos
        video_count = random.randint(20, 30)
        videos = generate_sample_videos(username, video_count)
        print(f"  Generated {len(videos)} sample videos")

        # Step 4: Save videos to JSON for reference
        output = {
            "username": username,
            "scraped_at": datetime.utcnow().isoformat(),
            "profile": profile or {"username": username},
            "video_count": len(videos),
            "videos": videos,
        }
        data_dir = Path(__file__).resolve().parent.parent / "data"
        with open(data_dir / f"{username}.json", "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"  Saved to data/{username}.json")

        # Step 5: Insert videos into DB via direct DB access
        _insert_videos_to_db(creator_id, videos)
        print(f"  Inserted {len(videos)} videos into database")

        if i < len(CREATORS) - 1:
            print(f"  Waiting 15s before next creator...\n")
            time.sleep(15)

    print("\nDone! Start the frontend with 'npm run dev' and check the dashboard.")


def _insert_videos_to_db(creator_id: int, videos: list[dict]):
    """Insert videos directly into the SQLite database."""
    from app.models.database import SessionLocal, Video

    db = SessionLocal()
    try:
        for v in videos:
            existing = db.query(Video).filter(Video.video_id == v["video_id"]).first()
            if not existing:
                db.add(Video(
                    creator_id=creator_id,
                    video_id=v["video_id"],
                    caption=v["caption"],
                    views=v["views"],
                    likes=v["likes"],
                    comments=v["comments"],
                    shares=v["shares"],
                    posted_at=datetime.fromisoformat(v["posted_at"]) if v.get("posted_at") else None,
                    duration=v.get("duration", 0),
                    hashtags=v.get("hashtags", ""),
                ))
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
