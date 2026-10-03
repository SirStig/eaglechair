"""
AI Service - EagleChair Admin AI Assistant

Powered by Google Gemini with:
- Full streaming via WebSockets
- Web search via DuckDuckGo
- File analysis (PDF, CSV, images)
- Safe arithmetic calculator
- Persistent memory
- RAG-style training data
- EagleChair DB query tools
"""

import ast
import asyncio
import io
import ipaddress
import json
import logging
import math
import os
import operator
import re
import socket
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, AsyncGenerator, Optional
from urllib.parse import urljoin, urlparse

import httpx
import html2text
import pandas as pd
import pdfplumber
from ddgs import DDGS
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from fuzzywuzzy import fuzz
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from backend.core.config import settings
from backend.database.base import AsyncSessionLocal
from backend.models.ai_chat import AITrainingDocument, TrainingStatus
from backend.services.ai_catalog_tools import (
    ENTITIES,
    audit_data_quality,
    catalog_overview,
    create_proposals,
    describe_schema,
    get_records,
    list_records,
)
from backend.services.ai_domain_knowledge import EAGLECHAIR_DOMAIN_KNOWLEDGE
from backend.services.ai_max_persona import MAX_PERSONA

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Gemini Client Setup
# ─────────────────────────────────────────────────────────────────────────────

_client: Optional[genai.Client] = None

def get_gemini_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = getattr(settings, "GEMINI_API_KEY", None) or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured")
        _client = genai.Client(api_key=api_key)
    return _client


# ─────────────────────────────────────────────────────────────────────────────
# Tool Implementations
# ─────────────────────────────────────────────────────────────────────────────

def web_search(query: str, max_results: int = 12) -> dict:
    """Search the web using DuckDuckGo."""
    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                })
        return {"results": results, "count": len(results)}
    except Exception as e:
        logger.warning(f"Web search failed: {e}")
        return {"results": [], "count": 0, "error": str(e)}


FETCH_MAX_REDIRECTS = 5
FETCH_MAX_BYTES = 2 * 1024 * 1024  # 2MB response cap


def _is_public_ip(ip: ipaddress._BaseAddress) -> bool:
    """True only for globally routable unicast addresses."""
    if ip.version == 6 and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
        or not ip.is_global
    )


def _resolve_fetch_url(url: str) -> tuple[Optional[str], Optional[str]]:
    """
    Validate a URL for server-side fetching (SSRF protection).

    Returns (error, None) if the URL is not allowed, otherwise (None, ip) where
    ip is a validated public address the request must be pinned to.
    """
    try:
        parsed = urlparse(url)
        port = parsed.port
    except ValueError:
        return "Invalid URL", None
    if parsed.scheme not in ("http", "https"):
        return "Only http and https URLs are allowed", None
    host = parsed.hostname
    if not host:
        return "URL has no host", None
    if parsed.username or parsed.password:
        return "URLs with credentials are not allowed", None
    port = port or (443 if parsed.scheme == "https" else 80)
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError):
        return "Could not resolve host", None
    if not infos:
        return "Could not resolve host", None
    ips = []
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0].split("%")[0])
        except ValueError:
            return "Invalid host address", None
        if not _is_public_ip(ip):
            return "URL resolves to a non-public address", None
        ips.append(ip)
    return None, str(ips[0])


def _validate_fetch_url(url: str) -> Optional[str]:
    """Return an error message if the URL is not allowed for fetching, else None."""
    return _resolve_fetch_url(url)[0]


def fetch_webpage(url: str, max_chars: int = 8000) -> dict:
    """Fetch and convert a webpage to markdown for AI reading."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; EagleChair-AI/1.0)",
            "Accept": "text/html,application/xhtml+xml",
        }
        current_url = url
        # trust_env=False: connect directly to the pinned IP, never via an env proxy
        with httpx.Client(timeout=15, follow_redirects=False, trust_env=False) as client:
            # Follow redirects manually so every hop is re-validated
            for _ in range(FETCH_MAX_REDIRECTS + 1):
                error, pinned_ip = _resolve_fetch_url(current_url)
                if error:
                    return {"url": url, "content": "", "error": error}
                # Connect to the IP we validated (no second DNS lookup, so no
                # rebinding), sending the original Host header and, for https,
                # SNI + certificate hostname verification against the original host.
                target = httpx.URL(current_url)
                host = target.raw_host.decode("ascii")
                with client.stream(
                    "GET",
                    target.copy_with(host=pinned_ip),
                    headers={**headers, "Host": target.netloc.decode("ascii")},
                    extensions={"sni_hostname": host} if target.scheme == "https" else None,
                ) as resp:
                    if resp.is_redirect:
                        location = resp.headers.get("location")
                        if not location:
                            return {"url": url, "content": "", "error": "Redirect without location"}
                        current_url = urljoin(current_url, location)
                        continue
                    resp.raise_for_status()
                    body = bytearray()
                    for chunk in resp.iter_bytes():
                        body.extend(chunk)
                        if len(body) > FETCH_MAX_BYTES:
                            break
                    text = bytes(body[:FETCH_MAX_BYTES]).decode(resp.charset_encoding or "utf-8", errors="replace")
                    content_type = resp.headers.get("content-type", "")
                if "text/html" in content_type or "application/xhtml" in content_type:
                    h = html2text.HTML2Text()
                    h.ignore_links = False
                    h.ignore_images = True
                    h.body_width = 0
                    md = h.handle(text)
                    # Compact whitespace
                    md = re.sub(r"\n{3,}", "\n\n", md)
                    return {
                        "url": url,
                        "content": md[:max_chars],
                        "truncated": len(md) > max_chars,
                    }
                return {"url": url, "content": text[:max_chars], "truncated": len(text) > max_chars}
            return {"url": url, "content": "", "error": "Too many redirects"}
    except Exception as e:
        return {"url": url, "content": "", "error": str(e)}


CALC_MAX_EXPRESSION_LENGTH = 200
CALC_MAX_EXPONENT = 1000
CALC_MAX_INT_BITS = 4096

_CALC_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
}
_CALC_UNARY_OPS = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_CALC_FUNCTIONS = {
    "sqrt": math.sqrt,
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "floor": math.floor,
    "ceil": math.ceil,
    "log": math.log,
    "log10": math.log10,
    "exp": math.exp,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
}
_CALC_CONSTANTS = {"pi": math.pi, "e": math.e}


def _calc_pow(base, exponent):
    if abs(exponent) > CALC_MAX_EXPONENT:
        raise ValueError("Exponent too large")
    if (
        isinstance(base, int)
        and isinstance(exponent, int)
        and exponent >= 0
        and max(abs(base).bit_length(), 1) * exponent <= CALC_MAX_INT_BITS
    ):
        return base ** exponent
    # Float power raises OverflowError instead of building huge integers
    return math.pow(base, exponent)


def _calc_eval(node):
    if isinstance(node, ast.Expression):
        return _calc_eval(node.body)
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return node.value
    if isinstance(node, ast.BinOp):
        left = _calc_eval(node.left)
        right = _calc_eval(node.right)
        if isinstance(node.op, ast.Pow):
            return _calc_pow(left, right)
        op = _CALC_BIN_OPS.get(type(node.op))
        if op is None:
            raise ValueError("Unsupported operator")
        result = op(left, right)
        if isinstance(result, int) and result.bit_length() > CALC_MAX_INT_BITS:
            raise ValueError("Result too large")
        return result
    if isinstance(node, ast.UnaryOp) and type(node.op) in _CALC_UNARY_OPS:
        return _CALC_UNARY_OPS[type(node.op)](_calc_eval(node.operand))
    if isinstance(node, ast.Name) and node.id in _CALC_CONSTANTS:
        return _CALC_CONSTANTS[node.id]
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id in _CALC_FUNCTIONS
        and not node.keywords
    ):
        args = [_calc_eval(arg) for arg in node.args]
        return _CALC_FUNCTIONS[node.func.id](*args)
    raise ValueError("Unsupported expression")


def calculate(expression: str) -> dict:
    """Safely evaluate an arithmetic expression (numbers, + - * / // % ** ^, parentheses, basic math functions)."""
    try:
        if not isinstance(expression, str) or not expression.strip():
            raise ValueError("Expression is empty")
        if len(expression) > CALC_MAX_EXPRESSION_LENGTH:
            raise ValueError("Expression too long")
        tree = ast.parse(expression.replace("^", "**"), mode="eval")
        result = _calc_eval(tree)
        return {
            "expression": expression,
            "result": str(result),
            "numeric": float(result),
        }
    except Exception as e:
        return {"expression": expression, "error": str(e) or "Invalid expression"}


def analyze_csv_content(content: str, max_rows: int = 50) -> dict:
    """Analyze CSV content and return summary statistics."""
    try:
        df = pd.read_csv(io.StringIO(content))
        analysis = {
            "shape": {"rows": len(df), "columns": len(df.columns)},
            "columns": list(df.columns),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
            "head": df.head(max_rows).to_markdown(index=False),
            "stats": {},
        }
        # Numeric stats
        numeric_cols = df.select_dtypes(include="number").columns.tolist()
        if numeric_cols:
            desc = df[numeric_cols].describe()
            analysis["stats"] = desc.to_dict()
        # Missing values
        missing = df.isnull().sum()
        analysis["missing_values"] = {col: int(v) for col, v in missing.items() if v > 0}
        # Sample for large datasets
        if len(df) > max_rows:
            analysis["note"] = f"Showing first {max_rows} of {len(df)} rows"
        return analysis
    except Exception as e:
        return {"error": str(e)}


def analyze_pdf_content(file_path: str, max_pages: int = 100) -> dict:
    """Extract text from a PDF file."""
    try:
        pages = []
        with pdfplumber.open(file_path) as pdf:
            total = len(pdf.pages)
            for i, page in enumerate(pdf.pages[:max_pages]):
                text = page.extract_text() or ""
                # Try to extract tables
                tables = []
                for table in page.extract_tables():
                    if table:
                        try:
                            df = pd.DataFrame(table[1:], columns=table[0])
                            tables.append(df.to_markdown(index=False))
                        except Exception:
                            pass
                pages.append({
                    "page": i + 1,
                    "text": text,
                    "tables": tables,
                })
        return {
            "total_pages": total,
            "analyzed_pages": min(total, max_pages),
            "pages": pages,
            "truncated": total > max_pages,
        }
    except Exception as e:
        return {"error": str(e)}


def convert_excel_to_markdown(file_path: str, max_rows_per_sheet: int = 1000) -> dict:
    """Convert Excel file to markdown tables."""
    try:
        ext = Path(file_path).suffix.lower()
        engine = "xlrd" if ext == ".xls" else "openpyxl"
        xl = pd.ExcelFile(file_path, engine=engine)
        sheets = {}
        for sheet in xl.sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet, engine=engine)
            n = min(len(df), max_rows_per_sheet)
            sheets[sheet] = {
                "markdown": df.head(max_rows_per_sheet).to_markdown(index=False),
                "shape": {"rows": len(df), "columns": len(df.columns)},
                "columns": list(df.columns),
            }
        return {"sheets": sheets, "sheet_names": xl.sheet_names}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Gemini Tool Definitions
# ─────────────────────────────────────────────────────────────────────────────

_ENTITY_TYPES = list(ENTITIES)


def _fn(name: str, description: str, properties: dict | None = None, required: list | None = None):
    schema = {"type": "object", "properties": properties or {}}
    if required:
        schema["required"] = required
    return types.FunctionDeclaration(name=name, description=description, parameters_json_schema=schema)


_ENTITY_TYPE_PROP = {
    "type": "string",
    "enum": _ENTITY_TYPES,
    "description": "Which kind of record: " + ", ".join(_ENTITY_TYPES),
}

FUNCTION_DECLARATIONS = [
    _fn(
        "web_search",
        "Search the web (DuckDuckGo) for current information: competitor pricing, industry news, material specs, anything not in the database.",
        {
            "query": {"type": "string", "description": "Specific, concise search query"},
            "max_results": {"type": "integer", "description": "1-15, default 12"},
        },
        ["query"],
    ),
    _fn(
        "fetch_webpage",
        "Read the full content of a public webpage. Use after web_search instead of relying on snippets.",
        {"url": {"type": "string"}},
        ["url"],
    ),
    _fn(
        "calculate",
        "Exact arithmetic for pricing, margins, percentages and conversions. E.g. '250 * 1.15', '(500 - 350) / 500 * 100'.",
        {"expression": {"type": "string"}},
        ["expression"],
    ),
    _fn(
        "catalog_overview",
        "Counts (total and active) for every record type in the database. Call first to see how big each table is before paging through it.",
    ),
    _fn(
        "get_data_schema",
        "Field names, types, foreign keys and required fields for record types. Call before proposing creates or edits to a type you have not used yet in this chat.",
        {"entity_type": {**_ENTITY_TYPE_PROP, "description": "Optional; omit for every type"}},
    ),
    _fn(
        "list_records",
        (
            "Page through ANY record type, including inactive / unavailable ones. Supports text search over names, codes "
            "and SKUs, and exact-match filters on any column (e.g. {\"product_id\": 42}, {\"family_id\": 7, \"is_active\": true}, "
            "{\"finish_id\": null} for missing values, {\"name\": \"not_null\"}). Returns summary columns plus resolved names "
            "for foreign keys. Use offset to read everything when has_more is true."
        ),
        {
            "entity_type": _ENTITY_TYPE_PROP,
            "search": {"type": "string", "description": "Optional case-insensitive text search"},
            "filters": {"type": "object", "description": "Optional exact-match filters: {column: value | [values] | null | \"not_null\"}"},
            "include_inactive": {"type": "boolean", "description": "Default true"},
            "fields": {"type": "array", "items": {"type": "string"}, "description": "Optional columns to return instead of the summary set"},
            "limit": {"type": "integer", "description": "Default 100, max 500"},
            "offset": {"type": "integer", "description": "Default 0"},
        },
        ["entity_type"],
    ),
    _fn(
        "get_records",
        (
            "Every column of specific records by id. Products also include all their variations, category_ids, "
            "subcategory_ids and secondary_family_ids; families include their products; catalog projects include a page summary."
        ),
        {
            "entity_type": _ENTITY_TYPE_PROP,
            "ids": {"type": "array", "items": {"type": "integer"}, "description": "Up to 100 ids"},
        },
        ["entity_type", "ids"],
    ),
    _fn(
        "audit_data_quality",
        (
            "Scan a record type for cleanup work: duplicate SKUs/model numbers/names, messy whitespace, lowercase SKUs, SKUs "
            "that don't match their product, variations still available on inactive products, redundant dimensions, missing "
            "names/images/descriptions, unused finishes/fabrics/colors, empty families. Issues with an obvious fix include "
            "suggested_changes you can pass straight to propose_changes. Use filters to scope (e.g. {\"product_id\": 42})."
        ),
        {
            "entity_type": _ENTITY_TYPE_PROP,
            "filters": {"type": "object", "description": "Optional exact-match filters, same format as list_records"},
            "max_issues": {"type": "integer", "description": "Default 300"},
        },
        ["entity_type"],
    ),
    _fn(
        "search_catalog",
        "Quick keyword search across active families, products, variations, finishes, upholsteries, colors and categories. Use 'all' for a family/model overview.",
        {"query": {"type": "string"}},
        ["query"],
    ),
    _fn(
        "get_product_details",
        "Customer-facing product details by model number (e.g. ['5242', '6018WB']) or product id: specs, variations with swatch images, public product_url and admin_edit_url.",
        {
            "model_numbers": {"type": "array", "items": {"type": "string"}},
            "product_ids": {"type": "array", "items": {"type": "integer"}},
        },
    ),
    _fn(
        "get_product_catalog",
        "The entire active catalog as markdown tables (categories, families, finishes, upholsteries, colors, products, variations). Large; prefer list_records for targeted work.",
    ),
    _fn(
        "search_training_data",
        "Fuzzy search over uploaded training documents (price lists, spec sheets, PDFs).",
        {
            "query": {"type": "string"},
            "max_results": {"type": "integer", "description": "Default 20"},
        },
        ["query"],
    ),
    _fn(
        "get_training_vs_catalog_overview",
        "Model numbers that appear only in training documents, only in the live catalog, or in both.",
    ),
    _fn(
        "propose_changes",
        (
            "Propose one or many database changes for the admin to review. NOTHING is written until the admin approves each "
            "change in the chat. Put every change for one task in a single call (up to 200; use several calls with clear titles "
            "for more). Each change is validated now: invalid ones come back in `rejected` with the reason so you can fix and "
            "re-propose them. Only include fields that actually change. Prices are in cents. Get ids from list_records / "
            "get_records first; never guess ids."
        ),
        {
            "title": {"type": "string", "description": "Short batch title shown to the admin, e.g. 'Normalize SKU casing for 6018 variations'"},
            "changes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "action": {"type": "string", "enum": ["update", "create", "delete"], "description": "Default update"},
                        "entity_type": _ENTITY_TYPE_PROP,
                        "entity_id": {"type": "integer", "description": "Required for update/delete"},
                        "changes": {"type": "object", "description": "update: {field: new value}; create: all field values for the new record"},
                        "reason": {"type": "string", "description": "One line explaining why"},
                    },
                    "required": ["entity_type", "reason"],
                },
            },
        },
        ["title", "changes"],
    ),
]

READ_ONLY_TOOLS = {d.name for d in FUNCTION_DECLARATIONS} - {"propose_changes"}


def _get_tools_for_mode(mode: str) -> list[types.Tool]:
    decls = FUNCTION_DECLARATIONS
    if mode == "ask":
        decls = [d for d in decls if d.name in READ_ONLY_TOOLS]
    return [types.Tool(function_declarations=decls)]


# ─────────────────────────────────────────────────────────────────────────────
# System Prompt Builder
# ─────────────────────────────────────────────────────────────────────────────

def build_system_prompt(
    memory_entries: list[dict],
    training_summaries: list[dict],
    mode: str = "edit",
    model: str = "auto",
    valid_reference_ids: str | None = None,
    proposal_status: str | None = None,
) -> str:
    today = datetime.now().strftime("%B %d, %Y")

    personality_block = MAX_PERSONA if model == "max" else ""

    if mode == "ask":
        mode_block = """

## MODE: ASK (Read-Only)
You cannot propose changes in this mode. Read, research and answer. If the admin asks for a change, explain what you would change and tell them to switch to Edit or Agent mode."""
    elif mode == "agent":
        mode_block = """

## MODE: AGENT (Bulk Work)
Work through large jobs end to end without stopping to ask: page through every relevant record (follow has_more), run audit_data_quality, and propose ALL the fixes as batches. Split huge jobs into several propose_changes calls grouped by kind of fix (e.g. one batch for SKU casing, one for deactivations). Call independent read tools in parallel."""
    else:
        mode_block = """

## MODE: EDIT
Propose changes when the admin asks for them. For bulk requests, still gather everything first and propose it as one batch."""

    memory_block = ""
    if memory_entries:
        memory_block = "\n\n## Persistent Memory\n" + "\n".join(
            f"- [{m.get('category', 'general')}] {m['key']}: {m['value']}"
            for m in memory_entries
        )

    valid_ids_block = f"\n\n{valid_reference_ids}" if valid_reference_ids and mode in ("edit", "agent") else ""
    proposal_block = f"\n\n## Your Proposals In This Chat\n{proposal_status}" if proposal_status else ""

    training_block = ""
    if training_summaries:
        parts = []
        for t in training_summaries:
            block = f"### {t['name']}\n{t.get('summary', 'No summary available.')}"
            kf = t.get("key_facts") or []
            if kf:
                block += "\n\nKey facts:\n" + "\n".join(f"- {f}" for f in kf)
            sd = t.get("structured_data") or ""
            if sd.strip():
                block += "\n\nStructured data:\n" + sd
            parts.append(block)
        training_block = "\n\n## Trained Knowledge Base\n" + "\n\n".join(parts)

    return f"""You are the EagleChair AI Assistant — a senior catalog manager and business analyst for Eagle Chair, a premium B2B commercial seating manufacturer. You work for the admin team inside the admin panel.

Today's date: {today}

## What You Can See
You have read access to the ENTIRE catalog database, active and inactive: products, variations, families, categories, subcategories, finishes, upholsteries, colors, laminates, hardware, custom options, product tags, downloadable catalogs (PDF catalogs, spec sheets) and Catalog Builder projects. Plus uploaded training documents, the admin's attached files, and the web.

- **catalog_overview** — how many of each record exist.
- **list_records** — page through any type with search and filters; follow has_more until you have everything you need. Never conclude something doesn't exist after reading only the first page.
- **get_records** — every field of specific records (products include all variations and category/family links).
- **audit_data_quality** — find cleanup work automatically.
- **get_data_schema** — exact field names and types before you propose changes.
- **search_catalog / get_product_details / get_product_catalog** — fast customer-facing lookups (active records only).
- **search_training_data / get_training_vs_catalog_overview** — uploaded documents.
- **web_search / fetch_webpage / calculate** — research and exact math.

Never guess catalog facts or ids. Look them up. Call independent tools in parallel.

## Changing Data — Always Through propose_changes
You never write to the database directly. **propose_changes** stores changes as a reviewable batch; the admin approves or declines each one (or all at once) in the chat, and only approved changes are applied.
1. Gather the facts first (list_records / get_records / audit_data_quality). Use exact ids from tool results.
2. Check field names with get_data_schema if unsure. Prices and costs are integers in cents.
3. Put all changes for one task in ONE call with a clear title. Each change needs a one-line reason. Only include fields that change.
4. Read the tool result: fix every `rejected` change and re-propose it; don't repeat accepted ones.
5. Then summarize for the admin: what the batch does, how many changes, anything you skipped and why. Don't restate every row — the admin sees each change in the review card.
6. Prefer deactivating (is_active=false; is_available=false for variations) over deleting records that quotes may reference. Use delete only for true junk/duplicates, and say so.
7. Trust the admin when they say data is wrong; propose the fix.

## Cleanup Jobs (e.g. "clean up these variations")
Scope the records (filters by product_id / family_id, or search), read ALL of them, run audit_data_quality on the same scope, then look for patterns yourself too: inconsistent naming ("Walnut" vs "walnut finish"), SKU formats, missing finish/fabric links that the name implies, wrong price adjustments, duplicates. Propose the full set of fixes, grouped into batches by kind of fix.

## Answering Product Questions
Use model numbers (5242), SKUs (5242PBX) or names with admins and in public-facing text — not internal ids, except when discussing a specific change. Give full detail: dimensions, pricing, variations, stock status, lead time, certifications. Include images with markdown ![alt](url) when helpful (primary_image_url, swatch urls).

## Formatting
Markdown: ## headings, bullet lists, tables for comparisons, **bold** key terms, `code` for model numbers and SKUs. Cite web sources as [title](url). Show calculation work. Keep answers scannable.

## Links
Internal links open in-app: [Products](/admin/catalog), [Edit product](/admin/catalog?edit=ID), [Families](/admin/families), [Categories](/admin/categories), [Finishes](/admin/finishes), [Upholstery](/admin/upholstery), [Colors](/admin/colors), [Laminates](/admin/laminates), [Hardware](/admin/hardware), [Downloads/Catalogs](/admin/downloads), [Catalog Builder](/admin/catalog-builder), [Quotes](/admin/quotes). Public product pages come from product_url in get_product_details.

## EagleChair Domain Knowledge
{EAGLECHAIR_DOMAIN_KNOWLEDGE}{personality_block}{mode_block}{proposal_block}{memory_block}{valid_ids_block}{training_block}"""


# ─────────────────────────────────────────────────────────────────────────────
# File Processing
# ─────────────────────────────────────────────────────────────────────────────

async def process_uploaded_file(
    file_path: str,
    file_type: str,
    original_filename: str,
    max_csv_rows: int = 500,
    max_excel_rows: int = 1000,
    max_pdf_pages: int = 100,
) -> str:
    """Convert uploaded file to text/markdown for AI consumption."""
    try:
        path = Path(file_path)
        if not path.exists():
            return f"[File not found: {original_filename}]"

        if file_type == "pdf":
            result = analyze_pdf_content(file_path, max_pages=max_pdf_pages)
            if "error" in result:
                return f"[PDF read error: {result['error']}]"
            pages_text = []
            for page in result.get("pages", []):
                pg = f"--- Page {page['page']} ---\n{page['text']}"
                if page.get("tables"):
                    pg += "\n\nTables:\n" + "\n\n".join(page["tables"])
                pages_text.append(pg)
            return f"# {original_filename} ({result['total_pages']} pages)\n\n" + "\n\n".join(pages_text)

        elif file_type == "csv":
            content = path.read_text(encoding="utf-8", errors="replace")
            result = analyze_csv_content(content, max_rows=max_csv_rows)
            if "error" in result:
                return f"[CSV read error: {result['error']}]"
            return (
                f"# {original_filename}\n\n"
                f"**Shape**: {result['shape']['rows']} rows × {result['shape']['columns']} columns\n\n"
                f"**Columns**: {', '.join(result['columns'])}\n\n"
                f"**Data**:\n{result.get('head', '')}\n\n"
                + (f"**Statistics**:\n{json.dumps(result.get('stats', {}), indent=2)}" if result.get("stats") else "")
            )

        elif file_type == "excel":
            result = convert_excel_to_markdown(file_path, max_rows_per_sheet=max_excel_rows)
            if "error" in result:
                return f"[Excel read error: {result['error']}]"
            parts = [f"# {original_filename}"]
            for sheet_name, sheet_data in result.get("sheets", {}).items():
                parts.append(f"\n## Sheet: {sheet_name} ({sheet_data['shape']['rows']} rows)\n{sheet_data['markdown']}")
            return "\n\n".join(parts)

        elif file_type == "text":
            return path.read_text(encoding="utf-8", errors="replace")[:50000]

        elif file_type == "image":
            # Return path for inline image handling
            return f"[Image: {original_filename}]"

        else:
            try:
                return path.read_text(encoding="utf-8", errors="replace")[:20000]
            except Exception:
                return f"[Cannot read file: {original_filename}]"

    except Exception as e:
        logger.error(f"Error processing file {file_path}: {e}")
        return f"[Error processing {original_filename}: {str(e)}]"


# ─────────────────────────────────────────────────────────────────────────────
# Main AI Streaming Engine
# ─────────────────────────────────────────────────────────────────────────────

class AIStreamEvent:
    """Events streamed back to the client via WebSocket."""

    @staticmethod
    def thinking(message: str = "Thinking...") -> dict:
        return {"type": "thinking", "data": {"message": message}}

    @staticmethod
    def searching(query: str, count: int = 0) -> dict:
        return {"type": "searching", "data": {"query": query, "search_count": count}}

    @staticmethod
    def search_results(sources: list[dict]) -> dict:
        return {"type": "search_results", "data": {"sources": sources}}

    @staticmethod
    def fetching_url(url: str) -> dict:
        return {"type": "fetching_url", "data": {"url": url}}

    @staticmethod
    def calculating(expression: str) -> dict:
        return {"type": "calculating", "data": {"expression": expression}}

    @staticmethod
    def text_chunk(content: str) -> dict:
        return {"type": "text_chunk", "data": {"content": content}}

    @staticmethod
    def message_done(message_id: str, tokens: int, web_sources: list) -> dict:
        return {
            "type": "message_done",
            "data": {
                "message_id": message_id,
                "tokens": tokens,
                "web_sources": web_sources,
            },
        }

    @staticmethod
    def error(message: str) -> dict:
        return {"type": "error", "data": {"message": message}}

    @staticmethod
    def title_update(title: str) -> dict:
        return {"type": "title_update", "data": {"title": title}}

    @staticmethod
    def suggested_edit(edit: dict) -> dict:
        return {"type": "suggested_edit", "data": {"edit": edit}}

    @staticmethod
    def tool_call(tool_call: dict) -> dict:
        return {"type": "tool_call", "data": {"tool_call": tool_call}}

    @staticmethod
    def edit_batch(batch: dict) -> dict:
        return {"type": "edit_batch", "data": {"batch": batch}}

    @staticmethod
    def tool_call_started(name: str, label: str, args: dict) -> dict:
        return {"type": "tool_call_started", "data": {"name": name, "label": label, "args": args}}


TOOL_FRIENDLY_LABELS = {
    "web_search": "Searching the web",
    "fetch_webpage": "Reading webpage",
    "calculate": "Calculating",
    "catalog_overview": "Counting catalog records",
    "get_data_schema": "Reading data schema",
    "list_records": "Listing records",
    "get_records": "Loading records",
    "audit_data_quality": "Auditing data quality",
    "search_catalog": "Searching catalog",
    "search_training_data": "Searching training data",
    "get_product_catalog": "Loading catalog",
    "get_training_vs_catalog_overview": "Comparing training to catalog",
    "get_product_details": "Fetching product details",
    "propose_changes": "Proposing changes",
}


def _tool_friendly_label(name: str, args: dict | None = None) -> str:
    args = args or {}
    base = TOOL_FRIENDLY_LABELS.get(name, name.replace("_", " ").title())
    entity = str(args.get("entity_type") or "").replace("_", " ")
    if name == "search_catalog" and args.get("query"):
        return f"Searching catalog for '{str(args['query'])[:40]}'"
    if name == "search_training_data" and args.get("query"):
        return f"Searching training data for '{str(args['query'])[:40]}'"
    if name == "get_product_details" and args.get("model_numbers"):
        return f"Fetching details for {', '.join(str(m) for m in args['model_numbers'][:3])}"
    if name == "list_records" and entity:
        label = f"Listing {entity} records"
        if args.get("search"):
            label += f" matching '{str(args['search'])[:30]}'"
        if args.get("offset"):
            label += f" (from {args['offset']})"
        return label
    if name == "get_records" and entity:
        return f"Loading {len(args.get('ids') or [])} {entity} record(s)"
    if name == "audit_data_quality" and entity:
        return f"Auditing {entity} data"
    if name == "propose_changes":
        n = len(args.get("changes") or [])
        return f"Proposing {n} change{'s' if n != 1 else ''}" + (f": {str(args.get('title'))[:50]}" if args.get("title") else "")
    if name == "fetch_webpage" and args.get("url"):
        host = urlparse(str(args["url"])).netloc or "page"
        return f"Reading {host}"
    if name == "web_search" and args.get("query"):
        return f"Searching the web for '{str(args['query'])[:30]}'"
    return base


@dataclass
class ToolContext:
    """Who/where a tool call runs for; propose_changes stores proposals against it."""
    session_id: Optional[str] = None
    message_id: Optional[str] = None
    admin_user_id: Optional[int] = None
    mode: str = "edit"
    web_sources: list = field(default_factory=list)
    search_count: int = 0


TOOL_PREVIEW_MAX_CHARS = 12000  # tool results shown in / stored with the chat UI


def _preview_result(result: Any) -> Any:
    """Trim large tool results for the websocket + stored message (the model gets the full result)."""
    try:
        raw = json.dumps(result, default=str)
    except (TypeError, ValueError):
        return {"preview": str(result)[:TOOL_PREVIEW_MAX_CHARS]}
    if len(raw) <= TOOL_PREVIEW_MAX_CHARS:
        return result
    if isinstance(result, dict):
        slim = {}
        for k, v in result.items():
            if isinstance(v, list) and len(v) > 10:
                slim[k] = v[:10]
                slim[f"{k}_omitted"] = len(v) - 10
            elif isinstance(v, str) and len(v) > 2000:
                slim[k] = v[:2000] + "…"
            else:
                slim[k] = v
        slim["_truncated_for_display"] = True
        if len(json.dumps(slim, default=str)) <= TOOL_PREVIEW_MAX_CHARS * 2:
            return slim
    return {"preview": raw[:TOOL_PREVIEW_MAX_CHARS] + "…", "_truncated_for_display": True}


async def _with_db(fn, *args, **kwargs):
    async with AsyncSessionLocal() as db:
        return await fn(db, *args, **kwargs)


async def _run_tool(name: str, args: dict, ctx: ToolContext, emit) -> Any:
    """Execute one tool and return its result (a JSON-serializable object)."""
    if name == "web_search":
        query = str(args.get("query", ""))
        max_r = max(1, min(int(args.get("max_results") or 12), 15))
        ctx.search_count += 1
        emit(AIStreamEvent.searching(query, ctx.search_count))
        result = await asyncio.to_thread(web_search, query, max_r)
        sources = result.get("results", [])
        ctx.web_sources.extend(sources[:5])
        emit(AIStreamEvent.search_results(sources))
        return result
    if name == "fetch_webpage":
        url = str(args.get("url", ""))
        emit(AIStreamEvent.fetching_url(url))
        result = await asyncio.to_thread(fetch_webpage, url)
        if not any(s.get("url") == url for s in ctx.web_sources):
            ctx.web_sources.append({"url": url, "title": (result.get("content", "")[:80] or "").strip(), "snippet": ""})
        return result
    if name == "calculate":
        expression = str(args.get("expression", ""))
        emit(AIStreamEvent.calculating(expression))
        return await asyncio.to_thread(calculate, expression)
    if name == "catalog_overview":
        return await _with_db(catalog_overview)
    if name == "get_data_schema":
        return describe_schema(args.get("entity_type") or None)
    if name == "list_records":
        return await _with_db(
            list_records,
            args.get("entity_type"),
            search=args.get("search"),
            filters=args.get("filters"),
            include_inactive=args.get("include_inactive", True) is not False,
            fields=args.get("fields"),
            limit=args.get("limit") or 100,
            offset=args.get("offset") or 0,
        )
    if name == "get_records":
        return await _with_db(get_records, args.get("entity_type"), args.get("ids") or [])
    if name == "audit_data_quality":
        return await _with_db(
            audit_data_quality, args.get("entity_type"), filters=args.get("filters"), max_issues=args.get("max_issues") or 300,
        )
    if name == "search_catalog":
        return await search_catalog(str(args.get("query", "")).strip())
    if name == "search_training_data":
        max_r = max(1, min(int(args.get("max_results") or 20), 50))
        return await search_training_data(str(args.get("query", "")).strip(), max_results=max_r)
    if name == "get_product_catalog":
        return {"catalog": await fetch_product_catalog()}
    if name == "get_training_vs_catalog_overview":
        return await get_training_vs_catalog_overview()
    if name == "get_product_details":
        return await get_product_details(
            product_ids=args.get("product_ids") or [], model_numbers=args.get("model_numbers") or [],
        )
    if name == "propose_changes":
        if ctx.mode == "ask":
            return {"error": "Ask mode is read-only; ask the admin to switch to Edit or Agent mode to propose changes."}
        if not ctx.session_id:
            return {"error": "Proposals need a chat session"}
        result = await _with_db(
            create_proposals,
            session_id=ctx.session_id,
            message_id=ctx.message_id,
            admin_user_id=ctx.admin_user_id,
            title=args.get("title"),
            changes=args.get("changes") or [],
        )
        if result.get("accepted"):
            emit(AIStreamEvent.edit_batch({
                "batch_id": result["batch_id"], "title": result["title"], "edits": result["edits"],
            }))
        # The model only needs ids + outcome, not the full rows back
        out = {
            "batch_id": result.get("batch_id"),
            "accepted": result.get("accepted", 0),
            "accepted_ids": [
                {"proposal_id": e["id"], "entity_type": e["entity_type"], "entity_id": e["entity_id"], "action": e["action"]}
                for e in result.get("edits", [])
            ],
            "rejected": result.get("rejected", []),
            "status": "Waiting for admin review. Nothing has been written yet.",
        }
        if result.get("error"):
            out["error"] = result["error"]
        return out
    return {"error": f"Unknown tool: {name}"}


async def _execute_tool(fc, ctx: ToolContext) -> tuple[types.Part, dict, list[dict]]:
    """Run one call; returns (function_response part, UI record, events the tool emitted)."""
    events: list[dict] = []
    emit = events.append
    name = fc.name or ""
    args = dict(fc.args) if fc.args else {}
    label = _tool_friendly_label(name, args)
    try:
        result = await _run_tool(name, args, ctx, emit)
    except ValueError as e:  # bad entity_type / filter field etc. — let the model correct itself
        result = {"error": str(e)}
    except Exception as e:
        logger.exception(f"AI tool {name} failed")
        result = {"error": f"{type(e).__name__}: {e}"}
    if not isinstance(result, dict):
        result = {"result": result}
    response = types.Part(function_response=types.FunctionResponse(id=fc.id, name=name, response=result))
    return response, {"name": name, "label": label, "args": _preview_result(args), "result": _preview_result(result)}, events


def _thinking_level(model_option: str | None) -> str:
    if model_option == "deep":
        return "high"
    # The chat should always think properly: anything below medium runs at high
    level = (getattr(settings, "GEMINI_THINKING_LEVEL", None) or "high").lower()
    return level if level in ("medium", "high") else "high"


_RETRYABLE_CODES = {429, 500, 502, 503, 504}
_BLOCK_FINISH_REASONS = ("SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII")


async def stream_ai_response(
    session_messages: list[dict],
    system_prompt: str,
    model: str | None = None,
    mode: str = "edit",
    cancelled: asyncio.Event | None = None,
    tool_context: ToolContext | None = None,
) -> AsyncGenerator[dict, None]:
    """
    Agent loop: stream model output, run every function call the model makes
    (concurrently), feed the results back, and repeat until the model answers.

    The model's turn is sent back verbatim (all parts, including thought
    signatures), which Gemini 3+ requires for multi-step function calling.
    """
    client = get_gemini_client()
    gemini_model = settings.GEMINI_MODEL
    ctx = tool_context or ToolContext()
    ctx.mode = mode

    def _cancelled() -> bool:
        return cancelled is not None and cancelled.is_set()

    contents = [
        types.Content(role="user" if m["role"] == "user" else "model", parts=[types.Part(text=m["content"])])
        for m in session_messages
        if (m.get("content") or "").strip()
    ]
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        tools=_get_tools_for_mode(mode),
        thinking_config=types.ThinkingConfig(thinking_level=_thinking_level(model)),
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        max_output_tokens=65536,
    )

    if _cancelled():
        return
    yield AIStreamEvent.thinking()

    max_rounds = 40 if mode == "agent" else 25
    total_tokens = 0
    produced_text = False

    for _round in range(max_rounds):
        model_parts: list[types.Part] = []
        calls: list = []
        round_tokens = 0
        finish_reason = None

        for attempt in range(3):
            try:
                stream = await client.aio.models.generate_content_stream(
                    model=gemini_model, contents=contents, config=config,
                )
                try:
                    async for chunk in stream:
                        if _cancelled():
                            break
                        usage = getattr(chunk, "usage_metadata", None)
                        if usage and getattr(usage, "total_token_count", None):
                            round_tokens = usage.total_token_count
                        if not chunk.candidates:
                            block = getattr(getattr(chunk, "prompt_feedback", None), "block_reason", None)
                            if block:
                                yield AIStreamEvent.error(f"The request was blocked by the model ({block}).")
                                return
                            continue
                        cand = chunk.candidates[0]
                        finish_reason = getattr(cand, "finish_reason", None) or finish_reason
                        parts = (getattr(cand.content, "parts", None) or []) if cand.content else []
                        for part in parts:
                            model_parts.append(part)
                            if getattr(part, "thought", None):
                                continue
                            if part.text:
                                produced_text = True
                                yield AIStreamEvent.text_chunk(part.text)
                            if part.function_call:
                                calls.append(part.function_call)
                finally:
                    aclose = getattr(stream, "aclose", None)
                    if aclose:
                        try:
                            await aclose()
                        except Exception:
                            pass
                break
            except genai_errors.APIError as e:
                code = getattr(e, "code", None)
                message = str(getattr(e, "message", None) or e)
                if (
                    code == 400 and "thinking level" in message.lower()
                    and config.thinking_config is not None and not model_parts
                ):
                    # e.g. GEMINI_THINKING_LEVEL=minimal on a model without it:
                    # step up to high, and only drop thinking if high is rejected too
                    rejected = config.thinking_config.thinking_level
                    if rejected != types.ThinkingLevel.HIGH:
                        config.thinking_config = types.ThinkingConfig(thinking_level="high")
                    else:
                        config.thinking_config = None
                    logger.warning(f"{gemini_model} rejected thinking level {rejected}: {message}")
                    continue
                if code in _RETRYABLE_CODES and attempt < 2 and not model_parts:
                    yield AIStreamEvent.thinking("The model is busy, retrying...")
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                logger.error(f"Gemini API error ({gemini_model}): {e}")
                if code == 404:
                    yield AIStreamEvent.error(
                        f"AI model '{gemini_model}' is not available. Check GEMINI_MODEL in the server settings."
                    )
                else:
                    yield AIStreamEvent.error(f"AI error: {getattr(e, 'message', None) or e}")
                return
        total_tokens += round_tokens

        if _cancelled():
            return
        if not calls:
            reason = str(finish_reason or "")
            if not produced_text and reason.endswith(_BLOCK_FINISH_REASONS):
                yield AIStreamEvent.error(f"The model stopped without answering ({reason}).")
                return
            if reason.endswith("MAX_TOKENS"):
                yield AIStreamEvent.text_chunk("\n\n_(Response hit the output limit — ask me to continue.)_")
            break

        contents.append(types.Content(role="model", parts=model_parts))

        # Announce every call, run them concurrently, then report results in call order
        for fc in calls:
            args = dict(fc.args) if fc.args else {}
            yield AIStreamEvent.tool_call_started(fc.name, _tool_friendly_label(fc.name, args), _preview_result(args))
        outcomes = await asyncio.gather(*(_execute_tool(fc, ctx) for fc in calls))
        if _cancelled():
            return
        for _, record, events in outcomes:
            yield AIStreamEvent.tool_call(record)
            for ev in events:
                yield ev
        contents.append(types.Content(role="user", parts=[resp for resp, _, _ in outcomes]))
        yield AIStreamEvent.thinking("Working with the results...")
    else:
        yield AIStreamEvent.text_chunk(
            f"\n\n_(Stopped after {max_rounds} tool rounds. Say \"continue\" to keep going.)_"
        )

    seen_urls = set()
    unique_sources = []
    for s in ctx.web_sources:
        url = s.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_sources.append(s)
    yield AIStreamEvent.message_done("", total_tokens, unique_sources)


async def generate_chat_title(first_message: str) -> str:
    """Generate a short title for a chat based on the first message."""
    try:
        client = get_gemini_client()
        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=settings.GEMINI_FAST_MODEL,
                contents=f"Generate a concise 3-7 word title for this chat message. Return ONLY the title, no quotes or punctuation:\n\n{first_message[:500]}",
                config=types.GenerateContentConfig(
                    max_output_tokens=30,
                    temperature=0.3,
                ),
            )
        )
        title = response.text.strip().strip('"\'').strip()
        return title[:80] if title else "New Chat"
    except Exception:
        return first_message[:50].strip() + "..." if len(first_message) > 50 else first_message


async def extract_memory_from_conversation(
    messages: list[dict],
    existing_memory: list[dict],
) -> list[dict]:
    """Extract important facts from conversation to save to memory."""
    try:
        client = get_gemini_client()
        convo_text = "\n".join(
            f"{m['role'].upper()}: {m['content'][:500]}"
            for m in messages[-10:]  # Last 10 messages
        )
        existing_keys = [m["key"] for m in existing_memory]
        existing_str = "\n".join(existing_keys) if existing_keys else "None"

        prompt = f"""Review this conversation and extract important facts worth remembering for future sessions.

RULES - follow strictly:
- Save ONLY facts that the USER stated, asked about, or explicitly confirmed. Never save anything the ASSISTANT said, suggested, or generated.
- Do not save: assistant explanations, assistant suggestions, assistant summaries, assistant opinions, or any content that originated from the assistant.
- Do not save: trivial facts, obvious statements, greetings, or conversational filler.
- Only save: concrete business facts the user shared (company names, preferences, contact info, product details, pricing decisions, etc.).
- If the user did not share any new factual information worth remembering, return [].

Existing memory keys (don't duplicate): {existing_str}

Conversation:
{convo_text}

Return a JSON array of memory items. Each item: {{"key": "short_key", "value": "fact to remember", "category": "business|product|preference|contact|other", "importance": 0.1-1.0}}

Return [] if nothing meets the criteria. Return ONLY valid JSON."""

        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=settings.GEMINI_FAST_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(max_output_tokens=1024, temperature=0.2),
            )
        )
        text = response.text.strip()
        # Extract JSON from response
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        return []
    except Exception as e:
        logger.warning(f"Memory extraction failed: {e}")
        return []


async def process_training_document(
    file_path: str,
    file_type: str,
    original_filename: str,
    document_name: str,
) -> dict:
    """
    Fully analyze a training document and extract all knowledge.
    Returns processed_content, summary, key_facts, structured_data.
    Uses higher extraction limits so CSV/Excel/PDF retain as much data as possible.
    """
    try:
        raw_content = await process_uploaded_file(
            file_path,
            file_type,
            original_filename,
            max_csv_rows=2000,
            max_excel_rows=2000,
            max_pdf_pages=200,
        )

        if not raw_content or raw_content.startswith("[Error") or raw_content.startswith("[File not"):
            return {
                "success": False,
                "error": raw_content,
                "processed_content": "",
                "summary": "",
                "key_facts": [],
                "structured_data": "",
            }

        client = get_gemini_client()
        content_cap = 120000

        analysis_prompt = f"""You are analyzing a business document for Eagle Chair, a premium B2B chair manufacturer.

Document: {document_name} ({file_type})

Instructions:
- RETAIN EVERYTHING. Do not summarize away data. For pricing sheets, CSV, or Excel: every product, model number, price, and row is a key fact.
- For catalog PDFs: extract every product name, model number, dimension, price, and spec from text and tables. Some content may be in images; extract all text and tables you have.
- Key Facts: list EVERY fact, number, price, product code, contact, spec — one list item per fact. No limit. Include every row/product if it's tabular data.
- Structured Data: reproduce ALL tables in full markdown (every row). For CSV/Excel this is the full dataset in markdown. Do not truncate.

Content:
{raw_content[:content_cap]}

Output valid JSON only:
{{
  "summary": "2-3 paragraph overview of what this document contains",
  "key_facts": ["every", "single", "fact", "price", "product", "..."],
  "structured_data": "full markdown tables, every row, no truncation",
  "insights": ["optional short insights"]
}}"""

        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=analysis_prompt,
                config=types.GenerateContentConfig(max_output_tokens=65536, temperature=0.1),
            )
        )

        analysis_text = response.text.strip()
        match = re.search(r"\{.*\}", analysis_text, re.DOTALL)
        analysis = {}
        if match:
            try:
                analysis = json.loads(match.group())
            except json.JSONDecodeError:
                analysis = {"summary": analysis_text, "key_facts": []}

        return {
            "success": True,
            "processed_content": raw_content,
            "summary": analysis.get("summary", ""),
            "key_facts": analysis.get("key_facts", []),
            "structured_data": analysis.get("structured_data", ""),
            "insights": analysis.get("insights", []),
        }

    except Exception as e:
        logger.error(f"Training document processing failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "processed_content": "",
            "summary": "",
            "key_facts": [],
            "structured_data": "",
        }


# ─────────────────────────────────────────────────────────────────────────────
# Database Query Tool (for EagleChair data)
# ─────────────────────────────────────────────────────────────────────────────

async def get_eaglechair_context(db: AsyncSession) -> str:
    """Get a brief overview of current EagleChair data for AI context."""
    from sqlalchemy import func as sa_func

    from backend.models.chair import Category, Chair
    from backend.models.company import Company, CompanyStatus
    from backend.models.quote import Quote

    try:
        async def count(q):
            return (await db.execute(q)).scalar() or 0

        products = await count(select(sa_func.count()).select_from(Chair).where(Chair.is_active.is_(True)))
        companies = await count(
            select(sa_func.count()).select_from(Company).where(Company.status == CompanyStatus.ACTIVE)
        )
        quotes = await count(
            select(sa_func.count()).select_from(Quote)
            .where(Quote.created_at >= datetime.utcnow() - timedelta(days=30))
        )
        categories = await count(select(sa_func.count()).select_from(Category))
        return (
            f"Current EagleChair Data: {products} active products, {companies} active companies, "
            f"{quotes} quotes in last 30 days, {categories} categories."
        )
    except Exception as e:
        logger.debug(f"Could not fetch EagleChair context: {e}")
        return ""


async def fetch_valid_reference_ids() -> str:
    """
    Fetch all valid category, subcategory, family, finish, upholstery, and color IDs
    from the live database. Used to inject into system prompt so the AI only uses
    IDs that actually exist when creating/editing products.
    """
    try:
        async with AsyncSessionLocal() as db:
            lines = ["## Valid Reference IDs (use ONLY these when creating or editing products)"]
            lines.append("NEVER use category_id, subcategory_id, family_id, finish_id, upholstery_id, or color_id unless it appears below. Edits with invalid IDs will fail.")
            lines.append("")

            r = await db.execute(text(
                "SELECT id, name, slug FROM categories WHERE is_active = true ORDER BY display_order, name"
            ))
            cats = r.fetchall()
            lines.append("### Categories (category_id)")
            for c in cats:
                lines.append(f"- {c.name}: id={c.id}")
            lines.append("")

            r = await db.execute(text(
                "SELECT id, name, category_id FROM product_subcategories WHERE is_active = true ORDER BY display_order, name"
            ))
            subcats = r.fetchall()
            cat_map = {c.id: c.name for c in cats}
            if subcats:
                lines.append("### Subcategories (subcategory_id)")
                for s in subcats:
                    lines.append(f"- {s.name}: id={s.id} (category: {cat_map.get(s.category_id, '?')})")
                lines.append("")

            r = await db.execute(text(
                "SELECT id, name, category_id FROM product_families WHERE is_active = true ORDER BY display_order, name"
            ))
            families = r.fetchall()
            if families:
                lines.append("### Product Families (family_id)")
                for f in families:
                    lines.append(f"- {f.name}: id={f.id} (category: {cat_map.get(f.category_id, '?')})")
                lines.append("")

            r = await db.execute(text(
                "SELECT id, name, finish_code FROM finishes WHERE is_active = true ORDER BY display_order, name"
            ))
            finishes = r.fetchall()
            lines.append("### Finishes (finish_id)")
            for f in finishes:
                lines.append(f"- {f.name}: id={f.id}")
            lines.append("")

            r = await db.execute(text(
                "SELECT id, name, material_code FROM upholsteries WHERE is_active = true ORDER BY display_order, name"
            ))
            upholsteries = r.fetchall()
            lines.append("### Upholsteries (upholstery_id)")
            for u in upholsteries:
                lines.append(f"- {u.name}: id={u.id}")
            lines.append("")

            r = await db.execute(text(
                "SELECT id, name, color_code FROM colors WHERE is_active = true ORDER BY display_order, name"
            ))
            colors = r.fetchall()
            lines.append("### Colors (color_id)")
            for c in colors:
                lines.append(f"- {c.name}: id={c.id}")
            lines.append("")

            return "\n".join(lines)
    except Exception as e:
        logger.error(f"Failed to fetch valid reference IDs: {e}")
        return ""


async def fetch_product_catalog() -> str:
    """
    Fetch the full EagleChair product catalog from the database and format as markdown.
    Called on-demand when the AI needs catalog information.
    """
    try:
        async with AsyncSessionLocal() as db:
            lines = [
                "# Eagle Chair — Live Product Catalog\n",
                "## Product Naming & Units",
                "- Base model: 4 digits (e.g., 5242, 6018). Suffixes: P, PB, WB, BX. Dashes optional (5242-P = 5242P).",
                "- Variations: sku = full model (e.g., 5242PBX). Usually share base model with their product.",
                "- Dimensions: inches. Weight: lbs. Upholstery amount: yards. Prices: dollars (displayed from cents).\n",
            ]

            # ── Categories ──────────────────────────────────────────────────
            r = await db.execute(text(
                "SELECT id, name, slug, parent_id FROM categories WHERE is_active = true ORDER BY display_order"
            ))
            cats = r.fetchall()
            cat_map = {c.id: c.name for c in cats}

            lines.append("## Categories")
            for c in [c for c in cats if not c.parent_id]:
                lines.append(f"- **{c.name}** (id:{c.id}, slug:{c.slug})")
                for ch in [ch for ch in cats if ch.parent_id == c.id]:
                    lines.append(f"  - {ch.name} (id:{ch.id})")
            lines.append("")

            # ── Subcategories ────────────────────────────────────────────────
            r = await db.execute(text(
                "SELECT id, name, slug, category_id FROM product_subcategories WHERE is_active = true ORDER BY display_order"
            ))
            subcats = r.fetchall()
            subcat_map = {s.id: s.name for s in subcats}

            if subcats:
                lines.append("## Subcategories")
                for s in subcats:
                    lines.append(f"- {s.name} (id:{s.id}, category:{cat_map.get(s.category_id, '?')})")
                lines.append("")

            # ── Families ─────────────────────────────────────────────────────
            r = await db.execute(text(
                "SELECT id, name, slug, category_id, subcategory_id, overview_text, is_featured "
                "FROM product_families WHERE is_active = true ORDER BY display_order"
            ))
            families = r.fetchall()
            family_map = {f.id: f.name for f in families}

            lines.append("## Product Families")
            lines.append("| ID | Name | Category | Subcategory | Featured | Overview |")
            lines.append("|---|---|---|---|---|---|")
            for f in families:
                cat_name = cat_map.get(f.category_id, "-")
                subcat_name = subcat_map.get(f.subcategory_id, "-") if f.subcategory_id else "-"
                featured = "Yes" if f.is_featured else "No"
                overview = (f.overview_text or "")[:80].replace("|", "/").replace("\n", " ")
                lines.append(f"| {f.id} | {f.name} | {cat_name} | {subcat_name} | {featured} | {overview} |")
            lines.append("")

            # ── Finishes ─────────────────────────────────────────────────────
            r = await db.execute(text(
                "SELECT id, name, finish_code, finish_type, grade, additional_cost "
                "FROM finishes WHERE is_active = true ORDER BY display_order"
            ))
            finishes = r.fetchall()
            finish_map = {f.id: f.name for f in finishes}

            lines.append("## Finishes (wood stains, paints, metal coatings)")
            lines.append("| ID | Name | Code | Type | Grade | Additional Cost |")
            lines.append("|---|---|---|---|---|---|")
            for f in finishes:
                cost = f"${f.additional_cost / 100:.2f}" if f.additional_cost else "$0.00"
                lines.append(f"| {f.id} | {f.name} | {f.finish_code or '-'} | {f.finish_type or '-'} | {f.grade} | {cost} |")
            lines.append("")

            # ── Upholsteries ─────────────────────────────────────────────────
            r = await db.execute(text(
                "SELECT id, name, material_code, material_type, grade, "
                "additional_cost, grade_a_cost, grade_b_cost, grade_c_cost, premium_cost "
                "FROM upholsteries WHERE is_active = true ORDER BY display_order"
            ))
            upholsteries = r.fetchall()
            upholstery_map = {u.id: u.name for u in upholsteries}

            lines.append("## Upholsteries (fabrics, vinyls, leathers)")
            lines.append("| ID | Name | Code | Type | Grade | Base | Gr.A | Gr.B | Gr.C | Premium |")
            lines.append("|---|---|---|---|---|---|---|---|---|---|")
            def fmt_cents(v: int) -> str:
                return f"${v / 100:.2f}" if v else "$0.00"

            for u in upholsteries:
                lines.append(
                    f"| {u.id} | {u.name} | {u.material_code or '-'} | {u.material_type} "
                    f"| {u.grade or '-'} | {fmt_cents(u.additional_cost)} "
                    f"| {fmt_cents(u.grade_a_cost)} | {fmt_cents(u.grade_b_cost)} "
                    f"| {fmt_cents(u.grade_c_cost)} | {fmt_cents(u.premium_cost)} |"
                )
            lines.append("")

            # ── Colors ───────────────────────────────────────────────────────
            r = await db.execute(text(
                "SELECT id, name, color_code, hex_value, category FROM colors WHERE is_active = true ORDER BY display_order"
            ))
            colors = r.fetchall()
            color_map = {c.id: c.name for c in colors}

            lines.append("## Colors")
            lines.append("| ID | Name | Code | Hex | Category |")
            lines.append("|---|---|---|---|---|")
            for c in colors:
                lines.append(f"| {c.id} | {c.name} | {c.color_code or '-'} | {c.hex_value or '-'} | {c.category or '-'} |")
            lines.append("")

            # ── Products ─────────────────────────────────────────────────────
            r = await db.execute(text("""
                SELECT id, model_number, model_suffix, suffix_description, name,
                       category_id, subcategory_id, family_id, base_price, msrp,
                       width, depth, height, seat_height, weight, upholstery_amount,
                       frame_material, features, stock_status, is_featured, is_new, is_outdoor_suitable,
                       recommended_use, minimum_order_quantity, lead_time_days,
                       ada_compliant, flame_certifications, warranty_info
                FROM chairs WHERE is_active = true ORDER BY display_order, model_number
            """))
            products = r.fetchall()

            lines.append(f"## Products ({len(products)} active)")
            lines.append("| ID | Model | Suffix | Name | Category | Family | Price | MSRP | W×D×H (in) | Seat H | Weight (lb) | Uph Yds | Frame | Stock | Features |")
            lines.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
            for p in products:
                cat_name = cat_map.get(p.category_id, f"?{p.category_id}")
                fam_name = family_map.get(p.family_id, "-") if p.family_id else "-"
                price = f"${p.base_price / 100:.2f}" if p.base_price else "-"
                msrp = f"${p.msrp / 100:.2f}" if p.msrp else "-"
                dims = f"{p.width or '?'}×{p.depth or '?'}×{p.height or '?'}"
                seat_h = str(p.seat_height) if p.seat_height else "-"
                weight_str = f"{p.weight}" if p.weight is not None else "-"
                uph_str = f"{p.upholstery_amount}" if p.upholstery_amount is not None else "-"
                features_str = ""
                if p.features:
                    try:
                        feats = json.loads(p.features) if isinstance(p.features, str) else p.features
                        features_str = ", ".join(feats) if isinstance(feats, list) else str(feats)
                    except Exception:
                        features_str = str(p.features)
                lines.append(
                    f"| {p.id} | {p.model_number} | {p.model_suffix or ''} | {p.name} "
                    f"| {cat_name} | {fam_name} "
                    f"| {price} | {msrp} | {dims} | {seat_h} | {weight_str} | {uph_str} "
                    f"| {p.frame_material or '-'} | {p.stock_status} | {features_str[:50]} |"
                )
            lines.append("")

            # ── Variations ───────────────────────────────────────────────────
            r = await db.execute(text("""
                SELECT id, product_id, sku, name, finish_id, upholstery_id, color_id,
                       price_adjustment, stock_status, is_available,
                       width, depth, height, seat_height, weight, upholstery_amount
                FROM product_variations WHERE is_available = true ORDER BY product_id, display_order
            """))
            variations = r.fetchall()

            lines.append(f"## Product Variations ({len(variations)} available)")
            lines.append("| ID | SKU | Product ID | Name | Finish | Upholstery | Color | Price Adj | W×D×H | Weight | Uph Yds |")
            lines.append("|---|---|---|---|---|---|---|---|---|---|---|")
            for v in variations:
                finish_name = finish_map.get(v.finish_id, "-") if v.finish_id else "-"
                uph_name = upholstery_map.get(v.upholstery_id, "-") if v.upholstery_id else "-"
                color_name = color_map.get(v.color_id, "-") if v.color_id else "-"
                adj = f"${v.price_adjustment / 100:+.2f}" if v.price_adjustment else "$0.00"
                dims = ""
                if v.width or v.depth or v.height:
                    dims = f"{v.width or '?'}×{v.depth or '?'}×{v.height or '?'}"
                else:
                    dims = "-"
                weight_str = f"{v.weight}" if v.weight is not None else "-"
                uph_str = f"{v.upholstery_amount}" if v.upholstery_amount is not None else "-"
                lines.append(
                    f"| {v.id} | {v.sku} | {v.product_id} | {v.name or ''} "
                    f"| {finish_name} | {uph_name} | {color_name} | {adj} | {dims} | {weight_str} | {uph_str} |"
                )
            lines.append("")

            return "\n".join(lines)

    except Exception as e:
        logger.error(f"Failed to fetch product catalog: {e}")
        return f"Error fetching product catalog: {str(e)}"


async def search_training_data(query: str, max_results: int = 20, fuzzy_threshold: int = 50) -> dict:
    """
    Search ALL training documents using fuzzy matching over key_facts, structured_data, and summary.
    Use when the user asks about models, products, pricing, or any info that might be in training docs.
    """
    if not query or not query.strip():
        return {"error": "Empty search query", "results": [], "count": 0}
    q = query.strip().lower()
    scored: list[dict] = []
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AITrainingDocument)
                .where(
                    AITrainingDocument.is_active == True,
                    AITrainingDocument.status == TrainingStatus.COMPLETED,
                )
                .order_by(AITrainingDocument.created_at.desc())
            )
            docs = result.scalars().all()
        for doc in docs:
            matched_facts: list[str] = []
            matched_chunks: list[str] = []
            best_score = 0
            key_facts = doc.key_facts or []
            for fact in key_facts:
                if not isinstance(fact, str):
                    fact = str(fact)
                score = fuzz.partial_ratio(q, fact.lower())
                if score >= fuzzy_threshold:
                    matched_facts.append(fact[:300])
                    best_score = max(best_score, score)
            summary = (doc.summary or "").strip()
            if summary:
                score = fuzz.partial_ratio(q, summary.lower())
                if score >= fuzzy_threshold:
                    matched_chunks.append(f"[Summary] {summary[:400]}")
                    best_score = max(best_score, score)
            structured = (doc.structured_data or "").strip()
            if structured:
                for line in structured.split("\n"):
                    if len(line) > 20 and fuzz.partial_ratio(q, line.lower()) >= fuzzy_threshold:
                        matched_chunks.append(line[:400])
                        best_score = max(best_score, fuzz.partial_ratio(q, line.lower()))
            if best_score > 0:
                scored.append({
                    "doc_name": doc.name,
                    "matched_facts": matched_facts[:10],
                    "matched_chunks": matched_chunks[:5],
                    "score": best_score,
                })
        scored.sort(key=lambda x: x["score"], reverse=True)
        results = scored[:max_results]
        return {"query": query, "results": results, "count": len(results)}
    except Exception as e:
        logger.error(f"Training data search failed: {e}")
        return {"error": str(e), "query": query, "results": [], "count": 0}


_MODEL_PATTERN = re.compile(r"\b(\d{3,5}[A-Za-z]*)\b")


def _extract_model_numbers_from_text(text: str) -> set[str]:
    if not text:
        return set()
    found = set()
    for m in _MODEL_PATTERN.findall(text):
        found.add(m.upper())
    return found


async def get_training_vs_catalog_overview() -> dict:
    """
    Compare model numbers in training data vs live catalog.
    Returns in_training_only, in_catalog_only, in_both for easy comparison.
    """
    training_models: set[str] = set()
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AITrainingDocument)
                .where(
                    AITrainingDocument.is_active == True,
                    AITrainingDocument.status == TrainingStatus.COMPLETED,
                )
            )
            docs = result.scalars().all()
        for doc in docs:
            for fact in (doc.key_facts or []):
                training_models.update(_extract_model_numbers_from_text(str(fact)))
            training_models.update(_extract_model_numbers_from_text(doc.structured_data or ""))
            training_models.update(_extract_model_numbers_from_text(doc.summary or ""))
    except Exception as e:
        logger.error(f"Failed to extract training models: {e}")
        return {"error": str(e), "in_training_only": [], "in_catalog_only": [], "in_both": []}
    catalog_models: set[str] = set()
    try:
        async with AsyncSessionLocal() as db:
            r = await db.execute(
                text("SELECT model_number, model_suffix FROM chairs WHERE is_active = true")
            )
            for row in r.fetchall():
                full = f"{row.model_number}{row.model_suffix or ''}"
                catalog_models.add(full.upper())
                catalog_models.add((row.model_number or "").upper())
    except Exception as e:
        logger.error(f"Failed to fetch catalog models: {e}")
        return {"error": str(e), "in_training_only": [], "in_catalog_only": [], "in_both": []}
    in_both = sorted(training_models & catalog_models)
    in_training_only = sorted(training_models - catalog_models)
    in_catalog_only = sorted(catalog_models - training_models)
    return {
        "in_training_only": in_training_only[:100],
        "in_catalog_only": in_catalog_only[:100],
        "in_both": in_both[:100],
        "count_training_only": len(in_training_only),
        "count_catalog_only": len(in_catalog_only),
        "count_both": len(in_both),
    }


def _is_broad_catalog_query(query: str) -> bool:
    q = (query or "").strip().lower()
    broad = ("all", "*", "everything", "list all", "show all", "full catalog", "entire catalog", "")
    return q in broad or q in ("all models", "all products")


async def search_catalog(query: str, max_results: int = 50) -> dict:
    """
    Search the Eagle Chair catalog for a term. Searches families, products, variations,
    finishes, upholsteries, colors, categories. Case-insensitive partial match.
    For broad queries (all, *, everything), returns full catalog overview.
    """
    q = (query or "").strip()
    if _is_broad_catalog_query(q):
        try:
            async with AsyncSessionLocal() as db:
                families_r = await db.execute(text("""
                    SELECT pf.id, pf.name, pf.slug, c.name as category_name,
                           (SELECT COUNT(*) FROM chairs ch WHERE ch.family_id = pf.id AND ch.is_active) as product_count
                    FROM product_families pf
                    LEFT JOIN categories c ON pf.category_id = c.id
                    WHERE pf.is_active = true ORDER BY pf.display_order
                """))
                families_overview = []
                for row in families_r.fetchall():
                    families_overview.append({
                        "id": row.id, "name": row.name, "slug": row.slug,
                        "category": row.category_name, "product_count": row.product_count or 0,
                    })
                models_r = await db.execute(text("""
                    SELECT model_number, model_suffix, name, base_price FROM chairs
                    WHERE is_active = true ORDER BY display_order, model_number
                """))
                all_models = []
                for row in models_r.fetchall():
                    full_model = f"{row.model_number}{row.model_suffix or ''}"
                    all_models.append({
                        "model": full_model, "name": row.name,
                        "price": f"${row.base_price / 100:.2f}" if row.base_price else None,
                    })
                return {
                    "query": query,
                    "broad_overview": True,
                    "families": families_overview,
                    "all_models": all_models[:max_results * 2],
                    "total_products": len(all_models),
                    "products": [], "variations": [], "finishes": [], "upholsteries": [], "colors": [], "categories": [],
                }
        except Exception as e:
            logger.error(f"Broad catalog fetch failed: {e}")
            return {"error": str(e), "query": query, "families": [], "products": [], "variations": [], "finishes": [], "upholsteries": [], "colors": [], "categories": []}
    term = f"%{q}%"
    result = {"query": query, "families": [], "products": [], "variations": [], "finishes": [], "upholsteries": [], "colors": [], "categories": []}
    try:
        async with AsyncSessionLocal() as db:
            r = await db.execute(
                text("""
                    SELECT pf.id, pf.name, pf.slug, pf.category_id, pf.subcategory_id,
                           pf.overview_text, pf.is_featured,
                           pf.family_image, pf.banner_image_url,
                           c.name as category_name, sc.name as subcategory_name
                    FROM product_families pf
                    LEFT JOIN categories c ON pf.category_id = c.id
                    LEFT JOIN product_subcategories sc ON pf.subcategory_id = sc.id
                    WHERE pf.is_active = true
                    AND (LOWER(pf.name) LIKE LOWER(:t) OR LOWER(pf.slug) LIKE LOWER(:t)
                         OR (pf.overview_text IS NOT NULL AND LOWER(pf.overview_text) LIKE LOWER(:t)))
                    ORDER BY pf.display_order
                    LIMIT :lim
                """),
                {"t": term, "lim": max_results},
            )
            for row in r.fetchall():
                result["families"].append({
                    "id": row.id, "name": row.name, "slug": row.slug,
                    "category_id": row.category_id, "subcategory_id": row.subcategory_id,
                    "category": row.category_name, "subcategory": row.subcategory_name,
                    "featured": row.is_featured, "overview": (row.overview_text or "")[:200],
                    "family_image": row.family_image,
                    "banner_image_url": row.banner_image_url,
                })

            r = await db.execute(
                text("""
                    SELECT ch.id, ch.model_number, ch.model_suffix, ch.name, ch.base_price, ch.msrp,
                           ch.category_id, ch.subcategory_id, ch.family_id,
                           pf.name as family_name, c.name as category_name
                    FROM chairs ch
                    LEFT JOIN product_families pf ON ch.family_id = pf.id
                    LEFT JOIN categories c ON ch.category_id = c.id
                    WHERE ch.is_active = true
                    AND (LOWER(ch.model_number) LIKE LOWER(:t) OR LOWER(COALESCE(ch.model_suffix,'')) LIKE LOWER(:t)
                         OR LOWER(ch.name) LIKE LOWER(:t) OR (pf.name IS NOT NULL AND LOWER(pf.name) LIKE LOWER(:t)))
                    ORDER BY ch.display_order
                    LIMIT :lim
                """),
                {"t": term, "lim": max_results},
            )
            for row in r.fetchall():
                result["products"].append({
                    "id": row.id, "model": row.model_number, "suffix": row.model_suffix or "",
                    "name": row.name, "family": row.family_name, "category": row.category_name,
                    "category_id": row.category_id, "subcategory_id": row.subcategory_id, "family_id": row.family_id,
                    "price": f"${row.base_price / 100:.2f}" if row.base_price else None,
                    "msrp": f"${row.msrp / 100:.2f}" if row.msrp else None,
                })

            r = await db.execute(
                text("""
                    SELECT pv.id, pv.sku, pv.product_id, pv.name, pv.price_adjustment,
                           f.name as finish_name, u.name as upholstery_name, col.name as color_name
                    FROM product_variations pv
                    LEFT JOIN finishes f ON pv.finish_id = f.id
                    LEFT JOIN upholsteries u ON pv.upholstery_id = u.id
                    LEFT JOIN colors col ON pv.color_id = col.id
                    WHERE pv.is_available = true
                    AND (LOWER(pv.sku) LIKE LOWER(:t) OR LOWER(COALESCE(pv.name,'')) LIKE LOWER(:t)
                         OR (f.name IS NOT NULL AND LOWER(f.name) LIKE LOWER(:t))
                         OR (u.name IS NOT NULL AND LOWER(u.name) LIKE LOWER(:t))
                         OR (col.name IS NOT NULL AND LOWER(col.name) LIKE LOWER(:t)))
                    ORDER BY pv.product_id
                    LIMIT :lim
                """),
                {"t": term, "lim": max_results},
            )
            for row in r.fetchall():
                result["variations"].append({
                    "id": row.id, "sku": row.sku, "product_id": row.product_id,
                    "name": row.name or "", "finish": row.finish_name, "upholstery": row.upholstery_name,
                    "color": row.color_name,
                    "price_adj": f"${row.price_adjustment / 100:+.2f}" if row.price_adjustment else "$0",
                })

            r = await db.execute(
                text("""
                    SELECT id, name, finish_code, finish_type, grade, additional_cost, image_url
                    FROM finishes WHERE is_active = true
                    AND (LOWER(name) LIKE LOWER(:t) OR LOWER(COALESCE(finish_code,'')) LIKE LOWER(:t) OR LOWER(COALESCE(finish_type,'')) LIKE LOWER(:t))
                    ORDER BY display_order LIMIT :lim
                """),
                {"t": term, "lim": max_results},
            )
            for row in r.fetchall():
                result["finishes"].append({
                    "id": row.id, "name": row.name, "code": row.finish_code or "-",
                    "type": row.finish_type or "-", "grade": row.grade,
                    "cost": f"${row.additional_cost / 100:.2f}" if row.additional_cost else "$0",
                    "image_url": row.image_url,
                })

            r = await db.execute(
                text("""
                    SELECT id, name, material_code, material_type, grade, additional_cost, image_url, swatch_image_url
                    FROM upholsteries WHERE is_active = true
                    AND (LOWER(name) LIKE LOWER(:t) OR LOWER(COALESCE(material_code,'')) LIKE LOWER(:t) OR LOWER(material_type) LIKE LOWER(:t))
                    ORDER BY display_order LIMIT :lim
                """),
                {"t": term, "lim": max_results},
            )
            for row in r.fetchall():
                result["upholsteries"].append({
                    "id": row.id, "name": row.name, "code": row.material_code or "-",
                    "type": row.material_type, "grade": row.grade or "-",
                    "cost": f"${row.additional_cost / 100:.2f}" if row.additional_cost else "$0",
                    "image_url": row.image_url,
                    "swatch_image_url": row.swatch_image_url,
                })

            r = await db.execute(
                text("""
                    SELECT id, name, color_code, hex_value, category, image_url
                    FROM colors WHERE is_active = true
                    AND (LOWER(name) LIKE LOWER(:t) OR LOWER(COALESCE(color_code,'')) LIKE LOWER(:t) OR (category IS NOT NULL AND LOWER(category) LIKE LOWER(:t)))
                    ORDER BY display_order LIMIT :lim
                """),
                {"t": term, "lim": max_results},
            )
            for row in r.fetchall():
                result["colors"].append({
                    "id": row.id, "name": row.name, "code": row.color_code or "-",
                    "hex": row.hex_value or "-", "category": row.category or "-",
                    "image_url": row.image_url,
                })

            r = await db.execute(
                text("""
                    SELECT id, name, slug, parent_id FROM categories
                    WHERE is_active = true AND (LOWER(name) LIKE LOWER(:t) OR LOWER(slug) LIKE LOWER(:t))
                    ORDER BY display_order LIMIT :lim
                """),
                {"t": term, "lim": max_results},
            )
            for row in r.fetchall():
                result["categories"].append({"id": row.id, "name": row.name, "slug": row.slug,
                                            "parent_id": row.parent_id})

        return result
    except Exception as e:
        logger.error(f"Catalog search failed: {e}")
        return {"error": str(e), "query": query, "families": [], "products": [], "variations": [], "finishes": [], "upholsteries": [], "colors": [], "categories": []}


async def get_product_details(product_ids: list | None = None, model_numbers: list | None = None) -> dict:
    """
    Fetch full product details (dimensions, features, variations, etc.).
    Accepts product_ids (internal IDs) or model_numbers (e.g. 5242, 5242P, 6018WB) — prefer model_numbers when user mentions a model.
    """
    ids = []
    if product_ids:
        for pid in product_ids:
            try:
                ids.append(int(pid))
            except (TypeError, ValueError):
                continue
    if model_numbers:
        try:
            async with AsyncSessionLocal() as db:
                for term in [(m or "").strip() for m in model_numbers if m][:10]:
                    if not term:
                        continue
                    r = await db.execute(
                        text("""
                            SELECT id FROM chairs WHERE is_active = true
                            AND (model_number = :t OR CONCAT(model_number, COALESCE(model_suffix,'')) = :t)
                            ORDER BY model_suffix
                            LIMIT 1
                        """),
                        {"t": term},
                    )
                    row = r.fetchone()
                    if row and row.id not in ids:
                        ids.append(row.id)
                    if not row:
                        rv = await db.execute(
                            text("""
                                SELECT product_id FROM product_variations WHERE is_available = true
                                AND sku = :t LIMIT 1
                            """),
                            {"t": term},
                        )
                        vrow = rv.fetchone()
                        if vrow and vrow.product_id not in ids:
                            ids.append(vrow.product_id)
        except Exception as e:
            logger.warning(f"Model number lookup failed: {e}")
    if not ids:
        return {"error": "No product IDs or model numbers provided", "products": []}
    ids = ids[:10]
    try:
        async with AsyncSessionLocal() as db:
            products = []
            for pid in ids:
                r = await db.execute(
                    text("""
                        SELECT ch.id, ch.model_number, ch.model_suffix, ch.suffix_description, ch.name, ch.slug as product_slug,
                               ch.short_description, ch.full_description,
                               ch.category_id, ch.subcategory_id, ch.family_id,
                               ch.base_price, ch.msrp, ch.width, ch.depth, ch.height, ch.seat_height,
                               ch.weight, ch.upholstery_amount, ch.frame_material, ch.features,
                               ch.stock_status, ch.is_featured, ch.is_new, ch.is_outdoor_suitable,
                               ch.recommended_use, ch.minimum_order_quantity, ch.lead_time_days,
                               ch.ada_compliant, ch.flame_certifications, ch.warranty_info,
                               ch.primary_image_url, ch.hover_images,
                               pf.name as family_name, pf.slug as family_slug, pf.family_image, pf.banner_image_url,
                               c.name as category_name, c.slug as category_slug, c.parent_id as category_parent_id,
                               parent_cat.slug as parent_category_slug,
                               sc.name as subcategory_name, sc.slug as subcategory_slug
                        FROM chairs ch
                        LEFT JOIN product_families pf ON ch.family_id = pf.id
                        LEFT JOIN categories c ON ch.category_id = c.id
                        LEFT JOIN categories parent_cat ON c.parent_id = parent_cat.id
                        LEFT JOIN product_subcategories sc ON ch.subcategory_id = sc.id
                        WHERE ch.id = :pid AND ch.is_active = true
                    """),
                    {"pid": pid},
                )
                row = r.fetchone()
                if not row:
                    products.append({"id": pid, "error": "Product not found"})
                    continue
                feats = []
                if row.features:
                    try:
                        f = json.loads(row.features) if isinstance(row.features, str) else row.features
                        feats = f if isinstance(f, list) else [str(f)]
                    except Exception:
                        feats = [str(row.features)]
                flame = row.flame_certifications
                if isinstance(flame, str):
                    try:
                        flame = json.loads(flame) if flame else []
                    except Exception:
                        flame = [flame] if flame else []
                hover_urls = []
                if row.hover_images:
                    try:
                        h = json.loads(row.hover_images) if isinstance(row.hover_images, str) else row.hover_images
                        if isinstance(h, list):
                            for x in h:
                                if isinstance(x, str):
                                    hover_urls.append(x)
                                elif isinstance(x, dict) and x.get("url"):
                                    hover_urls.append(x["url"])
                    except Exception:
                        pass
                image_urls = [row.primary_image_url] if row.primary_image_url else []
                image_urls.extend(hover_urls[:2])
                product_slug = row.product_slug or str(row.id)
                cat_slug = row.category_slug or "chairs"
                parent_slug = row.parent_category_slug
                subcat_slug = row.subcategory_slug
                if parent_slug and cat_slug:
                    product_url = f"/products/{parent_slug}/{cat_slug}/{product_slug}"
                elif cat_slug:
                    product_url = f"/products/{cat_slug}/uncategorized/{product_slug}"
                else:
                    product_url = f"/products/{product_slug}"
                admin_edit_url = f"/admin/catalog?edit={row.id}"
                products.append({
                    "id": row.id,
                    "model": row.model_number,
                    "suffix": row.model_suffix or "",
                    "full_model": f"{row.model_number}{row.model_suffix or ''}".strip(),
                    "name": row.name,
                    "short_description": row.short_description,
                    "full_description": row.full_description,
                    "category_id": row.category_id,
                    "subcategory_id": row.subcategory_id,
                    "family_id": row.family_id,
                    "family": row.family_name,
                    "family_slug": row.family_slug,
                    "product_url": product_url,
                    "admin_edit_url": admin_edit_url,
                    "category": row.category_name,
                    "subcategory": row.subcategory_name,
                    "suffix_description": row.suffix_description,
                    "base_price": f"${row.base_price / 100:.2f}" if row.base_price else None,
                    "msrp": f"${row.msrp / 100:.2f}" if row.msrp else None,
                    "dimensions": f"{row.width or '?'}×{row.depth or '?'}×{row.height or '?'} in" if (row.width or row.depth or row.height) else None,
                    "seat_height": f"{row.seat_height} in" if row.seat_height else None,
                    "weight": f"{row.weight} lbs" if row.weight else None,
                    "upholstery_amount": f"{row.upholstery_amount} yds" if row.upholstery_amount else None,
                    "frame_material": row.frame_material,
                    "features": feats,
                    "stock_status": row.stock_status,
                    "is_featured": row.is_featured,
                    "is_new": row.is_new,
                    "is_outdoor_suitable": row.is_outdoor_suitable,
                    "recommended_use": row.recommended_use,
                    "minimum_order_quantity": row.minimum_order_quantity,
                    "lead_time_days": row.lead_time_days,
                    "ada_compliant": row.ada_compliant,
                    "flame_certifications": flame,
                    "warranty_info": row.warranty_info,
                    "primary_image_url": row.primary_image_url,
                    "image_urls": image_urls[:3],
                    "family_image": row.family_image,
                    "family_banner_url": row.banner_image_url,
                    "category_slug": cat_slug,
                    "subcategory_slug": subcat_slug,
                })
                rv = await db.execute(
                    text("""
                        SELECT pv.id, pv.sku, pv.name, pv.price_adjustment, pv.primary_image_url as var_image_url,
                               f.name as finish_name, f.image_url as finish_image_url,
                               u.name as upholstery_name, u.swatch_image_url as upholstery_swatch_url, u.image_url as upholstery_image_url,
                               col.name as color_name, col.image_url as color_image_url
                        FROM product_variations pv
                        LEFT JOIN finishes f ON pv.finish_id = f.id
                        LEFT JOIN upholsteries u ON pv.upholstery_id = u.id
                        LEFT JOIN colors col ON pv.color_id = col.id
                        WHERE pv.product_id = :pid AND pv.is_available = true
                        ORDER BY pv.display_order, pv.sku
                    """),
                    {"pid": pid},
                )
                vars_list = []
                for v in rv.fetchall():
                    adj = f"${v.price_adjustment / 100:+.2f}" if v.price_adjustment else "$0"
                    vars_list.append({
                        "sku": v.sku,
                        "name": v.name or "",
                        "finish": v.finish_name,
                        "finish_image_url": v.finish_image_url,
                        "upholstery": v.upholstery_name,
                        "upholstery_image_url": v.upholstery_swatch_url or v.upholstery_image_url,
                        "color": v.color_name,
                        "color_image_url": v.color_image_url,
                        "variation_image_url": v.var_image_url,
                        "price_adjustment": adj,
                    })
                products[-1]["variations"] = vars_list
            return {"products": products}
    except Exception as e:
        logger.error(f"get_product_details failed: {e}")
        return {"error": str(e), "products": []}
