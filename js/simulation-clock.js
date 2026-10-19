/* One elapsed-time ledger for rendering and throttled background callbacks. */
(function (root) {
  "use strict";
  const STEP = 1 / 60, STEP_MS = 1000 / 60, MAX_STEPS = 3600, EPSILON = 1e-6;
  const validTime = value => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  function create(startMs) {
    if (!validTime(startMs)) throw new TypeError("A finite clock time is required");
    let last = startMs, pending = 0;
    const snapshot = steps => ({ steps, pendingSeconds: pending / 1000, behind: pending + EPSILON >= STEP_MS });
    return {
      get pendingSeconds() { return pending / 1000; },
      advance(now, step) {
        if (!validTime(now)) return snapshot(0);
        if (typeof step !== "function") throw new TypeError("A simulation step callback is required");
        pending += Math.max(0, now - last);
        last = Math.max(last, now);
        const count = Math.min(MAX_STEPS, Math.floor((pending + EPSILON) / STEP_MS));
        let completed = 0;
        try { for (; completed < count; completed++) step(STEP); }
        finally { pending = Math.max(0, pending - completed * STEP_MS); }
        return snapshot(completed);
      },
      reset(now) {
        if (!validTime(now)) throw new TypeError("A finite clock time is required");
        last = now; pending = 0;
      },
    };
  }
  const api = Object.freeze({ create, STEP, MAX_STEPS });
  if (typeof module === "object") module.exports = api;
  else root.BCSimulationClock = api;
})(typeof window === "undefined" ? globalThis : window);
