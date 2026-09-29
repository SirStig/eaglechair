"""
Add the token_version column to companies and admin_users (idempotent).

token_version backs JWT revocation: it is embedded in access/refresh tokens as
the `tv` claim and incremented on logout, password change and password reset.
The app also runs this automatically at startup (init_db), so running it by
hand is only needed if you want to migrate before deploying the new code.

Works on MySQL, PostgreSQL and SQLite.

Usage (from repo root):
    python -m backend.scripts.add_token_version_columns
"""

import asyncio
import logging
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.database.base import engine, ensure_token_version_columns  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main() -> None:
    try:
        added = await ensure_token_version_columns(engine)
        if added:
            logger.info(f"Added token_version column to: {', '.join(added)}")
        else:
            logger.info("token_version column already present (nothing to do)")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
