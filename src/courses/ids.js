// Stable random IDs for instructor-authored modules/items/pages/uploads.
//   newId("m")  → "m_lpqxz_a3"
//   newId("it") → "it_lpqxz_a3"
export const newId = (prefix) =>
  prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
