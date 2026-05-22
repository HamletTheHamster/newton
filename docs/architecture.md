# Architecture

The entire application is a single React component in `src/newton.jsx` (~1250 lines). There are no routes, no component files, no state management library. Navigation is driven by a `screen` state variable; each screen is a top-level `if(screen==="...")return(...)` block near the bottom of the file.

**Screens:** `student-search` → `student-pw` → `student-portal` → `quiz` | `inst-login` → `instructor` → `inst-sub-detail`

## Firebase (no SDK — REST only)

All Firebase access goes through hand-rolled REST helpers at the top of `newton.jsx`:

- **App Check** (`getAppCheckToken`): exchanges a reCAPTCHA v3 token (prod) or a hardcoded debug UUID (dev) for a short-lived App Check token. Pre-warms at module load. The RTDB rules reject any request without a valid App Check token.
- **Anonymous Auth** (`getAuthToken`): signs in anonymously via the Identity Toolkit REST API and refreshes automatically. The `?auth=<idToken>` query param is required on every RTDB request.
- **`fbGet` / `fbSet`**: thin wrappers that attach both tokens. Every data write goes through `fbSave` (inside the component), which additionally manages the `syncStatus` state shown in the instructor header.

Security rules: `database.rules.json`.

**RTDB layout:**
```
roster/          — array of student objects
studentPws/      — {studentId: {hash, salt}}
submissions/     — {studentId: [submission, ...]}
checkedSubs/     — {submissionId: true}
dueDates/        — {quizId: "YYYY-MM-DD HH:mm"}
settings/        — {passwordHash, passwordSalt, totpSecret?, trustedDevices?}
bugReports/      — {id: {id, message, timestamp, read}}
_test/           — scratch node for connectivity check on startup
```

## Authentication

**Students:** password verified client-side against a SHA-256 hash+salt stored in `studentPws`. Legacy plain-text passwords are migrated to hashed on first correct login. Default password is the student's ID.

**Instructor:** single shared password verified against `settings.passwordHash/Salt`. Optionally protected by TOTP 2FA (RFC 6238, implemented with `crypto.subtle` HMAC-SHA1 — no library). Trusted devices are stored as SHA-256 hashes of a random token kept in `localStorage`; the raw token never goes to Firebase.

### 2FA Setup Flow

Enable in Settings tab → generates TOTP secret in browser → shows QR code (via `qrcode` npm package) → user confirms with a 6-digit code → secret saved to `settings.totpSecret` in Firebase. "Remember this device" writes the token hash to `settings.trustedDevices` and the raw token to `localStorage['newton_device_token']`. Disable/clear actions use the existing `confirmDanger` modal (requires password re-entry).

## Claude API

Two calls, both proxied through `netlify/functions/claude.js` (which forwards to `api.anthropic.com/v1/messages` with the server-side API key):

1. **`checkImageReadability`** — validates that an uploaded drawing is legible before the student submits.
2. **`evaluateAnswer`** — grades a free-text quiz answer, returns a score and feedback. Maintains a per-question dialogue history (`apiHist`) so the model has context for follow-up exchanges within the same question.
