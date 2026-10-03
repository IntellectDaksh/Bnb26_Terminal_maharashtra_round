// Server-clock offset. Countdowns use serverNow(), never Date.now() alone,
// so a wrong device clock cannot shorten or extend a reservation window.

const samples: number[] = [];
let offset = 0;

/** Record one sample: serverTime from a response, t0/t1 = local send/receive times. */
export function recordServerTime(serverTimeIso: string, t0: number, t1: number) {
  const server = Date.parse(serverTimeIso);
  if (Number.isNaN(server)) return;
  samples.push(server - (t0 + t1) / 2);
  if (samples.length > 7) samples.shift();
  const sorted = [...samples].sort((a, b) => a - b);
  offset = sorted[Math.floor(sorted.length / 2)]; // median ignores one slow round-trip
}

export const serverNow = () => Date.now() + offset;
export const clockOffset = () => offset;

export function msUntil(iso: string) {
  return Math.max(0, Date.parse(iso) - serverNow());
}
