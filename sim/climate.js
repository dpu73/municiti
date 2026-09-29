// Climates: a 12-month profile per climate. Spec §12b.
// Index 0 = January. weatherMod multiplies infrastructure decay; snow is 0..1.

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const CLIMATES = {
  midwest: {
    name: 'Midwest',
    //           Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
    weatherMod: [1.2, 1.2, 1.6, 1.4, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.1, 1.2], // Mar/Apr = freeze-thaw
    snow:       [1.0, 0.8, 0.4, 0.05, 0,   0,   0,   0,   0,   0,   0.3, 0.8],
  },
};

/** Calendar month index for a resolved turn. Turn 1 is FOUNDING_MONTH. */
export function monthIndex(turn, config) {
  return (config.FOUNDING_MONTH + turn - 1 + 1200) % 12;
}

export function yearOf(turn) {
  return Math.floor(Math.max(turn - 1, 0) / 12) + 1;
}

export function monthLabel(turn, config) {
  if (turn === 0) return 'Founding day';
  return `${MONTHS[monthIndex(turn, config)]}, Year ${yearOf(turn)}`;
}
