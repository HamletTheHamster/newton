import { useState } from "react";
import { useTheme } from "../theme.js";

export function ManualAddStudent({ roster, onAdd }) {
  const { s, text } = useTheme();
  const [fn, setFn] = useState("");
  const [ln, setLn] = useState("");
  const [sid, setSid] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const add = async () => {
    setErr(""); setOk("");
    const f = fn.trim(), l = ln.trim(), st = sid.trim(), em = email.trim();
    if (!f || !l || !st) { setErr("First name, last name, and student ID are required."); return; }
    if (roster.some(r => r.studentId === st)) { setErr("A student with that ID already exists."); return; }
    await onAdd({ firstName: f, lastName: l, studentId: st, fullName: f + " " + l, ...(em ? { email: em } : {}) });
    setFn(""); setLn(""); setSid(""); setEmail(""); setOk(f + " " + l + " added successfully.");
    setTimeout(() => setOk(""), 3000);
  };

  return (
    <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
      <p style={{ color: text, fontWeight: 600, fontSize: 14, margin: "0 0 14px" }}>Add Student Manually</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <div><label style={s.label}>First Name</label><input style={s.input} placeholder="Jane" value={fn} onChange={e => setFn(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} /></div>
        <div><label style={s.label}>Last Name</label><input style={s.input} placeholder="Smith" value={ln} onChange={e => setLn(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} /></div>
        <div><label style={s.label}>Student ID</label><input style={s.input} placeholder="1234567" value={sid} onChange={e => setSid(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} /></div>
        <div><label style={s.label}>Email <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label><input style={s.input} placeholder="jane@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} /></div>
        <button onClick={add} style={{ ...s.btnPri, width: "auto", padding: "12px 20px", whiteSpace: "nowrap" }}>Add Student</button>
      </div>
      {err && <p style={{ color: "#f87171", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
      {ok && <p style={{ color: "#4ade80", fontSize: 13, margin: "10px 0 0" }}>✓ {ok}</p>}
    </div>
  );
}
