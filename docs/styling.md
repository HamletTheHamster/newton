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
