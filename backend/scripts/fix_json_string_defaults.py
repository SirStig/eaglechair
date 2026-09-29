"""
Fix JSON columns that hold the literal JSON *string* "[]" instead of an empty list.

Older model definitions used ``Column(JSON, default="[]")``, which serialises the
Python string "[]" (stored as the JSON value ``"[]"``) rather than an empty array.
Such rows load back as the string "[]" and break schemas that expect a list
(e.g. the quote cart). The models now use ``default=list``; this one-off script
repairs existing rows.

Affected columns:
    chairs.images, chairs.hover_images, product_variations.images

Idempotent and dialect-agnostic (MySQL / SQLite / PostgreSQL): values are loaded
and checked in Python, and rewritten through SQLAlchemy ``update()``.

Usage (from the project root, venv active):

    python -m backend.scripts.fix_json_string_defaults --dry-run
    python -m backend.scripts.fix_json_string_defaults
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import select, update  # noqa: E402

from backend.database.base import AsyncSessionLocal  # noqa: E402
from backend.models.chair import Chair, ProductVariation  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(message)s")
logger = logging.getLogger("fix_json_string_defaults")

TARGETS = [
    (Chair, ("images", "hover_images")),
    (ProductVariation, ("images",)),
]


def _is_string_empty_list(value) -> bool:
    return isinstance(value, str) and value.strip() == "[]"


async def run(dry_run: bool) -> int:
    total = 0
    async with AsyncSessionLocal() as session:
        for model, columns in TARGETS:
            cols = [getattr(model, name) for name in columns]
            result = await session.execute(select(model.id, *cols))
            for row in result.all():
                row_id = row[0]
                fixes = {
                    name: []
                    for name, value in zip(columns, row[1:])
                    if _is_string_empty_list(value)
                }
                if not fixes:
                    continue
                total += 1
                logger.info(
                    "%s %s id=%s: %s",
                    "[dry-run] would fix" if dry_run else "fixing",
                    model.__tablename__,
                    row_id,
                    ", ".join(sorted(fixes)),
                )
                if not dry_run:
                    await session.execute(
                        update(model)
                        .where(model.id == row_id)
                        # data repair, not a content edit: keep updated_at
                        .values(**fixes, updated_at=model.updated_at)
                    )
        if dry_run:
            await session.rollback()
        else:
            await session.commit()
    logger.info(
        "%s %d row(s)", "Would fix" if dry_run else "Fixed", total
    )
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--dry-run", action="store_true", help="Report affected rows without writing"
    )
    args = parser.parse_args()
    asyncio.run(run(args.dry_run))


if __name__ == "__main__":
    main()
