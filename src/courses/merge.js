// Merges course-defined modules with per-class instructor authoring
// (release dates, hidden items, URL overrides, custom items).
//
// Output shape (per module):
//   { id, title, releaseDate, items: [ ...mergedItems ] }
// Each merged item carries `_key` (stable id for visibility/override maps),
// `_hidden` (boolean), and `_origin` ("course" | "custom").
//
// Item key convention:
//   - Course items: `course:<index>` (positional in the course definition)
//   - Custom items: `custom:<ci.id>`
export function buildModules(courseModules, moduleConfig = {}, pages = {}, uploads = {}) {
  if (!Array.isArray(courseModules)) return [];
  return courseModules.map(mod => {
    const cfg = moduleConfig[mod.id] || {};
    const hidden = cfg.hiddenItems || {};
    const overrides = cfg.itemOverrides || {};

    const courseItems = (mod.items || []).map((it, i) => {
      const key = `course:${i}`;
      const ov = overrides[key] || {};
      return { ...it, ...ov, _key: key, _hidden: !!hidden[key], _origin: "course" };
    });

    const customItems = (cfg.customItems || []).map(ci => {
      const key = `custom:${ci.id}`;
      const resolved = { ...ci, _key: key, _hidden: !!hidden[key], _origin: "custom" };
      if (ci.type === "page") {
        const page = pages[ci.pageId] || null;
        resolved.pageContent = page?.content || "";
        if (!resolved.title && page?.title) resolved.title = page.title;
      } else if (ci.type === "file") {
        const up = uploads[ci.uploadId] || null;
        resolved.downloadUrl = up?.downloadUrl || null;
        resolved.fileName = up?.name || null;
        resolved.fileSize = up?.size || null;
        resolved.fileMime = up?.mime || null;
        if (!resolved.title && up?.name) resolved.title = up.name;
      }
      return resolved;
    });

    return {
      ...mod,
      releaseDate: cfg.releaseDate || null,
      items: [...courseItems, ...customItems],
    };
  });
}
