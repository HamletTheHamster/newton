// Server-side screen for a student-chosen preferred first name.
//
// The name a student picks is not private: it replaces their name for the instructor across the
// gradebook and analytics, and it is rendered on the pre-login student picker, where the whole class
// can read it without signing in. So it is approved HERE, not in the browser, for the same reason
// the homework answer key is: shipping the policy to the client hands out the map. This function
// owns the wordlist and the Claude judgment; src/nickname.js holds only the structural rules, which
// the client re-runs purely for instant feedback while typing.
//
// Two layers, in order:
//   1. A wordlist over a leet-folded copy of the name. Deterministic, instant, and free. It is the
//      floor, not the filter: it catches the obvious spellings and nothing subtle.
//   2. Claude, which is the actual filter. It reads the name in context (the student's real name is
//      passed, so "Kunj" for Kunjkumar is plainly fine) and judges slurs in any language, insults
//      aimed at someone, impersonation of staff, and strings that are not names at all.
//
// This FAILS CLOSED. If Claude is unreachable or replies with something unparseable, the name is
// refused and the student is told to try again shortly. The cost of that is a student briefly unable
// to rename themselves; the cost of failing open is a slur on the login screen with nobody watching.
//
// Request body (POST JSON): { name, firstName?, fullName? }
// Response:                 { ok: true } | { ok: false, reason }
import { checkNicknameFormat, normalizeNickname, NICKNAME_MAX } from "../../src/nickname.js";
import { parseJsonReply } from "../../src/grading-core.js";

const MODEL = "claude-opus-5";

const REFUSE_GENERIC = "That name is not appropriate for a course roster. Please choose another.";
const REFUSE_UNAVAILABLE = "The name check is unavailable right now. Please try again in a few minutes.";

// Refused wherever they appear, even glued to other letters, because no personal name contains them.
const BLOCKED_ANYWHERE = [
  "fuck", "shit", "cunt", "faggot", "nigger", "nigga", "whore", "rape", "rapist",
  "wank", "jizz", "retard", "molest", "pedo", "kkk",
];

// Refused only as a whole word. These embed in real names (Cassandra contains "ass", Titus contains
// "tit"), so a substring match here would reject legitimate students, which is the failure mode this
// feature can least afford.
const BLOCKED_WORDS = [
  "ass", "arse", "cum", "tit", "tits", "boob", "boobs", "slut", "bitch",
  "penis", "vagina", "anal", "anus", "sex", "porn", "piss", "turd",
  "fart", "poop", "nazi", "hitler", "std", "aids", "meth",
];

// Deliberately NOT on either list: "dick", "cock", "hoe", "crap", "damn", "hell", "weed". Each is
// either a real given name (Dick is Richard) or mild enough that context decides, and a wordlist has
// no context. Claude judges these, and it judges them well: it approves Dick and Bob while refusing
// Stinky, Idiot and Ur Mom. A hard list can only be wrong about them in the direction that tells a
// student their own name is inappropriate.

// Three normalizations, because one cannot do the job without breaking a real name.
//   plain    lowercased, accents stripped, punctuation gone. The baseline.
//   leeted    plain plus digit/symbol substitutions ("n1gga" -> "nigga"). Repeats INTACT.
//   folded    leeted with runs of a repeated letter collapsed ("fuuuck" -> "fuck").
// Folding is what defeats stretched spellings, but it also turns "boob" into "bob", so it is used
// only for the substring list (where the blocked terms are folded to match), never for whole-word
// matching. Getting that backwards would refuse a student named Bob.
const strip = s => String(s ?? "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
const collapse = s => s.replace(/(.)\1+/g, "$1");

export function leetFold(raw) {
  const map = { "4": "a", "@": "a", "8": "b", "3": "e", "6": "g", "1": "i", "!": "i", "|": "i", "0": "o", "5": "s", "$": "s", "7": "t", "2": "z" };
  const leeted = strip(raw).replace(/[0-9@!|$]/g, ch => map[ch] ?? " ").replace(/[^a-z]+/g, " ").trim();
  return { plain: strip(raw).replace(/[^a-z]+/g, " ").trim(), leeted, folded: collapse(leeted) };
}

// The wordlist verdict. Returns a reason string when the name is refused, or null to pass it on.
export function wordlistReason(name) {
  const { plain, leeted, folded } = leetFold(name);
  if (!plain && !leeted) return null;
  const runs = [plain, leeted].map(f => f.replace(/ /g, ""));
  const foldedRun = folded.replace(/ /g, "");
  // A term is matched against the folded form only if folding leaves enough of it to be specific:
  // collapse("kkk") is "k", and matching that would refuse every name containing the letter k.
  const foldable = w => { const c = collapse(w); return c.length >= 4 ? c : null; };
  if (BLOCKED_ANYWHERE.some(w => runs.some(r => r.includes(w)) || (foldable(w) && foldedRun.includes(foldable(w))))) return REFUSE_GENERIC;
  const words = new Set([...plain.split(" "), ...leeted.split(" ")]);
  if (BLOCKED_WORDS.some(w => words.has(w))) return REFUSE_GENERIC;
  return null;
}

const SCREEN_RULES = `You approve or refuse the display name a college student has chosen for themselves in their physics course's learning app. The name replaces their first name for their instructor and appears on the app's public student-picker list, so the whole class can see it.

Default to APPROVING. Personal names come from every language and culture, and refusing a real name is a worse mistake than approving an odd one. Never refuse a name merely because it is unfamiliar, hard to pronounce, unusual in English, very short, transliterated, or spelled with accents or non-Latin letters.

Approve:
- Any plausible given name, nickname, shortening, or initials (Kunj, Wes, JJ, Bea, Xiùlán, Nguyen, Siobhan, Mo).
- A name unrelated to the student's legal name. Students go by names that look nothing like what is on the roster, and that is the entire point of this feature.

Refuse:
- Profanity, sexual content, or bodily-function humor, in any language or spelling.
- Slurs or hateful references of any kind, including coded or historical ones.
- An insult, taunt, or joke aimed at a person, including the student themselves.
- Impersonation: the name of a well-known real person, or a name that claims a role or authority in the course (Professor, Doctor, Dean, Admin, TA, Instructor).
- Drug, alcohol, weapon, violence, or self-harm references.
- Advertising, slogans, political or religious campaigning, URLs, or handles.
- A string that is not being offered as a name at all (a command, a sentence, keyboard mash).

Reply with ONLY a JSON object and no other text:
{"status":"allow"} to approve, or
{"status":"block","reason":"<one short sentence, addressed to the student, plain text, no quotes of what they typed>"} to refuse.
The reason must be neutral and non-accusatory, and must never repeat the name back.`;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = JSON.parse(await req.text()); }
  catch { return json({ error: "Invalid JSON body." }, 400); }

  const name = normalizeNickname(body.name);

  // The structural rules are re-run here rather than trusted from the client: the client's copy is
  // for typing feedback, this one is the gate.
  const format = checkNicknameFormat(name);
  if (!format.ok) return json({ ok: false, reason: format.reason });

  const listed = wordlistReason(name);
  if (listed) return json({ ok: false, reason: listed });

  const realName = normalizeNickname(body.fullName) || normalizeNickname(body.firstName);
  const ask = realName
    ? `The student's name on the roster is "${realName}".\nThe display name they have chosen is: "${name}"`
    : `The display name the student has chosen is: "${name}"`;

  let reply;
  try {
    reply = await callClaude(ask);
  } catch (e) {
    // Fail closed. Nothing unscreened is ever approved, so an outage costs a rename, not a slur on
    // the login screen.
    console.error("screen-name: Claude call failed:", e?.message || e);
    return json({ ok: false, reason: REFUSE_UNAVAILABLE });
  }

  const verdict = parseJsonReply(reply, null);
  if (!verdict || (verdict.status !== "allow" && verdict.status !== "block")) {
    console.error("screen-name: unparseable verdict:", reply.slice(0, 300));
    return json({ ok: false, reason: REFUSE_UNAVAILABLE });
  }
  if (verdict.status === "allow") return json({ ok: true });

  // Cap the model's wording: it is shown to the student verbatim, so it should stay one sentence.
  const reason = normalizeNickname(verdict.reason).slice(0, 160) || REFUSE_GENERIC;
  return json({ ok: false, reason });
};

// Mirrors netlify/functions/grade.js — same CLAUDE_API_KEY, version header and raw-fetch shape as
// the rest of this app's Claude calls. Low effort: this is a one-line classification, not grading.
async function callClaude(question) {
  const key = process.env.CLAUDE_API_KEY || "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      output_config: { effort: "low" },
      system: SCREEN_RULES,
      messages: [{ role: "user", content: question }],
    }),
  });
  let data;
  try { data = await res.json(); }
  catch { throw new Error("Non-JSON response from Claude."); }
  if (!res.ok || data?.error) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  const text = data.content?.map(b => b.text || "").join("") || "";
  if (!text.trim()) throw new Error("Empty response (check that CLAUDE_API_KEY is set).");
  return text;
}

export { NICKNAME_MAX };
