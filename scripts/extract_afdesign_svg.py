#!/usr/bin/env python3
"""Extract embedded SVG files from inside Affinity Designer (.afdesign) files.

Embedded documents (File > Place) are stored as nested afdesign blobs in edc/* entries.
Each is converted to SVG via the Inkscape inkaf parser.
"""

import argparse
import re
import sys
from io import BytesIO
from pathlib import Path

sys.path.insert(0, "/usr/share/inkscape/extensions/other/extension-afdesign")
from inkaf.parser.extract import AFExtractor, NormalFATFile
from inkaf.svg.convert import AFConverter


def extract_svg_from_edc(edc_data: bytes) -> str | None:
    if len(edc_data) < 16 or not edc_data.startswith(b"EmDc"):
        return None
    inner = edc_data[8:]
    try:
        with BytesIO(inner) as stream:
            ex = AFExtractor(stream)
            conv = AFConverter()
            conv.convert(ex)
            return conv.doc.getroot().tostring().decode("utf-8")
    except Exception:
        return None


def get_original_names(doc_data: bytes) -> dict[str, str]:
    result: dict[str, str] = {}
    for m in re.finditer(rb"edc/([a-f0-9]+)", doc_data):
        key = f"edc/{m.group(1).decode()}"
        end = doc_data.find(b"\x00", m.end())
        rest = doc_data[m.end():end] if end > 0 else doc_data[m.end():m.end() + 50]
        if b".svg" in rest:
            idx = doc_data.rfind(b".svg", 0, m.start() + 200)
            if idx > 0:
                start = doc_data.rfind(b"\x00", max(0, idx - 80), idx) + 1
                name = doc_data[start : idx + 4].decode("utf-8", errors="replace")
                if "/" in name:
                    name = Path(name).name
                result[key] = name
    return result


def main():
    parser = argparse.ArgumentParser(description="Extract embedded SVGs from .afdesign files")
    parser.add_argument("afdesign", type=Path, help="Path to .afdesign file")
    parser.add_argument("-o", "--output", type=Path, default=None)
    parser.add_argument("--limit", type=int, default=0, help="Max SVGs to extract (0=all)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    if not args.afdesign.exists():
        print(f"Error: File not found: {args.afdesign}", file=sys.stderr)
        sys.exit(1)

    out_dir = args.output or (args.afdesign.parent / f"{args.afdesign.stem}_svgs")
    out_dir.mkdir(parents=True, exist_ok=True)

    with open(args.afdesign, "rb") as f:
        ex = AFExtractor(f)
        edc_names = [n for n in ex.ids if n.startswith("edc/")]
        if not edc_names:
            print("No edc/* entries in file.", file=sys.stderr)
            sys.exit(1)
        if args.limit:
            edc_names = edc_names[: args.limit]
        names = get_original_names(ex.content.files.get("doc.dat", b""))
        extracted: list[Path] = []
        if args.verbose:
            print(f"Processing {len(edc_names)} edc entries", file=sys.stderr)
        for name in edc_names:
            rev = ex.get_head_revision(name)
            if args.verbose:
                print(f"  {name}: rev={rev is not None}", file=sys.stderr)
            if not rev or not isinstance(rev, NormalFATFile):
                continue
            try:
                data = ex.extract(rev)
                svg = extract_svg_from_edc(data)
                if args.verbose:
                    print(f"  {name}: data={len(data)}, svg={'yes' if svg else 'no'}", file=sys.stderr)
                if not svg:
                    continue
                orig = names.get(name)
                base_name = Path(orig).stem if orig else name.replace("/", "_")
                base_name = re.sub(r"[^\w\-.]", "_", base_name) or "embedded"
                out_path = out_dir / f"{base_name}.svg"
                n = 1
                while out_path.exists():
                    out_path = out_dir / f"{base_name}_{n}.svg"
                    n += 1
                out_path.write_text(svg)
                extracted.append(out_path)
            except Exception as e:
                if args.verbose:
                    print(f"  {name}: error {e}", file=sys.stderr)

    if extracted:
        print(f"Extracted {len(extracted)} SVG(s) to {out_dir}")
        for p in extracted:
            print(f"  {p.name}")
    else:
        print("No embedded SVG documents found.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
