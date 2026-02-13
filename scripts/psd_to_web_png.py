#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

MAX_DIMENSION = 2400

def main():
    if len(sys.argv) > 1:
        folder = Path(sys.argv[1]).resolve()
    else:
        raw = input("Folder path to find PSDs/TIFs: ").strip()
        if not raw:
            print("No path given", file=sys.stderr)
            return 1
        folder = Path(raw).expanduser().resolve()
    if not folder.is_dir():
        print(f"Not a directory: {folder}", file=sys.stderr)
        return 1
    sources = sorted(
        list(folder.glob("*.psd"))
        + list(folder.glob("*.tif"))
        + list(folder.glob("*.tiff"))
    )
    if not sources:
        print(f"No PSD or TIF files in {folder}")
        return 1
    out_dir = folder / "web_pngs"
    out_dir.mkdir(exist_ok=True)
    for src in sources:
        out = out_dir / (src.stem + ".png")
        cmd = [
            "magick",
            str(src),
            "-background", "none",
            "-flatten",
            "-alpha", "on",
            "-strip",
            "-resize", f"{MAX_DIMENSION}x{MAX_DIMENSION}>",
            "-define", "png:compression-level=9",
            "PNG32:" + str(out),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(src.name, r.stderr or r.stdout, file=sys.stderr)
            continue
        print(src.name, "->", out.name)
    print("Done. Output in", out_dir)
    return 0

if __name__ == "__main__":
    sys.exit(main())
