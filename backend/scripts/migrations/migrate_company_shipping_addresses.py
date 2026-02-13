"""
Migrate company single shipping address to company_shipping_addresses table.

Creates company_shipping_addresses, quote_shipping_destinations, quote_item_allocations;
migrates existing company shipping data; populates quote destinations/allocations for existing quotes;
drops shipping columns from companies.

Usage:
    python -m backend.scripts.migrations.migrate_company_shipping_addresses [--confirm]
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from backend.database.base import Base, AsyncSessionLocal, engine
from backend.models.company import CompanyShippingAddress
from backend.models.quote import Quote, QuoteItem, QuoteShippingDestination, QuoteItemAllocation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_migration(confirm: bool = False):
    if not confirm:
        logger.warning("Run with --confirm to execute the migration.")
        return

    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    CompanyShippingAddress.__table__,
                    QuoteShippingDestination.__table__,
                    QuoteItemAllocation.__table__,
                ],
            )
        )

    try:
        async with engine.begin() as conn:
            res = await conn.execute(
                text(
                    "SELECT id, shipping_address_line1, shipping_address_line2, shipping_city, "
                    "shipping_state, shipping_zip, shipping_country FROM companies "
                    "WHERE shipping_address_line1 IS NOT NULL AND shipping_address_line1 != ''"
                )
            )
            rows = res.mappings().all()
        if rows:
            async with AsyncSessionLocal() as db:
                for row in rows:
                    addr = CompanyShippingAddress(
                        company_id=row["id"],
                        line1=row["shipping_address_line1"] or "",
                        line2=row["shipping_address_line2"],
                        city=row["shipping_city"] or "",
                        state=row["shipping_state"] or "",
                        zip=row["shipping_zip"] or "",
                        country=row["shipping_country"] or "USA",
                    )
                    db.add(addr)
                await db.commit()
            logger.info("Migrated %s companies to company_shipping_addresses", len(rows))
        else:
            logger.info("No company shipping data to migrate.")
    except Exception as e:
        if "shipping_address_line1" in str(e) or "column" in str(e).lower():
            logger.info("Companies table has no shipping columns (already migrated or fresh DB), skipping company data migration.")
        else:
            raise

        result = await db.execute(
            select(Quote).options(
                selectinload(Quote.items),
                selectinload(Quote.shipping_destinations),
            )
        )
        quotes = result.scalars().all()
        quotes_to_migrate = [q for q in quotes if not q.shipping_destinations]
        for quote in quotes_to_migrate:
            dest = QuoteShippingDestination(
                quote_id=quote.id,
                line1=quote.shipping_address_line1 or "",
                line2=quote.shipping_address_line2,
                city=quote.shipping_city or "",
                state=quote.shipping_state or "",
                zip=quote.shipping_zip or "",
                country=quote.shipping_country or "USA",
            )
            db.add(dest)
            await db.flush()
            for item in quote.items:
                alloc = QuoteItemAllocation(
                    quote_item_id=item.id,
                    quote_shipping_destination_id=dest.id,
                    quantity=item.quantity,
                )
                db.add(alloc)
        await db.commit()
        logger.info("Migrated %s quotes to quote_shipping_destinations and quote_item_allocations", len(quotes_to_migrate))

    async with engine.begin() as conn:
        for col in (
            "shipping_address_line1",
            "shipping_address_line2",
            "shipping_city",
            "shipping_state",
            "shipping_zip",
            "shipping_country",
        ):
            await conn.execute(text(f"ALTER TABLE companies DROP COLUMN IF EXISTS {col}"))
    logger.info("Dropped shipping columns from companies.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm", action="store_true", help="Execute the migration")
    args = parser.parse_args()
    asyncio.run(run_migration(confirm=args.confirm))


if __name__ == "__main__":
    main()
