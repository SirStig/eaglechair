"""
Report quotes that carry tax, to find ones hit by the old 10% auto-tax bug.

Until the fix in "Stop admin quote edits from adding 10% tax", every admin edit
of a quote recalculated tax_amount as round(subtotal * 0.10), although quotes
are created with no tax. This script lists every quote with tax_amount > 0 and
flags the ones whose tax is exactly that 10% figure (within 1 cent).

Read-only by default. With --zero-ten-percent it asks for confirmation, then
sets tax_amount = 0 and total_amount = subtotal + shipping_cost - discount_amount
(the app's own total formula) ONLY for the flagged 10% quotes. Quotes with any
other tax amount (e.g. entered by hand) are never changed.

Usage (from the project root, venv active):

    python -m backend.scripts.report_quote_tax
    python -m backend.scripts.report_quote_tax --zero-ten-percent
"""

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session, selectinload  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

import backend.models  # noqa: E402,F401  (register all mappers)
from backend.core.config import settings  # noqa: E402
from backend.models.quote import Quote  # noqa: E402
from backend.scripts.add_performance_indexes import sync_database_url  # noqa: E402

TEN_PERCENT_TOLERANCE_CENTS = 1


def is_ten_percent_tax(quote: Quote) -> bool:
    return abs((quote.tax_amount or 0) - round((quote.subtotal or 0) * 0.10)) <= TEN_PERCENT_TOLERANCE_CENTS


def corrected_total(quote: Quote) -> int:
    return (quote.subtotal or 0) + (quote.shipping_cost or 0) - (quote.discount_amount or 0)


def _money(cents) -> str:
    return f"${(cents or 0) / 100:,.2f}"


def _date(value) -> str:
    return value.strftime("%Y-%m-%d %H:%M") if value else "-"


def print_report(quotes: list) -> None:
    header = f"{'Quote':<22} {'Company':<30} {'Created':<16} {'Updated':<16} " \
             f"{'Subtotal':>12} {'Tax':>10} {'Total':>12} {'~10%':>5}  Status"
    print(header)
    print("-" * len(header))
    for q in quotes:
        company = q.company.company_name if q.company else f"(guest) {q.contact_name or ''}".strip()
        status = q.status.value if hasattr(q.status, "value") else q.status
        print(
            f"{q.quote_number:<22} {company[:30]:<30} {_date(q.created_at):<16} {_date(q.updated_at):<16} "
            f"{_money(q.subtotal):>12} {_money(q.tax_amount):>10} {_money(q.total_amount):>12} "
            f"{'YES' if is_ten_percent_tax(q) else 'no':>5}  {status}"
            + (f"  quoted_price={_money(q.quoted_price)}" if q.quoted_price else "")
        )
    flagged = [q for q in quotes if is_ten_percent_tax(q)]
    print()
    print(f"{len(quotes)} quote(s) with tax > 0; {len(flagged)} match 10% of subtotal (+/- 1 cent).")
    if any(q.quoted_price for q in flagged):
        print("Note: some flagged quotes have a quoted_price set; review it by hand, this script never changes it.")


def run(zero_ten_percent: bool, assume_yes: bool = False) -> int:
    engine = create_engine(sync_database_url(settings.database_url_async), poolclass=NullPool)
    changed = 0
    try:
        with Session(engine) as db:
            quotes = db.execute(
                select(Quote)
                .where(Quote.tax_amount > 0)
                .options(selectinload(Quote.company))
                .order_by(Quote.created_at)
            ).scalars().all()
            print_report(quotes)

            if not zero_ten_percent:
                return 0
            flagged = [q for q in quotes if is_ten_percent_tax(q)]
            if not flagged:
                print("Nothing to change.")
                return 0

            print("\nWill set tax to $0.00 and recompute the total for:")
            for q in flagged:
                print(f"  {q.quote_number}: tax {_money(q.tax_amount)} -> $0.00, "
                      f"total {_money(q.total_amount)} -> {_money(corrected_total(q))}")
            if not assume_yes:
                answer = input(f"\nType 'yes' to update {len(flagged)} quote(s): ").strip().lower()
                if answer != "yes":
                    print("Aborted; nothing changed.")
                    return 0
            for q in flagged:
                q.tax_amount = 0
                q.total_amount = corrected_total(q)
                changed += 1
            db.commit()
            print(f"Updated {changed} quote(s).")
    finally:
        engine.dispose()
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--zero-ten-percent",
        action="store_true",
        help="After confirmation, zero the tax on quotes whose tax is 10%% of subtotal (+/- 1 cent)",
    )
    args = parser.parse_args()
    run(args.zero_ten_percent)


if __name__ == "__main__":
    main()
