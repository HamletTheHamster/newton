export function SyncBadge({ status, label, error }) {
  if (status === 'idle') return null;
  const cfg = {
    saving: { color: "#facc15", text: "💾 Saving…" },
    saved: { color: "#4ade80", text: label || "✓ Saved" },
    error: { color: "#f87171", text: "⚠️ Save failed" },
  };
  const c = cfg[status] || cfg.saving;
  return (
    <span
      style={{ fontSize: 12, color: c.color, fontWeight: 500, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      title={error}
    >
      {c.text}{status === 'error' && error ? `: ${error}` : ''}
    </span>
  );
}
