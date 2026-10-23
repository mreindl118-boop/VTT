// Table titles from the official PDF. The your5e conversion of SRD 5.2.1 dropped most table titles ("Travel Pace",
// "XP Budget per Character" …); the PDF sets each one in GillSans SemiBold 16 pt black, right above the table's
// header row (SemiBold 14–15 pt). `pdftohtml -xml` keeps fonts, so the titles and the headers under them can be read
// back exactly. The result is committed (scripts/books/titles/<book>.json) so the converter stays pure and a build
// without the PDF or pdftohtml reproduces the same data.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface PdfTitle { page: number; title: string; head: string[] }

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);/g, (_, n: string, d: string) => (n ? ENT[n] : String.fromCodePoint(+d)));

export function titlesFromXml(xml: string): PdfTitle[] {
  const fonts = new Map<string, 'T' | 'H' | 'x'>();
  for (const m of xml.matchAll(/<fontspec id="(\d+)" size="(\d+)" family="([^"]+)" color="([^"]+)"/g)) {
    const [, id, size, fam, color] = m;
    const semi = /GillSans-SemiBold/.test(fam) && !/SC700/.test(fam) && color === '#231f20';
    fonts.set(id, semi && +size === 16 ? 'T' : semi && (+size === 14 || +size === 15) ? 'H' : 'x');
  }
  const runs: { page: number; top: number; k: string; text: string }[] = [];
  for (const p of xml.matchAll(/<page number="(\d+)"[^>]*>([\s\S]*?)<\/page>/g)) {
    for (const t of p[2].matchAll(/<text top="(\d+)" left="\d+" width="\d+" height="\d+" font="(\d+)">([\s\S]*?)<\/text>/g)) {
      const text = unescape(t[3].replace(/<[^>]+>/g, '')).trim();
      if (text) runs.push({ page: +p[1], top: +t[1], k: fonts.get(t[2]) ?? 'x', text });
    }
  }
  const out: PdfTitle[] = [];
  for (let i = 0; i < runs.length; i++) {
    if (runs[i].k !== 'T') continue;
    const parts = [runs[i].text];
    let j = i + 1, last = runs[i].top;
    // A long title wraps onto a second line in the same font.
    while (j < runs.length && runs[j].k === 'T' && runs[j].page === runs[i].page && runs[j].top - last > 0 && runs[j].top - last < 30) { parts.push(runs[j].text); last = runs[j].top; j++; }
    const head: string[] = [];
    while (j < runs.length && runs[j].k === 'H' && head.length < 12) head.push(runs[j++].text);
    out.push({ page: runs[i].page, title: parts.join(' ').replace(/\s+/g, ' '), head });
    i = j - 1;
  }
  return out;
}

/** Titles of every table in a PDF, or null when pdftohtml is not installed. */
export function pdfTitles(pdf: string): PdfTitle[] | null {
  const dir = mkdtempSync(join(tmpdir(), 'books-titles-'));
  try {
    execFileSync('pdftohtml', ['-xml', '-i', '-q', pdf, join(dir, 'out')], { stdio: 'ignore', maxBuffer: 256 * 1024 * 1024 });
    return titlesFromXml(readFileSync(join(dir, 'out.xml'), 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
