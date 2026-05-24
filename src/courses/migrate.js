import { newId } from "./ids.js";

// Build a fresh per-class `modules` array (with stable item IDs) by seeding
// from a code template and folding in any legacy per-class authoring stored
// under the pre-Phase-2.5 `moduleConfig` shape:
//   { itemOverrides: { "course:<i>": { url } }, customItems: [...], hiddenItems: { "course:<i>"|"custom:<id>": true } }
//
// Returns { modules, moduleConfig } in the new shape:
//   modules:       [{ id, title, items: [{ id, type, ... }] }]
//   moduleConfig:  { [mid]: { releaseDate?, hiddenItems?: { [itemId]: true } } }
//
// Pure and idempotent. Safe to call with empty legacyConfig.
export function migrateLegacyModuleConfig(template, legacyConfig) {
  const legacy = legacyConfig || {};
  const newModuleConfig = {};

  const modules = (template || []).map(mod => {
    const cfg = legacy[mod.id] || {};
    const overrides = cfg.itemOverrides || {};
    const legacyCustom = Array.isArray(cfg.customItems) ? cfg.customItems : [];
    const legacyHidden = cfg.hiddenItems || {};

    // Track legacy → new ID mapping so we can re-key hiddenItems below.
    const remap = new Map();
    const items = [];

    (mod.items || []).forEach((it, i) => {
      const legacyKey = "course:" + i;
      const ov = overrides[legacyKey] || {};
      const id = newId("it");
      items.push({ id, ...it, ...ov });
      remap.set(legacyKey, id);
    });

    legacyCustom.forEach(ci => {
      const legacyKey = "custom:" + ci.id;
      const id = newId("it");
      // ci already has type + (pageId|uploadId|url|title) — drop its old id.
      const { id: _legacyCiId, ...rest } = ci;
      items.push({ id, ...rest });
      remap.set(legacyKey, id);
    });

    const newHidden = {};
    Object.keys(legacyHidden).forEach(k => {
      if (!legacyHidden[k]) return;
      const newKey = remap.get(k);
      if (newKey) newHidden[newKey] = true;
    });

    const nextCfg = {};
    if (cfg.releaseDate) nextCfg.releaseDate = cfg.releaseDate;
    if (Object.keys(newHidden).length) nextCfg.hiddenItems = newHidden;
    if (Object.keys(nextCfg).length) newModuleConfig[mod.id] = nextCfg;

    return { id: mod.id, title: mod.title, items };
  });

  return { modules, moduleConfig: newModuleConfig };
}
