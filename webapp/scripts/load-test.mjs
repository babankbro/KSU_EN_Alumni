// NFR-PERF-03 — concurrent-user load test against a server backed by the
// perf database (scripts/perf-seed.sql + perf-sessions.sql).
//
//   node scripts/load-test.mjs http://localhost:3101 50,100,200,400 30
//   node scripts/load-test.mjs http://localhost:3101,http://localhost:3102 ...
//     (several servers: virtual users are spread across them, as a
//      round-robin reverse proxy would)
//
// Each virtual user is a signed-in member (own session) who opens a page,
// waits THINK_MS, and repeats — a closed model, like people browsing during
// homecoming. Stages run back to back; each prints throughput, latency
// percentiles, errors (5xx / network) and rate-limited responses (429).

const BASES = (process.argv[2] ?? "http://localhost:3101").split(",");
const STAGES = (process.argv[3] ?? "50,100,200,400").split(",").map(Number);
const SECONDS = Number(process.argv[4] ?? 30);
const THINK_MS = Number(process.env.THINK_MS ?? 1000);
const TIMEOUT_MS = 15000;

const q = (s) => encodeURIComponent(s);
// Weighted mix of what people open on a busy day.
const MIX = [
  [25, () => "/"],
  [15, () => "/alumni-news"],
  [10, () => "/events"],
  [8, () => "/events/1"],
  [8, () => "/news"],
  [7, () => "/jobs"],
  [12, () => pick(["/directory", `/directory?q=${q("สม")}`, `/directory?q=${q("แสงทอง")}`, "/directory?cohort=2560&program=16", `/directory?province=${q("ขอนแก่น")}`])],
  [5, () => "/directory/cohorts"],
  [5, () => "/awards"],
  [5, () => "/kb"],
];
const TOTAL = MIX.reduce((s, [w]) => s + w, 0);
function pick(a) {
  return a[Math.floor(Math.random() * a.length)];
}
function nextPath() {
  let r = Math.random() * TOTAL;
  for (const [w, f] of MIX) if ((r -= w) < 0) return f();
  return "/";
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0);

async function stage(users) {
  const lat = [];
  let errors = 0, limited = 0, done = 0;
  const end = Date.now() + SECONDS * 1000;
  const vu = async (i) => {
    const cookie = `ksu_member_session=perf-${(i % 500) + 1}`;
    const BASE = BASES[i % BASES.length];
    await sleep(Math.random() * THINK_MS); // spread the first wave
    while (Date.now() < end) {
      const t0 = performance.now();
      try {
        const res = await fetch(BASE + nextPath(), { headers: { cookie }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        await res.arrayBuffer();
        if (res.status === 429) limited++;
        else if (res.status >= 500) errors++;
        else lat.push(performance.now() - t0);
      } catch {
        errors++;
      }
      done++;
      await sleep(THINK_MS * (0.5 + Math.random()));
    }
  };
  const t0 = Date.now();
  await Promise.all(Array.from({ length: users }, (_, i) => vu(i)));
  const secs = (Date.now() - t0) / 1000;
  lat.sort((a, b) => a - b);
  return { users, rps: done / secs, p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), max: lat.at(-1) ?? 0, errors, limited, done };
}

console.log(`servers ${BASES.length} · ${SECONDS}s per stage · think ${THINK_MS}ms`);
console.log("users   req/s    p50     p95     p99     max   errors  429   requests");
for (const u of STAGES) {
  const r = await stage(u);
  const s = (ms) => `${(ms / 1000).toFixed(2)}s`.padStart(7);
  console.log(
    `${String(r.users).padStart(5)} ${r.rps.toFixed(1).padStart(7)} ${s(r.p50)} ${s(r.p95)} ${s(r.p99)} ${s(r.max)} ${String(r.errors).padStart(7)} ${String(r.limited).padStart(5)} ${String(r.done).padStart(9)}`,
  );
}
