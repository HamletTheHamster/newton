import { useState } from "react";
import { s } from "../theme.js";

export function ManualAddStudent({ roster, onAdd }) {
  const [fn, setFn] = useState("");
  const [ln, setLn] = useState("");
  const [sid, setSid] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const add = async () => {
    setErr(""); setOk("");
    const f = fn.trim(), l = ln.trim(), st = sid.trim();
    if (!f || !l || !st) { setErr("All three fields are required."); return; }
    if (roster.some(r => r.studentId === st)) { setErr("A student with that ID already exists."); return; }
    await onAdd({ firstName: f, lastName: l, studentId: st, fullName: f + " " + l });
    setFn(""); setLn(""); setSid(""); setOk(f + " " + l + " added successfully.");
    setTimeout(() => setOk(""), 3000);
  };

  return (
    <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
      <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: "0 0 14px" }}>Add Student Manually</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <div><label style={s.label}>First Name</label><input style={s.input} placeholder="Jane" value={fn} onChange={e => setFn(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} /></div>
        <div><label style={s.label}>Last Name</label><input style={s.input} placeholder="Smith" value={ln} onChange={e => setLn(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} /></div>
        <div><label style={s.label}>Student ID</label><input style={s.input} placeholder="1234567" value={sid} onChange={e => setSid(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} /></div>
        <button onClick={add} style={{ ...s.btnPri, width: "auto", padding: "12px 20px", whiteSpace: "nowrap" }}>Add Student</button>
      </div>
      {err && <p style={{ color: "#f87171", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
      {ok && <p style={{ color: "#4ade80", fontSize: 13, margin: "10px 0 0" }}>✓ {ok}</p>}
    </div>
  );
}
