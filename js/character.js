(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BCAppearance = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const finite = (value, fallback = 0) =>
    Number.isFinite(value) ? value : fallback;
  const facingOf = (facing) => Math.max(0, Math.min(3, Math.round(finite(facing))));
  const SWING_DURATION = 0.22;
  const STEP_DISTANCE = 8;
  // Foot-relative gloves in the two attack-atlas frames, ordered by facing.
  const ATTACK_HANDS = [
    [[-8, -23], [-8, -22], [8, -21], [7, -23]],
    [[12, -17], [13, -18], [12, -18], [-13, -17]],
  ];

  function idle(facing = 0) {
    facing = facingOf(facing);
    return {
      mode: "idle",
      frame: 0,
      facing,
      bob: 0,
      lean: 0,
      hand: {
        x: facing === 3 ? -7 : facing === 2 ? 6 : 7,
        y: facing === 2 ? -15 : -13,
        angle: 0,
        behind: facing === 2,
      },
      head: { x: 0, y: -30 },
    };
  }

  function createTracker() {
    // This stays outside saved game state: reloading starts in a neutral pose.
    return { last: null, distance: 0, moving: false };
  }

  function sample(tracker, state) {
    const player = state.player;
    const now = {
      x: finite(player.x),
      y: finite(player.y),
      clock: finite(state.clock),
      zone: state.zone,
    };
    const last = tracker.last;
    if (!last) {
      tracker.distance = 0;
      tracker.moving = false;
    } else {
      const dt = now.clock - last.clock;
      const travelled = Math.hypot(now.x - last.x, now.y - last.y);
      if (now.zone !== last.zone || dt < 0 || travelled > 40) {
        tracker.distance = 0;
        tracker.moving = false;
      } else if (dt > 0 && travelled > 0.0001) {
        tracker.distance =
          (tracker.distance + travelled) % (STEP_DISTANCE * 4);
        tracker.moving = true;
      } else if (dt !== 0 || travelled > 0.0001) {
        // A second render of the same tick keeps its pose. A new stationary
        // tick stops immediately, even when auto-play still has a destination.
        tracker.distance = 0;
        tracker.moving = false;
      }
    }
    tracker.last = now;

    const pose = idle(player.facing);
    const mirror = pose.facing === 3 ? -1 : 1;
    const remaining = Math.max(
      0,
      Math.min(SWING_DURATION, finite((state.cooldowns || {}).swing)),
    );
    if (remaining > 0) {
      const progress = 1 - remaining / SWING_DURATION;
      const bodyShift = Math.sin(progress * Math.PI);
      pose.mode = "attack";
      pose.frame = remaining > 0.11 ? 0 : 1;
      const hand = ATTACK_HANDS[pose.frame][pose.facing];
      pose.hand.x = hand[0];
      pose.hand.y = hand[1];
      pose.bob = -0.3 * bodyShift;
      pose.lean = mirror * bodyShift;
      const angle =
        remaining > 0.11
          ? -0.75 + (0.6 * (SWING_DURATION - remaining)) / 0.11
          : remaining > 0.045
            ? -0.15 + (1.55 * (0.11 - remaining)) / 0.065
            : (1.4 * remaining) / 0.045;
      pose.hand.angle = mirror * angle;
    } else if (tracker.moving) {
      pose.mode = "walk";
      pose.frame = Math.floor(tracker.distance / STEP_DISTANCE);
      pose.bob = [0, -0.6, 0, -0.6][pose.frame];
      pose.lean = [0.6, 0, -0.6, 0][pose.frame];
      pose.hand.angle = mirror * [-0.13, 0.15, -0.13, 0.15][pose.frame];
    }
    pose.hand.x += pose.lean;
    pose.hand.y += pose.bob;
    pose.head.x += pose.lean;
    pose.head.y += pose.bob;
    return pose;
  }

  return { createTracker, sample, idle };
});
