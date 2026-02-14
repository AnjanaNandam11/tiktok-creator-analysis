"""Core analytics functions for TikTok competitor analysis."""

from sqlalchemy.orm import Session

from app.models.database import Creator, Video


def calculate_engagement_rate(likes: int, comments: int, shares: int, views: int) -> float:
    """Calculate engagement rate for a video."""
    if views == 0:
        return 0.0
    return ((likes + comments + shares) / views) * 100


def get_creator_stats(db: Session, creator_id: int) -> dict:
    """Compute aggregate stats for a creator."""
    creator = db.query(Creator).filter(Creator.id == creator_id).first()
    if not creator:
        return {"error": "Creator not found"}

    videos = db.query(Video).filter(Video.creator_id == creator_id).all()
    if not videos:
        return {
            "username": creator.username,
            "total_videos": 0,
            "total_views": 0,
            "total_likes": 0,
            "avg_engagement_rate": 0.0,
            "follower_count": creator.follower_count,
            "date_range": {"earliest": None, "latest": None},
        }

    total_views = sum(v.views for v in videos)
    total_likes = sum(v.likes for v in videos)
    rates = [
        calculate_engagement_rate(v.likes, v.comments, v.shares, v.views)
        for v in videos
    ]

    dates = [v.posted_at for v in videos if v.posted_at]
    earliest = min(dates).isoformat() if dates else None
    latest = max(dates).isoformat() if dates else None

    return {
        "username": creator.username,
        "total_videos": len(videos),
        "total_views": total_views,
        "total_likes": total_likes,
        "avg_engagement_rate": round(sum(rates) / len(rates), 2),
        "follower_count": creator.follower_count,
        "date_range": {"earliest": earliest, "latest": latest},
    }


def get_posting_patterns(db: Session, creator_id: int) -> dict:
    """Analyse posting time patterns for a creator."""
    videos = db.query(Video).filter(Video.creator_id == creator_id).all()
    if not videos:
        return {
            "best_hours": {},
            "best_days": {},
            "posting_frequency": 0.0,
            "total_posts": 0,
        }

    dated = [v for v in videos if v.posted_at]
    if not dated:
        return {
            "best_hours": {},
            "best_days": {},
            "posting_frequency": 0.0,
            "total_posts": len(videos),
        }

    # Engagement by hour and day
    hour_eng: dict[int, list[float]] = {}
    day_eng: dict[str, list[float]] = {}

    for v in dated:
        rate = calculate_engagement_rate(v.likes, v.comments, v.shares, v.views)
        h = v.posted_at.hour
        d = v.posted_at.strftime("%A")
        hour_eng.setdefault(h, []).append(rate)
        day_eng.setdefault(d, []).append(rate)

    # Average engagement per hour, sorted descending, top 3
    hour_avg = {h: round(sum(rs) / len(rs), 3) for h, rs in hour_eng.items()}
    best_hours = dict(sorted(hour_avg.items(), key=lambda x: x[1], reverse=True)[:3])

    # Average engagement per day, sorted descending
    day_avg = {d: round(sum(rs) / len(rs), 3) for d, rs in day_eng.items()}
    best_days = dict(sorted(day_avg.items(), key=lambda x: x[1], reverse=True))

    # Posting frequency: videos per day over the date range
    dates = [v.posted_at for v in dated]
    span_days = (max(dates) - min(dates)).days or 1
    posting_frequency = round(len(dated) / span_days, 2)

    return {
        "best_hours": best_hours,
        "best_days": best_days,
        "posting_frequency": posting_frequency,
        "total_posts": len(videos),
    }


def get_content_performance(db: Session, creator_id: int) -> list[dict]:
    """Return top 10 videos by engagement rate."""
    videos = db.query(Video).filter(Video.creator_id == creator_id).all()
    if not videos:
        return []

    scored = []
    for v in videos:
        rate = calculate_engagement_rate(v.likes, v.comments, v.shares, v.views)
        scored.append({
            "video_id": v.video_id,
            "caption": v.caption,
            "views": v.views,
            "likes": v.likes,
            "comments": v.comments,
            "shares": v.shares,
            "engagement_rate": round(rate, 2),
            "posted_at": v.posted_at.isoformat() if v.posted_at else None,
        })

    scored.sort(key=lambda x: x["engagement_rate"], reverse=True)
    return scored[:10]


def compare_creators(db: Session, creator_ids: list[int]) -> list[dict]:
    """Compare multiple creators side by side."""
    results = []
    for cid in creator_ids:
        creator = db.query(Creator).filter(Creator.id == cid).first()
        if not creator:
            continue

        videos = db.query(Video).filter(Video.creator_id == cid).all()
        if not videos:
            results.append({
                "username": creator.username,
                "avg_views": 0,
                "avg_engagement_rate": 0.0,
                "total_videos": 0,
                "posting_frequency": 0.0,
                "avg_likes": 0,
                "avg_comments": 0,
                "follower_count": creator.follower_count,
            })
            continue

        n = len(videos)
        avg_views = sum(v.views for v in videos) // n
        avg_likes = sum(v.likes for v in videos) // n
        avg_comments = sum(v.comments for v in videos) // n

        rates = [
            calculate_engagement_rate(v.likes, v.comments, v.shares, v.views)
            for v in videos
        ]
        avg_rate = round(sum(rates) / len(rates), 2)

        dated = [v for v in videos if v.posted_at]
        if len(dated) >= 2:
            dates = [v.posted_at for v in dated]
            span_days = (max(dates) - min(dates)).days or 1
            posting_frequency = round(len(dated) / span_days, 2)
        else:
            posting_frequency = 0.0

        results.append({
            "username": creator.username,
            "avg_views": avg_views,
            "avg_engagement_rate": avg_rate,
            "total_videos": n,
            "posting_frequency": posting_frequency,
            "avg_likes": avg_likes,
            "avg_comments": avg_comments,
            "follower_count": creator.follower_count,
        })

    return results
