// ── Is this session running the build the server is serving? ───────────────────
//
// There is no realtime listener and student tabs stay open for days, so a session can go on
// running code from an earlier deploy indefinitely. That is not merely a missing-features
// problem: on 2026-09-29 a tab served from a pre-2026-09-06 snapshot inside Blackboard wrote
// `submissions/{studentId}` as a whole array and destroyed seven records.
//
// Two separate things now stop that, and this module is only the second:
//   1. `database.rules.json` refuses any submission write whose key is not the record's own id,
//      which makes the destructive write impossible from ANY client, however old. That is the
//      half that does not depend on the stale client cooperating, and it is the real guard.
//   2. This check, which notices the staleness and gets the session onto current code. It can
//      only ever help against a bundle NEW enough to contain it, so it is a containment measure
//      for future snapshots, never a substitute for the rule above.
//
// Deliberately compares a baked-in constant against a file fetched from the server, rather than
// asking the server "am I current?" — the question has to be answerable by a client that the
// server has no record of.

export const BUILD_ID = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

// The deployed build id, or null when it cannot be established. Null is NOT staleness: a failed
// fetch means offline, a captive portal, or `netlify dev` with no built manifest, and treating
// any of those as "reload now" would put a student in a reload loop that loses their place.
export async function fetchDeployedBuildId() {
  try {
    // `no-store` plus a cache-busting query, because the whole point is a client whose cache is
    // lying to it. Either alone is routinely ignored by a webview holding a stale page.
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const data = await r.json();
    return typeof data?.buildId === "string" && data.buildId ? data.buildId : null;
  } catch { return null; }
}

// True only when the server's build id is known AND differs from this bundle's. Both guards
// matter: `dev` never reports stale (the manifest is a build artifact, absent under `vite dev`),
// and an unreachable manifest never reports stale either.
export async function isStaleBuild() {
  if (BUILD_ID === "dev" || BUILD_ID.startsWith("local-")) return false;
  const deployed = await fetchDeployedBuildId();
  return deployed != null && deployed !== BUILD_ID;
}
