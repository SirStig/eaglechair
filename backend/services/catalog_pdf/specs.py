"""
Spec rows (icon + value) printed in the dimension column next to a product.

Python port of getSpecItems in frontend/src/utils/specSymbols.js; keep the
two in sync so the catalog shows the same symbols as the product pages.
"""

from typing import Optional

# Drawing per dimension field, per spec profile. Missing entries get a text badge.
PROFILE_ICONS = {
    "chair": {
        "height": "chair-height",
        "width": "chair-width",
        "depth": "chair-depth",
        "seat_height": "chair-seat-height",
        "seat_width": "chair-width",
        "seat_depth": "chair-seat-depth",
        "arm_height": "arm-height",
    },
    "barstool": {
        "height": "stool-height",
        "width": "base-width",
        "depth": "chair-depth",
        "seat_height": "stool-seat-height",
        "seat_width": "stool-seat-width",
        "seat_depth": "chair-seat-depth",
        "arm_height": "arm-height",
    },
    "bench": {
        "height": "stool-height",
        "width": "stool-seat-width",
        "depth": "chair-depth",
        "seat_height": "stool-seat-height",
        "seat_width": "stool-seat-width",
    },
    "table_base": {
        "height": "stool-height",
        "width": "base-width",
        "depth": "base-width",
    },
    "table": {},
    "booth": {
        "height": "booth-height",
        "width": "booth-width",
        "depth": "booth-depth",
        "seat_height": "booth-seat-height",
    },
}

DIMENSIONS = (
    ("height", "H"),
    ("width", "W"),
    ("depth", "D"),
    ("seat_height", "SH"),
    ("seat_width", "SW"),
    ("seat_depth", "SD"),
    ("arm_height", "AH"),
    ("back_height", "BH"),
)

SPEC_FIELDS = tuple(key for key, _ in DIMENSIONS) + ("weight", "shipping_weight", "upholstery_amount")


def _fmt(value: float) -> str:
    return f"{round(float(value), 1):g}"


def _pick(product: dict, variation: Optional[dict], key: str):
    if variation and variation.get(key) is not None:
        return variation[key]
    return product.get(key)


def get_spec_items(product: dict, variation: Optional[dict], profile: Optional[str]) -> list[dict]:
    """
    Spec rows for a product, in catalog order, skipping empty values.

    Each row is {"key", "value", "icon", "badge"}: icon is a spec-icons/ name,
    or None with a short text badge when the profile has no drawing for it.
    Values use the catalog's notation (32”, 22#, 2.5y).
    """
    icons = PROFILE_ICONS.get(profile or "", {})
    is_arm_chair = profile == "chair" and _pick(product, variation, "arm_height") is not None
    items = []

    for key, badge in DIMENSIONS:
        value = _pick(product, variation, key)
        if value is None:
            continue
        # An arm chair's seat width is measured between the arms
        icon = "between-arms-width" if is_arm_chair and key == "seat_width" else icons.get(key)
        items.append(
            {"key": key, "value": f"{_fmt(value)}”", "icon": icon, "badge": None if icon else badge}
        )

    weight = _pick(product, variation, "shipping_weight")
    if weight is None:
        weight = _pick(product, variation, "weight")
    if weight is not None:
        items.append({"key": "weight", "value": f"{_fmt(weight)}#", "icon": "weight", "badge": None})

    yards = _pick(product, variation, "upholstery_amount")
    if yards:
        items.append({"key": "upholstery_amount", "value": f"{_fmt(yards)}y", "icon": "yardage", "badge": None})

    return items
