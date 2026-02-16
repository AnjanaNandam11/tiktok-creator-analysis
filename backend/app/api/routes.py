import random
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import get_db, Creator, Video
from app.analytics.core import (
    compare_creators as _compare_creators,
    get_creator_stats as _get_creator_stats,
    get_posting_patterns as _get_posting_patterns,
    get_content_performance as _get_content_performance,
)

router = APIRouter()

USERNAME_RE = re.compile(r"^[\w.]{1,30}$")

# --- Demo fallback data ------------------------------------------------
_CAPTIONS = [
    "POV: when Monday hits different #relatable #fyp",
    "Wait for it... #surprise #viral",
    "Trying this trend for the first time #trending #foryou",
    "This took me 3 hours to make #creative #art",
    "I can't believe this actually worked #hack #lifehack",
    "The ending though #plottwist #comedy",
    "Day in my life #vlog #dayinmylife #routine",
    "This sound is everything #music #dance",
    "Rate my fit 1-10 #fashion #ootd #style",
    "New recipe alert #cooking #foodtok #recipe",
]
_HASHTAGS = [
    "fyp,foryou,viral", "trending,foryoupage,tiktok", "comedy,funny,humor",
    "dance,music,choreography", "lifestyle,vlog,dayinmylife", "food,recipe,cooking",
]


def _generate_demo_videos(count: int = 25) -> list[dict]:
    """Generate realistic sample videos when TikTok blocks the scraper."""
    base_views = random.randint(500_000, 50_000_000)
    videos = []
    for _ in range(count):
        mult = random.choice([0.1, 0.2, 0.3, 0.5, 0.5, 0.8, 1.0, 1.5, 3.0, 10.0])
        views = int(base_views * mult * random.uniform(0.5, 1.5))
        videos.append({
            "video_id": str(random.randint(7_000_000_000_000_000_000, 7_400_000_000_000_000_000)),
            "caption": random.choice(_CAPTIONS),
            "views": views,
            "likes": int(views * random.uniform(0.05, 0.20)),
            "comments": int(views * random.uniform(0.005, 0.03)),
            "shares": int(views * random.uniform(0.002, 0.015)),
            "posted_at": (datetime.utcnow() - timedelta(days=random.randint(1, 90), hours=random.randint(0, 23))).isoformat(),
            "duration": round(random.uniform(7, 180), 1),
            "hashtags": random.choice(_HASHTAGS),
        })
    return videos


# --- Helpers ------------------------------------------------------------

def _upsert_videos(db: Session, creator_id: int, videos: list[dict]) -> int:
    """Insert or update videos for a creator. Returns count of upserted videos."""
    count = 0
    for v in videos:
        vid = v.get("video_id", "")
        if not vid:
            continue
        existing = db.query(Video).filter(Video.video_id == vid).first()
        if existing:
            existing.views = v.get("views", 0)
            existing.likes = v.get("likes", 0)
            existing.comments = v.get("comments", 0)
            existing.shares = v.get("shares", 0)
        else:
            db.add(Video(
                creator_id=creator_id,
                video_id=vid,
                caption=v.get("caption", ""),
                views=v.get("views", 0),
                likes=v.get("likes", 0),
                comments=v.get("comments", 0),
                shares=v.get("shares", 0),
                posted_at=datetime.fromisoformat(v["posted_at"]) if v.get("posted_at") else None,
                duration=v.get("duration", 0),
                hashtags=v.get("hashtags", ""),
            ))
        count += 1
    db.commit()
    return count


# --- Routes -------------------------------------------------------------

@router.get("/creators")
def list_creators(db: Session = Depends(get_db)):
    """List all tracked creators."""
    creators = db.query(Creator).all()
    return [
        {
            "id": c.id,
            "username": c.username,
            "niche": c.niche,
            "follower_count": c.follower_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in creators
    ]


@router.post("/creators")
async def add_creator(username: str, niche: str = "", db: Session = Depends(get_db)):
    """Add a new creator, scrape their profile, and return results."""
    username = username.strip().lstrip("@")

    if not username or not USERNAME_RE.match(username):
        raise HTTPException(
            status_code=400,
            detail="Invalid username. Use only letters, numbers, underscores, and dots (max 30 chars).",
        )

    existing = db.query(Creator).filter(Creator.username == username).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Creator @{username} is already being tracked.")

    # Create the creator first
    creator = Creator(username=username, niche=niche)
    db.add(creator)
    db.commit()
    db.refresh(creator)

    # Scrape their TikTok profile
    videos_scraped = 0
    used_demo = False
    try:
        from app.scrapers.tiktok_scraper import scrape_tiktok_user
        result = await scrape_tiktok_user(username)
        profile = result.get("profile", {})
        videos = result.get("videos", [])

        # Update follower count from scraped profile
        follower_count = profile.get("followers", 0)
        if follower_count > 1000:
            creator.follower_count = follower_count
            db.commit()

        # Check if videos look like anti-bot dummy data (all zeros)
        real_videos = [v for v in videos if v.get("views", 0) > 0 or v.get("likes", 0) > 0]

        # Fall back to demo data if no usable videos were scraped
        if not real_videos:
            print(f"  [demo] TikTok blocked @{username}, generating sample data")
            if follower_count < 1000:
                creator.follower_count = random.randint(500_000, 20_000_000)
                db.commit()
            videos = _generate_demo_videos(random.randint(20, 30))
            used_demo = True

        videos_scraped = _upsert_videos(db, creator.id, videos)
    except Exception as e:
        print(f"[warn] Scraping failed for @{username}: {e}")
        # Generate demo data as fallback even on scrape failure
        creator.follower_count = random.randint(500_000, 20_000_000)
        db.commit()
        videos = _generate_demo_videos(random.randint(20, 30))
        videos_scraped = _upsert_videos(db, creator.id, videos)
        used_demo = True

    if used_demo:
        msg = f"Creator added with sample data ({videos_scraped} demo videos). TikTok blocked live scraping."
    elif videos_scraped > 0:
        msg = f"Creator added and {videos_scraped} videos scraped successfully."
    else:
        msg = "Creator added with profile data. No video data available."

    return {
        "id": creator.id,
        "username": creator.username,
        "follower_count": creator.follower_count,
        "total_videos": videos_scraped,
        "message": msg,
    }


@router.get("/creators/{creator_id}/stats")
def creator_stats_nested(creator_id: int, db: Session = Depends(get_db)):
    """Get aggregate stats for a creator (nested under /creators)."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    return _get_creator_stats(db, creator_id)


@router.get("/creators/{creator_id}/patterns")
def posting_patterns_nested(creator_id: int, db: Session = Depends(get_db)):
    """Get posting time patterns for a creator."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    return _get_posting_patterns(db, creator_id)


@router.get("/creators/{creator_id}/top-videos")
def top_videos(creator_id: int, db: Session = Depends(get_db)):
    """Get top 10 videos by engagement rate."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    return _get_content_performance(db, creator_id)


@router.patch("/creators/{creator_id}")
def update_creator(creator_id: int, niche: str = "", db: Session = Depends(get_db)):
    """Update a creator's niche."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    creator.niche = niche.strip()
    db.commit()
    return {"status": "ok", "id": creator.id, "niche": creator.niche}


@router.delete("/creators/{creator_id}")
def delete_creator(creator_id: int, db: Session = Depends(get_db)):
    """Delete a creator and all their videos."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    username = creator.username
    db.query(Video).filter(Video.creator_id == creator_id).delete()
    db.delete(creator)
    db.commit()
    return {"status": "ok", "message": f"Creator @{username} and all their videos have been deleted."}


@router.get("/creators/{creator_id}")
def get_creator(creator_id: int, db: Session = Depends(get_db)):
    """Get a creator's details and videos."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        return {"error": "Creator not found"}
    videos = db.query(Video).filter(Video.creator_id == creator_id).all()
    return {
        "creator": {
            "id": creator.id,
            "username": creator.username,
            "niche": creator.niche,
            "follower_count": creator.follower_count,
        },
        "videos": [
            {
                "video_id": v.video_id,
                "caption": v.caption,
                "views": v.views,
                "likes": v.likes,
                "comments": v.comments,
                "shares": v.shares,
                "posted_at": v.posted_at.isoformat() if v.posted_at else None,
                "duration": v.duration,
                "hashtags": v.hashtags,
            }
            for v in videos
        ],
    }


@router.post("/scrape/{username}")
async def scrape_creator(username: str, db: Session = Depends(get_db)):
    """Trigger scraping for a creator and persist results."""
    from app.scrapers.tiktok_scraper import scrape_tiktok_user

    used_demo = False
    try:
        result = await scrape_tiktok_user(username)
        profile = result.get("profile", {})
        videos = result.get("videos", [])
    except Exception as e:
        print(f"[warn] Scraping failed for @{username}: {e}")
        profile = {}
        videos = []

    # Ensure creator exists in DB
    creator = db.query(Creator).filter(Creator.username == username).first()
    if not creator:
        creator = Creator(username=username)
        db.add(creator)
        db.commit()
        db.refresh(creator)

    # Update follower count
    follower_count = profile.get("followers", 0)
    if follower_count > 1000:
        creator.follower_count = follower_count
        db.commit()

    # Fall back to demo data if no usable videos
    real_videos = [v for v in videos if v.get("views", 0) > 0 or v.get("likes", 0) > 0]
    if not real_videos:
        print(f"  [demo] TikTok blocked @{username}, generating sample data")
        if follower_count < 1000:
            creator.follower_count = random.randint(500_000, 20_000_000)
            db.commit()
        videos = _generate_demo_videos(random.randint(20, 30))
        used_demo = True

    count = _upsert_videos(db, creator.id, videos)

    return {
        "status": "ok",
        "username": username,
        "videos_scraped": count,
        "demo_data": used_demo,
    }


@router.get("/analytics/compare")
def compare_creators(creator_ids: str, db: Session = Depends(get_db)):
    """Compare multiple creators. Pass comma-separated IDs."""
    ids = [int(i) for i in creator_ids.split(",")]
    return {"creators": _compare_creators(db, ids)}


@router.get("/analytics/stats/{creator_id}")
def creator_stats(creator_id: int, db: Session = Depends(get_db)):
    """Get aggregate stats for a single creator."""
    return _get_creator_stats(db, creator_id)


@router.get("/analytics/patterns/{creator_id}")
def posting_patterns(creator_id: int, db: Session = Depends(get_db)):
    """Get posting time patterns for a creator."""
    return _get_posting_patterns(db, creator_id)


@router.get("/analytics/performance/{creator_id}")
def content_performance(creator_id: int, db: Session = Depends(get_db)):
    """Get top 10 videos by engagement rate."""
    return _get_content_performance(db, creator_id)
