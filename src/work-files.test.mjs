// Tests for the hand-written PDF assembler used to shrink a student's uploaded written work.
//
// Why this is one of the few tested files: a malformed PDF here fails SILENTLY at the point
// it matters. The upload succeeds, the submission saves, the student sees "submitted" - and
// weeks later the instructor clicks the work file while grading and gets an unopenable
// document, with the original long gone from the student's phone. Byte offsets in the xref
// table have to be exact, and nothing in the app would notice if they weren't.
//
// Run: node src/work-files.test.mjs

import { buildPdfFromJpegPages, formatBytes, WORK_HARD_LIMIT, WORK_TARGET_BYTES } from "./work-files.js";

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) { console.log(`  ok  ${name}`); return; }
  failures++;
  console.log(`FAIL  ${name}${detail ? ` - ${detail}` : ""}`);
}
function eq(name, actual, expected) {
  check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// A syntactically real (if tiny) baseline JPEG: SOI, APP0/JFIF, EOI. The assembler must carry
// these bytes through untouched, so what matters is that they are binary and recognizable.
function fakeJpeg(seed) {
  const body = new Uint8Array(64).map((_, i) => (i * 7 + seed) & 0xff);
  return Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00,
    0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    ...body,
    0xff, 0xd9,
  ]);
}

const latin1 = bytes => Buffer.from(bytes).toString("latin1");

async function bytesOf(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

console.log("\nbuildPdfFromJpegPages - structure");

const pages = [
  { bytes: fakeJpeg(1), width: 1275, height: 1700 },   // portrait
  { bytes: fakeJpeg(2), width: 1700, height: 1275 },   // landscape
  { bytes: fakeJpeg(3), width: 1000, height: 1000 },   // square
];
const blob = buildPdfFromJpegPages(pages);
const raw = await bytesOf(blob);
const txt = latin1(raw);

eq("blob mime is application/pdf", blob.type, "application/pdf");
check("starts with a PDF header", txt.startsWith("%PDF-1.4\n"));
check("carries the binary marker comment so tools treat it as binary",
  raw[9] === 0x25 && raw[10] === 0xe2 && raw[11] === 0xe3);
check("ends with %%EOF", txt.trimEnd().endsWith("%%EOF"));
eq("page count in the page tree", /\/Count (\d+)/.exec(txt)?.[1], "3");
eq("one page object per page", (txt.match(/\/Type \/Page\b(?!s)/g) || []).length, 3);
eq("one image XObject per page", (txt.match(/\/Subtype \/Image/g) || []).length, 3);

console.log("\nxref table - every offset must land on its object");

const startxref = Number(/startxref\n(\d+)/.exec(txt)[1]);
check("startxref points at the xref keyword", txt.slice(startxref, startxref + 4) === "xref",
  `found ${JSON.stringify(txt.slice(startxref, startxref + 12))}`);

const size = Number(/\/Size (\d+)/.exec(txt)[1]);
eq("trailer /Size covers catalog + page tree + 3 objects per page", size, 2 + 3 * pages.length + 1);

const xrefBody = txt.slice(startxref);
const header = new RegExp(`^xref\\n0 ${size}\\n`).exec(xrefBody);
check("xref subsection header names the whole object range", !!header);
// Entry 0 is the free entry; entry n describes object n.
const entries = xrefBody.slice(header[0].length).split("\n").slice(0, size);
eq("one entry per object, plus the free entry", entries.length, size);
check("every entry is exactly 20 bytes (19 + newline)", entries.every(e => e.length === 19),
  `lengths ${entries.map(e => e.length).join(",")}`);
eq("entry 0 is the free entry", entries[0], "0000000000 65535 f ");

let offsetsOk = true;
entries.slice(1).forEach((entry, i) => {
  const objNum = i + 1;
  const off = Number(entry.slice(0, 10));
  if (!txt.startsWith(`${objNum} 0 obj`, off)) {
    offsetsOk = false;
    console.log(`      object ${objNum}: offset ${off} lands on ${JSON.stringify(txt.slice(off, off + 14))}`);
  }
});
check("each xref offset lands exactly on its object header", offsetsOk);

console.log("\nJPEG streams - the image bytes must survive verbatim");

let streamsOk = true;
pages.forEach((pg, i) => {
  const objNum = 5 + 3 * i;
  const at = txt.indexOf(`${objNum} 0 obj`);
  const declared = Number(new RegExp(`/Length (\\d+) >>\\nstream\\n`).exec(txt.slice(at))[1]);
  if (declared !== pg.bytes.length) { streamsOk = false; console.log(`      page ${i + 1}: /Length ${declared} != ${pg.bytes.length}`); return; }
  const start = txt.indexOf("stream\n", at) + "stream\n".length;
  const got = raw.slice(start, start + pg.bytes.length);
  if (latin1(got) !== latin1(pg.bytes)) { streamsOk = false; console.log(`      page ${i + 1}: stream bytes differ`); return; }
  if (txt.slice(start + pg.bytes.length, start + pg.bytes.length + 11) !== "\nendstream\n") {
    streamsOk = false; console.log(`      page ${i + 1}: stream is not closed where /Length says it ends`);
  }
});
check("every page's JPEG is byte-identical and /Length agrees", streamsOk);

console.log("\nMediaBox - pages fit Letter and keep their aspect ratio");

const boxes = [...txt.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map(m => [Number(m[1]), Number(m[2])]);
eq("one MediaBox per page", boxes.length, 3);
boxes.forEach(([w, h], i) => {
  const src = pages[i];
  check(`page ${i + 1} fits inside Letter`, w <= 612.01 && h <= 792.01, `${w}x${h}`);
  check(`page ${i + 1} touches a Letter edge (scaled to fit, not shrunk further)`,
    Math.abs(w - 612) < 0.5 || Math.abs(h - 792) < 0.5, `${w}x${h}`);
  const ratio = (w / h) / (src.width / src.height);
  check(`page ${i + 1} keeps its aspect ratio`, Math.abs(ratio - 1) < 0.005, `ratio off by ${(ratio - 1).toFixed(4)}`);
});

const content = /q ([\d.]+) 0 0 ([\d.]+) 0 0 cm \/Im0 Do Q/.exec(txt);
check("the content stream draws the image at the full page size",
  Number(content[1]) === boxes[0][0] && Number(content[2]) === boxes[0][1]);

console.log("\nedge cases");

const one = latin1(await bytesOf(buildPdfFromJpegPages([{ bytes: fakeJpeg(9), width: 800, height: 600 }])));
eq("a single-page document still declares /Size 6", /\/Size (\d+)/.exec(one)[1], "6");
check("a single-page document's kids list has one entry", /\/Kids \[3 0 R\]/.test(one));

console.log("\nsize thresholds and formatting");

check("the target sits well under the hard limit", WORK_TARGET_BYTES < WORK_HARD_LIMIT);
check("a file at the target survives base64 inflation under a 6 MB function body cap",
  WORK_TARGET_BYTES * (4 / 3) < 6 * 1024 * 1024);
eq("bytes", formatBytes(512), "512 B");
eq("kilobytes", formatBytes(2048), "2 KB");
eq("megabytes keep a decimal while small", formatBytes(2.5 * 1024 * 1024), "2.5 MB");
eq("large megabytes round off", formatBytes(145092333), "138 MB");

console.log(failures === 0 ? "\nAll work-file tests passed.\n" : `\n${failures} test(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
