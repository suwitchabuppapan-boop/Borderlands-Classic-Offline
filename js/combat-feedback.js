/* Transient visual events only: no DOM, timers, gameplay RNG, or saved fields. */
(function (root) {
  "use strict";
  const MAX_EVENTS = 64;
  const durations = { attack: .28, skill: .45, impact: .25 };
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const point = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  function emit(s, event) {
    // Reject the entire payload before allocating or changing transient state.
    if (!s || typeof s !== "object" || !event || typeof event.kind !== "string" || !own(durations, event.kind) ||
        !point(event.source) || !point(event.target) ||
        !Number.isInteger(event.facing) || event.facing < 0 || event.facing > 3 ||
        typeof event.weaponType !== "string" || !event.weaponType.length ||
        !(event.skillId === null || typeof event.skillId === "string" && event.skillId.length > 0) ||
        ![null, "hit", "miss", "crit"].includes(event.result) ||
        !["direct", "dot", "trap"].includes(event.phase) ||
        !(event.amount === null || Number.isFinite(event.amount) && event.amount >= 0) ||
        typeof event.magic !== "boolean") return null;
    if (!s.combatFeedback) s.combatFeedback = { nextId: 1, events: [] };
    const feedback = s.combatFeedback;
    const stored = {
      id: feedback.nextId++, kind: event.kind,
      source: Object.freeze({ x: event.source.x, y: event.source.y }),
      target: Object.freeze({ x: event.target.x, y: event.target.y }),
      facing: event.facing, weaponType: event.weaponType, skillId: event.skillId,
      result: event.result, phase: event.phase, amount: event.amount, magic: event.magic,
      age: 0, duration: durations[event.kind],
    };
    feedback.events.push(stored);
    if (feedback.events.length > MAX_EVENTS) feedback.events.splice(0, feedback.events.length - MAX_EVENTS);
    return stored;
  }
  function tick(s, dt) {
    if (!s.combatFeedback || !Number.isFinite(dt) || dt <= 0) return;
    s.combatFeedback.events = s.combatFeedback.events.filter(event => (event.age += dt) < event.duration);
  }
  function clear(s) {
    if (s.combatFeedback) s.combatFeedback.events.length = 0;
  }
  const api = { emit, tick, clear, MAX_EVENTS };
  if (typeof module === "object") module.exports = api;
  else root.BCCombatFeedback = api;
})(typeof window === "object" ? window : globalThis);
