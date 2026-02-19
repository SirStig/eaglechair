"""
Generate short description, full description, and feature list from catalog PDF content.
Supports Google Gemini (google-genai, set GEMINI_API_KEY) or Ollama (set OLLAMA_BASE_URL / --ollama-url).
"""

import json
import logging
import re
import time
from typing import Any, Dict, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

GEMINI_RETRY_DELAYS = (5, 15, 45)
DEFAULT_OLLAMA_BASE_URL = "http://192.168.1.202:11434"
DEFAULT_OLLAMA_MODEL = "gemma3:12b"

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gemini-2.5-flash-lite"
DESCRIPTION_SYSTEM = """You are writing product copy for furniture (chairs, barstools, etc.) for a B2B website.
Given catalog text from a manufacturer PDF, produce:
1. short_description: One or two short sentences only. No bullet points. Marketing tone.
2. full_description: Two to four paragraphs. Professional, highlight materials, build quality, and use cases. No bullet points in the body.
3. features: A JSON array of feature strings. Each item is one clear feature (e.g. "Solid wood construction", "Optional upholstery"). Use only information from the catalog. Typically 5–15 items.

Output valid JSON only, no markdown or extra text, with keys: short_description, full_description, features."""


def build_catalog_context(product_record: Dict[str, Any]) -> str:
    family = product_record.get("family_name", "")
    base_model = product_record.get("base_model", "")
    text = product_record.get("full_page_text", "")
    dims = product_record.get("dimensions") or {}
    parts = [f"Product family: {family}. Model (base): {base_model}."]
    if dims:
        dim_parts = []
        if dims.get("width") is not None:
            dim_parts.append(f"Width {dims['width']}\"")
        if dims.get("depth") is not None:
            dim_parts.append(f"Depth {dims['depth']}\"")
        if dims.get("height") is not None:
            dim_parts.append(f"Height {dims['height']}\"")
        if dims.get("weight") is not None:
            dim_parts.append(f"Weight {dims['weight']}#")
        if dims.get("yardage") is not None:
            dim_parts.append(f"Upholstery {dims['yardage']} y")
        if dim_parts:
            parts.append("Dimensions: " + ", ".join(dim_parts) + ".")
    parts.append("\n\nCatalog text from PDF:\n" + (text or ""))
    return "\n".join(parts)


def _parse_llm_json(raw: str, source: str = "LLM") -> Dict[str, Any]:
    raw = re.sub(r"^```\w*\s*", "", raw)
    raw = re.sub(r"\s*```\s*$", "", raw)
    try:
        out = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.warning("%s response was not valid JSON: %s", source, e)
        return {"short_description": None, "full_description": None, "features": []}
    short = out.get("short_description")
    full = out.get("full_description")
    features = out.get("features")
    if not isinstance(features, list):
        features = [f.strip() for f in str(features or "").split(",") if f.strip()]
    return {
        "short_description": short if isinstance(short, str) else None,
        "full_description": full if isinstance(full, str) else None,
        "features": [str(x).strip() for x in features if x] if features else [],
    }


def _generate_descriptions_ollama(
    product_record: Dict[str, Any],
    base_url: str,
    model: str = DEFAULT_OLLAMA_MODEL,
) -> Dict[str, Any]:
    context = build_catalog_context(product_record)
    prompt = (
        DESCRIPTION_SYSTEM
        + "\n\n---\n\n"
        + context
        + "\n\n---\n\nOutput JSON only:"
    )
    url = base_url.rstrip("/") + "/api/generate"
    body = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode("utf-8")
    req = Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (HTTPError, URLError, json.JSONDecodeError) as e:
        logger.warning("Ollama request failed: %s", e)
        return {"short_description": None, "full_description": None, "features": []}
    raw = (data.get("response") or "").strip()
    return _parse_llm_json(raw, "Ollama")


def generate_descriptions(
    product_record: Dict[str, Any],
    api_key: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    ollama_base_url: Optional[str] = None,
    ollama_model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Produce short_description, full_description, and features (list of strings).
    Uses Ollama if ollama_base_url is set, otherwise Gemini (requires api_key or GEMINI_API_KEY).
    product_record must have family_name, base_model, full_page_text, and optionally dimensions.
    """
    if ollama_base_url:
        return _generate_descriptions_ollama(
            product_record,
            base_url=ollama_base_url,
            model=ollama_model or DEFAULT_OLLAMA_MODEL,
        )

    from google import genai

    context = build_catalog_context(product_record)
    prompt = (
        DESCRIPTION_SYSTEM
        + "\n\n---\n\n"
        + context
        + "\n\n---\n\nOutput JSON only:"
    )
    client = genai.Client(api_key=api_key) if api_key else genai.Client()
    raw = ""
    try:
        for attempt, delay in enumerate([0] + list(GEMINI_RETRY_DELAYS)):
            if delay:
                time.sleep(delay)
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                )
                raw = (response.text or "").strip()
                break
            except Exception as e:
                code = getattr(e, "code", None) or getattr(e, "status_code", None)
                if code == 429 and attempt < len(GEMINI_RETRY_DELAYS):
                    logger.warning("Gemini 429, retry in %ss", GEMINI_RETRY_DELAYS[attempt])
                    continue
                raise
    finally:
        try:
            client.close()
        except Exception:
            pass
    return _parse_llm_json(raw, "Gemini")
