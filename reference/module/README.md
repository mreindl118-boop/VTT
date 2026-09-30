# reference/module/: master module reference

This folder is the one place for the source book: **Curse of Strahd**, scanned PDF.

    reference/module/curse-of-strahd.pdf

Everything in this folder except this README is gitignored, and `tests/no-book-content.test.ts` fails if
any book file ever gets committed. The GitHub repo is public, and the book is copyrighted.

Everything built from the book reads from here:

- `npm run ocr` → `reference/ocr/page-NNN.txt`
- `node --experimental-strip-types scripts/manifest-report.ts` → `reference/manifest-report.md`

What does get committed is derived data only: area keys, names, printed page numbers, stated dimensions
(in `manifests/`), and original geometry (in `locations/`).
