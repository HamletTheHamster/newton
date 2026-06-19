# Answer-Key Discrepancy Log

A running record of places where the **instructor's source answer key** (the PDFs under
`hwImage/HW*/`) disagrees with the **independently verified solution** baked into the app.
The app always uses the verified value, so student grading is correct regardless — this log
exists so the instructor can go back and **fix the source key documents** later.

**How to use this when authoring/verifying a homework set:** as you solve each problem from
scratch (see [homework-roadmap.md](homework-roadmap.md) § Authoring), every time your verified
answer differs from the instructor key — *even if the difference is within the ±2% grading
tolerance* — add a row below. Flag whether the difference is inside or outside tolerance:

- **Outside ±2%** → the key is wrong enough that a student trusting it would be marked wrong by
  the app (or vice-versa). High priority to fix.
- **Within ±2%** → both grade as correct in the app, but the printed key still shows a
  slightly-off number worth cleaning up (usually intermediate rounding).

Columns: the part, the key's value, the verified value, whether the gap exceeds ±2% of the
verified value, the likely cause, and a Fixed? box to tick once the source key is corrected.

---

## HW3 — Motion in Two Dimensions (verified 2026-06-18)

| Problem / part | Key value | Verified value | Outside ±2%? | Likely cause | Fixed? |
|----------------|-----------|----------------|--------------|--------------|--------|
| **3.6 (a)** — $v_y$ at $t_2$ | **0.54 m/s** | **0.52 m/s** (0.5177) | **Yes** — ±2% band is ≈ [0.507, 0.528] | Transcription slip: the key's own expression $4.5\sin31° - 1.8$ evaluates to 0.52, but it boxed 0.54. | ☐ |
| 3.6 (b) — direction of $\vec v_2$ | 4.8° | 4.58° | No | Key rounded the components to 6.4 and 0.54 *before* taking $\arctan$; using full precision gives 4.58°. | ☐ |
| 3.22 (c) — height water strikes building | 15.8 m | 15.9 m | No | Key used $\sin53.1° \approx 0.7997$ early; with the exact 3‑4‑5 angle $v_{0y}=20.0$ exactly, so $60.0 - 44.1 = 15.9$ m. | ☐ |

**Not a key error, but noted for context:** 3.54 (b) has no single correct number — with the
minimum muzzle velocity the shell lands essentially *at* the cliff edge and the "distance past
the edge" is hypersensitive to rounding of $v_0$ (see homework-roadmap.md). The app grades it as
a conceptual `text` part rather than a numeric, so it is not a key discrepancy.

---

## HW1 / HW2

Re-verified on 2026-06-18 and confirmed correct/complete (per homework-roadmap.md § Authoring),
but specific key-vs-verified differences were not separately logged at the time. If those source
keys are re-checked in the future, record any discrepancies here.
