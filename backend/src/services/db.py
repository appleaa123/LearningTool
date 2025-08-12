from __future__ import annotations

import os
from pathlib import Path
from contextlib import contextmanager
from typing import Iterator

from sqlmodel import SQLModel, Session, create_engine


def _database_path() -> str:
    """Resolve the on-disk SQLite path under a persisted directory.

    The default location is `/data/app.db`. Override with env `SQLITE_DB_PATH`.
    Ensures the parent directory exists before returning.
    """
    # Default to a repo-local ./data/app.db for local dev; Docker sets SQLITE_DB_PATH=/data/app.db
    default_local = str(Path(__file__).resolve().parents[3] / "data" / "app.db")
    configured = os.getenv("SQLITE_DB_PATH")
    candidate = configured or default_local
    parent = Path(candidate).parent
    try:
        parent.mkdir(parents=True, exist_ok=True)
        return candidate
    except Exception:
        # Fallback to repo-local if configured path is not writable (e.g., /data on macOS local run)
        fallback_parent = Path(default_local).parent
        try:
            fallback_parent.mkdir(parents=True, exist_ok=True)
        except Exception:
            # As a last resort, use current working directory
            return str(Path.cwd() / "app.db")
        return default_local


# Create a global engine for the application
ENGINE = create_engine(f"sqlite:///{_database_path()}", echo=False)


def init_db() -> None:
    """Create all tables if they do not already exist."""
    # Late import to avoid circular deps
    from services.models import BaseModel

    SQLModel.metadata.create_all(ENGINE)  # type: ignore[arg-type]


def get_session() -> Iterator[Session]:
    """FastAPI dependency to provide a DB session per request."""
    with Session(ENGINE) as session:
        yield session


@contextmanager
def session_scope() -> Iterator[Session]:
    """Context manager for non-request contexts (e.g., background tasks)."""
    session = Session(ENGINE)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


