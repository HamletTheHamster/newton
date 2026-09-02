# Testing & Verification

There is no automated test suite. To verify a change end-to-end, drive the running app in a browser. This doc captures the project-specific gotchas that aren't obvious from the source.

## Driving the app under test

Headless browser (Playwright/Puppeteer) against `http://localhost:8888` (Netlify dev) is the right surface. The whole app is one React component with no route hashes — navigation is `screen` state — so locate by visible text or placeholder, not by URL.

Selector tips specific to this app:

- Inputs **don't have `type="text"`**; selectors like `input[type="text"]` will time out. Use `input[placeholder*="..." i]` or `:not([type])`.
- The chat answer field is a `<textarea>`. Submit with `Enter` (Shift+Enter for newline).
- The student login flow: name search → click roster row → password screen → portal. Search input filters live; the matching row is what you click, not the input itself. The roster search spans every **active** class — if a name matches in multiple classes the class label is shown beside it.
- Before any roster/quiz/grading flow can be exercised, at least one class must exist. On a fresh RTDB, log in as instructor → Settings → Classes → create one (e.g., name "Physics 1 Test", course `physics1`). The instructor header dropdown switches between classes; each class has its own roster, submissions, gradebook check marks, and due dates.
- Wait for the textarea to become enabled again (`!disabled`) as a busy-state signal — there is no spinner element.

## Local Claude proxy: two gotchas

Both bite anyone running `netlify dev` for the first time. Production isn't affected.

### 1. `config = { path: ... }` in `claude.js` 404s under `netlify-cli` 24.x

The function exports `export const config = { path: "/.netlify/functions/claude" }`. `netlify-cli 24.9.0` treats this as a routing collision with the default path and refuses to invoke the function, with a self-contradicting warning:

> Function claude cannot be invoked on /.netlify/functions/claude, because the function has the following URL paths defined: /.netlify/functions/claude

Workaround: comment out the `path` config locally while testing. Don't commit — production deployment needs it.

### 2. `ANTHROPIC_API_KEY` is shadowed and silently dropped

Two compounding behaviors in `netlify dev`:

- `process.env.ANTHROPIC_API_KEY` is set by netlify-cli to a ~413-char internal JWT (Edge Functions identity token) that overrides whatever you set. The function reads it, hands it to Anthropic, and gets `401 invalid x-api-key`.
- The smart-secret-detection scanner recognises `sk-ant-*` values and **silently** omits them from `.env.local` injection — no log line, the key just isn't there at runtime.

Workaround: use a non-`ANTHROPIC` env var name locally.

```bash
# .env.local (local only — don't commit)
NEWTON_LOCAL_KEY=sk-ant-...
```

```js
// netlify/functions/claude.js — local edit, don't commit
"x-api-key": process.env.NEWTON_LOCAL_KEY || process.env.ANTHROPIC_API_KEY,
```

The `NEWTON_LOCAL_KEY` name slips past smart-detection, and putting it **first** in the `||` avoids the JWT shadowing.

Pull the production key with `netlify env:get ANTHROPIC_API_KEY` after `netlify link`.

To debug what the function actually sees, add a temporary `x-debug` branch that returns `{hasAnthropic, anthropicPrefix, ...}` and probe with `curl -X POST -H "x-debug: 1" http://localhost:8888/.netlify/functions/claude`.

## App Check blocks local dev entirely

If `VITE_FIREBASE_DEBUG_TOKEN` is missing from `.env.local` **or** is not registered in the Firebase console, the app shows "Cannot Reach Database / App attestation failed" immediately on load and is completely unusable locally.

Fix:
1. Go to the Firebase console → **newton-93d05** project → **App Check** → **Apps** → your web app → **Manage debug tokens**
2. Either add the UUID already in your `.env.local` as a registered token, or generate a new one there and paste it into `.env.local` as `VITE_FIREBASE_DEBUG_TOKEN`
3. Restart `npm run dev`

This token is for local dev only — do not set it in Netlify environment variables. The production build uses reCAPTCHA v3 instead.

## Firebase startup flake

`fbConnectTest` (in `src/firebase.js`) writes to `_test` and reads it back. Occasionally fails with *"Write succeeded but read-back mismatch"* — passes on a page reload. Two browser tabs or back-to-back test runs can race on the same `_test` node. If you see the "Cannot Reach Database" screen on first load during a test, retry before treating it as a real failure.

## Submission side effects

`startQuiz` only enters **practice mode** if `submissions` already contains a record for `(studentId, quizId)` — i.e. the student has completed that quiz before. A first-time run through any quiz writes a real graded submission to Firebase. When testing the quiz flow:

- Use a quiz the test student has already completed (practice mode → no submission written), **or**
- Be prepared to delete the resulting `submissions/{studentId}/{...}` entry afterward.

Everything that signals the run's mode is in the **top bar**, not the chat: practice mode shows a teal "Practice" badge beside the title ("Preview" for an instructor preview, whose subtitle also reads "Instructor preview · not saved"), and a graded run past its due date appends "· ⚠️ past due (50% penalty)" to the subtitle. The chat itself opens directly on question 1 — the old leading `system` message that repeated the title, taker and banner was removed as duplication of the top bar. `ChatMessages` still renders `system` messages, since submissions saved before that change carry one in their stored dialogue.

**The safest way to exercise a quiz or homework end-to-end is the instructor preview**, which needs no student and writes nothing: Instructor → Home (Modules) → expand a module → **click the item's title**. It runs the real runner with practice forced on, badged "Preview" instead of "Practice", and "← Back" returns to Modules rather than the student portal. Use it to check new content (question wording, choice feedback, survey replies, homework prompts/figures, graph-vector-fbd fields, Claude's grading of a free-response or `text`/`math` answer) without touching `submissions`, `hwDrafts` or `hwAttempts` — homework preview writes **no** draft and **no** attempt counts, so it is repeatable. It still calls Claude, so the local proxy gotchas above apply.

Clicking the title also opens the other item types the way a student gets them — `file` and `link`/`reading`/`notes` in a new tab, `page` in the student `PageViewer` — which is the quickest way to confirm an upload or URL actually resolves.

## Blackboard export — verifying without risking the real gradebook

The Blackboard sync (Gradebook → **Blackboard**) is the one feature whose output lands in a system
Newton does not control and cannot undo: an upload writes into the official gradebook of record,
where a mistake is discovered by a student. Verify it in this order.

**1. The format logic is already covered.** `node src/blackboard.test.mjs` (63 assertions) exercises
CSV round-tripping, column-header parsing, student matching, the re-import merge, and every
deliberate omission. Run it before touching `src/blackboard.js` — it is faster and stricter than
any click-through, and it is what caught `\bhw\b` failing to match `HW1`.

**2. Read the file before uploading it.** The modal's counts and the file are built from the same
`buildBlackboardCsv` call, so they cannot disagree — but open the CSV anyway and check the header
row. Existing columns must carry their `|1281892` suffix verbatim; columns you want Blackboard to
create must be a bare title with no `|` and no `[Total Pts: …]`. That one glance catches the whole
class of "it uploaded but went to the wrong place" failures.

**3. Test an upload on one column, not forty.** Blackboard has no undo for a grade upload. Untick
"Let Blackboard create the columns it does not have yet", link a single assignment, upload, and
confirm the values land where expected before doing a full run.

**4. Never point a test at a live course.** There is no sandbox inside Newton for this — the file
is real grades for real students. Use a Blackboard development/sandbox course if you need to
exercise column creation.

### What to check in the modal (the UI is not unit-testable)

- **Import** a Grade Center download: student and column counts appear, and unmatched people are
  **named** in both directions (on the roster but not in Blackboard, and vice versa).
- **Re-import** a newer download: pairings you made by hand survive, and columns Blackboard has
  since created link themselves. This is `mergeImport`, and it is the step that makes the whole
  scheme repeatable all term.
- **The select dropdowns** render dark in dark mode — they carry `colorScheme`, since the option
  list is browser chrome no CSS of ours reaches.
- **Toggling either checkbox** changes the counts in step 3 immediately, because they are read off
  the real file rather than estimated separately.

### Known Blackboard behaviours that look like bugs

- **A created column arrives at 100 points** (Ultra), not Newton's 10. The upload format has no
  points field; `[Total Pts: …]` is written on download and ignored inbound. Fix it in Blackboard
  (Gradebook → Gradable Items → ⋯ → Edit → points), which is the house route, or turn on
  `scaleToColumn`. Not a Newton bug.
- **An assignment nobody has a grade in does not appear** after upload. Ultra only creates a column
  that has at least one grade in it, so Newton holds those back deliberately and lists them under
  "waiting on a first grade". Not a dropped column.
- **Excused work uploads blank.** A grade upload cannot set Blackboard's exempt flag. Mark those
  exempt in Blackboard by hand.

### If you need a fixture

Do **not** commit one. A Grade Center download carries every student's name, ID and username, and
`Fall * gradebook/` is gitignored for that reason. `src/blackboard.test.mjs` builds its own
Blackboard file from `toCsv([...])` at the top of the file — extend that instead.
