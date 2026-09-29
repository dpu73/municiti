// Player actions that happen between turns. Each returns a new state.
// Spec §12b (procurement), §13.

import { findOffer, purchaseBlocker } from './catalog.js';

/** Back-compat for the CLI runner: the plow offers by short id. */
export const PLOW_BIDS = ['plow-auction', 'plow-coop', 'plow-dealer'].map(id => ({ ...findOffer(id), label: findOffer(id).name }));

export function canAfford(state, offer) { return state.treasury >= offer.price; }

export function buyAsset(state, offerOrId, config) {
  const offer = typeof offerOrId === 'string' ? findOffer(offerOrId) : findOffer(offerOrId.id) ?? offerOrId;
  if (!offer) throw new Error(`unknown offer ${offerOrId}`);
  const why = purchaseBlocker(state, offer, config);
  if (why) throw new Error(`${why}: ${offer.itemLabel} — ${offer.name}`);
  const next = structuredClone(state);
  next.treasury -= offer.price;
  next.assets.push({
    id: `${offer.itemId}-${next.assets.length}`,
    type: offer.itemId, tier: offer.tier, label: `${offer.itemLabel} — ${offer.name}`, offerId: offer.id,
    condition: offer.condition, efficiency: offer.efficiency, lifespanTurns: offer.lifespanTurns,
    maintNeed: offer.maintNeed, price: offer.price,
    vehicleSlots: offer.vehicleSlots ?? 0, mechanic: !!offer.mechanic,
    warrantyUntil: next.turn + offer.deliveryTurns + offer.warrantyTurns,
    arrivesTurn: next.turn + offer.deliveryTurns, boughtTurn: next.turn, idled: false,
  });
  next.log.push({ turn: next.turn, type: 'purchase', what: `${offer.itemLabel} — ${offer.name}`, cost: offer.price });
  return next;
}

export function adoptBudget(state, budget, millage) {
  if (state.takeover) throw new Error('the county controls the budget during a takeover');
  const next = structuredClone(state);
  next.budget = budget;
  next.millage = millage;
  next.log.push({ turn: next.turn, type: 'budget adopted' });
  return next;
}
