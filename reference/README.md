# reference/ (gitignored)

Drop the scanned book here as `reference/module/curse-of-strahd.pdf`, then run:

    npm run ocr          # pdftoppm @ 300 DPI -> tesseract -> reference/ocr/page-NNN.txt
    npx tsx scripts/manifest-report.ts   # (or: node --experimental-strip-types) cross-check manifests vs OCR

Nothing in this folder except this README is ever committed. The app stores only
keys, names, page numbers, dimensions and Matt's notes — never book text, art or maps.
