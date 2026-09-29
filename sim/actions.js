// Player actions that happen between turns. Each returns a new state.
// Spec §12b (procurement), §13.

// tier: 'base' assets (a station, a depot) are never idled or sold by the county;
// 'addon' assets (extra trucks, a helipad, a plow) are what a takeover reaches. Spec §12.
export const PLOW_BIDS = [
  { id: 'auction', label: 'County auction — used plow',  price: 45_000,  condition: 60,  maintNeed: 600, warrantyTurns: 0,  deliveryTurns: 1 },
  { id: 'dealer',  label: 'Dealer — new plow, 3yr warranty', price: 180_000, condition: 100, maintNeed: 250, warrantyTurns: 36, deliveryTurns: 3 },
];

export function canAfford(state, bid) {
  return state.treasury >= bid.price;
}

export function buyAsset(state, bid, type = 'plow') {
  if (state.takeover) throw new Error('the county controls purchasing during a takeover');
  if (!canAfford(state, bid)) throw new Error(`cannot afford ${bid.label}: ${bid.price}`);
  const next = structuredClone(state);
  next.treasury -= bid.price;
  next.assets.push({
    id: `${type}-${next.assets.length}`,
    type,
    tier: bid.tier ?? 'addon',
    label: bid.label,
    condition: bid.condition,
    maintNeed: bid.maintNeed,
    warrantyUntil: next.turn + bid.deliveryTurns + bid.warrantyTurns,
    arrivesTurn: next.turn + bid.deliveryTurns,
    boughtTurn: next.turn,
    price: bid.price,
  });
  next.log.push({ turn: next.turn, type: 'purchase', what: bid.label, cost: bid.price });
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
