"""
Family category / subcategory assignments

A product family can be listed under several categories and subcategories.
ProductFamily.category_id / subcategory_id remain the primary assignment and
the family_categories / family_subcategories tables hold the full set,
primary included - the same model products use (chair_categories).
"""

from typing import Iterable, List, Optional

from sqlalchemy import delete, insert, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.exceptions import ValidationError
from backend.models.chair import (
    Category,
    ProductFamily,
    ProductSubcategory,
    family_categories,
    family_subcategories,
)


def in_categories(category_ids: Iterable[int]):
    """WHERE clause: family's primary or any extra category is one of category_ids."""
    ids = list(category_ids)
    return or_(
        ProductFamily.category_id.in_(ids),
        ProductFamily.id.in_(
            select(family_categories.c.family_id).where(family_categories.c.category_id.in_(ids))
        ),
    )


def in_subcategories(subcategory_ids: Iterable[int]):
    """WHERE clause: family's primary or any extra subcategory is one of subcategory_ids."""
    ids = list(subcategory_ids)
    return or_(
        ProductFamily.subcategory_id.in_(ids),
        ProductFamily.id.in_(
            select(family_subcategories.c.family_id).where(family_subcategories.c.subcategory_id.in_(ids))
        ),
    )


async def _replace_links(db: AsyncSession, table, column: str, family_id: int, ids: List[int]) -> None:
    await db.execute(delete(table).where(table.c.family_id == family_id))
    if ids:
        await db.execute(insert(table), [{"family_id": family_id, column: i} for i in ids])


async def _keep_primary(db: AsyncSession, table, column: str, family_id: int, primary, previous) -> None:
    col = getattr(table.c, column)
    if previous and previous != primary:
        await db.execute(delete(table).where(table.c.family_id == family_id, col == previous))
    if primary:
        exists = await db.execute(select(table.c.family_id).where(table.c.family_id == family_id, col == primary))
        if exists.first() is None:
            await db.execute(insert(table), [{"family_id": family_id, column: primary}])


async def sync_family_categories(
    db: AsyncSession,
    family: ProductFamily,
    category_ids: Optional[List[int]] = None,
    subcategory_ids: Optional[List[int]] = None,
    previous_category_id: Optional[int] = None,
    previous_subcategory_id: Optional[int] = None,
) -> None:
    """
    Store a family's category / subcategory sets (family must have an id).

    With a list: it becomes the full set; the primary is kept when it's in the
    list, otherwise the first entry becomes primary. An empty subcategory list
    clears the primary subcategory too; an empty category list keeps just the
    primary category.

    Without a list (None) only the primary is kept in step: a changed primary
    (e.g. the bulk "Move to category" action) replaces the old one in the set.
    """
    if category_ids is not None:
        ids = list(dict.fromkeys(int(i) for i in category_ids))
        if ids:
            found = set((await db.execute(select(Category.id).where(Category.id.in_(ids)))).scalars().all())
            missing = [i for i in ids if i not in found]
            if missing:
                raise ValidationError(f"Category ID {missing[0]} not found")
            if family.category_id not in ids:
                family.category_id = ids[0]
        elif family.category_id:
            ids = [family.category_id]
        await _replace_links(db, family_categories, "category_id", family.id, ids)
    else:
        await _keep_primary(db, family_categories, "category_id", family.id,
                            family.category_id, previous_category_id)

    if subcategory_ids is not None:
        ids = list(dict.fromkeys(int(i) for i in subcategory_ids))
        if ids:
            found = set((await db.execute(
                select(ProductSubcategory.id).where(ProductSubcategory.id.in_(ids))
            )).scalars().all())
            missing = [i for i in ids if i not in found]
            if missing:
                raise ValidationError(f"Subcategory ID {missing[0]} not found")
            if family.subcategory_id not in ids:
                family.subcategory_id = ids[0]
        else:
            family.subcategory_id = None
        await _replace_links(db, family_subcategories, "subcategory_id", family.id, ids)
    else:
        await _keep_primary(db, family_subcategories, "subcategory_id", family.id,
                            family.subcategory_id, previous_subcategory_id)


async def category_id_lists(db: AsyncSession, family_ids: List[int]) -> tuple[dict, dict]:
    """({family_id: [category ids]}, {family_id: [subcategory ids]}) from the link tables."""
    if not family_ids:
        return {}, {}
    cats: dict = {}
    for fid, cid in (await db.execute(
        select(family_categories.c.family_id, family_categories.c.category_id)
        .where(family_categories.c.family_id.in_(family_ids))
    )).all():
        cats.setdefault(fid, []).append(cid)
    subs: dict = {}
    for fid, sid in (await db.execute(
        select(family_subcategories.c.family_id, family_subcategories.c.subcategory_id)
        .where(family_subcategories.c.family_id.in_(family_ids))
    )).all():
        subs.setdefault(fid, []).append(sid)
    return cats, subs


def primary_first(primary: Optional[int], ids: List[int]) -> List[int]:
    if not primary:
        return list(ids)
    return [primary] + [i for i in ids if i != primary]


async def attach_category_ids(db: AsyncSession, families: list) -> None:
    """
    Set category_ids / subcategory_ids (primary first) on serialized family
    dicts or ProductFamily objects, in one query per table.
    """
    def get(f, key):
        return f.get(key) if isinstance(f, dict) else getattr(f, key, None)

    def put(f, key, value):
        if isinstance(f, dict):
            f[key] = value
        else:
            setattr(f, key, value)

    cats, subs = await category_id_lists(db, [get(f, "id") for f in families if get(f, "id")])
    for f in families:
        fid = get(f, "id")
        put(f, "category_ids", primary_first(get(f, "category_id"), cats.get(fid, [])))
        put(f, "subcategory_ids", primary_first(get(f, "subcategory_id"), subs.get(fid, [])))
