#!/usr/bin/env python3
"""Extract embedded PNG and JPEG images from Affinity Designer (.afdesign) files."""

import argparse
import struct
import sys
from pathlib import Path


PNG_SIG = b"\x89PNG\r\n\x1a\n"
JPEG_SIG = b"\xff\xd8\xff"
JPEG_EOI = b"\xff\xd9"


def extract_png(data: bytes, start: int) -> tuple[bytes | None, int]:
    if data[start : start + 8] != PNG_SIG:
        return None, start
    pos = start + 8
    while pos + 12 <= len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        chunk_type = data[pos + 4 : pos + 8]
        chunk_end = pos + 8 + length + 4
        if chunk_end > len(data):
            return None, start
        if chunk_type == b"IEND":
            return data[start:chunk_end], chunk_end
        pos = chunk_end
    return None, start


def extract_jpeg(data: bytes, start: int) -> tuple[bytes | None, int]:
    if data[start : start + 3] != JPEG_SIG:
        return None, start
    pos = start + 2
    while pos < len(data) - 1:
        if data[pos] == 0xFF and data[pos + 1] == 0xD9:
            return data[start : pos + 2], pos + 2
        if data[pos] != 0xFF:
            pos += 1
            continue
        if pos + 4 > len(data):
            return None, start
        seg_len = struct.unpack(">H", data[pos + 2 : pos + 4])[0]
        pos += 2 + seg_len
    return None, start


def extract_images(path: Path, out_dir: Path) -> list[Path]:
    data = path.read_bytes()
    extracted: list[Path] = []
    out_dir.mkdir(parents=True, exist_ok=True)

    png_count = 0
    pos = 0
    while True:
        idx = data.find(PNG_SIG, pos)
        if idx == -1:
            break
        png_data, next_pos = extract_png(data, idx)
        if png_data:
            png_count += 1
            out_path = out_dir / f"{path.stem}_image_{png_count:02d}.png"
            out_path.write_bytes(png_data)
            extracted.append(out_path)
        pos = idx + 1

    jpeg_count = 0
    pos = 0
    while True:
        idx = data.find(JPEG_SIG, pos)
        if idx == -1:
            break
        jpeg_data, next_pos = extract_jpeg(data, idx)
        if jpeg_data:
            jpeg_count += 1
            out_path = out_dir / f"{path.stem}_image_{jpeg_count:02d}.jpg"
            out_path.write_bytes(jpeg_data)
            extracted.append(out_path)
        pos = idx + 1

    return extracted


def main():
    parser = argparse.ArgumentParser(description="Extract images from .afdesign files")
    parser.add_argument("afdesign", type=Path, help="Path to .afdesign file")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output directory (default: same as input, with _images suffix)",
    )
    args = parser.parse_args()

    if not args.afdesign.exists():
        print(f"Error: File not found: {args.afdesign}", file=sys.stderr)
        sys.exit(1)

    out_dir = args.output or (args.afdesign.parent / f"{args.afdesign.stem}_images")
    extracted = extract_images(args.afdesign, out_dir)

    print(f"Extracted {len(extracted)} images to {out_dir}")
    for p in extracted:
        print(f"  {p.name}")


if __name__ == "__main__":
    main()
