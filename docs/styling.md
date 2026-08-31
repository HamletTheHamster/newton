# Styling Guide

All styles are inline — no CSS files, no CSS modules, no Tailwind.

## Theme system — both sides use `useTheme()`

Both the instructor and student portals support user-toggled dark/light mode. All components must use `useTheme()` instead of importing static constants:

```js
import { useTheme } from "../../theme.js";

export function MyComponent() {
  const { s, bg, card, text, muted, border, teal, tealDim, hover, isLight } = useTheme();
  // use s.card, s.btnPri, text, muted, border, etc. — never hardcode #fff or BG
}
```

`useTheme()` reads from `ThemeContext`. The static `s` export (always-dark) is only for legacy fallback — prefer `useTheme()` in all new components.

`buildTheme(light)` in `theme.js` generates the full token set:

| Token    | Dark value               | Light value              |
|----------|--------------------------|--------------------------|
| `bg`     | `#1c1d1f`                | `#F4F0EB` (bone/eggshell)|
| `card`   | `rgba(23,23,23,0.85)`    | `rgba(255,255,255,0.72)` |
| `text`   | `#fff`                   | `#1c1d1f`                |
| `muted`  | `#a0a0a0`                | `#6b6b6f`                |
| `border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)`       |
| `teal`   | `#00828c`                | `#00828c` (unchanged)    |
| `hover`  | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.04)`       |

### System preference detection

On first visit (no saved `localStorage` value), the app defaults to the OS light/dark preference:

```js
const saved = localStorage.getItem("newton_light_mode");
if (saved !== null) return saved === "1";
return window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false;
```

Toggling the `☀`/`☽` button (instructor header or student header) saves `"1"`/`"0"` to `localStorage`.

### `ThemeContext.Provider` placement

`App.jsx` computes `const appTh = buildTheme(lightMode)` unconditionally at the top of render (it's a plain function, not a hook). Every screen branch — login, quiz, student portal, instructor portal — is wrapped in `<ThemeContext.Provider value={appTh}>` so components that call `useTheme()` (e.g. `ChatMessages`, `DragDropQuestion`) pick up the correct theme everywhere.

### Modal / popup cards — `solidBg` pattern

`card` in light mode is `rgba(255,255,255,0.72)` (semi-transparent) — intentional for content areas but looks washed-out over a dark overlay. Any modal inner card should override with:

```js
const solidBg = isLight ? "#fff" : "#252627";
// then on the inner <div>:
style={{ ...s.card, background: solidBg, ... }}
```

Applied to: `GradeSettingsModal`, `AnnouncementEditor`, `SubViewModal`, `BugReportModal`, and the "Leave quiz?" confirmation popup in the quiz screen.

### Native `<select>` dropdowns — `colorScheme`

CSS on `<option>` elements doesn't control the OS-rendered dropdown popup. Set `colorScheme` on the `<select>` itself to force the correct native appearance:

```js
<select style={{ ..., colorScheme: isLight ? "light" : "dark" }}>
  <option style={{ background: bg, color: text }}>…</option>
</select>
```

Applied to: instructor class picker, student class picker, and the Settings course picker in `App.jsx`.

### Badge opacity in light mode

`s.badge(color)` uses stronger alpha in light mode so badges are visible on a light background:
- Light: `color + "28"` background (16%), `color + "70"` border (44%)
- Dark: `color + "22"` background (13%), `color + "44"` border (27%)

### Assignment-category colors — one map, in `src/category-colors.js`

The color identifying a category (quiz, homework, lab, midterm, final) is **not** theme-derived and
is **not** declared per screen. It lives in `src/category-colors.js` and is read through
`categoryColor(key, fallback)` or, for a syllabus's free-text category names,
`categoryColorForName(name, fallback)`:

```js
import { categoryColor } from "../../category-colors.js";
background: categoryColor(ev.kind, teal)     // "quiz" | "cat_quiz" | "hw" all resolve
```

The five colors used to be redeclared in `Gradebook.jsx`, `StudentGrades.jsx`,
`StudentSyllabus.jsx`, `StudentCalendar.jsx` and `TodoRail.jsx` under two different key spellings
(`quiz` vs `cat_quiz`), and they drifted — a quiz was mint green in the gradebook and syllabus but
lime in the calendar and To Do rail. **Adding or changing a category color means editing that one
file**; the `fallback` argument stays per-caller, since it's usually that screen's theme teal.

### Module-level utility functions

Functions defined at module scope (outside any component) cannot call `useTheme()`. In `Gradebook.jsx`, the helpers `catColor`, `overallColor`, and `cellFg` import `TEAL` and `MUTED` at module level and keep using those uppercase constants (`catColor` is now a thin wrapper passing `TEAL` as the fallback to the shared `categoryColor`). Only inside component functions can `useTheme()` be called.

## Mobile / Responsive

All responsive logic is JS-driven — no CSS media queries. Use the `useIsMobile` hook from `src/utils.js`:

```js
import { useIsMobile } from "../../utils.js";

const isMobile = useIsMobile(); // true when viewport ≤ 768px
```

The breakpoint is 768px (changeable via the optional `breakpoint` argument). `Shell` uses this internally to switch between the three-pane desktop layout and the single-column mobile layout (hamburger drawer for nav, horizontal todo strip below header). For any new component that needs to adapt at the same breakpoint, import `useIsMobile` from utils rather than adding a new listener.

**Wide instructor tables are the main thing that breaks on a phone.** A fixed `gridTemplateColumns` (the Assignments hub's `1fr 118px 64px 320px 160px`, ~640px of fixed track) cannot shrink, so below the breakpoint it overflows its card and the cells overlap. The pattern used in `Assignments.jsx`: build each row's cells **once** into variables, then place them into either the desktop grid row or a stacked mobile card (title + type badge, labelled field groups, actions on their own wrapping row), and hide the column-header strip on mobile since the card labels its own fields. Building the cells once is what keeps the two layouts from drifting. Tap targets grow at the same time (buttons/chips go from ~5px to ~7px vertical padding), and a control that is merely hidden-by-opacity on desktop (the Clear button) is taken out of the flow with `display: "none"` on mobile so it leaves no dead gap.
