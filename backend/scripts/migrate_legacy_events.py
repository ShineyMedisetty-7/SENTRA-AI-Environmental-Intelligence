
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# Resolve project and backend directories.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"

sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal
from models.event import Event


# Historical SQLite backups.
SOURCES = {
    "backend_sentra_backup": {
        "path": PROJECT_ROOT / "database_backups" / "backend_sentra_backup.db",
        "expected_count": 150,
    },
    "root_sentra_backup": {
        "path": PROJECT_ROOT / "database_backups" / "root_sentra_backup.db",
        "expected_count": 64,
    },
}


def read_events(database_path):
    """Read SQLite events without modifying the source database."""

    uri = database_path.resolve().as_uri() + "?mode=ro"
    connection = sqlite3.connect(uri, uri=True)

    try:
        rows = connection.execute("""
            SELECT event_type, location, description, person_id, timestamp
            FROM events
            ORDER BY id
        """).fetchall()

        return rows

    finally:
        connection.close()


def main():
    session = SessionLocal()

    try:
        # Never import into a database that already contains events.
        existing_count = session.query(Event).count()

        if existing_count != 0:
            raise RuntimeError(
                f"PostgreSQL already contains {existing_count} events. "
                "Migration cancelled to prevent duplicates."
            )

        imported_events = []

        for source_name, config in SOURCES.items():
            database_path = config["path"]

            if not database_path.is_file():
                raise FileNotFoundError(database_path)

            rows = read_events(database_path)

            if len(rows) != config["expected_count"]:
                raise RuntimeError(
                    f"{source_name}: expected "
                    f"{config['expected_count']} events, "
                    f"but found {len(rows)}. Migration cancelled."
                )

            print(f"{source_name}: {len(rows)} events found.")

            for row in rows:
                event_type, location, description, person_id, timestamp = row

                parsed_timestamp = (
                    datetime.fromisoformat(timestamp)
                    if timestamp
                    else None
                )

                imported_events.append(
                    Event(
                        event_type=event_type,
                        location=location,
                        description=description,
                        person_id=person_id,
                        timestamp=parsed_timestamp,
                        legacy_source=source_name,
                    )
                )

        # Insert all events in one transaction.
        session.add_all(imported_events)
        session.commit()

        print("\nMigration completed successfully!")

        for source_name in SOURCES:
            count = (
                session.query(Event)
                .filter(Event.legacy_source == source_name)
                .count()
            )
            print(f"{source_name}: {count} imported")

        print("Total imported:", session.query(Event).count())

    except Exception:
        session.rollback()
        raise

    finally:
        session.close()


if __name__ == "__main__":
    main()
