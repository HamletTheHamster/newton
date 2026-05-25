# Styling Guide

All styles are inline — no CSS files, no CSS modules, no Tailwind.

## Instructor side — static theme

A shared `s` object in `src/theme.js` holds reusable style objects (e.g. `s.card`, `s.input`, `s.btnPri`). Theme constants are also exported from that file:

| Constant | Purpose        |
|----------|----------------|
| `BG`     | Page background |
| `CARD`   | Card background |
| `TEAL`   | Primary accent  |
| `MUTED`  | Secondary text  |
| `BORDER` | Border color    |

The instructor side still imports these constants directly. When adding new instructor UI, use values from `s` and the constants rather than hardcoding colors.

## Student side — themeable (dark/light)

The student portal supports a user-toggled light mode (set in student Account Settings, persisted to `localStorage` as `newton_light_mode`). All student-facing components must use `useTheme()` instead of importing static constants:

```js
import { useTheme } from "../../theme.js";

export function MyStudentComponent() {
  const { s, bg, card, text, muted, border, teal, tealDim, hover, isLight } = useTheme();
  // use s.card, s.btnPri, text, muted, border, etc. — never hardcode #fff or BG
}
```

`useTheme()` reads from `ThemeContext`. When there is no provider (instructor side), it returns the dark theme, so shared components (e.g. `ModuleRow`, `ModuleItem`, `PageViewer`) work correctly in both contexts.

`buildTheme(light)` in `theme.js` generates the full token set:

| Token    | Dark value           | Light value              |
|----------|----------------------|--------------------------|
| `bg`     | `#1c1d1f`            | `#F4F0EB` (bone/eggshell)|
| `card`   | `rgba(23,23,23,0.85)`| `rgba(255,255,255,0.72)` |
| `text`   | `#fff`               | `#1c1d1f`                |
| `muted`  | `#a0a0a0`            | `#6b6b6f`                |
| `border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.09)`   |
| `teal`   | `#00828c`            | `#00828c` (unchanged)    |
| `hover`  | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.04)`   |

The `ThemeContext.Provider` is set in `App.jsx` around the student portal render (including the settings panel). `lightMode` state is stored in `App` and toggled via the "Appearance" section in student Account Settings.

## Mobile / Responsive

All responsive logic is JS-driven — no CSS media queries. Use the `useIsMobile` hook from `src/utils.js`:

```js
import { useIsMobile } from "../../utils.js";

const isMobile = useIsMobile(); // true when viewport ≤ 768px
```

The breakpoint is 768px (changeable via the optional `breakpoint` argument). `Shell` uses this internally to switch between the three-pane desktop layout and the single-column mobile layout (hamburger drawer for nav, horizontal todo strip below header). For any new component that needs to adapt at the same breakpoint, import `useIsMobile` from utils rather than adding a new listener.
