import { useTheme } from "../../theme.js";
import { ModuleItem } from "../../components/lms/ModuleItem.jsx";
import { visibleShelves } from "../../course-info.js";

// The student's reference shelves: the equation sheet, the textbooks, the supplementary videos,
// the things that are true all term and are never "done".
//
// It renders the SAME `ModuleItem` rows as the Home module list, deliberately, so a file looks
// identical wherever a student meets it. What it does not render is the checklist furniture:
//
//   no completion circles  a resource is not work, and the module header on Home was asking
//                          students to tick off owning a textbook
//   no "n / total"         there is nothing to count down
//   no collapse control    a shelf is a place you go to find one thing, so everything is open
//   no release lock        reference material is available from day one by definition
//
// `tracked: false` in the meta is what suppresses the circle (see ModuleItem), and it is the only
// difference between a row here and the same row on Home. Opens are still RECORDED — the click
// goes through the same `onOpenMaterial` — so the instructor's Analytics -> Materials open rates
// cover shelves exactly as they cover a week's reading. The tick is a student-facing checklist
// affordance; the record is instructor telemetry, and only the first one is out of place here.
//
// Props:
//   shelves: merged modules already filtered to the resource ones (partitionModules, course-info.js)
//   onItemClick(item): opens the material and records the open (App.jsx's openMaterial)
export function StudentResources({ shelves = [], onItemClick }) {
  const { s, text, muted, border } = useTheme();

  // What a shelf lists, and whether the sidebar offers this page at all, are the same question,
  // so they are answered in one place (course-info.js) rather than once here and once in App.jsx.
  const visible = visibleShelves(shelves);

  return (
    <div>
      <h2 style={{ color: text, fontWeight: 700, fontSize: 22, margin: "0 0 22px" }}>Resources</h2>

      {visible.length === 0 ? (
        <div style={{ ...s.card, padding: 40, textAlign: "center", color: muted }}>
          <p style={{ margin: 0, fontSize: 14 }}>No resources have been posted yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map(shelf => (
            <div key={shelf.id} style={{ ...s.card, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", fontWeight: 600, fontSize: 15, color: text }}>
                {shelf.title}
              </div>
              <div style={{ borderTop: `1px solid ${border}` }}>
                {shelf.items.map((item, i) => (
                  <ModuleItem
                    key={item._key || i}
                    item={item}
                    meta={{ tracked: false }}
                    onClick={() => onItemClick && onItemClick(item)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
