// Asset catalog: categories → items → offers. Spec §12b.
// Every offer carries the four numbers the player reads at a glance:
//   efficiency (0–100, how well it does the job), condition (0–100 on delivery),
//   lifespanTurns (expected life; past it, upkeep doubles), price + maintNeed.
// tier 'base' assets (buildings) are never touched by a county takeover.

export const CATALOG = {
  buildings: {
    label: 'Buildings',
    items: {
      'pw-yard': {
        label: 'Public Works yard', tier: 'base',
        blurb: 'Somewhere to park what the town owns. Required before buying any vehicle.',
        offers: [
          { id: 'yard-lot',    name: 'Gravel lot & shed', price: 18_000,  condition: 100, efficiency: 50,  lifespanTurns: 240, maintNeed: 150, warrantyTurns: 0,  deliveryTurns: 2, vehicleSlots: 2, mechanic: false },
          { id: 'yard-garage', name: 'Garage with bay',   price: 65_000,  condition: 100, efficiency: 100, lifespanTurns: 480, maintNeed: 400, warrantyTurns: 0,  deliveryTurns: 6, vehicleSlots: 4, mechanic: true },
        ],
      },
    },
  },
  vehicles: {
    label: 'Vehicles',
    requires: 'pw-yard',
    items: {
      plow: {
        label: 'Snowplow', tier: 'addon',
        blurb: 'Keeps roads open in winter. One plow at full efficiency clears 6 segments.',
        offers: [
          { id: 'plow-auction', name: 'County auction', price: 45_000,  condition: 60,  efficiency: 65,  lifespanTurns: 60,  maintNeed: 600, warrantyTurns: 0,  deliveryTurns: 1 },
          { id: 'plow-coop',    name: 'Regional co-op', price: 95_000,  condition: 85,  efficiency: 85,  lifespanTurns: 120, maintNeed: 400, warrantyTurns: 12, deliveryTurns: 2 },
          { id: 'plow-dealer',  name: 'Dealer, new',    price: 180_000, condition: 100, efficiency: 100, lifespanTurns: 180, maintNeed: 250, warrantyTurns: 36, deliveryTurns: 3 },
        ],
      },
    },
  },
};

export function findOffer(offerId) {
  for (const [catId, cat] of Object.entries(CATALOG))
    for (const [itemId, item] of Object.entries(cat.items))
      for (const o of item.offers)
        if (o.id === offerId) return { ...o, catId, itemId, type: itemId, tier: item.tier, itemLabel: item.label };
  return null;
}

export function ownedOf(state, itemId, { arrived = true } = {}) {
  return state.assets.filter(a => a.type === itemId && (!arrived || state.turn >= a.arrivesTurn));
}

export function vehicleSlots(state) {
  return ownedOf(state, 'pw-yard', { arrived: false }).reduce((s, y) => s + (y.vehicleSlots ?? 0), 0);
}

export function hasMechanic(state) {
  return ownedOf(state, 'pw-yard').some(y => y.mechanic && !y.idled);
}

/** Why an offer can't be bought right now, or null if it can. */
export function purchaseBlocker(state, offer, config) {
  if (state.takeover) return 'County controls purchasing';
  const cat = CATALOG[offer.catId];
  if (cat.requires && !ownedOf(state, cat.requires, { arrived: false }).length) return `Needs a ${CATALOG.buildings.items[cat.requires].label}`;
  if (offer.catId === 'vehicles') {
    const slots = state.assets.filter(a => a.type === 'pw-yard').reduce((s, y) => s + (y.vehicleSlots ?? 0), 0);
    const used = state.assets.filter(a => CATALOG.vehicles.items[a.type]).length;
    if (used >= slots) return `Yard is full (${slots} slot${slots === 1 ? '' : 's'})`;
  }
  if (state.treasury < offer.price) return 'Can’t afford';
  return null;
}
