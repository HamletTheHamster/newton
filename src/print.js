// Browser print-to-PDF of one region of the page.
//
// A student's PDF of a submission is the SAME DOM the app already renders, not a second document
// built by hand. The breakdown carries KaTeX math and live SVG plots (graphs, vectors, free-body
// diagrams) whose look is the answer being graded, so any second renderer for print would be a
// copy of the first to keep in step forever, and a rasterized one would print the math blurry.
// Instead the sheet is mounted hidden, `@media print` (src/index.css) hides everything else on
// the page, and the browser's own PDF writer does the typesetting, in vectors.
//
// The trade: the student lands in the print dialog and chooses the PDF destination there, rather
// than getting a file straight into Downloads. That is the only route to a real text-and-vector
// PDF without either a headless-Chrome service (there is no server here, only functions) or a
// rasterizing library.

// Marks the print as OURS. Without it a plain Cmd+P still prints the app the way it always did:
// the sheet is display:none until this class is on the body. Set on <html> AS WELL as <body>,
// because the app paints its dark background on <html>: that background is the page canvas, so
// on any page the sheet does not fill to the bottom it prints as a black band under the text.
export const PRINTING_CLASS = "newton-printing";

// Chrome and Safari name the saved PDF after the document title, so the title IS the filename.
export function printFilename(...parts) {
  return parts
    .filter(Boolean)
    .join(" - ")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

// The sheet's images are separate elements from the ones already on screen, so a print fired in
// the same frame can capture them blank. Waits for them, but never blocks the button on a URL
// that will never answer.
export function waitForImages(root, timeoutMs = 4000) {
  const imgs = root ? Array.from(root.querySelectorAll("img")) : [];
  const pending = imgs.filter(img => !img.complete || img.naturalWidth === 0);
  if (pending.length === 0) return Promise.resolve();
  return Promise.race([
    Promise.all(pending.map(img => new Promise(done => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }))),
    new Promise(done => setTimeout(done, timeoutMs)),
  ]);
}

// Opens the print dialog with `filename` as the suggested name, and puts the page back afterwards.
// `afterprint` is the real signal (Chrome 63+, Safari 13+, Firefox 6+); the long timeout only
// exists so a browser that never fires it cannot leave the tab titled after a homework forever.
export function printSheet(filename) {
  const prevTitle = document.title;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    document.body.classList.remove(PRINTING_CLASS);
    document.documentElement.classList.remove(PRINTING_CLASS);
    document.title = prevTitle;
  };
  if (filename) document.title = filename;
  document.body.classList.add(PRINTING_CLASS);
  document.documentElement.classList.add(PRINTING_CLASS);
  window.addEventListener("afterprint", restore, { once: true });
  const safety = setTimeout(restore, 60000);
  window.addEventListener("afterprint", () => clearTimeout(safety), { once: true });
  window.print();
}
