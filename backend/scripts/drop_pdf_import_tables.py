"""
Drop the tables of the removed admin PDF import (tmp catalog staging).

The tables were created by create_all while the import existed; nothing reads
them any more. Run once per database, from the repo root:

    python -m backend.scripts.drop_pdf_import_tables          # dry run
    python -m backend.scripts.drop_pdf_import_tables --apply

Also delete the staged files under FRONTEND_PATH/tmp/ (uploads/, images/).
"""

import asyncio
import sys

from sqlalchemy import inspect, text

from backend.database.base import engine

# Children first (foreign keys)
TABLES = (
    "tmp_product_images",
    "tmp_product_variations",
    "tmp_chairs",
    "tmp_product_families",
    "catalog_uploads",
)


async def main(apply: bool) -> None:
    async with engine.begin() as conn:
        existing = set(await conn.run_sync(lambda sync: inspect(sync).get_table_names()))
        for table in TABLES:
            if table not in existing:
                print(f"skip   {table} (not present)")
                continue
            if apply:
                await conn.execute(text(f"DROP TABLE {table}"))
                print(f"dropped {table}")
            else:
                print(f"would drop {table}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main("--apply" in sys.argv))
