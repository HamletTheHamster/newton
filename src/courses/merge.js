// Merges per-class instructor-authored `modules` with `moduleConfig`
// (release date + visibility), `pages`, and `uploads`.
//
// Input:
//   modulesArr:   [{ id, title, items: [{ id, type, ... }] }]   per-class, RTDB
//   moduleConfig: { [mid]: { releaseDate?, hiddenItems?: { [itemId]: true } } }
//   pages:        { [pageId]: { title, content, ... } }
//   uploads:      { [uploadId]: { name, size, mime, downloadUrl, ... } }
//
// Output per module: { id, title, releaseDate, items: [...] }
// Each item carries `_key` (= item.id) and `_hidden`, plus resolved
// pageContent / downloadUrl / etc. for page and file items.
export function buildModules(modulesArr, moduleConfig = {}, pages = {}, uploads = {}) {
  if (!Array.isArray(modulesArr)) return [];
  return modulesArr.map(mod => {
    const cfg = moduleConfig[mod.id] || {};
    const hidden = cfg.hiddenItems || {};
    const items = (mod.items || []).map(it => {
      const resolved = { ...it, _key: it.id, _hidden: !!hidden[it.id] };
      if (it.type === "page") {
        const page = pages[it.pageId] || null;
        resolved.pageContent = page?.content || "";
        if (!resolved.title && page?.title) resolved.title = page.title;
      } else if (it.type === "file") {
        const up = uploads[it.uploadId] || null;
        resolved.downloadUrl = up?.downloadUrl || null;
        resolved.fileName = up?.name || null;
        resolved.fileSize = up?.size || null;
        resolved.fileMime = up?.mime || null;
        if (!resolved.title && up?.name) resolved.title = up.name;
      }
      return resolved;
    });
    return { id: mod.id, title: mod.title, releaseDate: cfg.releaseDate || null, items };
  });
}
