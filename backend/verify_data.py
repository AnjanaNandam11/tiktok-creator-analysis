"""Verify demo data in the SQLite database."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import func
from app.models.database import SessionLocal, Creator, Video


def main():
    db = SessionLocal()
    try:
        creator_count = db.query(Creator).count()
        print(f"=== Database Verification ===\n")
        print(f"Total creators: {creator_count}\n")

        creators = db.query(Creator).all()
        for c in creators:
            videos = db.query(Video).filter(Video.creator_id == c.id).all()
            video_count = len(videos)

            if videos:
                dates = [v.posted_at for v in videos if v.posted_at]
                avg_views = sum(v.views for v in videos) / video_count
                min_date = min(dates).strftime("%Y-%m-%d") if dates else "N/A"
                max_date = max(dates).strftime("%Y-%m-%d") if dates else "N/A"
            else:
                avg_views = 0
                min_date = max_date = "N/A"

            print(f"@{c.username}")
            print(f"  Followers:   {c.follower_count:,}")
            print(f"  Videos:      {video_count}")
            print(f"  Date range:  {min_date} to {max_date}")
            print(f"  Avg views:   {avg_views:,.0f}")
            print()
    finally:
        db.close()


if __name__ == "__main__":
    main()
