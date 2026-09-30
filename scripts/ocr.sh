#!/usr/bin/env bash
# OCR the scanned book: pdftoppm @ 300 DPI -> tesseract -> reference/ocr/page-NNN.txt (PDF page index).
# Resumable (skips pages already done) and parallel. Output stays in reference/ (gitignored).
set -euo pipefail
PDF="${1:-reference/module/curse-of-strahd.pdf}"
[ -f "$PDF" ] || [ ! -f reference/curse-of-strahd.pdf ] || PDF=reference/curse-of-strahd.pdf
OUT="reference/ocr"
command -v pdftoppm >/dev/null || { echo "need poppler-utils (pdftoppm)"; exit 1; }
command -v tesseract >/dev/null || { echo "need tesseract-ocr"; exit 1; }
[ -f "$PDF" ] || { echo "missing $PDF — drop the book there first"; exit 1; }
mkdir -p "$OUT/tmp"
PAGES=$(pdfinfo "$PDF" | awk '/^Pages:/{print $2}')
echo "OCR $PAGES pages -> $OUT"
ocr_page() {
  local i=$1 base
  base=$(printf '%s/page-%03d' "$OUT" "$i")
  [ -f "$base.txt" ] && [ -s "$base.txt" ] && return 0
  pdftoppm -r 300 -gray -f "$i" -l "$i" -png "$PDF" "$OUT/tmp/p$i"
  local png; png=$(ls "$OUT"/tmp/p"$i"-*.png | head -1)
  # One thread per process: tesseract's OpenMP threads thrash when pages run in parallel.
  # Art-only pages (covers, maps) can stall layout analysis, so cap each page and fall back.
  OMP_THREAD_LIMIT=1 timeout 120 tesseract "$png" "$base" --psm 3 -l eng >/dev/null 2>&1 \
    || OMP_THREAD_LIMIT=1 timeout 120 tesseract "$png" "$base" --psm 6 -l eng >/dev/null 2>&1 \
    || echo "[ocr timed out]" > "$base.txt"
  rm -f "$png"
  echo -n "."
}
export -f ocr_page; export PDF OUT
seq 1 "$PAGES" | xargs -P "$(nproc)" -I{} bash -c 'ocr_page {}'
echo; echo "done. next: node --experimental-strip-types scripts/manifest-report.ts"
