"""
Product base exports for admins: an Excel workbook (products + variations)
and the grouping used by the contents-style product index PDF.
"""

import io
from collections import OrderedDict
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from backend.services.catalog_pdf.layouts import model_label

_HEADER_FONT = Font(bold=True, color="FFFFFF")
_HEADER_FILL = PatternFill("solid", fgColor="221F1F")

PRODUCT_COLUMNS = (
    ("Model Number", 14),
    ("Suffix", 8),
    ("Full Model", 16),
    ("Name", 34),
    ("Family", 20),
    ("Category", 20),
    ("Subcategory", 20),
    ("Status", 10),
    ("Stock Status", 14),
    ("Variations", 11),
    ("Variation SKUs", 50),
    ("Has Photo", 10),
    ("Height", 9),
    ("Width", 9),
    ("Depth", 9),
    ("Seat Height", 11),
    ("Weight", 9),
)

VARIATION_COLUMNS = (
    ("Model Number", 16),
    ("Product Name", 34),
    ("Family", 20),
    ("SKU", 20),
    ("Variation Name", 34),
    ("Finish", 18),
    ("Upholstery", 18),
    ("Color", 14),
    ("Available", 10),
    ("Stock Status", 14),
)


def _category(product: dict) -> str:
    parent = product.get("parent_category_name")
    name = product.get("category_name") or ""
    return f"{parent} / {name}" if parent and name else name


def _sheet(wb: Workbook, title: str, columns, rows, first: bool = False):
    ws = wb.active if first else wb.create_sheet()
    ws.title = title
    ws.append([name for name, _ in columns])
    for cell in ws[1]:
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL
        cell.alignment = Alignment(vertical="center")
    for index, (_, width) in enumerate(columns, start=1):
        ws.column_dimensions[get_column_letter(index)].width = width
    for row in rows:
        ws.append(row)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    return ws


def build_workbook(products: list[dict]) -> bytes:
    """Excel workbook with a Products sheet and a Variations sheet."""
    wb = Workbook()
    product_rows = []
    variation_rows = []
    for p in products:
        skus = [v["sku"] for v in p["variations"] if v.get("sku")]
        product_rows.append([
            p["model_number"],
            p.get("model_suffix") or "",
            model_label(p),
            p["name"],
            p.get("family_name") or "",
            _category(p),
            p.get("subcategory_name") or "",
            "Active" if p["is_active"] else "Inactive",
            p.get("stock_status") or "",
            len(p["variations"]),
            ", ".join(skus),
            "Yes" if p.get("default_image") else "No",
            p.get("height"),
            p.get("width"),
            p.get("depth"),
            p.get("seat_height"),
            p.get("weight"),
        ])
        for v in p["variations"]:
            variation_rows.append([
                model_label(p),
                p["name"],
                p.get("family_name") or "",
                v.get("sku") or "",
                v.get("name") or "",
                v.get("finish") or "",
                v.get("upholstery") or "",
                v.get("color") or "",
                "Yes" if v.get("is_available") else "No",
                v.get("stock_status") or "",
            ])

    _sheet(wb, "Products", PRODUCT_COLUMNS, product_rows, first=True)
    _sheet(wb, "Variations", VARIATION_COLUMNS, variation_rows)
    wb.properties.creator = "Eagle Chair"
    wb.properties.created = datetime.utcnow()

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def index_groups(products: list[dict]) -> list[dict]:
    """Products grouped category -> family for render_product_index, sorted by name."""
    categories: "OrderedDict[str, OrderedDict[str, list]]" = OrderedDict()
    ordered = sorted(products, key=lambda p: (_category(p) or "~", p.get("family_name") or "~", p["model_number"]))
    for p in ordered:
        families = categories.setdefault(_category(p) or "Uncategorized", OrderedDict())
        families.setdefault(p.get("family_name") or "Other", []).append({
            "model": model_label(p),
            "name": p["name"],
            "variations": [v["sku"] for v in p["variations"] if v.get("sku")],
            "is_active": p["is_active"],
        })
    return [
        {"name": category, "families": [{"name": f, "products": items} for f, items in families.items()]}
        for category, families in categories.items()
    ]
