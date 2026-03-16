"""
AI Service - EagleChair Admin AI Assistant

Powered by Google Gemini with:
- Full streaming via WebSockets
- Web search via DuckDuckGo
- File analysis (PDF, CSV, images)
- Math tools via sympy
- Persistent memory
- RAG-style training data
- EagleChair DB query tools
"""

import asyncio
import io
import json
import logging
import math
import os
import re
import time
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

import httpx
import html2text
import pandas as pd
import pdfplumber
import sympy
from duckduckgo_search import DDGS
from google import genai
from google.genai import types
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from backend.core.config import settings
from backend.database.base import AsyncSessionLocal
from backend.services.ai_domain_knowledge import EAGLECHAIR_DOMAIN_KNOWLEDGE

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


def fetch_webpage(url: str, max_chars: int = 8000) -> dict:
    """Fetch and convert a webpage to markdown for AI reading."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; EagleChair-AI/1.0)",
            "Accept": "text/html,application/xhtml+xml",
        }
        with httpx.Client(timeout=15, follow_redirects=True) as client:
            resp = client.get(url, headers=headers)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "text/html" in content_type or "application/xhtml" in content_type:
                h = html2text.HTML2Text()
                h.ignore_links = False
                h.ignore_images = True
                h.body_width = 0
                md = h.handle(resp.text)
                # Compact whitespace
                md = re.sub(r"\n{3,}", "\n\n", md)
                return {
                    "url": url,
                    "content": md[:max_chars],
                    "truncated": len(md) > max_chars,
                }
            else:
                return {"url": url, "content": resp.text[:max_chars], "truncated": len(resp.text) > max_chars}
    except Exception as e:
        return {"url": url, "content": "", "error": str(e)}


def calculate(expression: str) -> dict:
    """Evaluate a mathematical expression using sympy for exact results."""
    try:
        # Safe evaluation with sympy
        expr = sympy.sympify(expression)
        result = sympy.simplify(expr)
        numeric = float(result.evalf()) if result.is_number else None
        return {
            "expression": expression,
            "result": str(result),
            "numeric": numeric,
        }
    except Exception as e:
        # Fallback to basic eval for simple arithmetic
        try:
            safe_expr = re.sub(r"[^0-9+\-*/().,%^ ]", "", expression)
            result = eval(safe_expr, {"__builtins__": {}}, {})  # noqa: S307
            return {"expression": expression, "result": str(result), "numeric": float(result)}
        except Exception:
            return {"expression": expression, "error": str(e)}


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

TOOL_DEFINITIONS = [
    types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="web_search",
                description="Search the web for current information using DuckDuckGo. Use this to find pricing data, industry news, product specs, competitor info, or any information not in your training data.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "query": types.Schema(
                            type=types.Type.STRING,
                            description="Search query. Be specific and concise.",
                        ),
                        "max_results": types.Schema(
                            type=types.Type.INTEGER,
                            description="Number of results to return (1-15, default 12)",
                        ),
                    },
                    required=["query"],
                ),
            ),
            types.FunctionDeclaration(
                name="fetch_webpage",
                description="Fetch and read the full content of a specific webpage URL. Use after web_search to get detailed info from a result.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "url": types.Schema(
                            type=types.Type.STRING,
                            description="The URL to fetch",
                        ),
                    },
                    required=["url"],
                ),
            ),
            types.FunctionDeclaration(
                name="calculate",
                description="Perform mathematical calculations, pricing math, percentages, unit conversions. Supports algebra, statistics formulas, and more.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "expression": types.Schema(
                            type=types.Type.STRING,
                            description="Mathematical expression to evaluate. E.g. '250 * 1.15' or 'sqrt(144)' or '(500 - 350) / 500 * 100'",
                        ),
                    },
                    required=["expression"],
                ),
            ),
            types.FunctionDeclaration(
                name="search_catalog",
                description=(
                    "Search the Eagle Chair catalog for a specific term. Searches product families, products, "
                    "variations, finishes, upholsteries, colors, categories. Use this FIRST when the user asks "
                    "about any product name, family name (e.g. Abruzzo, Alpine), model number, finish, upholstery, "
                    "or color. Returns only matching rows. Call this before saying you don't know."
                ),
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "query": types.Schema(
                            type=types.Type.STRING,
                            description="Search term: product/family name, model number, finish, upholstery, color, etc.",
                        ),
                    },
                    required=["query"],
                ),
            ),
            types.FunctionDeclaration(
                name="get_product_catalog",
                description=(
                    "Retrieve the complete Eagle Chair product catalog from the live database. "
                    "Returns all active products, variations, categories, families, finishes, upholsteries, colors. "
                    "Use when search_catalog returns nothing but you need full context, or when the user asks for "
                    "broad catalog info, pricing overview, or full structure."
                ),
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={},
                ),
            ),
        ]
    )
]


# ─────────────────────────────────────────────────────────────────────────────
# System Prompt Builder
# ─────────────────────────────────────────────────────────────────────────────

def build_system_prompt(memory_entries: list[dict], training_summaries: list[dict]) -> str:
    today = datetime.now().strftime("%B %d, %Y")

    memory_block = ""
    if memory_entries:
        memory_block = "\n\n## Persistent Memory\n" + "\n".join(
            f"- [{m.get('category', 'general')}] {m['key']}: {m['value']}"
            for m in memory_entries
        )

    training_block = ""
    if training_summaries:
        parts = []
        for t in training_summaries:
            block = f"### {t['name']}\n{t.get('summary', 'No summary available.')}"
            kf = t.get("key_facts") or []
            if kf:
                block += "\n\nKey facts (use these when answering):\n" + "\n".join(f"- {f}" for f in kf)
            sd = t.get("structured_data") or ""
            if sd.strip():
                block += "\n\nStructured data (tables/pricing — use in full when answering):\n" + sd
            parts.append(block)
        training_block = "\n\n## Trained Knowledge Base\n" + "\n\n".join(parts)

    return f"""You are the EagleChair AI Assistant — a highly intelligent, senior business analyst and operational expert for Eagle Chair, a premium B2B chair manufacturer.

Today's date: {today}

## Your Role
You assist the Eagle Chair admin team with:
- **Business Intelligence**: Analyzing quotes, revenue, company performance, pricing strategy
- **Product Analysis**: Understanding product specs, pricing, inventory, variations
- **Research**: Finding competitor pricing, industry trends, material costs, market data
- **Math & Calculations**: Pricing calculations, margin analysis, discount modeling, forecasting
- **Document Analysis**: Reading and interpreting uploaded PDFs, CSVs, pricing sheets
- **Data Processing**: Converting raw data into actionable insights

## CRITICAL: Search Before Saying "I Don't Know" — Never Assume or Guess
NEVER assume, guess, or infer product details (pricing, specs, availability, family membership, etc.). Always use search_catalog or get_product_catalog to get factual data.

NEVER say you don't know, have no information, or can't find something about products, families, variations, finishes, upholstery, colors, or catalog without FIRST:
1. Calling **search_catalog** with the user's term (e.g. "Abruzzo", "5242", "Alpine") — this searches families, products, variations, finishes, upholsteries, colors
2. If search_catalog returns nothing, calling **get_product_catalog** for the full catalog
3. Checking **Trained Knowledge Base** (below) and **Persistent Memory** (below)
4. For external info: **web_search** and **fetch_webpage**

When the user mentions ANY product name, family name, model number, finish, upholstery, color, or category — call search_catalog IMMEDIATELY. Search everywhere, every time.

## Available Tools (use them liberally)
- **search_catalog**: Search the live catalog for a term. Use FIRST when the user asks about any product, family (e.g. Abruzzo, Alpine), model, finish, upholstery, or color. Returns matching families, products, variations, finishes, upholsteries, colors. Never guess — always search.
- **get_product_catalog**: Full catalog. Use when search_catalog returns nothing or user needs broad overview. Never assume product data — fetch it.
- **web_search**: Search the web. Use 2–4 searches per research question. Default 12 results.
- **fetch_webpage**: Read a webpage in full. Use after web_search — don't rely on snippets alone.
- **calculate**: Precise math for pricing, margins, percentages.

## Response Style
- Be thorough and detailed. Provide comprehensive answers with full context and supporting evidence.
- Use your tools extensively: search the web multiple times from different angles, fetch webpages for deeper context, call get_product_catalog when discussing products, and calculate when numbers matter.
- When researching: run 2–4 searches with varied queries before answering. Fetch key URLs to read full content. Don't stop at snippets — dig deeper.
- Structure responses with markdown: headers (##, ###), bullet lists, numbered lists, tables, bold for emphasis, and inline code for IDs/codes.
- Always cite web sources with [title](url). For calculations, show the full work.
- If uncertain, search for more information. Never guess about products, pricing, or catalog data.

## Formatting
- Use markdown in all responses: **bold** for emphasis, `code` for IDs and model numbers, ## headers for sections, bullet and numbered lists, and tables for data. The chat UI renders markdown.

## Guiding Admin (Links & Buttons)
When the admin asks "how do I edit X?" or "where do I do Y?", provide step-by-step instructions and include clickable links. Use markdown: [Go to Product Catalog](/admin/catalog). Internal links (paths starting with /) open in-app. For prominent actions, use descriptive link text like [Edit Product](/admin/catalog) or [View Quote #42](/admin/quotes). You have full knowledge of all admin routes — use them to guide users directly.

## EagleChair Domain Knowledge
{EAGLECHAIR_DOMAIN_KNOWLEDGE}

## EagleChair Context
Eagle Chair is a premium B2B chair manufacturer selling to commercial clients (hotels, offices, restaurants). Products include chairs with various wood finishes, upholstery options, and hardware. Pricing is in cents in the database. Companies register for accounts and submit quote requests.{memory_block}{training_block}"""


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


async def stream_ai_response(
    session_messages: list[dict],
    system_prompt: str,
    model: str = "gemini-2.0-flash",
) -> AsyncGenerator[dict, None]:
    """
    Core streaming generator. Yields AIStreamEvent dicts.
    Handles tool calls in a loop until model returns final text.
    """
    client = get_gemini_client()

    # Build Gemini message history
    contents = []
    for msg in session_messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))

    web_sources_accumulated = []
    search_count = 0

    yield AIStreamEvent.thinking()

    # Tool execution loop
    max_tool_rounds = 10  # Prevent infinite loops
    tool_round = 0

    while tool_round < max_tool_rounds:
        tool_round += 1

        try:
            # Collect full response (non-streaming for tool call detection)
            response = await asyncio.to_thread(
                lambda: client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        tools=TOOL_DEFINITIONS,
                        temperature=0.6,
                        max_output_tokens=16384,
                    ),
                )
            )
        except Exception as e:
            yield AIStreamEvent.error(f"AI error: {str(e)}")
            return

        # Check for function calls in response
        has_tool_calls = False
        function_calls_to_execute = []

        for candidate in response.candidates:
            for part in candidate.content.parts:
                if part.function_call:
                    has_tool_calls = True
                    function_calls_to_execute.append(part.function_call)

        if has_tool_calls:
            # Add the model's tool call response to contents
            contents.append(response.candidates[0].content)

            # Execute all tool calls and collect results
            tool_results = []
            for fc in function_calls_to_execute:
                func_name = fc.name
                func_args = dict(fc.args) if fc.args else {}

                if func_name == "web_search":
                    query = func_args.get("query", "")
                    max_r = min(int(func_args.get("max_results", 12)), 15)
                    search_count += 1
                    yield AIStreamEvent.searching(query, search_count)

                    result = await asyncio.to_thread(web_search, query, max_r)
                    sources = result.get("results", [])
                    web_sources_accumulated.extend(sources[:5])  # Keep top 5 per search
                    yield AIStreamEvent.search_results(sources)

                    tool_results.append(
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=func_name,
                                response={"result": result},
                            )
                        )
                    )

                elif func_name == "fetch_webpage":
                    url = func_args.get("url", "")
                    yield AIStreamEvent.fetching_url(url)

                    result = await asyncio.to_thread(fetch_webpage, url)
                    # Add to sources if not already there
                    if not any(s.get("url") == url for s in web_sources_accumulated):
                        web_sources_accumulated.append({
                            "url": url,
                            "title": result.get("content", "")[:80].strip(),
                            "snippet": "",
                        })

                    tool_results.append(
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=func_name,
                                response={"result": result},
                            )
                        )
                    )

                elif func_name == "calculate":
                    expression = func_args.get("expression", "")
                    yield AIStreamEvent.calculating(expression)

                    result = await asyncio.to_thread(calculate, expression)
                    tool_results.append(
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=func_name,
                                response={"result": result},
                            )
                        )
                    )

                elif func_name == "search_catalog":
                    query = func_args.get("query", "").strip()
                    yield AIStreamEvent.thinking(f"Searching catalog for '{query}'...")

                    result = await search_catalog(query)
                    tool_results.append(
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=func_name,
                                response={"result": result},
                            )
                        )
                    )

                elif func_name == "get_product_catalog":
                    yield AIStreamEvent.thinking("Loading product catalog from database...")

                    catalog_text = await fetch_product_catalog()
                    tool_results.append(
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=func_name,
                                response={"catalog": catalog_text},
                            )
                        )
                    )

                else:
                    tool_results.append(
                        types.Part(
                            function_response=types.FunctionResponse(
                                name=func_name,
                                response={"error": f"Unknown tool: {func_name}"},
                            )
                        )
                    )

            # Add tool results back
            contents.append(types.Content(role="user", parts=tool_results))
            yield AIStreamEvent.thinking("Processing results...")
            continue

        # No tool calls — stream the final text response
        break

    # Now stream the final response text
    try:
        final_text_parts = []
        for candidate in response.candidates:
            for part in candidate.content.parts:
                if part.text:
                    final_text_parts.append(part.text)

        full_text = "".join(final_text_parts)

        # Stream in chunks for smooth UX
        chunk_size = 30
        for i in range(0, len(full_text), chunk_size):
            chunk = full_text[i:i + chunk_size]
            yield AIStreamEvent.text_chunk(chunk)
            await asyncio.sleep(0.01)

        # Get token usage
        usage = getattr(response, "usage_metadata", None)
        tokens = 0
        if usage:
            tokens = getattr(usage, "total_token_count", 0) or 0

        # Deduplicate sources
        seen_urls = set()
        unique_sources = []
        for s in web_sources_accumulated:
            url = s.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_sources.append(s)

        yield AIStreamEvent.message_done("", tokens, unique_sources)

    except Exception as e:
        yield AIStreamEvent.error(f"Streaming error: {str(e)}")


async def generate_chat_title(first_message: str) -> str:
    """Generate a short title for a chat based on the first message."""
    try:
        client = get_gemini_client()
        response = await asyncio.to_thread(
            lambda: client.models.generate_content(
                model="gemini-2.0-flash",
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
                model="gemini-2.0-flash",
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
                model="gemini-2.0-flash",
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
    try:
        results = {}

        # Product count
        r = await db.execute(text("SELECT COUNT(*) as cnt FROM chairs WHERE is_active = true"))
        results["active_products"] = r.scalar() or 0

        # Quote count (recent)
        r = await db.execute(text("SELECT COUNT(*) as cnt FROM quotes WHERE created_at >= NOW() - INTERVAL '30 days'"))
        results["quotes_last_30d"] = r.scalar() or 0

        # Company count
        r = await db.execute(text("SELECT COUNT(*) as cnt FROM companies WHERE status = 'active'"))
        results["active_companies"] = r.scalar() or 0

        # Category count
        r = await db.execute(text("SELECT COUNT(*) as cnt FROM categories"))
        results["categories"] = r.scalar() or 0

        return (
            f"Current EagleChair Data: {results['active_products']} active products, "
            f"{results['active_companies']} active companies, "
            f"{results['quotes_last_30d']} quotes in last 30 days, "
            f"{results['categories']} categories."
        )
    except Exception as e:
        logger.debug(f"Could not fetch EagleChair context: {e}")
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


async def search_catalog(query: str, max_results: int = 50) -> dict:
    """
    Search the Eagle Chair catalog for a term. Searches families, products, variations,
    finishes, upholsteries, colors, categories. Case-insensitive partial match.
    """
    if not query or not query.strip():
        return {"error": "Empty search query", "families": [], "products": [], "variations": [], "finishes": [], "upholsteries": [], "colors": []}
    q = query.strip()
    term = f"%{q}%"
    result = {"query": query, "families": [], "products": [], "variations": [], "finishes": [], "upholsteries": [], "colors": [], "categories": []}
    try:
        async with AsyncSessionLocal() as db:
            r = await db.execute(
                text("""
                    SELECT pf.id, pf.name, pf.slug, pf.overview_text, pf.is_featured,
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
                    "category": row.category_name, "subcategory": row.subcategory_name,
                    "featured": row.is_featured, "overview": (row.overview_text or "")[:200],
                })

            r = await db.execute(
                text("""
                    SELECT ch.id, ch.model_number, ch.model_suffix, ch.name, ch.base_price, ch.msrp,
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
                    SELECT id, name, finish_code, finish_type, grade, additional_cost
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
                })

            r = await db.execute(
                text("""
                    SELECT id, name, material_code, material_type, grade, additional_cost
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
                })

            r = await db.execute(
                text("""
                    SELECT id, name, color_code, hex_value, category
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
