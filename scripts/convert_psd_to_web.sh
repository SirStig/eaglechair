#!/usr/bin/env bash
set -e
SOURCE_SCANS="/home/jkac/mac_ssd/root/CMYK scans"
SOURCE_INSTALLS="/home/jkac/mac_ssd/root/CMYK installs"
DEST_BASE="${HOME}/Downloads"
DEST_SCANS="${DEST_BASE}/CMYK-scans-converted"
DEST_INSTALLS="${DEST_BASE}/CMYK-installs-converted"

mkdir -p "$DEST_SCANS" "$DEST_INSTALLS"

convert_one() {
  local src="$1"
  local dest_base="$2"
  local rel="${src#$3/}"
  local dir="${rel%/*}"
  local base="${rel##*/}"
  local name="${base%.psd}"
  local outdir="${dest_base}/${dir}"
  local out="${outdir}/${name}.png"
  mkdir -p "$outdir"
  convert "$src" -alpha on -strip -define png:compression-level=9 "$out" && echo "  $rel -> $out"
}

echo "Converting CMYK scans..."
while IFS= read -r -d '' f; do
  convert_one "$f" "$DEST_SCANS" "$SOURCE_SCANS" || echo "  SKIP (failed): $f"
done < <(find "$SOURCE_SCANS" -name "*.psd" -print0 2>/dev/null)

echo "Converting CMYK installs..."
while IFS= read -r -d '' f; do
  convert_one "$f" "$DEST_INSTALLS" "$SOURCE_INSTALLS" || echo "  SKIP (failed): $f"
done < <(find "$SOURCE_INSTALLS" -name "*.psd" -print0 2>/dev/null)

echo "Done. Output: $DEST_SCANS and $DEST_INSTALLS"
