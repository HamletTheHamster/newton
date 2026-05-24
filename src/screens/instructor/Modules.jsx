import { useState } from "react";
import { s, TEAL, MUTED, BORDER } from "../../theme.js";
import { fmtDueTime, dueToDate } from "../../utils.js";
import { newId } from "../../courses/ids.js";

const fmtBytes = bytes => {
  if (!bytes || bytes < 1024) return (bytes || 0) + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

const TYPE_LABEL = { quiz: "Quiz", reading: "Reading", notes: "Notes", homework: "Homework", page: "Page", link: "Link", file: "File" };

const EyeIcon = ({ hidden }) => hidden
  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

export function Modules({
  classId, modules, moduleConfig, pages, uploads, quizzes,
  onSaveModules, onSaveModuleConfig, onSavePage, onDeletePage,
  onSaveUpload, onDeleteUpload, onUploadFile, onOpenPageEditor,
}) {
  const [openMap, setOpenMap] = useState({});
  const [editingTimeFor, setEditingTimeFor] = useState(null);
  const [editingTitleFor, setEditingTitleFor] = useState(null);
  const [titleDraft, setTitleDraft] = useState("");

  // Add-item flow state (one module's add bar active at a time)
  const [addingTo, setAddingTo] = useState(null);    // moduleId
  const [addType, setAddType] = useState(null);      // "quiz" | "reading" | "notes" | "link" | "file"
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addFile, setAddFile] = useState(null);
  const [addQuizPick, setAddQuizPick] = useState("");
  const [addProgress, setAddProgress] = useState(0);
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState("");

  // New-module form
  const [creatingModule, setCreatingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const cfgOf = id => moduleConfig[id] || {};
  const toggleOne = id => setOpenMap(prev => ({ ...prev, [id]: !prev[id] }));

  const resetAddState = () => {
    setAddingTo(null); setAddType(null);
    setAddTitle(""); setAddUrl(""); setAddFile(null);
    setAddQuizPick(""); setAddProgress(0); setAddBusy(false); setAddErr("");
  };

  // ── Module-level CRUD ────────────────────────────────────────────────────
  const updateModule = async (moduleId, mutator) => {
    const next = (modules || []).map(m => m.id === moduleId ? mutator(m) : m);
    await onSaveModules(next);
  };

  const renameModule = async (moduleId, nextTitle) => {
    const t = (nextTitle || "").trim();
    if (!t) { setEditingTitleFor(null); return; }
    await updateModule(moduleId, m => ({ ...m, title: t }));
    setEditingTitleFor(null);
  };

  const moveModule = async (moduleId, dir) => {
    const arr = [...(modules || [])];
    const i = arr.findIndex(m => m.id === moduleId);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await onSaveModules(arr);
  };

  const deleteModule = async (mod) => {
    if (!window.confirm(`Delete module "${mod.title}" and all its items? This cannot be undone.`)) return;
    // Cascade-clean owned pages and uploads.
    const items = mod.items || [];
    for (const it of items) {
      if (it.type === "page" && it.pageId && onDeletePage) {
        try { await onDeletePage(it.pageId); } catch (e) { console.warn("Page cleanup failed:", e?.message || e); }
      } else if (it.type === "file" && it.uploadId && onDeleteUpload) {
        try { await onDeleteUpload(it.uploadId); } catch (e) { console.warn("Upload cleanup failed:", e?.message || e); }
      }
    }
    // Remove the module from the list.
    const nextArr = (modules || []).filter(m => m.id !== mod.id);
    await onSaveModules(nextArr);
    // Drop any moduleConfig entry for it.
    if (moduleConfig[mod.id]) await onSaveModuleConfig(mod.id, {});
  };

  const submitCreateModule = async () => {
    const t = newModuleTitle.trim();
    if (!t) return;
    const next = [...(modules || []), { id: newId("m"), title: t, items: [] }];
    await onSaveModules(next);
    setCreatingModule(false); setNewModuleTitle("");
  };

  // ── Release date / time ──────────────────────────────────────────────────
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

  // ── Visibility ───────────────────────────────────────────────────────────
  const toggleHidden = async (mod, itemId) => {
    const cfg = { ...cfgOf(mod.id) };
    const hidden = { ...(cfg.hiddenItems || {}) };
    if (hidden[itemId]) delete hidden[itemId]; else hidden[itemId] = true;
    cfg.hiddenItems = hidden;
    await onSaveModuleConfig(mod.id, cfg);
  };

  // ── Item-level CRUD ──────────────────────────────────────────────────────
  const updateItem = async (moduleId, itemId, mutator) => {
    await updateModule(moduleId, m => ({
      ...m,
      items: (m.items || []).map(it => it.id === itemId ? mutator(it) : it),
    }));
  };

  const moveItem = async (moduleId, itemId, dir) => {
    await updateModule(moduleId, m => {
      const items = [...(m.items || [])];
      const i = items.findIndex(it => it.id === itemId);
      if (i < 0) return m;
      const j = i + dir;
      if (j < 0 || j >= items.length) return m;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...m, items };
    });
  };

  const deleteItem = async (mod, item) => {
    if (!window.confirm(`Delete "${item.title || TYPE_LABEL[item.type]}"? This cannot be undone.`)) return;
    await updateModule(mod.id, m => ({ ...m, items: (m.items || []).filter(it => it.id !== item.id) }));
    // Clean up hidden flag if any.
    const cfg = cfgOf(mod.id);
    if (cfg.hiddenItems?.[item.id]) {
      const hidden = { ...cfg.hiddenItems }; delete hidden[item.id];
      await onSaveModuleConfig(mod.id, { ...cfg, hiddenItems: hidden });
    }
    // Cascade for owned content.
    if (item.type === "page" && item.pageId && onDeletePage) {
      try { await onDeletePage(item.pageId); } catch (e) { console.warn("Page cleanup failed:", e?.message || e); }
    } else if (item.type === "file" && item.uploadId && onDeleteUpload) {
      try { await onDeleteUpload(item.uploadId); } catch (e) { console.warn("Upload cleanup failed:", e?.message || e); }
    }
  };

  const setItemUrl = async (moduleId, itemId, url) => {
    const trimmed = (url || "").trim();
    await updateItem(moduleId, itemId, it => ({ ...it, url: trimmed || null }));
  };

  // ── Add-item submitters ──────────────────────────────────────────────────
  const submitAddQuiz = async (mod) => {
    setAddErr("");
    if (!addQuizPick) { setAddErr("Pick a quiz."); return; }
    const items = [...(mod.items || []), { id: newId("it"), type: "quiz", refId: addQuizPick }];
    await updateModule(mod.id, m => ({ ...m, items }));
    resetAddState();
  };

  const submitAddTextItem = async (mod, type) => {
    setAddErr("");
    const t = addTitle.trim();
    if (!t) { setAddErr("Title is required."); return; }
    const u = addUrl.trim();
    let url = u || null;
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    const items = [...(mod.items || []), { id: newId("it"), type, title: t, url }];
    await updateModule(mod.id, m => ({ ...m, items }));
    resetAddState();
  };

  const submitAddLink = async (mod) => {
    setAddErr("");
    const t = addTitle.trim(), u = addUrl.trim();
    if (!t) { setAddErr("Title is required."); return; }
    if (!u) { setAddErr("URL is required."); return; }
    let normalized = u; if (!/^https?:\/\//i.test(u)) normalized = "https://" + u;
    const items = [...(mod.items || []), { id: newId("it"), type: "link", title: t, url: normalized }];
    await updateModule(mod.id, m => ({ ...m, items }));
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
        name: addFile.name, size: result.size, mime: result.mime,
        storagePath: result.storagePath, downloadUrl: result.downloadUrl,
        createdAt: new Date().toISOString(),
      };
      await onSaveUpload(uploadId, meta);
      const items = [...(mod.items || []), { id: newId("it"), type: "file", title, uploadId }];
      await updateModule(mod.id, m => ({ ...m, items }));
      resetAddState();
    } catch (e) {
      setAddErr(e?.message || "Upload failed.");
      setAddBusy(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const list = modules || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <TopBar
        creating={creatingModule}
        title={newModuleTitle}
        onTitleChange={setNewModuleTitle}
        onStartCreate={() => { setCreatingModule(true); setNewModuleTitle(""); }}
        onSubmitCreate={submitCreateModule}
        onCancelCreate={() => { setCreatingModule(false); setNewModuleTitle(""); }}
      />

      {list.length === 0 && !creatingModule && (
        <div style={{ ...s.card, padding: 32, textAlign: "center", color: MUTED }}>
          No modules yet. Click <span style={{ color: TEAL }}>+ New Module</span> above to add one.
        </div>
      )}

      {list.map((mod, modIdx) => {
        const cfg = cfgOf(mod.id);
        const releaseDate = cfg.releaseDate || null;
        const hidden = cfg.hiddenItems || {};
        const items = mod.items || [];
        const isOpen = !!openMap[mod.id];

        const dateVal = releaseDate ? releaseDate.slice(0, 10) : "";
        const timeVal = releaseDate && releaseDate.length === 16 && releaseDate[10] === ' ' ? releaseDate.slice(11) : "23:59";
        const releaseAt = releaseDate ? dueToDate(releaseDate) : null;
        const locked = !!(releaseAt && new Date() < releaseAt);

        return (
          <div key={mod.id} style={{ ...s.card, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", flexWrap: "wrap" }}>
              <button onClick={() => toggleOne(mod.id)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: 0, flexShrink: 0 }}>
                <span style={{ fontSize: 13, transform: isOpen ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▶</span>
              </button>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                {editingTitleFor === mod.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      autoFocus
                      value={titleDraft}
                      onChange={e => setTitleDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") renameModule(mod.id, titleDraft);
                        if (e.key === "Escape") setEditingTitleFor(null);
                      }}
                      style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${TEAL}`, color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 14, outline: "none", width: "100%", maxWidth: 360 }}
                    />
                    <button onClick={() => renameModule(mod.id, titleDraft)} style={{ background: "rgba(0,130,140,0.2)", border: `1px solid ${TEAL}`, color: TEAL, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                    <button onClick={() => setEditingTitleFor(null)} style={{ background: "none", border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: "#fff" }}>{mod.title || "Untitled module"}</span>
                    <button onClick={() => { setEditingTitleFor(mod.id); setTitleDraft(mod.title || ""); }} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, padding: "2px 4px", lineHeight: 1 }} title="Rename module">✎</button>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <input type="date" style={{ ...s.input, width: "auto", padding: "6px 10px", fontSize: 12 }} value={dateVal} onChange={async e => { setEditingTimeFor(null); await setReleaseDate(mod, e.target.value); }} />
                {releaseDate && (editingTimeFor === mod.id
                  ? <input type="time" autoFocus style={{ ...s.input, width: "auto", padding: "6px 10px", fontSize: 12 }} value={timeVal} onChange={async e => { if (e.target.value) await setReleaseTime(mod, dateVal, e.target.value); }} onBlur={() => setEditingTimeFor(null)} />
                  : <button onClick={() => setEditingTimeFor(mod.id)} style={{ background: "transparent", border: "none", color: MUTED, fontSize: 12, cursor: "pointer", padding: "4px 6px", fontFamily: "monospace" }}>{fmtDueTime(releaseDate)}</button>
                )}
                {releaseDate && <span style={s.badge(locked ? "#facc15" : "#4ade80")}>{locked ? "Locked" : "Released"}</span>}
                <IconBtn title="Move up"   disabled={modIdx === 0} onClick={() => moveModule(mod.id, -1)}>↑</IconBtn>
                <IconBtn title="Move down" disabled={modIdx === list.length - 1} onClick={() => moveModule(mod.id, 1)}>↓</IconBtn>
                <IconBtn title="Delete module" onClick={() => deleteModule(mod)}>🗑</IconBtn>
              </div>
            </div>

            {isOpen && (
              <div style={{ borderTop: `1px solid ${BORDER}` }}>
                {items.map((item, itemIdx) => {
                  const isHidden = !!hidden[item.id];
                  const upload = item.type === "file" ? uploads[item.uploadId] : null;
                  const subtitle =
                    item.type === "link" ? item.url :
                    item.type === "page" ? "Page" :
                    item.type === "file" ? (upload ? `${upload.name || "file"}${upload.size ? " · " + fmtBytes(upload.size) : ""}` : "File (missing)") :
                    null;
                  const canHaveUrl = item.type === "reading" || item.type === "notes";
                  const displayTitle = item.type === "quiz"
                    ? (quizzes.find(q => q.id === item.refId)?.title || `Quiz (${item.refId})`)
                    : (item.title || (item.type === "link" ? item.url : (upload?.name || "Untitled")));

                  return (
                    <ItemRow
                      key={item.id}
                      typeLabel={TYPE_LABEL[item.type] || "Item"}
                      title={displayTitle}
                      subtitle={subtitle}
                      isHidden={isHidden}
                      urlField={canHaveUrl ? (
                        <UrlInput
                          initial={item.url || ""}
                          onCommit={val => setItemUrl(mod.id, item.id, val)}
                          placeholder="Paste link URL (https://…)"
                        />
                      ) : null}
                      actions={
                        <>
                          <IconBtn title="Move up"   disabled={itemIdx === 0} onClick={() => moveItem(mod.id, item.id, -1)}>↑</IconBtn>
                          <IconBtn title="Move down" disabled={itemIdx === items.length - 1} onClick={() => moveItem(mod.id, item.id, 1)}>↓</IconBtn>
                          {item.type === "page" && (
                            <IconBtn title="Edit page" onClick={() => onOpenPageEditor(mod.id, item.id, item.pageId)}>✎</IconBtn>
                          )}
                          {item.type === "file" && upload?.downloadUrl && (
                            <IconBtn title="Open file" onClick={() => window.open(upload.downloadUrl, "_blank", "noopener,noreferrer")}>↗</IconBtn>
                          )}
                          <IconBtn title="Delete" onClick={() => deleteItem(mod, item)}>🗑</IconBtn>
                        </>
                      }
                      onToggleHidden={() => toggleHidden(mod, item.id)}
                    />
                  );
                })}

                <AddItemBar
                  mod={mod}
                  active={addingTo === mod.id ? addType : null}
                  busy={addBusy}
                  progress={addProgress}
                  err={addErr}
                  title={addTitle} setTitle={setAddTitle}
                  url={addUrl} setUrl={setAddUrl}
                  file={addFile} setFile={setAddFile}
                  quizPick={addQuizPick} setQuizPick={setAddQuizPick}
                  quizzes={quizzes}
                  onStart={type => { resetAddState(); setAddingTo(mod.id); setAddType(type); if (type === "file") {/* lazy file pick */} }}
                  onCancel={resetAddState}
                  onOpenPageEditor={() => onOpenPageEditor(mod.id, null, null)}
                  onSubmitQuiz={() => submitAddQuiz(mod)}
                  onSubmitText={() => submitAddTextItem(mod, addType)}
                  onSubmitLink={() => submitAddLink(mod)}
                  onSubmitFile={() => submitAddFile(mod)}
                />
              </div>
            )}
          </div>
        );
      })}

      {list.length > 2 && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={() => { setCreatingModule(true); setNewModuleTitle(""); }} style={{ ...s.btnGhost, width: "auto" }}>+ New Module</button>
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function TopBar({ creating, title, onTitleChange, onStartCreate, onSubmitCreate, onCancelCreate }) {
  if (creating) {
    return (
      <div style={{ ...s.card, padding: "12px 18px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          autoFocus
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSubmitCreate(); if (e.key === "Escape") onCancelCreate(); }}
          placeholder='Module title (e.g., "Lecture 15 | Special Relativity")'
          style={{ ...s.input, flex: "1 1 280px", padding: "8px 12px", fontSize: 13 }}
        />
        <button onClick={onSubmitCreate} style={{ ...s.btnPri, width: "auto", padding: "8px 16px", fontSize: 13 }}>Create</button>
        <button onClick={onCancelCreate} style={{ ...s.btnGhost, width: "auto" }}>Cancel</button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex" }}>
      <button onClick={onStartCreate} style={{ ...s.btnGhost, width: "auto" }}>+ New Module</button>
    </div>
  );
}

function ItemRow({ typeLabel, title, subtitle, isHidden, onToggleHidden, urlField, actions }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderTop: `1px solid ${BORDER}`, opacity: isHidden ? 0.45 : 1, flexWrap: "wrap" }}>
      <span style={{ ...s.muted, fontSize: 11, fontFamily: "monospace", flexShrink: 0, minWidth: 60 }}>{typeLabel}</span>
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

function UrlInput({ initial, onCommit, placeholder }) {
  const [val, setVal] = useState(initial || "");
  const [dirty, setDirty] = useState(false);
  const commit = async () => { if (!dirty) return; setDirty(false); await onCommit(val); };
  return (
    <input
      style={{ ...s.input, padding: "6px 10px", fontSize: 12 }}
      value={val}
      placeholder={placeholder}
      onChange={e => { setVal(e.target.value); setDirty(true); }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
    />
  );
}

function AddItemBar({
  mod, active, busy, progress, err,
  title, setTitle, url, setUrl, file, setFile, quizPick, setQuizPick, quizzes,
  onStart, onCancel, onOpenPageEditor,
  onSubmitQuiz, onSubmitText, onSubmitLink, onSubmitFile,
}) {
  const wrap = (child) => (
    <div style={{ borderTop: `1px solid ${BORDER}`, padding: "12px 18px", background: "rgba(255,255,255,0.02)" }}>{child}</div>
  );

  if (active === "quiz") {
    return wrap(
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select autoFocus value={quizPick} onChange={e => setQuizPick(e.target.value)} style={{ ...s.input, flex: "1 1 280px", padding: "8px 12px", fontSize: 13, width: "auto" }}>
            <option value="" style={{ background: "#252627" }}>— Choose a quiz —</option>
            {(quizzes || []).map(q => (
              <option key={q.id} value={q.id} style={{ background: "#252627" }}>{q.title}</option>
            ))}
          </select>
        </div>
        {err && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSubmitQuiz} style={{ ...s.btnPri, width: "auto", padding: "8px 16px", fontSize: 13 }}>Add Quiz</button>
          <button onClick={onCancel} style={{ ...s.btnGhost, width: "auto" }}>Cancel</button>
        </div>
      </div>
    );
  }

  if (active === "reading" || active === "notes") {
    return wrap(
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input autoFocus style={{ ...s.input, flex: "1 1 200px", padding: "8px 12px", fontSize: 13 }} placeholder={active === "reading" ? "Reading title (e.g., 'Ch. 7 — Work')" : "Notes title (e.g., 'Lecture 7 Notes')"} value={title} onChange={e => setTitle(e.target.value)} />
          <input style={{ ...s.input, flex: "2 1 280px", padding: "8px 12px", fontSize: 13 }} placeholder="URL (optional)" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onSubmitText(); }} />
        </div>
        {err && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSubmitText} style={{ ...s.btnPri, width: "auto", padding: "8px 16px", fontSize: 13 }}>Add {active === "reading" ? "Reading" : "Notes"}</button>
          <button onClick={onCancel} style={{ ...s.btnGhost, width: "auto" }}>Cancel</button>
        </div>
      </div>
    );
  }

  if (active === "link") {
    return wrap(
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input autoFocus style={{ ...s.input, flex: "1 1 200px", padding: "8px 12px", fontSize: 13 }} placeholder="Link title (e.g., Khan Academy: Work)" value={title} onChange={e => setTitle(e.target.value)} />
          <input style={{ ...s.input, flex: "2 1 280px", padding: "8px 12px", fontSize: 13 }} placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onSubmitLink(); }} />
        </div>
        {err && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSubmitLink} style={{ ...s.btnPri, width: "auto", padding: "8px 16px", fontSize: 13 }}>Add Link</button>
          <button onClick={onCancel} style={{ ...s.btnGhost, width: "auto" }}>Cancel</button>
        </div>
      </div>
    );
  }

  if (active === "file") {
    return wrap(
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ ...s.btnGhost, width: "auto", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1 }}>
            {file ? "Choose different…" : "Choose file…"}
            <input type="file" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); if (!title && e.target.files?.[0]) setTitle(e.target.files[0].name); }} style={{ display: "none" }} />
          </label>
          {file && <span style={{ ...s.muted, fontSize: 12 }}>{file.name} · {fmtBytes(file.size)}</span>}
          <input style={{ ...s.input, flex: "1 1 240px", padding: "8px 12px", fontSize: 13 }} placeholder="Display title (defaults to filename)" value={title} onChange={e => setTitle(e.target.value)} disabled={busy} />
        </div>
        {busy && (
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "hidden", height: 6 }}>
            <div style={{ width: Math.round(progress * 100) + "%", height: "100%", background: TEAL, transition: "width 0.15s linear" }} />
          </div>
        )}
        {err && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSubmitFile} disabled={busy || !file} style={{ ...s.btnPri, width: "auto", padding: "8px 16px", fontSize: 13, opacity: busy || !file ? 0.5 : 1 }}>
            {busy ? "Uploading… " + Math.round(progress * 100) + "%" : "Upload"}
          </button>
          <button onClick={onCancel} disabled={busy} style={{ ...s.btnGhost, width: "auto", opacity: busy ? 0.5 : 1 }}>Cancel</button>
        </div>
      </div>
    );
  }

  // Default: button bar
  return wrap(
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button onClick={() => onStart("quiz")}    style={{ ...s.btnGhost, width: "auto" }}>+ Quiz</button>
      <button onClick={() => onStart("reading")} style={{ ...s.btnGhost, width: "auto" }}>+ Reading</button>
      <button onClick={() => onStart("notes")}   style={{ ...s.btnGhost, width: "auto" }}>+ Notes</button>
      <button onClick={onOpenPageEditor}         style={{ ...s.btnGhost, width: "auto" }}>+ Page</button>
      <button onClick={() => onStart("link")}    style={{ ...s.btnGhost, width: "auto" }}>+ Link</button>
      <button onClick={() => onStart("file")}    style={{ ...s.btnGhost, width: "auto" }}>+ File</button>
      <button disabled title="Available in Phase 3" style={{ ...s.btnGhost, width: "auto", opacity: 0.4, cursor: "not-allowed" }}>+ Homework</button>
    </div>
  );
}
