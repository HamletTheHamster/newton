export const BG = "#1c1d1f";
export const CARD = "rgba(23,23,23,0.85)";
export const TEAL = "#00828c";
export const TEAL_DIM = "rgba(0,130,140,0.15)";
export const MUTED = "#a0a0a0";
export const BORDER = "rgba(255,255,255,0.08)";

export const s = {
  page: { minHeight: "100vh", background: BG, color: "#fff" },
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16 },
  input: { background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, color: "#fff", borderRadius: 10, padding: "12px 16px", outline: "none", width: "100%", fontSize: 14, boxSizing: "border-box" },
  btnPri: { background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontWeight: 600, cursor: "pointer", width: "100%", fontSize: 15 },
  btnSec: { background: CARD, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 20px", fontWeight: 600, cursor: "pointer", width: "100%", fontSize: 15 },
  btnGhost: { background: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 13 },
  btnDanger: { background: "rgba(127,29,29,0.4)", color: "#fca5a5", border: "1px solid rgba(127,29,29,0.6)", borderRadius: 8, padding: "10px 16px", cursor: "pointer", width: "100%", fontSize: 13, fontWeight: 500 },
  label: { color: MUTED, fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 },
  muted: { color: MUTED, fontSize: 13 },
  badge: (color) => ({ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }),
};
