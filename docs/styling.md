# Styling Guide

All styles are inline — no CSS files, no CSS modules, no Tailwind.

A shared `s` object in `src/theme.js` holds reusable style objects (e.g. `s.card`, `s.input`, `s.btnPri`). Theme constants are also exported from that file:

| Constant | Purpose        |
|----------|----------------|
| `BG`     | Page background |
| `CARD`   | Card background |
| `TEAL`   | Primary accent  |
| `MUTED`  | Secondary text  |
| `BORDER` | Border color    |

When adding new UI, use values from `s` and the theme constants rather than hardcoding colors or repeated style properties.

## Mobile / Responsive

All responsive logic is JS-driven — no CSS media queries. Use the `useIsMobile` hook from `src/utils.js`:

```js
import { useIsMobile } from "../../utils.js";

const isMobile = useIsMobile(); // true when viewport ≤ 768px
```

The breakpoint is 768px (changeable via the optional `breakpoint` argument). `Shell` uses this internally to switch between the three-pane desktop layout and the single-column mobile layout (hamburger drawer for nav, horizontal todo strip below header). For any new component that needs to adapt at the same breakpoint, import `useIsMobile` from utils rather than adding a new listener.
