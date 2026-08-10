import { useState, useEffect, useRef, Fragment } from "react";
import { useTheme } from "../../theme.js";
import { fmtDueTime, dueToDate } from "../../utils.js";
import { newId } from "../../courses/ids.js";
import { ItemIcon } from "../../components/lms/itemIcons.jsx";

const fmtBytes = bytes => {
  if (!bytes || bytes < 1024) return (bytes || 0) + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

const EyeIcon = ({ hidden }) => hidden
  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

export function Modules({
  classId, modules, moduleConfig, pages, uploads, quizzes, homeworks = [], customQuizzes,
  dueDates, onSaveDueDates,
  onSaveModules, onSaveModuleConfig, onSavePage, onDeletePage,
  onSaveUpload, onDeleteUpload, onUploadFile, onDeleteStorage, onOpenPageEditor,
  onOpenCustomQuizEditor, onDeleteCustomQuiz,
}) {
  const { s, muted, border, text, teal, bg } = useTheme();
  const lsKey = `newton_inst_modules_${classId}`;
  const [openMap, setOpenMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem(lsKey) || "{}"); } catch { return {}; }
  });
  const [editingTitleFor, setEditingTitleFor] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragItemKey, setDragItemKey] = useState(null);   // "moduleId::itemId"
  const [dragItemOverKey, setDragItemOverKey] = useState(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [moduleMenuFor, setModuleMenuFor] = useState(null);
  const moduleMenuRef = useRef(null);
  const [itemMenuFor, setItemMenuFor] = useState(null);     // "moduleId::itemId"
  const itemMenuRef = useRef(null);
  const [editingTimeFor, setEditingTimeFor] = useState(null);
  const [renamingItemKey, setRenamingItemKey] = useState(null); // "moduleId::itemId"
  const [renamingItemDraft, setRenamingItemDraft] = useState("");

  // Add-item flow state (one module's add bar active at a time)
  const [addingTo, setAddingTo] = useState(null);    // moduleId
  const [addType, setAddType] = useState(null);      // "quiz" | "homework" | "reading" | "notes" | "link" | "file"
  const [addTitle, setAddTitle] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addFile, setAddFile] = useState(null);
  const [addQuizPick, setAddQuizPick] = useState("");
  const [addHwPick, setAddHwPick] = useState("");
  const [addProgress, setAddProgress] = useState(0);
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState("");
  // Hidden input opened straight from the "File" menu click, so picking a file
  // takes one gesture instead of menu → Choose file… → picker.
  const addFileInputRef = useRef(null);

  // Replace-file flow (swap an existing item's file in place)
  const replaceInputRef = useRef(null);
  const replaceTargetRef = useRef(null);              // { modId, item } captured at click time
  const [replacing, setReplacing] = useState(null);   // { itemKey, name, progress }
  const [replaceErr, setReplaceErr] = useState(null); // { itemKey, msg }

  // New-module form
  const [creatingModule, setCreatingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const cfgOf = id => moduleConfig[id] || {};
  const toggleOne = id => setOpenMap(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    try { localStorage.setItem(lsKey, JSON.stringify(openMap)); } catch {}
  }, [openMap, lsKey]);

  useEffect(() => {
    try { setOpenMap(JSON.parse(localStorage.getItem(lsKey) || "{}")); } catch { setOpenMap({}); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const resetAddState = () => {
    setAddingTo(null); setAddType(null);
    setAddTitle(""); setAddUrl(""); setAddFile(null);
    setAddQuizPick(""); setAddHwPick(""); setAddProgress(0); setAddBusy(false); setAddErr("");
  };

  useEffect(() => {
    if (!moduleMenuFor) return;
    const handler = e => { if (moduleMenuRef.current && !moduleMenuRef.current.contains(e.target)) setModuleMenuFor(null); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moduleMenuFor]);

  useEffect(() => {
    if (!itemMenuFor) return;
    const handler = e => { if (itemMenuRef.current && !itemMenuRef.current.contains(e.target)) setItemMenuFor(null); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [itemMenuFor]);

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
  const setReleaseFull = async (mod, fullVal) => {
    const cfg = { ...cfgOf(mod.id) };
    if (fullVal) cfg.releaseDate = fullVal; else delete cfg.releaseDate;
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
    if (!window.confirm(`Delete "${item.title || item.type}"? This cannot be undone.`)) return;
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

  const renameItem = async (moduleId, itemId, newTitle) => {
    const t = (newTitle || "").trim();
    if (!t) { setRenamingItemKey(null); return; }
    await updateItem(moduleId, itemId, it => ({ ...it, title: t }));
    setRenamingItemKey(null);
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

  // Homework items reference a course-defined assignment by refId (hw1…hwN). Unlike quizzes there
  // are no instructor-authored homeworks, so this picker has no create/delete controls. Needed for
  // any class whose modules were built by hand rather than seeded from the course template — the
  // student's module list is what surfaces a homework to them (Home.jsx resolves item.refId).
  const submitAddHomework = async (mod) => {
    setAddErr("");
    if (!addHwPick) { setAddErr("Pick a homework."); return; }
    const items = [...(mod.items || []), { id: newId("it"), type: "homework", refId: addHwPick }];
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
    if (addFile.size >= 50 * 1024 * 1024) { setAddErr("File is too large (50 MB max)."); return; }
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

  const pickAddFile = (f) => {
    if (!f) return;
    setAddFile(f);
    setAddErr("");
    setAddTitle(t => t || f.name);
  };

  // ── Replace an item's file in place ──────────────────────────────────────
  // Keeps the same uploadId (and therefore the module item, its title and any
  // student-facing link) — only the stored file and its metadata change.
  const startReplaceFile = (mod, item) => {
    replaceTargetRef.current = { modId: mod.id, item };
    replaceInputRef.current?.click();
  };

  const onReplaceFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";                       // allow re-picking the same file later
    const target = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!file || !target) return;

    const { modId, item } = target;
    const itemKey = `${modId}::${item.id}`;
    setReplaceErr(null);
    if (file.size >= 50 * 1024 * 1024) { setReplaceErr({ itemKey, msg: "File is too large (50 MB max)." }); return; }

    const prev = uploads[item.uploadId] || null;
    const uploadId = item.uploadId || newId("u");
    setReplacing({ itemKey, name: file.name, progress: 0 });
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const storagePath = `classes/${classId}/uploads/${uploadId}/${safeName}`;
      const result = await onUploadFile(storagePath, file, p =>
        setReplacing(r => (r && r.itemKey === itemKey ? { ...r, progress: p } : r))
      );
      await onSaveUpload(uploadId, {
        name: file.name, size: result.size, mime: result.mime,
        storagePath: result.storagePath, downloadUrl: result.downloadUrl,
        createdAt: prev?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      // Repoint the item (no-op when reusing the id) and refresh a title that
      // was only ever the old filename; a title the instructor typed is kept.
      await updateItem(modId, item.id, it => ({
        ...it,
        uploadId,
        title: (!it.title || it.title === prev?.name) ? file.name : it.title,
      }));
      // Drop the superseded object, unless the new upload overwrote that path.
      if (prev?.storagePath && prev.storagePath !== result.storagePath && onDeleteStorage) {
        try { await onDeleteStorage(prev.storagePath); } catch (err) { console.warn("Old file cleanup failed:", err?.message || err); }
      }
      setReplacing(r => (r?.itemKey === itemKey ? null : r));
    } catch (err) {
      setReplacing(r => (r?.itemKey === itemKey ? null : r));
      setReplaceErr({ itemKey, msg: err?.message || "Upload failed." });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const list = modules || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Always-mounted pickers so a menu click can open the OS dialog synchronously */}
      <input
        ref={addFileInputRef}
        type="file"
        onChange={e => { pickAddFile(e.target.files?.[0]); e.target.value = ""; }}
        style={{ display: "none" }}
      />
      <input ref={replaceInputRef} type="file" onChange={onReplaceFilePicked} style={{ display: "none" }} />

      <TopBar
        creating={creatingModule}
        title={newModuleTitle}
        onTitleChange={setNewModuleTitle}
        onStartCreate={() => { setCreatingModule(true); setNewModuleTitle(""); }}
        onSubmitCreate={submitCreateModule}
        onCancelCreate={() => { setCreatingModule(false); setNewModuleTitle(""); }}
      />

      {list.length === 0 && !creatingModule && (
        <div style={{ ...s.card, padding: 32, textAlign: "center", color: muted }}>
          No modules yet. Click <span style={{ color: teal }}>+ New Module</span> above to add one.
        </div>
      )}

      {list.map((mod, modIdx) => {
        const cfg = cfgOf(mod.id);
        const releaseDate = cfg.releaseDate || null;
        const hidden = cfg.hiddenItems || {};
        const items = mod.items || [];
        const isOpen = !!openMap[mod.id];
        const isDropTarget = dragOverId === mod.id && dragId !== mod.id;
        const releaseAt = releaseDate ? dueToDate(releaseDate) : null;
        const locked = !!(releaseAt && new Date() < releaseAt);

        return (
          <div key={mod.id}>
            <div
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverId(mod.id); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null); }}
              onDrop={e => {
                e.preventDefault();
                if (!dragId || dragId === mod.id) { setDragId(null); setDragOverId(null); return; }
                const arr = [...(modules || [])];
                const from = arr.findIndex(m => m.id === dragId);
                const to = arr.findIndex(m => m.id === mod.id);
                if (from >= 0 && to >= 0) {
                  const [moved] = arr.splice(from, 1);
                  arr.splice(from < to ? to - 1 : to, 0, moved);
                  onSaveModules(arr);
                }
                setDragId(null); setDragOverId(null);
              }}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              style={{ ...s.card, overflow: "visible", boxShadow: isDropTarget ? `inset 0 3px 0 0 ${teal}` : undefined, opacity: dragId === mod.id ? 0.5 : 1 }}
            >
              {/* Module header — draggable for reordering */}
              <div
                draggable
                onDragStart={e => {
                  setDragId(mod.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", mod.id);
                }}
                onClick={() => toggleOne(mod.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", flexWrap: "wrap", cursor: dragId === mod.id ? "grabbing" : "grab" }}
              >
                {/* Expand indicator */}
                <span style={{ fontSize: 13, color: muted, transform: isOpen ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.2s", flexShrink: 0, pointerEvents: "none" }}>▶</span>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  {editingTitleFor === mod.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={titleDraft}
                        onChange={e => setTitleDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") renameModule(mod.id, titleDraft);
                          if (e.key === "Escape") setEditingTitleFor(null);
                        }}
                        style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${teal}`, color: text, borderRadius: 6, padding: "4px 10px", fontSize: 14, outline: "none", width: "100%", maxWidth: 360 }}
                      />
                      <button onClick={() => renameModule(mod.id, titleDraft)} style={{ background: "rgba(0,130,140,0.2)", border: `1px solid ${teal}`, color: teal, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓</button>
                      <button onClick={() => setEditingTitleFor(null)} style={{ background: "none", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  ) : (
                    <span style={{ fontWeight: 500, fontSize: 14, color: text }}>{mod.title || "Untitled module"}</span>
                  )}
                </div>
                {/* Three-dot menu */}
                <div
                  ref={moduleMenuFor === mod.id ? moduleMenuRef : null}
                  style={{ position: "relative", flexShrink: 0 }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => setModuleMenuFor(id => id === mod.id ? null : mod.id)}
                    style={{ background: "transparent", border: "none", color: muted, cursor: "pointer", fontSize: 20, padding: "2px 8px", lineHeight: 1, borderRadius: 6 }}
                  >⋮</button>
                  {moduleMenuFor === mod.id && (
                    <ModuleMenu
                      releaseDate={releaseDate}
                      locked={locked}
                      onSaveRelease={val => setReleaseFull(mod, val)}
                      onRename={() => { setModuleMenuFor(null); setEditingTitleFor(mod.id); setTitleDraft(mod.title || ""); }}
                      onAddItem={type => {
                        setModuleMenuFor(null);
                        setOpenMap(prev => ({ ...prev, [mod.id]: true }));
                        resetAddState();
                        setAddingTo(mod.id);
                        setAddType(type);
                        // Still inside the click gesture → the OS picker opens right away.
                        if (type === "file") addFileInputRef.current?.click();
                      }}
                      onOpenPageEditor={() => {
                        setModuleMenuFor(null);
                        setOpenMap(prev => ({ ...prev, [mod.id]: true }));
                        onOpenPageEditor(mod.id, null, null);
                      }}
                      onDelete={() => { setModuleMenuFor(null); deleteModule(mod); }}
                    />
                  )}
                </div>
              </div>

            {isOpen && (
              <div style={{ borderTop: `1px solid ${border}` }}>
                {items.map((item, itemIdx) => {
                  const isHidden = !!hidden[item.id];
                  const upload = item.type === "file" ? uploads[item.uploadId] : null;
                  const itemKey = `${mod.id}::${item.id}`;
                  const replacingThis = replacing?.itemKey === itemKey ? replacing : null;
                  // Kept deliberately sparse to match the student row: no filename/size
                  // for uploads, no "Page" label. Only in-flight upload progress and a
                  // broken-item warning survive — both are instructor-only signals.
                  const subtitle = replacingThis
                    ? `Uploading ${replacingThis.name}… ${Math.round(replacingThis.progress * 100)}%`
                    : item.type === "link" ? item.url :
                    item.type === "file" && !upload ? "File (missing)" :
                    null;
                  const canHaveUrl = item.type === "reading" || item.type === "notes";
                  const schedulable = item.type === "quiz" || item.type === "homework";
                  const refQuiz = item.type === "quiz" ? quizzes.find(q => q.id === item.refId) : null;
                  const refHw = item.type === "homework" ? homeworks.find(h => h.id === item.refId) : null;
                  const displayTitle = item.type === "quiz"
                    ? (refQuiz?.title || `Quiz (${item.refId})`)
                    : item.type === "homework"
                    ? (refHw?.title || `Homework (${item.refId})`)
                    : (item.title || (item.type === "link" ? item.url : (upload?.name || "Untitled")));

                  const quizDueDate = schedulable ? (dueDates?.[item.refId] || null) : null;
                  const quizDateVal = quizDueDate ? quizDueDate.slice(0, 10) : "";
                  const quizTimeVal = quizDueDate && quizDueDate.length === 16 && quizDueDate[10] === ' ' ? quizDueDate.slice(11) : "23:59";
                  const quizLate = quizDueDate ? dueToDate(quizDueDate) < new Date() : false;

                  // Mirrors the student's ModuleItem meta line (counts · pts · due).
                  const nQ = refQuiz?.questions?.length || 0;
                  const nP = refHw?.problems?.length || 0;
                  const metaBits = (nQ || nP || quizDueDate) ? (
                    <div style={{ ...s.muted, fontSize: 11, marginTop: 2, display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {!!nQ && <span>{nQ} question{nQ > 1 ? "s" : ""} · 10 pts</span>}
                      {refQuiz?.questions?.some(q => q.requiresImage) && <span style={{ color: "#a78bfa" }}>drawing</span>}
                      {!!nP && <span>{nP} problem{nP > 1 ? "s" : ""} · {nP} pts</span>}
                      {quizDueDate && (
                        <span style={{ color: quizLate ? "#f87171" : "#4ade80", fontWeight: 500 }}>
                          {quizLate ? "Past due · " : "Due "}
                          {dueToDate(quizDueDate).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  ) : null;

                  const isItemDropTarget = dragItemOverKey === itemKey && dragItemKey !== itemKey;

                  return (
                    <Fragment key={item.id}>
                      <ItemRow
                        typeIcon={<ItemIcon type={item.type} size={14} />}
                        title={displayTitle}
                        subtitle={subtitle}
                        meta={metaBits}
                        error={replaceErr?.itemKey === itemKey ? replaceErr.msg : null}
                        isHidden={isHidden}
                        isDropTarget={isItemDropTarget}
                        renameMode={renamingItemKey === itemKey}
                        renameDraft={renamingItemDraft}
                        onRenameDraftChange={setRenamingItemDraft}
                        onRenameCommit={() => renameItem(mod.id, item.id, renamingItemDraft)}
                        onRenameCancel={() => setRenamingItemKey(null)}
                        dragProps={{
                          draggable: true,
                          onDragStart: e => {
                            e.stopPropagation();
                            setDragItemKey(itemKey);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", itemKey);
                          },
                          onDragOver: e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; setDragItemOverKey(itemKey); },
                          onDragLeave: e => { e.stopPropagation(); setDragItemOverKey(null); },
                          onDrop: e => {
                            e.preventDefault(); e.stopPropagation();
                            if (!dragItemKey || dragItemKey === itemKey) { setDragItemKey(null); setDragItemOverKey(null); return; }
                            const [srcModId, srcItemId] = dragItemKey.split("::");
                            if (srcModId !== mod.id) { setDragItemKey(null); setDragItemOverKey(null); return; }
                            const arr = [...(mod.items || [])];
                            const from = arr.findIndex(it => it.id === srcItemId);
                            const to = arr.findIndex(it => it.id === item.id);
                            if (from >= 0 && to >= 0) {
                              const [moved] = arr.splice(from, 1);
                              arr.splice(from < to ? to - 1 : to, 0, moved);
                              onSaveModules((modules || []).map(m => m.id === mod.id ? { ...m, items: arr } : m));
                            }
                            setDragItemKey(null); setDragItemOverKey(null);
                          },
                          onDragEnd: () => { setDragItemKey(null); setDragItemOverKey(null); },
                        }}
                        urlField={canHaveUrl ? (
                          <UrlInput
                            initial={item.url || ""}
                            onCommit={val => setItemUrl(mod.id, item.id, val)}
                            placeholder="Paste link URL (https://…)"
                          />
                        ) : null}
                        actions={
                          <>
                            {item.type === "file" && upload?.downloadUrl && (
                              <IconBtn title="Open file" onClick={() => window.open(upload.downloadUrl, "_blank", "noopener,noreferrer")}>↗</IconBtn>
                            )}
                          </>
                        }
                        menuOpen={itemMenuFor === itemKey}
                        menuRef={itemMenuFor === itemKey ? itemMenuRef : null}
                        onToggleMenu={() => setItemMenuFor(k => k === itemKey ? null : itemKey)}
                        menu={
                          <ItemMenu
                            onEditPage={item.type === "page" ? () => { setItemMenuFor(null); onOpenPageEditor(mod.id, item.id, item.pageId); } : undefined}
                            onEditQuiz={item.type === "quiz" && customQuizzes?.[item.refId] ? () => { setItemMenuFor(null); onOpenCustomQuizEditor?.(mod.id, item.refId); } : undefined}
                            onRename={item.type === "file" ? () => { setItemMenuFor(null); setRenamingItemKey(itemKey); setRenamingItemDraft(item.title || upload?.name || ""); } : undefined}
                            onReplaceFile={item.type === "file" && !replacingThis ? () => { setItemMenuFor(null); startReplaceFile(mod, item); } : undefined}
                            dueField={schedulable ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <input
                                  type="date"
                                  style={{ ...s.input, width: "100%", padding: "6px 10px", fontSize: 12 }}
                                  value={quizDateVal}
                                  onChange={async e => {
                                    const nd = { ...(dueDates || {}) };
                                    if (e.target.value) nd[item.refId] = e.target.value;
                                    else delete nd[item.refId];
                                    setEditingTimeFor(null);
                                    await onSaveDueDates(nd);
                                  }}
                                />
                                {quizDueDate && (editingTimeFor === item.refId
                                  ? <input type="time" autoFocus style={{ ...s.input, width: "100%", padding: "6px 10px", fontSize: 12 }} value={quizTimeVal} onChange={async e => { if (!e.target.value) return; await onSaveDueDates({ ...(dueDates || {}), [item.refId]: quizDateVal + ' ' + e.target.value }); }} onBlur={() => setEditingTimeFor(null)} />
                                  : <button onClick={() => setEditingTimeFor(item.refId)} style={{ background: "transparent", border: `1px solid ${border}`, color: muted, fontSize: 12, cursor: "pointer", padding: "6px 10px", borderRadius: 10, width: "100%", textAlign: "left" }}>{fmtDueTime(quizDueDate)}</button>
                                )}
                                {quizDueDate && <span style={s.badge(quizLate ? "#f87171" : "#4ade80")}>{quizLate ? "Past due" : "Active"}</span>}
                              </div>
                            ) : null}
                            isHidden={isHidden}
                            onToggleHidden={() => { setItemMenuFor(null); toggleHidden(mod, item.id); }}
                            onDelete={() => { setItemMenuFor(null); deleteItem(mod, item); }}
                          />
                        }
                      />
                    </Fragment>
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
                  hwPick={addHwPick} setHwPick={setAddHwPick}
                  quizzes={quizzes}
                  homeworks={homeworks}
                  customQuizzes={customQuizzes}
                  onCancel={resetAddState}
                  onSubmitHomework={() => submitAddHomework(mod)}
                  onOpenPageEditor={() => onOpenPageEditor(mod.id, null, null)}
                  onCreateNewQuiz={() => onOpenCustomQuizEditor?.(mod.id)}
                  onDeleteCustomQuiz={onDeleteCustomQuiz}
                  onSubmitQuiz={() => submitAddQuiz(mod)}
                  onSubmitText={() => submitAddTextItem(mod, addType)}
                  onSubmitLink={() => submitAddLink(mod)}
                  onSubmitFile={() => submitAddFile(mod)}
                />
              </div>
            )}
          </div>
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
  const { s } = useTheme();
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

function ItemRow({ typeIcon, title, subtitle, meta, error, isHidden, urlField, actions, dragProps, isDropTarget, menuOpen, menuRef, onToggleMenu, menu, renameMode, renameDraft, onRenameDraftChange, onRenameCommit, onRenameCancel }) {
  const { s, muted, border, text, teal } = useTheme();
  const activeDragProps = renameMode ? { ...dragProps, draggable: false } : (dragProps || {});
  return (
    <div {...activeDragProps} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderTop: `1px solid ${border}`, opacity: isHidden ? 0.45 : 1, flexWrap: "wrap", cursor: renameMode ? "default" : (dragProps?.draggable ? "grab" : "default"), boxShadow: isDropTarget ? `inset 0 3px 0 0 ${teal}` : undefined }}>
      <span style={{ color: muted, flexShrink: 0, display: "inline-flex", alignItems: "center", minWidth: 18 }}>{typeIcon}</span>
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        {renameMode ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={renameDraft}
              onChange={e => onRenameDraftChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") onRenameCommit(); if (e.key === "Escape") onRenameCancel(); }}
              onBlur={onRenameCommit}
              style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${teal}`, color: text, borderRadius: 6, padding: "4px 10px", fontSize: 14, outline: "none", flex: 1, minWidth: 0 }}
            />
            <button onMouseDown={e => e.preventDefault()} onClick={onRenameCommit} style={{ background: "rgba(0,130,140,0.2)", border: `1px solid ${teal}`, color: teal, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</button>
            <button onMouseDown={e => e.preventDefault()} onClick={onRenameCancel} style={{ background: "none", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
          </div>
        ) : (
          <>
            <div style={{ color: text, fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
            {subtitle && <div style={{ ...s.muted, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
            {meta}
            {error && <div style={{ color: "#f87171", fontSize: 11 }}>{error}</div>}
          </>
        )}
      </div>
      {urlField && <div style={{ flex: "2 1 280px", minWidth: 0 }}>{urlField}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {actions}
        <div style={{ position: "relative" }} ref={menuRef}>
          <button onClick={onToggleMenu} style={{ background: "transparent", border: "none", color: muted, cursor: "pointer", fontSize: 20, padding: "2px 8px", lineHeight: 1, borderRadius: 6 }}>⋮</button>
          {menuOpen && menu}
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, disabled }) {
  const { muted, border } = useTheme();
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{ background: "transparent", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "5px 8px", cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, lineHeight: 1, opacity: disabled ? 0.35 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28 }}
    >
      {children}
    </button>
  );
}

function UrlInput({ initial, onCommit, placeholder }) {
  const { s } = useTheme();
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
  title, setTitle, url, setUrl, file, setFile, quizPick, setQuizPick, quizzes, customQuizzes,
  hwPick, setHwPick, homeworks,
  onCancel, onOpenPageEditor, onCreateNewQuiz, onDeleteCustomQuiz,
  onSubmitQuiz, onSubmitHomework, onSubmitText, onSubmitLink, onSubmitFile,
}) {
  const { s, muted, border, text, teal } = useTheme();
  const wrap = (child) => (
    <div style={{ borderTop: `1px solid ${border}`, padding: "12px 18px", background: "rgba(255,255,255,0.02)" }}>{child}</div>
  );

  if (active === "homework") {
    return wrap(
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
          {(homeworks || []).length === 0 ? (
            <div style={{ padding: "10px 14px", color: muted, fontSize: 13 }}>No homework assignments available for this course.</div>
          ) : (homeworks || []).map(h => {
            const selected = hwPick === h.id;
            return (
              <button
                key={h.id}
                onClick={() => setHwPick(h.id)}
                style={{ display: "block", width: "100%", background: selected ? "rgba(0,130,140,0.15)" : "transparent", border: "none", borderBottom: `1px solid ${border}`, color: selected ? teal : text, fontSize: 13, textAlign: "left", padding: "9px 14px", cursor: "pointer" }}
              >
                {h.title}
              </button>
            );
          })}
        </div>
        {err && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSubmitHomework} style={{ ...s.btnPri, width: "auto", padding: "8px 16px", fontSize: 13 }}>Add Homework</button>
          <button onClick={onCancel} style={{ ...s.btnGhost, width: "auto" }}>Cancel</button>
        </div>
      </div>
    );
  }

  if (active === "quiz") {
    return wrap(
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
          {(quizzes || []).length === 0 ? (
            <div style={{ padding: "10px 14px", color: muted, fontSize: 13 }}>No quizzes available.</div>
          ) : (quizzes || []).map(q => {
            const isCustom = !!(customQuizzes?.[q.id]);
            const selected = quizPick === q.id;
            return (
              <div
                key={q.id}
                style={{ display: "flex", alignItems: "center", background: selected ? "rgba(0,130,140,0.15)" : "transparent", borderBottom: `1px solid ${border}` }}
              >
                <button
                  onClick={() => setQuizPick(q.id)}
                  style={{ flex: 1, background: "transparent", border: "none", color: selected ? teal : text, fontSize: 13, textAlign: "left", padding: "9px 14px", cursor: "pointer" }}
                >
                  {q.title}
                </button>
                {isCustom && (
                  <button
                    onClick={() => { if (window.confirm(`Delete "${q.title}"? This cannot be undone.`)) { if (quizPick === q.id) setQuizPick(""); onDeleteCustomQuiz?.(q.id); } }}
                    title="Delete quiz"
                    style={{ background: "transparent", border: "none", color: muted, fontSize: 14, cursor: "pointer", padding: "0 12px", lineHeight: 1, flexShrink: 0 }}
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
        {err && <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSubmitQuiz} style={{ ...s.btnPri, width: "auto", padding: "8px 16px", fontSize: 13 }}>Add Quiz</button>
          <button onClick={() => { onCancel(); onCreateNewQuiz(); }} style={{ ...s.btnGhost, width: "auto", padding: "8px 16px", fontSize: 13 }}>+ New quiz</button>
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
            <div style={{ width: Math.round(progress * 100) + "%", height: "100%", background: teal, transition: "width 0.15s linear" }} />
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

  return null;
}

// ── ModuleMenu ────────────────────────────────────────────────────────────────
function ModuleMenu({ releaseDate, locked, onSaveRelease, onRename, onAddItem, onOpenPageEditor, onDelete }) {
  const { s, muted, border, text, teal, bg } = useTheme();
  const ET = "America/New_York";
  const etParts = d => {
    const f = new Intl.DateTimeFormat("en-US", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    return f.formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  };

  const now = new Date();
  const nowParts = etParts(now);
  const parsedValue = releaseDate ? dueToDate(releaseDate) : null;
  const parsedParts = parsedValue ? etParts(parsedValue) : null;
  const currentDateStr = parsedParts ? `${parsedParts.year}-${parsedParts.month}-${parsedParts.day}` : null;
  const currentTimeStr = parsedParts ? `${parsedParts.hour === "24" ? "00" : parsedParts.hour}:${parsedParts.minute}` : "23:59";

  const [calYear, setCalYear] = useState(() => parsedParts ? parseInt(parsedParts.year) : parseInt(nowParts.year));
  const [calMonth, setCalMonth] = useState(() => parsedParts ? parseInt(parsedParts.month) : parseInt(nowParts.month));
  const [timeInput, setTimeInput] = useState(currentTimeStr);

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const todayStr = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;

  const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const firstDayOfWeek = () => {
    const d = new Date(calYear, calMonth - 1, 1, 12, 0, 0);
    const dayName = new Intl.DateTimeFormat("en-US", { timeZone: ET, weekday: "short" }).format(d);
    return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(dayName);
  };

  const totalDays = daysInMonth(calYear, calMonth);
  const startDow = firstDayOfWeek();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const selectDay = day => {
    const mm = String(calMonth).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onSaveRelease(`${calYear}-${mm}-${dd} ${timeInput || "23:59"}`);
  };

  const prevMonth = () => { if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); };
  const nextMonth = () => { if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); };

  return (
    <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 200, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "14px 14px 10px", minWidth: 260, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      {/* Section 1: Release date */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ color: muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Release Date</span>
          {releaseDate && <span style={s.badge(locked ? "#facc15" : "#4ade80")}>{locked ? "Locked" : "Released"}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <button onClick={prevMonth} style={{ background: "transparent", border: "none", color: muted, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>‹</button>
          <span style={{ color: text, fontSize: 12, fontWeight: 600 }}>{MONTHS[calMonth - 1]} {calYear}</span>
          <button onClick={nextMonth} style={{ background: "transparent", border: "none", color: muted, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 3 }}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, color: muted, padding: "2px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const mm = String(calMonth).padStart(2, "0");
            const dd = String(day).padStart(2, "0");
            const dayStr = `${calYear}-${mm}-${dd}`;
            const isSelected = dayStr === currentDateStr;
            const isToday = dayStr === todayStr;
            const isPast = dayStr < todayStr;
            return (
              <button key={day} onClick={() => selectDay(day)} style={{ background: isSelected ? teal : "transparent", border: isToday && !isSelected ? `1px solid ${muted}` : "none", borderRadius: 4, color: isSelected ? "#fff" : isPast ? muted : text, cursor: "pointer", fontSize: 11, padding: "3px 2px", textAlign: "center" }}>{day}</button>
            );
          })}
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${border}`, paddingTop: 8 }}>
          <span style={{ color: muted, fontSize: 11 }}>Time (ET)</span>
          <input type="time" value={timeInput} onChange={e => { setTimeInput(e.target.value); if (currentDateStr && e.target.value) onSaveRelease(`${currentDateStr} ${e.target.value}`); }} style={{ ...s.input, width: "auto", padding: "4px 8px", fontSize: 12, flex: 1 }} />
        </div>
        {releaseDate && (
          <button onClick={() => onSaveRelease(null)} style={{ ...s.btnGhost, width: "100%", marginTop: 6, padding: "5px", fontSize: 12 }}>Clear date</button>
        )}
      </div>

      {/* Section 2: Edit — rename lives here rather than as a ✎ beside the title,
          so the module header reads as plainly as the student's. */}
      {onRename && (
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10, marginBottom: 10 }}>
          <button onClick={onRename} style={{ background: "transparent", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, width: "100%", textAlign: "left" }}>✎ Rename module</button>
        </div>
      )}

      {/* Section 3: Add item */}
      <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10, marginBottom: 10 }}>
        <div style={{ color: muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Add Item</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => onAddItem("quiz")} style={{ ...s.btnGhost, width: "auto", fontSize: 12, padding: "5px 10px" }}>+ Quiz</button>
          <button onClick={() => onAddItem("homework")} style={{ ...s.btnGhost, width: "auto", fontSize: 12, padding: "5px 10px" }}>+ Homework</button>
          <button onClick={onOpenPageEditor} style={{ ...s.btnGhost, width: "auto", fontSize: 12, padding: "5px 10px" }}>+ Page</button>
          <button onClick={() => onAddItem("link")} style={{ ...s.btnGhost, width: "auto", fontSize: 12, padding: "5px 10px" }}>+ Link</button>
          <button onClick={() => onAddItem("file")} style={{ ...s.btnGhost, width: "auto", fontSize: 12, padding: "5px 10px" }}>+ File</button>
        </div>
      </div>

      {/* Section 4: Delete */}
      <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10 }}>
        <button onClick={onDelete} style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, width: "100%", textAlign: "left" }}>🗑 Delete module</button>
      </div>
    </div>
  );
}

function ItemMenu({ dueField, isHidden, onToggleHidden, onDelete, onEditPage, onEditQuiz, onRename, onReplaceFile }) {
  const { s, muted, border, bg } = useTheme();
  const hasEditAction = onEditPage || onEditQuiz || onRename || onReplaceFile;
  return (
    <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 200, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "14px", minWidth: 220, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
      {dueField && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Due Date</div>
          {dueField}
        </div>
      )}
      {hasEditAction && (
        <div style={{ borderTop: dueField ? `1px solid ${border}` : "none", paddingTop: dueField ? 10 : 0, marginBottom: 10 }}>
          {onEditPage && (
            <button onClick={onEditPage} style={{ background: "transparent", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, width: "100%", textAlign: "left", marginBottom: 6 }}>✎ Edit page</button>
          )}
          {onEditQuiz && (
            <button onClick={onEditQuiz} style={{ background: "transparent", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, width: "100%", textAlign: "left", marginBottom: onRename ? 6 : 0 }}>✎ Edit quiz</button>
          )}
          {onRename && (
            <button onClick={onRename} style={{ background: "transparent", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, width: "100%", textAlign: "left", marginBottom: onReplaceFile ? 6 : 0 }}>✎ Rename</button>
          )}
          {onReplaceFile && (
            <button onClick={onReplaceFile} style={{ background: "transparent", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, width: "100%", textAlign: "left" }}>⇄ Replace file…</button>
          )}
        </div>
      )}
      <div style={{ borderTop: (dueField || hasEditAction) ? `1px solid ${border}` : "none", paddingTop: (dueField || hasEditAction) ? 10 : 0, marginBottom: 10 }}>
        <button
          onClick={onToggleHidden}
          style={{ background: "transparent", border: `1px solid ${border}`, color: muted, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
        >
          <EyeIcon hidden={isHidden} />
          {isHidden ? "Show to students" : "Hide from students"}
        </button>
      </div>
      <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10 }}>
        <button onClick={onDelete} style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, width: "100%", textAlign: "left" }}>🗑 Delete</button>
      </div>
    </div>
  );
}

