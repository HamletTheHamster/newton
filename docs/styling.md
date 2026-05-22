# Styling Guide

All styles are inline — no CSS files, no CSS modules, no Tailwind.

A shared `s` object at the top of `src/newton.jsx` holds reusable style objects (e.g. `s.card`, `s.input`, `s.btnPri`). Theme constants are also defined at the top of that file:

| Constant | Purpose        |
|----------|----------------|
| `BG`     | Page background |
| `CARD`   | Card background |
| `TEAL`   | Primary accent  |
| `MUTED`  | Secondary text  |
| `BORDER` | Border color    |

When adding new UI, use values from `s` and the theme constants rather than hardcoding colors or repeated style properties.
