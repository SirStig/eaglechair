"""
In-process product search index and option map (one per worker).

The search index maps product id -> normalized searchable text (name, model
number, short description, category / subcategory / family names, keywords)
built from one lightweight query. It is rebuilt when older than
INDEX_MAX_AGE seconds or when the catalog version counter changes (see
catalog_cache.bump_catalog_version, called from admin write paths).

The option map caches {chair id: (finish ids, upholstery ids, color ids)}
for the finish / upholstery / color list filters with the same policy.
"""

import difflib
import logging
import re
import time
import unicodedata
from dataclasses import dataclass, field
from typing import Dict, FrozenSet, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.models.chair import Category, Chair, ProductFamily, ProductSubcategory
from backend.services.catalog_cache import get_catalog_version

try:  # rapidfuzz is optional; difflib is the fallback
    from rapidfuzz import fuzz as _rf_fuzz  # type: ignore
except Exception:  # pragma: no cover - depends on environment
    _rf_fuzz = None

logger = logging.getLogger(__name__)

INDEX_MAX_AGE = 300  # seconds

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Score tiers (higher ranks first)
TIER_MODEL_EXACT = 5
TIER_MODEL_PREFIX = 4
TIER_NAME = 3
TIER_TEXT = 2
TIER_FUZZY = 1


def normalize(text: Optional[str]) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", str(text))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text.lower()


def tokenize(text: Optional[str]) -> List[str]:
    return _TOKEN_RE.findall(normalize(text))


def compact(text: Optional[str]) -> str:
    return "".join(tokenize(text))


def _similarity(a: str, b: str) -> float:
    if _rf_fuzz is not None:
        return float(_rf_fuzz.ratio(a, b))
    return difflib.SequenceMatcher(None, a, b).ratio() * 100.0


@dataclass
class _Entry:
    id: int
    name: str
    models: Tuple[str, ...]  # compact model numbers (base, base+suffix)
    name_tokens: FrozenSet[str]
    text_tokens: FrozenSet[str]


@dataclass
class _Index:
    entries: Dict[int, _Entry] = field(default_factory=dict)
    vocabulary: FrozenSet[str] = frozenset()
    built_at: float = 0.0
    version: Optional[Tuple] = None


_index = _Index()
_option_map: Dict[int, Tuple[FrozenSet[int], FrozenSet[int], FrozenSet[int]]] = {}
_option_map_state: Tuple[float, Optional[Tuple]] = (0.0, None)


def _max_age() -> float:
    # Tests roll back the DB between cases, so never reuse an index there.
    return 0.0 if settings.TESTING else INDEX_MAX_AGE


def _is_fresh(built_at: float, built_version, version) -> bool:
    if built_version is None or built_version != version:
        return False
    return (time.monotonic() - built_at) < _max_age()


def invalidate_local() -> None:
    """Drop this worker's in-process caches."""
    global _option_map_state
    _index.version = None
    _option_map_state = (0.0, None)


async def _build_index(db: AsyncSession, version) -> _Index:
    rows = (
        await db.execute(
            select(
                Chair.id,
                Chair.name,
                Chair.model_number,
                Chair.model_suffix,
                Chair.short_description,
                Chair.keywords,
                Category.name.label("category_name"),
                ProductSubcategory.name.label("subcategory_name"),
                ProductFamily.name.label("family_name"),
            )
            .outerjoin(Category, Chair.category_id == Category.id)
            .outerjoin(ProductSubcategory, Chair.subcategory_id == ProductSubcategory.id)
            .outerjoin(ProductFamily, Chair.family_id == ProductFamily.id)
            .where(Chair.is_active)
        )
    ).all()

    entries: Dict[int, _Entry] = {}
    vocab = set()
    for row in rows:
        base_model = compact(row.model_number)
        models = tuple(
            m
            for m in dict.fromkeys(
                [base_model, compact(f"{row.model_number or ''}{row.model_suffix or ''}")]
            )
            if m
        )
        name_tokens = frozenset(tokenize(row.name))
        kw = row.keywords
        keywords = " ".join(str(k) for k in kw if k) if isinstance(kw, list) else ""
        text_tokens = frozenset(
            tokenize(
                " ".join(
                    filter(
                        None,
                        [
                            row.name,
                            row.model_number,
                            row.model_suffix,
                            row.short_description,
                            row.category_name,
                            row.subcategory_name,
                            row.family_name,
                            keywords,
                        ],
                    )
                )
            )
        ) | set(models)
        entries[row.id] = _Entry(
            id=row.id,
            name=normalize(row.name),
            models=models,
            name_tokens=name_tokens,
            text_tokens=text_tokens,
        )
        vocab.update(text_tokens)

    return _Index(
        entries=entries,
        vocabulary=frozenset(vocab),
        built_at=time.monotonic(),
        version=version,
    )


async def get_index(db: AsyncSession) -> _Index:
    global _index
    version = await get_catalog_version()
    if not _is_fresh(_index.built_at, _index.version, version):
        started = time.perf_counter()
        _index = await _build_index(db, version)
        logger.info(
            f"Built product search index: {len(_index.entries)} products, "
            f"{len(_index.vocabulary)} terms in {(time.perf_counter() - started) * 1000:.1f}ms"
        )
    return _index


def _token_match(q: str, tokens: FrozenSet[str], prefixed: FrozenSet[str]) -> float:
    """100 for an exact token, 95 for a token prefix (typeahead), else 0."""
    if q in tokens:
        return 100.0
    if not prefixed.isdisjoint(tokens):
        return 95.0
    return 0.0


def _fuzzy_terms(q: str, vocabulary: FrozenSet[str], threshold: float) -> Dict[str, float]:
    """Vocabulary terms similar to q (>= threshold), with their scores."""
    matches: Dict[str, float] = {}
    if len(q) < 3:
        return matches
    matcher = difflib.SequenceMatcher(None, "", q) if _rf_fuzz is None else None
    cutoff = threshold / 100.0
    for term in vocabulary:
        if abs(len(term) - len(q)) > max(2, len(q) // 2):
            continue
        if matcher is not None:
            matcher.set_seq1(term)
            if matcher.real_quick_ratio() < cutoff or matcher.quick_ratio() < cutoff:
                continue
            score = matcher.ratio() * 100.0
        else:
            score = _similarity(q, term)
        if score >= threshold:
            matches[term] = score
    return matches


def search(index: _Index, query: str, limit: int, threshold: int) -> List[int]:
    """Return product ids ranked by relevance."""
    q_tokens = [t for t in tokenize(query) if len(t) >= 2] or tokenize(query)
    q_compact = compact(query)
    if not q_tokens or not q_compact:
        return []

    # Per query token: vocabulary terms it is a strict prefix of (typeahead)
    prefixed = {
        t: frozenset(v for v in index.vocabulary if v != t and v.startswith(t))
        if len(t) >= 2
        else frozenset()
        for t in q_tokens
    }
    fuzzy_cache: Dict[str, Dict[str, float]] = {}
    scored: List[Tuple[int, float, str, int]] = []

    for entry in index.entries.values():
        tier = 0
        score = 0.0

        if q_compact in entry.models:
            tier, score = TIER_MODEL_EXACT, 100.0
        elif len(q_compact) >= 2 and any(m.startswith(q_compact) for m in entry.models):
            tier = TIER_MODEL_PREFIX
            score = 100.0 * len(q_compact) / max(len(m) for m in entry.models)
        else:
            name_scores = [
                _token_match(t, entry.name_tokens, prefixed[t]) for t in q_tokens
            ]
            if all(name_scores):
                tier, score = TIER_NAME, sum(name_scores) / len(name_scores)
            else:
                text_scores = [
                    _token_match(t, entry.text_tokens, prefixed[t]) for t in q_tokens
                ]
                if all(text_scores):
                    tier, score = TIER_TEXT, sum(text_scores) / len(text_scores)
                else:
                    fuzzy_scores = []
                    for t, exact in zip(q_tokens, text_scores):
                        if exact:
                            fuzzy_scores.append(exact)
                            continue
                        if t not in fuzzy_cache:
                            fuzzy_cache[t] = _fuzzy_terms(
                                t, index.vocabulary, threshold
                            )
                        similar = fuzzy_cache[t]
                        best = max(
                            (similar[x] for x in entry.text_tokens & similar.keys()),
                            default=0.0,
                        )
                        if not best:
                            break
                        fuzzy_scores.append(best)
                    else:
                        avg = sum(fuzzy_scores) / len(fuzzy_scores)
                        if avg >= threshold:
                            tier, score = TIER_FUZZY, avg

        if tier:
            scored.append((tier, score, entry.name, entry.id))

    scored.sort(key=lambda s: (-s[0], -s[1], s[2], s[3]))
    return [s[3] for s in scored[:limit]]


async def get_option_map(
    db: AsyncSession,
) -> Dict[int, Tuple[FrozenSet[int], FrozenSet[int], FrozenSet[int]]]:
    """{chair id: (finish ids, upholstery ids, color ids)} for all chairs."""
    global _option_map, _option_map_state
    version = await get_catalog_version()
    built_at, built_version = _option_map_state
    if not _is_fresh(built_at, built_version, version):

        def _ids(value) -> FrozenSet[int]:
            if not isinstance(value, list):
                return frozenset()
            out = set()
            for v in value:
                try:
                    out.add(int(v))
                except (TypeError, ValueError):
                    continue
            return frozenset(out)

        rows = (
            await db.execute(
                select(
                    Chair.id,
                    Chair.available_finishes,
                    Chair.available_upholsteries,
                    Chair.available_colors,
                )
            )
        ).all()
        _option_map = {
            row.id: (
                _ids(row.available_finishes),
                _ids(row.available_upholsteries),
                _ids(row.available_colors),
            )
            for row in rows
        }
        _option_map_state = (time.monotonic(), version)
    return _option_map
