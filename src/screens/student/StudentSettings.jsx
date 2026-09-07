import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";
import { NICKNAME_MAX, nicknameAllowed } from "../../nickname.js";

// The student's account settings, rendered as a normal section page inside `Shell` -
// same header, sidebar, width and sticky footer as Home/Grades/Calendar. It used to be a
// standalone centered 420px card with the fixed Footer on top of it, which read as a phone
// screen dropped onto a desktop page and overlapped the footer on short viewports.
//
// Cards flow in an auto-fitting grid so the page fills the 960px column on a desktop and
// falls to one column on a phone, and each setting is its own card with its own save button:
// the three saves are independent writes (nickname is screened server-side, email PATCHes one
// roster field, password writes studentPws/{id}), so one combined "Save" would misrepresent them.
export function StudentSettings({
  loggedInStudent,
  onBack,
  // preferred first name
  nickDraft, setNickDraft, nickMsg, nickBusy, onSaveNickname,
  // email
  emailDraft, setEmailDraft, emailMsg, onSaveEmail,
  // password
  newPw1, setNewPw1, newPw2, setNewPw2, pwChangeMsg, onChangePassword,
  onLogout,
}) {
  const { s, text, border } = useTheme();
  const isMobile = useIsMobile();
  const allowed = nicknameAllowed(loggedInStudent);

  const msgStyle = m => ({ color: m.startsWith("✅") ? "#4ade80" : "#f87171", fontSize: 13, margin: 0 });
  const cardStyle = { ...s.card, padding: 24, display: "flex", flexDirection: "column", gap: 14, alignSelf: "start" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <button onClick={onBack} style={{ ...s.btnGhost, width: "auto", marginBottom: 18 }}>← Back to course</button>
        <h2 style={{ color: text, fontWeight: 700, fontSize: 20, margin: "0 0 6px" }}>Account Settings</h2>
        <p style={{ ...s.muted, margin: 0, fontSize: 13 }}>{loggedInStudent.fullName}</p>
      </div>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))" }}>

        {/* Preferred first name. Writes the same altName the instructor edits, so the app has
            one display name. `nicknameAllowed` is the instructor's per-student off switch;
            the real enforcement is the guard inside saveStudentNickname, which re-reads the
            roster, since this snapshot dates from login. */}
        <div style={cardStyle}>
          <h3 style={{ color: text, fontWeight: 600, fontSize: 16, margin: 0 }}>Preferred first name</h3>
          {allowed ? (
            <>
              <p style={{ ...s.muted, fontSize: 13, margin: 0 }}>
                This is the name your instructor sees, and the name on the student list you pick from when you log in. Your last name and your record stay the same. Leave it blank to go back to {loggedInStudent.fullName}.
              </p>
              <input
                style={s.input}
                maxLength={NICKNAME_MAX}
                placeholder={loggedInStudent.firstName || "First name"}
                value={nickDraft}
                onChange={e => setNickDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !nickBusy) onSaveNickname(); }}
                disabled={nickBusy}
              />
              {nickMsg && <p style={msgStyle(nickMsg)}>{nickMsg}</p>}
              <button onClick={onSaveNickname} disabled={nickBusy} style={{ ...s.btnPri, opacity: nickBusy ? 0.6 : 1, cursor: nickBusy ? "default" : "pointer" }}>
                {nickBusy ? "Checking…" : "Update Name"}
              </button>
            </>
          ) : (
            <p style={{ ...s.muted, fontSize: 13, margin: 0 }}>Your instructor sets your display name for this course.</p>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={{ color: text, fontWeight: 600, fontSize: 16, margin: 0 }}>Email</h3>
          <p style={{ ...s.muted, fontSize: 13, margin: 0 }}>Where course announcements are sent.</p>
          <input type="email" style={s.input} placeholder="your@email.com" value={emailDraft} onChange={e => setEmailDraft(e.target.value)} />
          {emailMsg && <p style={msgStyle(emailMsg)}>{emailMsg}</p>}
          <button onClick={onSaveEmail} style={s.btnPri}>Update Email</button>
        </div>

        <div style={cardStyle}>
          <h3 style={{ color: text, fontWeight: 600, fontSize: 16, margin: 0 }}>Password</h3>
          <div>
            <label style={s.label}>New Password</label>
            <input type="password" style={s.input} placeholder="New password" value={newPw1} onChange={e => setNewPw1(e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Confirm New Password</label>
            <input type="password" style={s.input} placeholder="Confirm password" value={newPw2} onChange={e => setNewPw2(e.target.value)} />
          </div>
          {pwChangeMsg && <p style={msgStyle(pwChangeMsg)}>{pwChangeMsg}</p>}
          <button onClick={onChangePassword} style={s.btnPri}>Update Password</button>
        </div>

        <div style={cardStyle}>
          <h3 style={{ color: text, fontWeight: 600, fontSize: 16, margin: 0 }}>Sign out</h3>
          <p style={{ ...s.muted, fontSize: 13, margin: 0 }}>You will be returned to the student list. Any homework you have started is saved.</p>
          <div style={{ borderTop: `1px solid ${border}`, paddingTop: 14 }}>
            <button onClick={onLogout} style={{ ...s.btnDanger, width: "100%" }}>Log Out</button>
          </div>
        </div>

      </div>
    </div>
  );
}
