import { useMemo, useState } from "react";
import { useTheme } from "../../theme.js";
import { useIsMobile } from "../../utils.js";
import { InfoDot } from "../../components/InfoDot.jsx";
import { ItemIcon } from "../../components/lms/itemIcons.jsx";
import {
  MATERIAL_TRACKING_SINCE, materialsOf, materialStats, materialOpensByStudent,
} from "../../material-views.js";
import { CORR_POS, Stat, StatRow, Meter, Panel, EmptyCard, fmtSince } from "./analytics-ui.jsx";

// Analytics -> Materials. Who has clicked to open the readings, lecture notes, links and pages
// posted in the modules.
//
// THE ONE THING THIS VIEW MUST NOT LET ANYONE BELIEVE is that it measures reading. A click means
// the browser was handed the file; it says nothing about whether a word of it was read, and a
// student working from a paper textbook or a classmate's printout can learn the material without
// ever generating a record here. So every figure is worded as an OPEN, the caveat sits under the
// panel rather than behind a tooltip, and there is deliberately no "engagement score" that would
// collapse these counts into a number that looks like a judgment.
//
// It is still worth having: an unopened handout is a fact, and "nobody in the class opened the
// week 6 notes" is usually about the posting, not the students.

// Longest name list rendered inline before it stops being a list and starts being a wall.
const NAME_LIMIT = 40;

const nameOf = stu => stu.altName || stu.fullName || stu.studentId;

// Opened / not opened, side by side. Shown under a material when its row is clicked, because
// "9 of 24" always prompts the question "which nine", and the answer is what an instructor acts
// on. Both halves are shown: the students who have NOT opened it are the actionable list, and a
// list of one side alone invites counting the other.
function NameSplit({ opened, notOpened }) {
  const { text, muted, border } = useTheme();
  const isMobile = useIsMobile();
  const col = (label, names, color) => (
    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
      <div style={{ color: muted, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 5 }}>
        {label} ({names.length})
      </div>
      {names.length === 0
        ? <div style={{ color: muted, fontSize: 12 }}>Nobody</div>
        : (
          <div style={{ color: text, fontSize: 12, lineHeight: 1.7 }}>
            {names.slice(0, NAME_LIMIT).map((n, i) => (
              <span key={n.key}>
                {i > 0 && <span style={{ color: muted }}>, </span>}
                <span style={{ borderBottom: `1px solid ${color}` }} title={n.hint || undefined}>{n.label}</span>
              </span>
            ))}
            {names.length > NAME_LIMIT && <span style={{ color: muted }}> and {names.length - NAME_LIMIT} more</span>}
          </div>
        )}
    </div>
  );

  return (
    <div style={{
      display: "flex", gap: 20, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row",
      padding: "10px 12px", margin: "2px 0 6px", borderRadius: 8, border: `1px solid ${border}`,
    }}>
      {col("Opened", opened, CORR_POS)}
      {col("Not opened", notOpened, "transparent")}
    </div>
  );
}

export function AnalyticsMaterials({ roster, modules, views, loading }) {
  const { s, text, muted, border } = useTheme();
  const isMobile = useIsMobile();
  const [openRow, setOpenRow] = useState(null);

  const materials = useMemo(() => materialsOf(modules), [modules]);
  const rows = useMemo(() => materialStats({ materials, roster, views }), [materials, roster, views]);
  const opens = useMemo(() => materialOpensByStudent({ materials, roster, views }), [materials, roster, views]);

  // Rows in posting order, grouped under their module heading — the same order the student sees
  // them in, so a row can be found by remembering where it was posted.
  const groups = useMemo(() => {
    const out = [];
    for (const row of rows) {
      const last = out[out.length - 1];
      if (last && last.moduleId === row.material.moduleId) last.rows.push(row);
      else out.push({ moduleId: row.material.moduleId, title: row.material.moduleTitle, rows: [row] });
    }
    return out;
  }, [rows]);

  const students = useMemo(() => (roster || [])
    .map(stu => ({ stu, ...(opens[stu.studentId]?.all || { opened: 0, total: materials.length, pct: null, lastAt: null }) }))
    // Fewest opened first: the ordering that needs no interpretation, and the end of the list
    // nobody needs to scroll to.
    .sort((a, b) => (a.opened - b.opened) || nameOf(a.stu).localeCompare(nameOf(b.stu))), [roster, opens, materials.length]);

  if (!roster?.length) return <EmptyCard title="No students enrolled">Add students in the Roster tab and this view fills in.</EmptyCard>;
  if (!materials.length) {
    return (
      <EmptyCard title="No course materials posted yet">
        Readings, lecture notes, links and pages attached to a module appear here once they have a file or a URL
        behind them. A placeholder item with nothing attached is not counted, since students cannot open it.
      </EmptyCard>
    );
  }

  const classPct = materials.length && students.length
    ? students.reduce((n, x) => n + (x.opened / materials.length) * 100, 0) / students.length
    : null;
  const untouched = rows.filter(r => r.opened.length === 0).length;

  const materialRow = row => {
    const id = row.material.id;
    const isOpen = openRow === id;
    const opened = row.opened.map(o => ({
      key: o.student.studentId,
      label: nameOf(o.student),
      hint: o.last ? `${fmtSince(o.last)}${o.count > 1 ? ` · opened ${o.count} times` : ""}` : "time not recorded",
    }));
    const notOpened = row.notOpened.map(stu => ({ key: stu.studentId, label: nameOf(stu) }));

    return (
      <div key={id}>
        <button
          onClick={() => setOpenRow(isOpen ? null : id)}
          title={`${row.opened.length} of ${row.total} students opened this`}
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 90px 96px",
            gap: isMobile ? 6 : 12, alignItems: "center", width: "100%", textAlign: "left",
            background: "none", border: "none", borderRadius: 6, padding: "7px 4px",
            cursor: "pointer", font: "inherit",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, color: text, fontSize: 12.5 }}>
            <span style={{ color: muted, display: "flex", flexShrink: 0 }}><ItemIcon type={row.material.type} size={13} /></span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.material.title}</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Meter pct={row.pct} width={isMobile ? 90 : 62} />
          </span>
          <span style={{ color: muted, fontSize: 11.5, whiteSpace: "nowrap", textAlign: isMobile ? "left" : "right" }}>
            {row.opened.length} of {row.total}
          </span>
        </button>
        {isOpen && <NameSplit opened={opened} notOpened={notOpened} />}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StatRow>
        <Stat label="Materials posted" value={materials.length} hint="files, links and pages" />
        <Stat
          label="Average opened"
          value={classPct == null ? "-" : `${Math.round(classPct)}%`}
          hint="per student, across the term"
        />
        <Stat
          label="Opened by nobody"
          value={untouched || "0"}
          color={untouched ? "#fbbf24" : undefined}
          hint={untouched === 1 ? "material" : "materials"}
        />
      </StatRow>

      <Panel
        title="Open rate by material"
        right={
          <InfoDot title="What an open is" align="right">
            A record means the student clicked the item and the browser was handed the file, the link or the page.
            <br /><br />
            It is not evidence of reading. A student can open a PDF and never scroll it, and a student who reads
            the chapter in the paper textbook generates no record at all. Read a low rate as "this was not opened
            through the course site", which is often a fact about the posting rather than about the class.
            <br /><br />
            Placeholder items with no file or URL attached are left out entirely, since nobody could have opened them.
          </InfoDot>
        }
        subtitle="In the order students see them. Click any material for who has and has not opened it."
      >
        {loading ? (
          <p style={{ ...s.muted, margin: 0 }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map(g => (
              <div key={g.moduleId}>
                <div style={{
                  color: muted, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
                  textTransform: "uppercase", padding: "0 4px 5px", borderBottom: `1px solid ${border}`,
                }}>{g.title}</div>
                {g.rows.map(materialRow)}
              </div>
            ))}
          </div>
        )}
        <p style={{ ...s.muted, fontSize: 11, margin: "14px 0 0", lineHeight: 1.5, paddingTop: 12, borderTop: `1px solid ${border}` }}>
          Opens have been recorded since {new Date(`${MATERIAL_TRACKING_SINCE}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.
          Anything posted and opened before then shows here as never opened, because nothing was watching, not
          because nobody looked.
        </p>
      </Panel>

      <Panel
        title="Per student"
        subtitle="How much of what has been posted each student has opened, fewest first."
      >
        {loading ? (
          <p style={{ ...s.muted, margin: 0 }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {students.map((x, i) => (
              <div
                key={x.stu.studentId}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "minmax(0,1fr) auto" : "minmax(0,1fr) 90px 96px 110px",
                  gap: 12, alignItems: "center", padding: "8px 4px",
                  borderTop: i ? `1px solid ${border}` : "none",
                }}
              >
                <span style={{ color: text, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nameOf(x.stu)}
                </span>
                {!isMobile && <Meter pct={x.pct} width={62} />}
                <span style={{ color: muted, fontSize: 12, whiteSpace: "nowrap", textAlign: isMobile ? "right" : "left", fontFamily: "monospace" }}>
                  {x.opened} of {materials.length}
                </span>
                {!isMobile && (
                  <span style={{ color: muted, fontSize: 11.5, whiteSpace: "nowrap", textAlign: "right" }}>
                    {x.lastAt ? fmtSince(x.lastAt) : "never"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <p style={{ ...s.muted, fontSize: 11, margin: "12px 0 0", lineHeight: 1.5 }}>
          A student at the top of this list is worth a question, not a conclusion: opening nothing here is equally
          consistent with working from the printed textbook. The Correlation view is where to check whether opening
          material tracks with performance in this class at all.
        </p>
      </Panel>
    </div>
  );
}
