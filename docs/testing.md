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

## Firebase startup flake

`fbConnectTest` (in `src/firebase.js`) writes to `_test` and reads it back. Occasionally fails with *"Write succeeded but read-back mismatch"* — passes on a page reload. Two browser tabs or back-to-back test runs can race on the same `_test` node. If you see the "Cannot Reach Database" screen on first load during a test, retry before treating it as a real failure.

## Submission side effects

`startQuiz` only enters **practice mode** if `submissions` already contains a record for `(studentId, quizId)` — i.e. the student has completed that quiz before. A first-time run through any quiz writes a real graded submission to Firebase. When testing the quiz flow:

- Use a quiz the test student has already completed (practice mode → no submission written), **or**
- Be prepared to delete the resulting `submissions/{studentId}/{...}` entry afterward.

The "⚠️ This quiz is past the due date" banner at the top of the chat indicates the run is **not** in practice mode (practice mode shows a teal "Practice" badge in the header and a "Practice Mode" line in the system message).
