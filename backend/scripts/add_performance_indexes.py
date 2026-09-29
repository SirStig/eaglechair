"""
Create performance indexes declared on the models for existing databases.

``Base.metadata.create_all`` only creates missing *tables*, so indexes added to
models later never reach an already-provisioned database. This script creates
the indexes listed in PERFORMANCE_INDEXES if they are missing.

Idempotent (``Index.create(checkfirst=True)``) and dialect-agnostic
(MySQL / SQLite / PostgreSQL). Tables that don't exist yet are skipped
(create_all will create them with their indexes).

Usage (from the project root, venv active):

    python -m backend.scripts.add_performance_indexes --dry-run
    python -m backend.scripts.add_performance_indexes
"""

import argparse
import logging
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import create_engine, inspect  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from backend.core.config import settings  # noqa: E402
from backend.models.chair import (  # noqa: E402
    Category,
    Chair,
    Color,
    Finish,
    ProductFamily,
    ProductSubcategory,
    Upholstery,
)
from backend.models.quote import Quote  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(message)s")
logger = logging.getLogger("add_performance_indexes")

# (model, index name) - the Index objects themselves are defined on the models
PERFORMANCE_INDEXES = [
    (Quote, "ix_quotes_status_created_at"),
    (Quote, "ix_quotes_company_id_created_at"),
    (Chair, "ix_chairs_is_active_display_order"),
    (Category, "ix_categories_parent_id"),
    (Category, "ix_categories_is_active_display_order"),
    (ProductSubcategory, "ix_product_subcategories_is_active_display_order"),
    (ProductFamily, "ix_product_families_is_active_display_order"),
    (Finish, "ix_finishes_is_active_display_order"),
    (Upholstery, "ix_upholsteries_is_active_display_order"),
    (Color, "ix_colors_is_active_display_order"),
]


def sync_database_url(async_url: str) -> str:
    """Convert an async driver URL to its sync equivalent."""
    return (
        async_url.replace("mysql+aiomysql://", "mysql+pymysql://")
        .replace("sqlite+aiosqlite://", "sqlite://")
        .replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    )


def run(dry_run: bool) -> int:
    engine = create_engine(
        sync_database_url(settings.database_url_async), poolclass=NullPool
    )
    created = 0
    try:
        with engine.begin() as conn:
            inspector = inspect(conn)
            for model, index_name in PERFORMANCE_INDEXES:
                table = model.__table__
                index = next((i for i in table.indexes if i.name == index_name), None)
                if index is None:
                    logger.error("%s: index %s not declared on model", table.name, index_name)
                    continue
                if not inspector.has_table(table.name):
                    logger.info("%s: table missing, skipping %s", table.name, index_name)
                    continue
                existing = {i["name"] for i in inspector.get_indexes(table.name)}
                if index_name in existing:
                    logger.info("%s: %s already exists", table.name, index_name)
                    continue
                cols = ", ".join(c.name for c in index.columns)
                if dry_run:
                    logger.info("[dry-run] would create %s ON %s (%s)", index_name, table.name, cols)
                else:
                    index.create(conn, checkfirst=True)
                    logger.info("created %s ON %s (%s)", index_name, table.name, cols)
                created += 1
    finally:
        engine.dispose()
    logger.info("%s %d index(es)", "Would create" if dry_run else "Created", created)
    return created


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--dry-run", action="store_true", help="Report missing indexes without creating them"
    )
    args = parser.parse_args()
    run(args.dry_run)


if __name__ == "__main__":
    main()
