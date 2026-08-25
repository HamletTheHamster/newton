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

## HW2 — Gauss's Law (verified 2026-08-11)

Every value independently re-derived from the problem statements. **This key is numerically
clean: every boxed value agrees with the verified value to the sig figs printed.** Only one row
below, and it is a rounding-convention note rather than an error. Constants as for HW1, with
$\epsilon_0 = 8.8542\times10^{-12}\ \text{C}^2/(\text{N}\cdot\text{m}^2)$ (the key uses
$8.85\times10^{-12}$, a 0.05% difference that never reaches the third sig fig).

| Problem / part | Key value | Verified value | Outside ±2%? | Likely cause | Fixed? |
|----------------|-----------|----------------|--------------|--------------|--------|
| 22.1 (a) — flux through the sheet | 1.8 N·m²/C | **1.75 N·m²/C** (exact) | Raw gap is 2.9%, but see note | Not an error: $EA\cos60° = 1.75$ exactly, and 1.8 is its correct 2-sig-fig rounding (14 N/C carries only 2 sf). The app stores 1.75 and reveals "1.8"; **both entries grade correct** (1.8 via `numericMatch`'s sig-fig leniency). Listed only because a bare numeric comparison trips the ±2% check. | n/a |

**The figure for 22.43 is wrong in the textbook and is NOT reproduced.** Fig. P22.43 draws the
positive sphere deflected *toward* the positively charged sheet, i.e. attracted, which contradicts
the problem's own $\sigma = +2.50\times10^{-9}\text{ C/m}^2$ and the repulsion the solution
assumes. The app serves a figure drawn for this purpose
(`public/homeworkFigures/physics2/HW2/figP22-43.png`, source SVG beside it) with the sphere pushed
*away* from the sheet and the sheet's positive charge marked. Nothing else about the problem
changed. **This one is worth raising with the publisher's figure, not just the key.**

**Confirmed correct (no discrepancy):** 22.3 (3.53×10⁵ N·m²/C, 3.13 μC), 22.4 (1.36×10⁵ twice,
2.71×10⁵), 22.10 (0, −678, −226 N·m²/C), 22.14 (7.43 N/C, 0), 22.15 (0.0810 N), 22.26
(6.56×10⁻²¹ J, 1.20×10⁵ m/s), 22.42 (all symbolic: $\rho r/2\epsilon_0$,
$\lambda/2\pi\epsilon_0 r$, and their agreement at $r=R$), 22.43 (10.2°), 22.51
($qQ/4\pi\epsilon_0r^2$ inward, and zero inside).

## HW3 — Electric Potential (verified 2026-08-15)

Every value independently re-derived from the problem statements. Constants as for HW1/HW2.
**This is the least clean PHY 215 key so far: two rows below are outright wrong (one by a factor
of ten), and a third boxes the wrong sign for the quantity the problem actually asks for.** All
three are worth correcting in the source document before students see it.

| Problem / part | Key value | Verified value | Outside ±2%? | Likely cause | Fixed? |
|----------------|-----------|----------------|--------------|--------------|--------|
| **23.8** — $U$ of the triangle | **7.77 mJ** (7.77×10⁻³ J) | **77.7 mJ** (0.077653 J) | **Yes** — off by a factor of **10** | Arithmetic slip in the key's own line: $3(8.99\times10^9)(1.20\times10^{-6})^2/0.500 = 7.77\times10^{-2}\text{ J}$, but it was written and boxed as $7.77\times10^{-3}$. Y&F's printed answer is 0.0777 J. | ☐ |
| **23.19 (c)** — work on the 2.50 nC charge | **−82.5 nJ** | **+82.4 nJ** (8.2385×10⁻⁸ J) | **Yes** — wrong sign | The problem asks for the charge travelling **from $B$ to $A$**, so $W = q(V_B - V_A)$. The key wrote $W_{a\to b} = q(V_A - V_B)$, i.e. it computed $A \to B$, the reverse trip. Magnitude is right. | ☐ |
| **23.4 (a)** — work to push the protons together | **−7.69×10⁻¹⁴ J** | **+7.69×10⁻¹⁴ J** | **Yes** — wrong sign for what is asked | The problem asks how much work it would **take** to push them together, i.e. the work done by the external agent, which is positive ($W_{ext} = \Delta U$). The key computed the work done by the *electric force*, which is the negative of that. Magnitude is right. The app names the agent in the prompt and marks the item `nonNegative`, so a student following the key gets a free no-cost nudge rather than a wrong verdict. | ☐ |
| 23.50 — acceleration | 3.32×10⁴ m/s² | **3.31×10⁴ m/s²** (33068) | No (0.4%) | The key rounded the intermediate separation to $r_2 = 0.026\text{ m}$ and carried that into $a = kq_1q_2/mr_2^2$; at full precision $r_2 = 0.026067\text{ m}$. The app asks for $r_2$ as its own part, so both roundings grade correct. | ☐ |
| 23.4 (b) — proton speed | 6.79×10⁶ m/s | **6.78×10⁶ m/s** (6.7799×10⁶) | No (0.15%) | Key used $m_p = 1.67\times10^{-27}\text{ kg}$; the course constant is $1.673\times10^{-27}$. | ☐ |

**Confirmed correct (no discrepancy):** 23.1 (−0.356 J), 23.13 (7.42 m/s, moving faster), 23.19(a)
(−737 V) and (b) (−704 V), 23.40 (1.5×10⁶ m), 23.50's separation (0.026 m), all of 23.56
($v = e/\sqrt{4\pi\epsilon_0m_er}$, $K = e^2/8\pi\epsilon_0r$, $K = |U|/2$, $E = -2.18\times10^{-18}\text{ J} = -13.6\text{ eV}$),
23.59 ($-1.46q^2/\pi\epsilon_0d$, verified both by direct summation over all 28 pairs and by the
12/12/4 shell counts), and 23.62 (47.7 V).

---

## HW4 — Capacitance & Dielectrics (verified 2026-08-17)

Every value independently re-derived from the problem statements before the key was opened.
Constants as for HW1–HW3, with $\epsilon_0 = 8.8541878\times10^{-12}\ \text{C}^2/(\text{N}\cdot\text{m}^2)$
(the key uses $8.85\times10^{-12}$).

**This key is in good shape** — the only two rows are small rounding artefacts, both well inside
±2%, and neither changes a verdict. Nothing here rises to the level of HW3's factor-of-ten and
sign errors.

| Problem / part | Key value | Verified value | Outside ±2%? | Likely cause | Fixed? |
|----------------|-----------|----------------|--------------|--------------|--------|
| 24.10 (b) — charge per unit length $\lambda$ | 38.1 nC/m | **38.2 nC/m** (38.229) | No (0.34%) | The key fed its own *rounded* part (a) result back in, using $\ln(3.00/0.250) = 0.18232$ where the unrounded $r_b$ gives $0.181905$, and $\epsilon_0 = 8.85\times10^{-12}$. The one-step route avoids both: $\lambda = Q/L = CV/L = (36.7\text{ pF})(125\text{ V})/(0.120\text{ m}) = 38.2\text{ nC/m}$, with no dependence on $r_b$ or $\epsilon_0$ at all. | ☐ |
| 24.63 (b) — charge on each outer $C_1$ | **960 μC** | **966 μC** (exact) | No (0.62%) | Transcription slip, and inconsistent with the key's own working: its line computes $Q = (2.3\ \mu\text{F})(420\text{ V}) = 966\ \mu\text{C}$ and then boxes 960. Rounded to the 2 sig figs the data support it would be **970**, not 960, so the boxed value is neither the exact result nor its correct rounding. | ☐ |

**Not a key error, but noted for context — 24.31 (b), charge on the 75-nF capacitor.** The key
boxes **17 μC**; the exact value is $Q = (75\text{ nF})(220\text{ V}) = 16.5\ \mu\text{C}$. A bare
numeric comparison makes that a 3.0% gap, outside the ±2% band, but 17 is the *correct* 2-sig-fig
rounding of 16.5 (and 35/75 nF carry only 2 sf), so it is a rounding convention, not an error. The
app stores 16.5 and reveals "17 μC"; **both entries grade correct**, 17 via `numericMatch`'s
sig-fig leniency — confirmed by pushing both through the real `grade.js` handler. Same shape as
HW2's 22.1(a) row.

**A note on 24.63's reveals rather than its key.** The data are 2 sf, but at 2 sf part (b) would
reveal "970 μC" — a third number, matching neither the exact 966 nor the key's 960, which would
read as a wrong answer to a student who got it right. Parts (b) and (c) therefore carry
`sigFigs: 3` so the reveals read 966 μC / 644 μC / 46.7 V, the values a correct reduction actually
produces. Part (a) stays at 2 sf, since $C_1/3 = 2.3$ exactly and "2.30" would overstate it.

**Confirmed correct (no discrepancy):** 24.1 (10.0 kV, 22.6 cm², 8.00 pF), 24.10(a) (3.00 mm),
24.16 (20 pF, 8.6 pF), all of 24.17 (2.40 μF equivalent; 22.4/22.4/44.8/67.2 μC;
5.60/5.60/11.2/16.8 V; $V_{ad} = 11.2$ V), 24.21 (19.3 nF, 482 nC, 163 nC, 25 V), 24.25
(2.83×10⁻² J/m³), all of 24.30 (2.40 μC total and on each capacitor; 43.2 μJ; 19.2 and 24.0 μJ;
16.0 and 20.0 V, the last two summing to the 36 V across the network), 24.31 apart from the (b)
note above (24 μC, 7.7 μC, 2.7 mJ, 0.85 and 1.8 mJ, 220 V across each), 24.36 (225 pC, 608 pC),
and 24.63(a) (2.3 μF), (b)'s $C_2$ charge (640 μC, the correct 2-sf rounding of 644) and (c) (47 V).

## HW5 — Current, Resistance & Electromotive Force (verified 2026-08-25)

Every value independently re-derived from the problem statements before the key was opened, with
$e = 1.602176634\times10^{-19}$ C and $\rho_{\text{Cu}} = 1.72\times10^{-8}\ \Omega\cdot\text{m}$
(Table 25.1). Assigned problems: 25.5, 25.14, 25.38, 25.39, 25.40+25.41 (condensed into one
multipart problem), 25.68, 25.73, 25.77 (part (a) not assigned), 25.83, 25.84.

> **25.77's part letters below are this key document's, i.e. the textbook's.** The app skips part
> (a) and relabels the rest, so **key (b)/(c)/(d) = app (a)/(b)/(c)**. The letters are left as the
> key prints them here, since the point of this log is to find the row to fix in the PDF.

**This key is in very good shape.** Every row below is an intermediate-rounding artefact, all well
inside ±2%, and none changes a verdict: each of the key's boxed values still grades as correct in
the app. The recurring cause is the same one seen in HW4: the key rounds an intermediate current
or power to 2-3 figures and then feeds that rounded number into the next step.

| Problem / part | Key value | Verified value | Outside ±2%? | Likely cause | Fixed? |
|----------------|-----------|----------------|--------------|--------------|--------|
| 25.5 (b) — time for 6-gauge wire | 440 min | **443 min** (442.98) | No (0.67%) | The key carried its rounded part (a) time forward. Since $t \propto A \propto d^2$, the exact ratio is $(4.12/2.05)^2 = 4.0391$, so $t_b = 4.0391 \times 109.67 = 443.0$ min. Working straight from $t = LnqA/I$ gives the same 442.98 min. | ☐ |
| 25.38 (b) — terminal voltage $V_{ab}$ | 15 V | **15.2 V** (15.247) | No (1.6%) | The key used its rounded $I = 0.47$ A, giving $16.0 - 0.752 = 15.25$, then boxed "15". With the exact $I = 8.0/17 = 0.470588$ A, $V_{ab} = 16.0 - (0.470588)(1.6) = 15.25$ V. At the data's precision this should be boxed as **15.2 V**, not 15. | ☐ |
| 25.68 (a) — potential difference $V_{ad}$ | 6.59 V | **6.58 V** (6.5833) | No (0.10%) | The key substituted its rounded $I = 0.167$ A into $V_{ad} = I(15.5\ \Omega) + 4.00$ V. The exact current is $I = 4.00/24.0 = 1/6$ A, giving $15.5/6 + 4.00 = 6.5833$ V. | ☐ |
| 25.77 (d) — savings in one year | $19.13/yr | **$19.10/yr** (19.099) | No (0.16%) | The key rounded the two dissipated powers to 106 W and 66.3 W before subtracting, giving a 39.7 W saving. The unrounded powers are 106.02 W and 66.379 W, so the saving is 39.641 W = 0.039641 kW; $(0.039641)(12)(365) = 173.63$ kWh, and at $0.11/kWh that is $19.099. | ☐ |

**Not a key error, but noted for context — 25.73, the discarded root.** The key writes the
quadratic as $1.3I^2 + 7I - 12.6 = 0$ and discards the negative root with the note "time
reversed". The physical reason is simpler and worth stating in the key: the negative root
($-6.808$ A) would mean current driven backwards through the battery, which the given circuit
does not do. The positive root, 1.4236 A, is confirmed by substitution
($3.2I + 3.8I + 1.3I^2 = 12.6$ V exactly).

**Confirmed correct (no discrepancy):** 25.5(a) (110 min) and (c) (larger diameter gives smaller
drift velocity), 25.14 (1.47×10⁻⁸ Ω·m, silver), 25.38(a) (0.47 A counterclockwise), all of 25.39
(144 Ω, 240 Ω, 0.83 A, 0.500 A), 25.40 (192 Ω, 252 W), 25.41 (484 Ω, 29.8 W, 0.248 A),
25.68(b) (4.08 V) and (c) (0.257 A counterclockwise, 3.87 V), 25.73 (1.42 A), 25.77(b) (35 A →
8-gauge) and (c) (0.0865 Ω, 106 W), 25.83 (4.00 V across the capacitor, 0.667 A, 6.67 V), and
all of 25.84 (6.00 V across the parallel group, 36.0 μC, 3.00 A, 18.0 Ω).
