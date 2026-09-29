// Asset catalog: categories → items → offers. Spec §12b.
// One number rules an asset: CONDITION (0–100). It is the efficiency; below
// OUT_OF_SERVICE_BELOW the unit is down for the month. Offers differ on price,
// condition on delivery, expected life, upkeep, warranty and delivery time.
// tier 'base' assets are never touched by a county takeover.

export const YARD_SURFACE = { midwest: 'gravel', mountain: 'stone', tropical: 'sand', south: 'red clay', southwest: 'caliche', pnw: 'gravel' };

export const CATALOG = {
  yard: {
    label: 'Yard',
    items: {
      'yard-pad': {
        label: 'Parking pad', tier: 'base', slot: 1, once: true,
        blurb: 'A second graded pad. +1 vehicle slot.',
        offers: [{ id: 'pad', name: 'Grade & gravel', price: 6_000, condition: 100, lifespanTurns: 480, maintNeed: 40, warrantyTurns: 0, deliveryTurns: 1 }],
      },
      'yard-barn': {
        label: 'Pole barn', tier: 'base', slot: 1, once: true, mechanic: true,
        blurb: 'Covered bay with a mechanic on staff. +1 slot; equipment ages half as fast.',
        offers: [
          { id: 'barn-kit',   name: 'Kit barn',        price: 28_000, condition: 100, lifespanTurns: 360, maintNeed: 220, warrantyTurns: 0,  deliveryTurns: 3 },
          { id: 'barn-steel', name: 'Steel building',  price: 52_000, condition: 100, lifespanTurns: 600, maintNeed: 180, warrantyTurns: 24, deliveryTurns: 5 },
        ],
      },
      'yard-fuel': {
        label: 'Fence & fuel', tier: 'base', slot: 1, once: true,
        blurb: 'Security fence and a fuel tank. +1 slot.',
        offers: [{ id: 'fence-fuel', name: 'Fence & 500 gal tank', price: 14_000, condition: 100, lifespanTurns: 360, maintNeed: 60, warrantyTurns: 0, deliveryTurns: 2 }],
      },
    },
  },
  vehicles: {
    label: 'Vehicles',
    items: {
      'road-truck': {
        label: 'Road truck', tier: 'addon',
        blurb: 'Dump truck and a patch crew. Every capital dollar repairs 40% more road.',
        offers: [
          { id: 'truck-auction', name: 'County auction', price: 22_000, condition: 55,  lifespanTurns: 72,  maintNeed: 350, warrantyTurns: 0,  deliveryTurns: 1 },
          { id: 'truck-dealer',  name: 'Dealer, new',    price: 95_000, condition: 100, lifespanTurns: 180, maintNeed: 180, warrantyTurns: 36, deliveryTurns: 3 },
        ],
      },
      plow: {
        label: 'Snowplow', tier: 'addon',
        blurb: 'Keeps roads open in winter. At condition 100 one plow clears 6 segments.',
        offers: [
          { id: 'plow-auction', name: 'County auction', price: 45_000,  condition: 60,  lifespanTurns: 60,  maintNeed: 600, warrantyTurns: 0,  deliveryTurns: 1 },
          { id: 'plow-coop',    name: 'Regional co-op', price: 95_000,  condition: 85,  lifespanTurns: 120, maintNeed: 400, warrantyTurns: 12, deliveryTurns: 2 },
          { id: 'plow-dealer',  name: 'Dealer, new',    price: 180_000, condition: 100, lifespanTurns: 180, maintNeed: 250, warrantyTurns: 36, deliveryTurns: 3 },
        ],
      },
    },
  },
};

export function findOffer(offerId) {
  for (const [catId, cat] of Object.entries(CATALOG))
    for (const [itemId, item] of Object.entries(cat.items))
      for (const o of item.offers)
        if (o.id === offerId) return { ...o, catId, itemId, type: itemId, tier: item.tier, itemLabel: item.label, slot: item.slot ?? 0, mechanic: !!item.mechanic };
  return null;
}

export const isVehicle = a => !!CATALOG.vehicles.items[a.type];
export const inService = (state, a) => state.turn >= a.arrivesTurn && !a.idled && a.condition >= 25;

/** Vehicle slots: 1 with the bare lot, +1 per yard upgrade (ordered counts), +2 at incorporation. */
export function vehicleSlots(state, config) {
  const upgrades = state.assets.filter(a => CATALOG.yard.items[a.type]).reduce((s, a) => s + (a.slot ?? 0), 0);
  const cap = state.incorporated ? config.YARD_SLOTS_CITY : config.YARD_SLOTS_TOWNSHIP;
  return Math.min(cap, 1 + upgrades + (state.incorporated ? 2 : 0));
}

export function hasMechanic(state) {
  return state.assets.some(a => a.mechanic && state.turn >= a.arrivesTurn && !a.idled);
}

/** Why an offer can't be bought right now, or null if it can. */
export function purchaseBlocker(state, offer, config) {
  if (state.takeover) return 'County controls purchasing';
  const item = CATALOG[offer.catId].items[offer.itemId];
  if (item.once && state.assets.some(a => a.type === offer.itemId)) return 'Already built';
  if (offer.catId === 'yard' && !state.incorporated && vehicleSlots(state, config) >= config.YARD_SLOTS_TOWNSHIP) return `Township yards max out at ${config.YARD_SLOTS_TOWNSHIP} slots`;
  if (offer.catId === 'vehicles') {
    const slots = vehicleSlots(state, config), used = state.assets.filter(isVehicle).length;
    if (used >= slots) return `Yard is full (${slots} slot${slots === 1 ? '' : 's'})`;
  }
  if (state.treasury < offer.price) return 'Can’t afford';
  return null;
}
