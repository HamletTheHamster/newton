# Answer-Key Discrepancy Log

A running record of places where the **instructor's source answer key** (the PDFs under
`source/<courseCode>/hw/HW*/`) disagrees with the **independently verified solution** baked into
the app. The app always uses the verified value, so student grading is correct regardless — this
log exists so the instructor can go back and **fix the source key documents** later.

This is the single log for **all** courses, split into a top-level section per course. Add new
rows under the right course heading.

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

# PHY 115 — Physics I (`physics1`)

Source keys: `source/phy115/hw/HW*/`. Per-assignment authoring notes: [courses/phy115.md](courses/phy115.md).

## HW3 — Motion in Two Dimensions (verified 2026-06-18)

| Problem / part | Key value | Verified value | Outside ±2%? | Likely cause | Fixed? |
|----------------|-----------|----------------|--------------|--------------|--------|
| **3.6 (a)** — $v_y$ at $t_2$ | **0.54 m/s** | **0.52 m/s** (0.5177) | **Yes** — ±2% band is ≈ [0.507, 0.528] | Transcription slip: the key's own expression $4.5\sin31° - 1.8$ evaluates to 0.52, but it boxed 0.54. | ☐ |
| 3.6 (b) — direction of $\vec v_2$ | 4.8° | 4.58° | No | Key rounded the components to 6.4 and 0.54 *before* taking $\arctan$; using full precision gives 4.58°. | ☐ |
| 3.22 (c) — height water strikes building | 15.8 m | 15.9 m (15.855) | No | Key used $\sin53.1° \approx 0.7997$ early; with the exact 3‑4‑5 angle $v_{0y}=20.0$ exactly, so $60.0 - 44.145 = 15.9$ m. Still stands under $g=9.81$. | ☐ |

**Not a key error, but noted for context:** 3.54 (b) has no single correct number — with the
minimum muzzle velocity the shell lands essentially *at* the cliff edge and the "distance past
the edge" is hypersensitive to rounding of $v_0$ (see homework-roadmap.md). The app grades it as
a conceptual `text` part rather than a numeric, so it is not a key discrepancy.

---

## HW4 — Newton's Laws of Motion (verified 2026-06-19)

> **✅ Three rows here were RESOLVED on 2026-08-09** when the course convention changed from
> $g = 9.80$ to $g = 9.81\text{ m/s}^2$ (matching this source key and PHY 215). 4.19(b), 4.37(b)
> and 4.57(a)/(b) differed *only* because of that constant, so the app and the printed key now
> agree exactly — nothing to fix in the source document. They are struck through below rather than
> deleted, so the history stays readable.

| Problem / part | Key value | Verified value | Outside ±2%? | Likely cause | Fixed? |
|----------------|-----------|----------------|--------------|--------------|--------|
| **4.37 (a)** — smallest child force | **17 N** | **16.6 N** (16.603) | **Yes** — ±2% band is ≈ [16.27, 16.94] | Key over-rounded $F_2\sin30° - F_1\sin60° = 70.0 - 86.6 = -16.6\text{ N}$ up to 17 N. Independent of $g$. | ☐ |
| 4.12 (a) / (c) — acceleration / speed | 4.3 m/s² / 43 m/s | 4.31 m/s² (4.3077) / 43.1 m/s | No | Key carried only 2 sig figs for $a$; the given data (32.5 kg, 140 N, 10.0 s) support 3. Independent of $g$. | ☐ |
| ~~4.19 (b) — weight on Io~~ | ~~8.12 N~~ | **8.12 N** (8.118) | — | ~~Key used $g=9.81$, app used 9.80.~~ **Resolved** — app now uses 9.81 and agrees with the key. | ✅ |
| ~~4.37 (b) — weight of cart~~ | ~~840 N~~ | **840 N** (839.95) | — | ~~Key used $g=9.81$, app used 9.80.~~ **Resolved** — app now uses 9.81 and agrees with the key. | ✅ |
| ~~4.57 (a)/(b) — mass of B / mass of A~~ | ~~4.33 kg / 5.29 kg~~ | **4.33 kg** (4.3321) / **5.29 kg** (5.2948) | — | ~~Key used $g=9.81$ in $g-a$, app used 9.80.~~ **Resolved** — app now uses 9.81 and agrees with the key. | ✅ |

**Not a key error, but noted for context:** 4.38 (b) — the impact speed ($0.17\text{ m/s}$) is a
small difference of two larger numbers ($v^2 = 1.5^2 - 2|a|\cdot500 = 2.25 - 2.222 = 0.028$), so it
is mildly sensitive to how the acceleration is rounded. It is *not* ill-conditioned enough to drop
the numeric (the canonical 0.17 m/s sits inside the ±2% band as long as full precision is carried),
unlike 3.54(b). Kept as a numeric part.

---

## HW1 / HW2

Re-verified on 2026-06-18 and confirmed correct/complete (per homework-roadmap.md § Authoring),
but specific key-vs-verified differences were not separately logged at the time. If those source
keys are re-checked in the future, record any discrepancies here.

---

# PHY 215 — Physics II (`physics2`)

Source keys: `source/phy215/hw/HW*/`. Per-assignment authoring notes: [courses/phy215.md](courses/phy215.md).

## HW1 — Electric Charge & Electric Field (verified 2026-08-09)

Every value was independently re-derived from the problem statements before authoring. The key is
in good shape — **all seven gaps below are well inside the ±2% band**, so a student following
either the key or the app grades as correct. Constants used by the app: $k = 8.988\times10^9$,
$e = 1.602\times10^{-19}\text{ C}$, $m_e = 9.109\times10^{-31}\text{ kg}$,
$m_p = 1.673\times10^{-27}\text{ kg}$, $g = 9.81\text{ m/s}^2$.

| Problem / part | Key value | Verified value | Outside ±2%? | Likely cause | Fixed? |
|----------------|-----------|----------------|--------------|--------------|--------|
| **21.2** — number of electrons | 1.24×10¹⁹ | **1.25×10¹⁹** (1.2483) | No | The key divided by $1.609\times10^{-19}$ — a digit-transposition typo for the electron charge $1.602\times10^{-19}\text{ C}$. | ☐ |
| **21.9 (b)** — smaller charge | 0.374 μC | **0.371 μC** (0.37107) | No | Transcription slip: the key's own line computes $3.71\times10^{-7}\text{ C}$ and its boxed larger charge $1.48\ \mu\text{C}$ equals $4\times0.371$ — so "0.374" is inconsistent with the key's own arithmetic. | ☐ |
| 21.33 (b) — proton deflection | 2.73 μm | **2.72 μm** (2.7231) | No | Intermediate rounding of the proton's acceleration. | ☐ |
| 21.34 — resultant $E_x$ | −6.48×10³ N/C | **−6.47×10³ N/C** (−6471) | No | Key rounded $\tfrac35\times1.08\times10^4$ before subtracting. | ☐ |
| 21.45 (iii) — field | −405 N/C | **−404 N/C** (−404.44) | No | Key rounded the two contributions (449.5 and 45.0) to 3 sf before summing. | ☐ |
| 21.45 (ii) — force on electron | 4.29×10⁻¹⁷ N | **4.30×10⁻¹⁷ N** (4.2999) | No | Propagated from the key's rounded field value (−268 instead of −268.38). | ☐ |
| 21.45 (iii) — force on electron | 6.49×10⁻¹⁷ N | **6.48×10⁻¹⁷ N** (6.4798) | No | Propagated from the rounded −405 N/C above. | ☐ |

**Confirmed correct (no discrepancy):** 21.2 charge (2 C), 21.9(a) 0.742 μC and (b) larger
1.48 μC, 21.22 (2.40 μN, $+x$), 21.30 ($\sqrt2 q/\pi\epsilon_0a^2$, $-y$), 21.33(a) 364 N/C,
21.34 $E_1$/$E_2$ magnitudes, 21.45(i), the Clock answer (**3:30** — verified by direct vector
summation as well as the pairing argument), 21.73 (3.41×10⁴ N/C at $g=9.81$), and all of 21.87
(0.418 m, 2.89 m, and the symbolic forms).
