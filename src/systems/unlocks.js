// ── Unlock Registry ──────────────────────────────────────────────────────────
// Every unlockable feature in MuniCity registers here.
// Other systems read from this — they never manage their own lock state.
//
// Unlock states:
//   'locked'     — not yet available, can't be purchased
//   'available'  — county has released it, can be purchased
//   'unlocked'   — player has it
//
// Unlock paths:
//   countyYear   — automatically becomes 'available' at this game year
//   purchaseCost — funds required to unlock (0 = free when available)
//   achievement  — { description, check: fn(gameState) } optional free unlock path

export const UNLOCK_CATEGORIES = {
  road:     'Roads',
  building: 'Buildings',
  vehicle:  'Vehicles',
  service:  'Services',
  policy:   'Policies',
};

const registry = new Map();

function define(key, def) {
  registry.set(key, {
    key,
    ...def,
    state: def.startUnlocked ? 'unlocked' : 'locked',
  });
}

// ── Road unlocks ─────────────────────────────────────────────────────────────

define('road_dirt', {
  category:     'road',
  name:         'Dirt Track',
  description:  'Basic unpaved track. Cheap but degrades fast.',
  countyYear:   0,
  purchaseCost: 0,
  startUnlocked: true,
});

define('road_gravel', {
  category:     'road',
  name:         'Gravel Road',
  description:  'Affordable two-lane gravel surface.',
  countyYear:   0,
  purchaseCost: 0,
  startUnlocked: true,
});

define('road_asphalt', {
  category:     'road',
  name:         'Asphalt',
  description:  'Standard paved road. The workhorse of your network.',
  countyYear:   1,
  purchaseCost: 5000,
  achievement: {
    description: 'Build 10 road segments',
    check: gs => gs.stats.roadSegmentsBuilt >= 10,
  },
});

define('road_avenue', {
  category:     'road',
  name:         'Avenue',
  description:  'Four-lane divided road. Handles serious traffic.',
  countyYear:   3,
  purchaseCost: 20000,
  achievement: {
    description: 'Reach population 500',
    check: gs => gs.stats.population >= 500,
  },
});

define('road_highway', {
  category:     'road',
  name:         'Highway',
  description:  'Six-lane high-speed arterial. Major capital investment.',
  countyYear:   6,
  purchaseCost: 75000,
  achievement: {
    description: 'Connect to 3 neighboring tiles',
    check: gs => gs.stats.neighborConnections >= 3,
  },
});
// ── Intersection unlocks ─────────────────────────────────────────────────────

define('intersection_stop_sign', {
  category:      'intersection',
  name:          'Stop Sign',
  description:   'Basic traffic control at intersections.',
  countyYear:    0,
  purchaseCost:  0,
  startUnlocked: true,
});

define('intersection_crosswalk', {
  category:      'intersection',
  name:          'Crosswalk',
  description:   'Pedestrian safety markings.',
  countyYear:    0,
  purchaseCost:  0,
  startUnlocked: true,
});

define('intersection_streetlight', {
  category:      'intersection',
  name:          'Streetlight',
  description:   'Illuminated intersections for night safety.',
  countyYear:    1,
  purchaseCost:  2000,
  achievement: {
    description: 'Reach population 100',
    check: gs => gs.stats.population >= 100,
  },
});

define('intersection_signal', {
  category:      'intersection',
  name:          'Traffic Signal',
  description:   'Full signal control. Requires power grid.',
  countyYear:    2,
  purchaseCost:  10000,
  achievement: {
    description: 'Build 20 road segments',
    check: gs => gs.stats.roadSegmentsBuilt >= 20,
  },
});

define('intersection_smart_signal', {
  category:      'intersection',
  name:          'Smart Signal',
  description:   'Adaptive timing system.',
  countyYear:    5,
  purchaseCost:  30000,
});
// ── (future categories stub here) ────────────────────────────────────────────
// define('building_fire_station', { ... })
// define('vehicle_snowplow', { ... })

// ── UnlockSystem ─────────────────────────────────────────────────────────────

export class UnlockSystem {
  constructor(gameState) {
    this.gameState = gameState;
    // Run initial county tick for year 0
    this._countyTick(0);
  }

  // Called once per game year
  advanceYear(year) {
    this._countyTick(year);
    this._checkAchievements();
  }

  // Check if a key is unlocked
  isUnlocked(key) {
    return registry.get(key)?.state === 'unlocked';
  }

  // Check if a key is available to purchase
  isAvailable(key) {
    const u = registry.get(key);
    return u && (u.state === 'available' || u.state === 'unlocked');
  }

  // Attempt purchase unlock
  purchase(key) {
    const u = registry.get(key);
    if (!u) return { ok: false, reason: 'Unknown unlock' };
    if (u.state === 'unlocked') return { ok: true };
    if (u.state === 'locked') return { ok: false, reason: `Not yet released by the county.` };
    if (this.gameState.funds < u.purchaseCost) {
      return { ok: false, reason: `Need $${u.purchaseCost.toLocaleString()} — you have $${this.gameState.funds.toLocaleString()}` };
    }
    this.gameState.funds -= u.purchaseCost;
    this.gameState.onFundsChanged();
    u.state = 'unlocked';
    console.log(`[unlocks] Purchased: ${key}`);
    this.gameState.onUnlockChanged?.(key);
    return { ok: true };
  }

  // Force unlock (achievement, cheat, save load)
  grant(key) {
    const u = registry.get(key);
    if (!u) return;
    u.state = 'unlocked';
    console.log(`[unlocks] Granted: ${key}`);
    this.gameState.onUnlockChanged?.(key);
  }

  // Get all unlocks in a category
  getCategory(category) {
    return [...registry.values()].filter(u => u.category === category);
  }

  // Get unlock entry
  get(key) {
    return registry.get(key);
  }

  // ── private ────────────────────────────────────────────────────────────────

  _countyTick(year) {
    for (const u of registry.values()) {
      if (u.state === 'locked' && u.countyYear <= year) {
        u.state = u.purchaseCost === 0 ? 'unlocked' : 'available';
        if (u.purchaseCost === 0) {
          console.log(`[unlocks] Auto-unlocked: ${u.key}`);
        } else {
          console.log(`[unlocks] Now available: ${u.key} (costs $${u.purchaseCost.toLocaleString()})`);
        }
      }
    }
  }

  _checkAchievements() {
    for (const u of registry.values()) {
      if (u.state !== 'locked' || !u.achievement) continue;
      if (u.achievement.check(this.gameState)) {
        u.state = 'unlocked';
        console.log(`[unlocks] Achievement unlock: ${u.key}`);
        this.gameState.onUnlockChanged?.(key);
      }
    }
  }
}