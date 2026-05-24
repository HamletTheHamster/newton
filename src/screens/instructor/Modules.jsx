import { useState } from "react";
import { s, TEAL, MUTED, BORDER } from "../../theme.js";
import { fmtDueTime, dueToDate } from "../../utils.js";

// Stable item-key convention (matches src/courses/merge.js):
//   - course items:  `course:<index>` (position in the course definition)
//   - custom items:  `custom:<ci.id>`
const courseKey = i => "course:" + i;
const customKey = id => "custom:" + id;

const newId = (prefix) => prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const fmtBytes = bytes => {
  if (!bytes || bytes < 1024) return (bytes || 0) + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

// Item type → display label
const TYPE_LABEL = { quiz: "Quiz", reading: "Reading", notes: "Notes", homework: "Homework", page: "Page", link: "Link", file: "File" };

// Eye / eye-slash icon
const EyeIcon = ({ hidden }) => hidden
  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

export function Modules({ classId, courseModules, moduleConfig, pages, uploads, quizzes, onSaveModuleConfig, onSaveUpload, onDeleteUpload, onUploadFile, onOpenPageEditor }) {
  const [openMap, setOpenMap] = useState({});
  const [editingTimeFor, setEditingTimeFor] = useState(null);
  const [addingTo, setAddingTo] = useState(null);    // moduleId
  const [addType, setAddType] = useState(null);      // "link" | "file"
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addFile, setAddFile] = useState(null);
  const [addProgress, setAddProgress] = useState(0);
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState("");

  if (!courseModules.length) {
    return <div style={{ ...s.card, padding: 40, textAlign: "center", color: MUTED }}>No modules defined for this course.</div>;
  }

  const cfgOf = id => moduleConfig[id] || {};
  const toggleOne = id => setOpenMap(prev => ({ ...prev, [id]: !prev[id] }));

  const setReleaseDate = async (mod, value) => {
    const cfg = { ...cfgOf(mod.id) };
    if (value) cfg.releaseDate = value; else delete cfg.releaseDate;
    await onSaveModuleConfig(mod.id, cfg);
  };

  const setReleaseTime = async (mod, dateVal, timeVal) => {
    if (!dateVal || !timeVal) return;
    const cfg = { ...cfgOf(mod.id), releaseDate: dateVal + " " + timeVal };
    await onSaveModuleConfig(mod.id, cfg);
  };

  const toggleHidden = async (mod, key) => {
    const cfg = { ...cfgOf(mod.id) };
    const hidden = { ...(cfg.hiddenItems || {}) };
    if (hidden[key]) delete hidden[key]; else hidden[key] = true;
    cfg.hiddenItems = hidden;
    await onSaveModuleConfig(mod.id, cfg);
  };

  const setCourseItemUrl = async (mod, key, url) => {
    const cfg = { ...cfgOf(mod.id) };
    const overrides = { ...(cfg.itemOverrides || {}) };
    const trimmed = (url || "").trim();
    if (trimmed) overrides[key] = { ...(overrides[key] || {}), url: trimmed };
    else if (overrides[key]) { const cleaned = { ...overrides[key] }; delete cleaned.url; if (Object.keys(cleaned).length) overrides[key] = cleaned; else delete overrides[key]; }
    cfg.itemOverrides = overrides;
    await onSaveModuleConfig(mod.id, cfg);
  };

  const moveCustomItem = async (mod, ciId, dir) => {
    const cfg = { ...cfgOf(mod.id) };
    const items = Array.isArray(cfg.customItems) ? [...cfg.customItems] : [];
    const i = items.findIndex(it => it.id === ciId);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    cfg.customItems = items;
    await onSaveModuleConfig(mod.id, cfg);
  };

  const deleteCustomItem = async (mod, ciId) => {
    const cfg = { ...cfgOf(mod.id) };
    const target = (cfg.customItems || []).find(it => it.id === ciId);
    const items = Array.isArray(cfg.customItems) ? cfg.customItems.filter(it => it.id !== ciId) : [];
    cfg.customItems = items;
    const hidden = { ...(cfg.hiddenItems || {}) };
    if (hidden[customKey(ciId)]) { delete hidden[customKey(ciId)]; cfg.hiddenItems = hidden; }
    await onSaveModuleConfig(mod.id, cfg);
    if (target?.type === "file" && target.uploadId && onDeleteUpload) {
      try { await onDeleteUpload(target.uploadId); } catch (e) { console.warn("Upload cleanup failed:", e?.message || e); }
    }
  };

  const resetAddState = () => {
    setAddingTo(null); setAddType(null);
    setAddTitle(""); setAddUrl(""); setAddFile(null);
    setAddProgress(0); setAddBusy(false); setAddErr("");
  };

  const submitAddLink = async (mod) => {
    setAddErr("");
    const t = addTitle.trim(), u = addUrl.trim();
    if (!t) { setAddErr("Title is required."); return; }
    if (!u) { setAddErr("URL is required."); return; }
    let normalized = u; if (!/^https?:\/\//i.test(u)) normalized = "https://" + u;
    const cfg = { ...cfgOf(mod.id) };
    const items = Array.isArray(cfg.customItems) ? [...cfg.customItems] : [];
    items.push({ id: newId("ci"), type: "link", title: t, url: normalized });
    cfg.customItems = items;
    await onSaveModuleConfig(mod.id, cfg);
    resetAddState();
  };

  const submitAddFile = async (mod) => {
    setAddErr("");
    if (!addFile) { setAddErr("Choose a file to upload."); return; }
    if (addFile.size >= 25 * 1024 * 1024) { setAddErr("File is too large (25 MB max)."); return; }
    const title = addTitle.trim() || addFile.name;
    setAddBusy(true); setAddProgress(0);
    try {
      const uploadId = newId("u");
      const safeName = addFile.name.replace(/[^\w.\-]+/g, "_");
      const storagePath = `classes/${classId}/uploads/${uploadId}/${safeName}`;
      const result = await onUploadFile(storagePath, addFile, p => setAddProgress(p));
      const meta = {
        name: addFile.name,
        size: result.size,
        mime: result.mime,
        storagePath: result.storagePath,
        downloadUrl: result.downloadUrl,
        createdAt: new Date().toISOString(),
      };
      await onSaveUpload(uploadId, meta);
      const cfg = { ...cfgOf(mod.id) };
      const items = Array.isArray(cfg.customItems) ? [...cfg.customItems] : [];
      items.push({ id: newId("ci"), type: "file", title, uploadId });
      cfg.customItems = items;
      await onSaveModuleConfig(mod.id, cfg);
      resetAddState();
    } catch (e) {
      setAddErr(e?.message || "Upload failed.");
      setAddBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {courseModules.map(mod => {
        const cfg = cfgOf(mod.id);
        const releaseDate = cfg.releaseDate || null;
        const hidden = cfg.hiddenItems || {};
        const overrides = cfg.itemOverrides || {};
        const customItems = Array.isArray(cfg.customItems) ? cfg.customItems : [];
        const isOpen = !!openMap[mod.id];

        const dateVal = releaseDate ? releaseDate.slice(0, 10) : "";
        const timeVal = releaseDate && releaseDate.length === 16 && releaseDate[10] === ' ' ? releaseDate.slice(11) : "23:59";
        const releaseAt = releaseDate ? dueToDate(releaseDate) : null;
        const locked = !!(releaseAt && new Date() < releaseAt);

        return (
          <div key={mod.id} style={{ ...s.card, overflow: "hidden" }}>
            {/* Module header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", flexWrap: "wrap" }}>
              <button onClick={() => toggleOne(mod.id)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: 0, flex: "1 1 240px", minWidth: 0, textAlign: "left" }}>
                <span style={{ color: MUTED, fontSize: 13, transform: isOpen ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.2s", flexShrink: 0 }}>▶</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{mod.title}</span>
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <input type="date" style={{ ...s.input, width: "auto", padding: "6px 10px", fontSize: 12 }} value={dateVal} onChange={async e => { setEditingTimeFor(null); await setReleaseDate(mod, e.target.value); }} />
                {releaseDate && (editingTimeFor === mod.id
                  ? <input type="time" autoFocus style={{ ...s.input, width: "auto", padding: "6px 10px", fontSize: 12 }} value={timeVal} onChange={async e => { if (e.target.value) await setReleaseTime(mod, dateVal, e.target.value); }} onBlur={() => setEditingTimeFor(null)} />
                  : <button onClick={() => setEditingTimeFor(mod.id)} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 12, cursor: "pointer", padding: "4px 6px", fontFamily: "monospace" }}>{fmtDueTime(releaseDate)}</button>
                )}
                {releaseDate && <span style={s.badge(locked ? "#facc15" : "#4ade80")}>{locked ? "Locked" : "Released"}</span>}
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: `1px solid ${BORDER}` }}>
                {/* Course-defined items */}
                {(mod.items || []).map((item, i) => {
                  const key = courseKey(i);
                  const isHidden = !!hidden[key];
                  const ov = overrides[key] || {};
                  const url = ov.url || item.url || "";
                  const title = item.type === "quiz"
                    ? (quizzes.find(q => q.id === item.refId)?.title || item.title || "Quiz")
                    : (item.title || TYPE_LABEL[item.type]);
                  const canHaveUrl = item.type === "reading" || item.type === "notes";
                  return (
                    <ItemRow
                      key={key}
                      icon={TYPE_LABEL[item.type]}
                      title={title}
                      isHidden={isHidden}
                      onToggleHidden={() => toggleHidden(mod, key)}
                      urlField={canHaveUrl ? (
                        <UrlInput
                          initial={url}
                          onCommit={val => setCourseItemUrl(mod, key, val)}
                          placeholder="Paste link URL (https://…)"
                        />
                      ) : null}
                    />
                  );
                })}

                {/* Custom items */}
                {customItems.map((ci, idx) => {
                  const key = customKey(ci.id);
                  const isHidden = !!hidden[key];
                  const upload = ci.type === "file" ? uploads[ci.uploadId] : null;
                  const subtitle = ci.type === "link" ? ci.url
                    : ci.type === "page" ? "Page"
                    : ci.type === "file" ? (upload ? `${upload.name || "file"}${upload.size ? " · " + fmtBytes(upload.size) : ""}` : "File (missing)")
                    : null;
                  return (
                    <ItemRow
                      key={key}
                      icon={TYPE_LABEL[ci.type] || "Item"}
                      title={ci.title || (ci.type === "link" ? ci.url : (upload?.name || "Untitled"))}
                      subtitle={subtitle}
                      isHidden={isHidden}
                      onToggleHidden={() => toggleHidden(mod, key)}
                      actions={
                        <>
                          <IconBtn title="Move up" disabled={idx === 0} onClick={() => moveCustomItem(mod, ci.id, -1)}>↑</IconBtn>
                          <IconBtn title="Move down" disabled={idx === customItems.length - 1} onClick={() => moveCustomItem(mod, ci.id, 1)}>↓</IconBtn>
                          {ci.type === "page" && (
                            <IconBtn title="Edit page" onClick={() => onOpenPageEditor(mod.id, ci.id, ci.pageId)}>✎</IconBtn>
                          )}
                          {ci.type === "file" && upload?.downloadUrl && (
                            <IconBtn title="Open file" onClick={() => window.open(upload.downloadUrl, "_blank", "noopener,noreferrer")}>↗</IconBtn>
                          )}
                          <IconBtn title="Delete" onClick={async () => {
                            if (!window.confirm("Delete this item? This cannot be undone.")) return;
                            await deleteCustomItem(mod, ci.id);
                          }}>🗑</IconBtn>
                        </>
                      }
                    />
                  );
                })}

                {/* Add item bar */}
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: "12px 18px", background: "rgba(255,255,255,0.02)" }}>
                  {addingTo === mod.id && addType === "link" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input style={{ ...s.input, flex: "1 1 200px", padding: "8px 12px", fontSize: 13 }} placeholder="Link title (e.g., Khan Academy: Work)" value={addTitle} onChange={e => setAddTitle(e.target.value)} autoFocus />
                        <input style={{ ...s.input, flex: "2 1 280px", padding: "8px 12px", fontSize: 13 }} placeholder="https://…" value={addUrl} onChange={e => setAddUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submitAddLink(mod); }} />
                      </div>
                      {addErr && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{addErr}</p>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => submitAddLink(mod)} style={{ ...s.btnPri, width: "auto", padding: "8px 16px", fontSize: 13 }}>Add Link</button>
                        <button onClick={resetAddState} style={{ ...s.btnGhost, width: "auto" }}>Cancel</button>
                      </div>
                    </div>
                  ) : addingTo === mod.id && addType === "file" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <label style={{ ...s.btnGhost, width: "auto", cursor: addBusy ? "not-allowed" : "pointer", opacity: addBusy ? 0.5 : 1 }}>
                          {addFile ? "Choose different…" : "Choose file…"}
                          <input type="file" disabled={addBusy} onChange={e => { setAddFile(e.target.files?.[0] || null); if (!addTitle && e.target.files?.[0]) setAddTitle(e.target.files[0].name); }} style={{ display: "none" }} />
                        </label>
                        {addFile && <span style={{ ...s.muted, fontSize: 12 }}>{addFile.name} · {fmtBytes(addFile.size)}</span>}
                        <input style={{ ...s.input, flex: "1 1 240px", padding: "8px 12px", fontSize: 13 }} placeholder="Display title (defaults to filename)" value={addTitle} onChange={e => setAddTitle(e.target.value)} disabled={addBusy} />
                      </div>
                      {addBusy && (
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "hidden", height: 6 }}>
                          <div style={{ width: Math.round(addProgress * 100) + "%", height: "100%", background: TEAL, transition: "width 0.15s linear" }} />
                        </div>
                      )}
                      {addErr && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{addErr}</p>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => submitAddFile(mod)} disabled={addBusy || !addFile} style={{ ...s.btnPri, width: "auto", padding: "8px 16px", fontSize: 13, opacity: addBusy || !addFile ? 0.5 : 1 }}>
                          {addBusy ? "Uploading… " + Math.round(addProgress * 100) + "%" : "Upload"}
                        </button>
                        <button onClick={resetAddState} disabled={addBusy} style={{ ...s.btnGhost, width: "auto", opacity: addBusy ? 0.5 : 1 }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => onOpenPageEditor(mod.id, null, null)} style={{ ...s.btnGhost, width: "auto" }}>+ Page</button>
                      <button onClick={() => { resetAddState(); setAddingTo(mod.id); setAddType("link"); }} style={{ ...s.btnGhost, width: "auto" }}>+ Link</button>
                      <button onClick={() => { resetAddState(); setAddingTo(mod.id); setAddType("file"); }} style={{ ...s.btnGhost, width: "auto" }}>+ File</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// One item row in the instructor module editor.
function ItemRow({ icon, title, subtitle, isHidden, onToggleHidden, urlField, actions }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderTop: `1px solid ${BORDER}`, opacity: isHidden ? 0.45 : 1, flexWrap: "wrap" }}>
      <span style={{ ...s.muted, fontSize: 11, fontFamily: "monospace", flexShrink: 0, minWidth: 60 }}>{icon}</span>
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        {subtitle && <div style={{ ...s.muted, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
      </div>
      {urlField && <div style={{ flex: "2 1 280px", minWidth: 0 }}>{urlField}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {actions}
        <IconBtn title={isHidden ? "Show to students" : "Hide from students"} onClick={onToggleHidden}>
          <EyeIcon hidden={isHidden} />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, disabled }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{ background: "transparent", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: "5px 8px", cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, lineHeight: 1, opacity: disabled ? 0.35 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28 }}
    >
      {children}
    </button>
  );
}

// Inline URL field that commits on blur or Enter.
function UrlInput({ initial, onCommit, placeholder }) {
  const [val, setVal] = useState(initial || "");
  const [dirty, setDirty] = useState(false);
  const commit = async () => {
    if (!dirty) return;
    setDirty(false);
    await onCommit(val);
  };
  return (
    <input
      style={{ ...s.input, padding: "6px 10px", fontSize: 12 }}
      value={val}
      placeholder={placeholder}
      onChange={e => { setVal(e.target.value); setDirty(true); }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
    />
  );
}
