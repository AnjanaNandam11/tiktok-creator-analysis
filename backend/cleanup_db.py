"""Remove stale test creators from the database."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.models.database import SessionLocal, Creator, Video


def main():
    db = SessionLocal()
    try:
        creator = db.query(Creator).filter(Creator.username == "humphreytalks").first()
        if not creator:
            print("@humphreytalks not found in database.")
            return

        video_count = db.query(Video).filter(Video.creator_id == creator.id).count()
        db.query(Video).filter(Video.creator_id == creator.id).delete()
        db.delete(creator)
        db.commit()
        print(f"Deleted @humphreytalks (id={creator.id}, {video_count} videos removed).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
