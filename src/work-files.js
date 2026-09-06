// Work-file normalization for the homework written-work upload.
//
// Why this exists: a student photographing four pages with a phone and running them through
// iOS/macOS "Create PDF" gets a PDF whose pages are RunLengthDecode (effectively uncompressed)
// 3024x4032 bitmaps - ~36 MB per page, 145 MB for four. That file is rejected outright by the
// hwWork Storage rule (25 MB) and the submit failed with no usable explanation. Phone photos
// attached directly are the same problem at a smaller scale, so images go through the same path.
//
// So every attached file is normalized in the browser BEFORE it is uploaded: a page is
// rasterized at a legible-but-modest resolution and re-encoded as JPEG. The 145 MB file above
// comes out around 1 MB with the handwriting fully readable.
//
// Two ceilings drive the target size, and they are far apart:
//   - WORK_HARD_LIMIT (25 MB) is the storage.rules backstop. Exceeding it is a hard failure.
//   - WORK_TARGET_BYTES (2.5 MB) is what keeps the file usable for the integrity check, which
//     base64-encodes it (x4/3) into a POST to a Netlify function whose synchronous request body
//     caps out around 6 MB. A file between the two uploads fine but silently goes unchecked.
// Normalization aims at the target and only ever refuses at the hard limit.
//
// A file already under the target is passed through UNTOUCHED. That matters for a PDF of typed
// or vector work (a scanner app's output, a tablet export): rasterizing it would throw away
// real quality to solve a problem it does not have.

export const WORK_HARD_LIMIT = 25 * 1024 * 1024;
export const WORK_TARGET_BYTES = 2.5 * 1024 * 1024;

// Successively more aggressive rasterization passes. The first is the quality we actually want
// for handwriting; the rest exist so a long assignment (20+ pages) still lands under the target
// rather than failing. Stops at the first pass that fits.
const PASSES = [
  { maxPx: 1700, quality: 0.72 },
  { maxPx: 1300, quality: 0.62 },
  { maxPx: 1000, quality: 0.5 },
];

export function formatBytes(n) {
  if (!Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  const mb = n / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

// ── PDF writing ─────────────────────────────────────────────────────────────────
// A minimal PDF whose pages are single full-bleed JPEGs (/DCTDecode carries the JPEG bytes
// through verbatim, so there is no second re-encode). Hand-written rather than pulled in as a
// dependency: the file is ~2 KB of structure and a PDF writer that only has to do this one
// thing is small enough to read in full. Covered by src/work-files.test.mjs.
const LETTER = [612, 792];

export function buildPdfFromJpegPages(pages) {
  const enc = new TextEncoder();
  const chunks = [];
  let len = 0;
  const push = u8 => { chunks.push(u8); len += u8.length; };
  const str = s => push(enc.encode(s));

  const offsets = [];                       // offsets[objNum] = byte offset of that object
  const obj = (n, body) => { offsets[n] = len; str(`${n} 0 obj\n${body}\nendobj\n`); };

  str("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));   // binary marker comment

  // Object numbering: 1 = catalog, 2 = page tree, then 3 per page (page, contents, image).
  const kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(" ");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);

  pages.forEach((pg, i) => {
    const [pageNum, contentNum, imgNum] = [3 + 3 * i, 4 + 3 * i, 5 + 3 * i];
    // Fit the image to Letter, preserving its aspect ratio; the page is exactly the fitted
    // image, so there are no margins to get wrong.
    const scale = Math.min(LETTER[0] / pg.width, LETTER[1] / pg.height);
    const w = +(pg.width * scale).toFixed(2);
    const h = +(pg.height * scale).toFixed(2);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q\n`;

    obj(pageNum, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] `
      + `/Resources << /XObject << /Im0 ${imgNum} 0 R >> >> /Contents ${contentNum} 0 R >>`);
    obj(contentNum, `<< /Length ${content.length} >>\nstream\n${content}endstream`);

    // The image object's stream is binary, so it is emitted in three parts rather than via obj().
    offsets[imgNum] = len;
    str(`${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height}`
      + ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>\nstream\n`);
    push(pg.bytes);
    str("\nendstream\nendobj\n");
  });

  // Cross-reference table. Every entry is exactly 20 bytes or the file will not parse.
  const count = 3 + 3 * pages.length;       // objects 1..count-1, plus the free entry 0
  const xrefAt = len;
  str(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) str(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  str(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  return new Blob(chunks, { type: "application/pdf" });
}

// ── Rasterization (browser only) ────────────────────────────────────────────────
let pdfjsPromise = null;
// Lazy-loaded like MathLive: pdf.js is a few hundred KB and only a student on the submit step
// with an oversized PDF ever needs it.
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })().catch(err => { pdfjsPromise = null; throw err; });
  }
  return pdfjsPromise;
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not encode page as JPEG"))), "image/jpeg", quality);
  });
}

// Render every page of an open document to a JPEG at `maxPx`. Pages are drawn one at a time
// and each canvas is released before the next, so a 145 MB scan never holds more than one
// decoded page in memory.
async function renderPages(doc, { maxPx, quality }, onProgress) {
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxPx / Math.max(base.width, base.height), 4);
    const viewport = page.getViewport({ scale: scale > 0 ? scale : 1 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    // JPEG has no alpha: without this, anything transparent renders black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, background: "#fff" }).promise;
    const blob = await canvasToJpeg(canvas, quality);
    out.push({ bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
    canvas.width = canvas.height = 0;      // release the backing store before the next page
    page.cleanup();
    if (onProgress) onProgress(n / doc.numPages);
  }
  return out;
}

// Rasterize a whole PDF, retrying at lower settings until it fits the target.
// The document is parsed ONCE and held open across passes: re-opening it is the expensive part
// (that 145 MB file is 145 MB of pixels to inflate), and a long assignment needs more than one
// pass. Page count also picks the starting pass, so a 40-page set does not render three times
// over just to discover that full resolution was never going to fit.
async function pdfToJpegPdf(file, onProgress) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, disableAutoFetch: true, disableStream: true }).promise;
  try {
    if (!doc.numPages) throw new Error("That PDF has no pages");
    const from = doc.numPages > 24 ? 2 : doc.numPages > 10 ? 1 : 0;
    let best = null;
    for (let i = from; i < PASSES.length; i++) {
      const blob = buildPdfFromJpegPages(await renderPages(doc, PASSES[i], onProgress));
      if (!best || blob.size < best.blob.size) best = { blob, pageCount: doc.numPages };
      if (blob.size <= WORK_TARGET_BYTES) break;
    }
    return best;
  } finally {
    doc.destroy();
  }
}

// Downscale + re-encode a single image file (a phone photo, or a PNG scan) to JPEG.
function compressImageFile(file, { maxPx, quality }) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image")); };
    img.onload = async () => {
      try {
        let { naturalWidth: w, naturalHeight: h } = img;
        const long = Math.max(w, h);
        if (long > maxPx) { const k = maxPx / long; w = Math.round(w * k); h = Math.round(h * k); }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await canvasToJpeg(canvas, quality);
        canvas.width = canvas.height = 0;
        resolve(blob);
      } catch (err) { reject(err); } finally { URL.revokeObjectURL(url); }
    };
    img.src = url;
  });
}

function renameExt(name, ext) {
  return `${(name || "work").replace(/\.[^.]+$/, "")}.${ext}`;
}

// ── The one entry point ─────────────────────────────────────────────────────────
// Returns { file, name, mime, size, originalSize, compressed, pages?, tooLarge, error? }.
// It never throws: a PDF that pdf.js cannot open (encrypted, malformed) falls back to the
// original file, and `tooLarge` then tells the caller to refuse it with a real explanation
// rather than letting the Storage rule reject it after a multi-minute upload.
export async function normalizeWorkFile(file, onProgress) {
  const originalSize = file.size;
  const pass = (extra = {}) => ({
    file, name: file.name, mime: file.type, size: originalSize, originalSize,
    compressed: false, tooLarge: originalSize > WORK_HARD_LIMIT, ...extra,
  });

  if (originalSize <= WORK_TARGET_BYTES) return pass();

  const isPdf = file.type === "application/pdf";
  const isImage = (file.type || "").startsWith("image/");
  if (!isPdf && !isImage) return pass();

  let best = null;
  let error = null;
  try {
    if (isPdf) {
      best = await pdfToJpegPdf(file, onProgress);
    } else {
      for (const opts of PASSES) {
        const blob = await compressImageFile(file, opts);
        if (!best || blob.size < best.blob.size) best = { blob };
        if (blob.size <= WORK_TARGET_BYTES) break;
      }
    }
  } catch (err) {
    error = err?.message || "Could not compress that file";
  }

  // Re-encoding is only ever an improvement if it actually got smaller; a vector PDF that
  // slipped past the target check can come out bigger as pixels, and the original is better.
  if (!best || best.blob.size >= originalSize) return pass(error ? { error } : {});

  const name = isPdf ? file.name : renameExt(file.name, "jpg");
  const mime = isPdf ? "application/pdf" : "image/jpeg";
  const out = new File([best.blob], name, { type: mime });
  return {
    file: out, name, mime, size: out.size, originalSize,
    compressed: true, pages: isPdf ? best.pageCount : undefined,
    tooLarge: out.size > WORK_HARD_LIMIT,
  };
}
