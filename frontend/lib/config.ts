// Values the backend owns. Override via env when the real numbers are known.
export const RESERVATION_WINDOW_MS = Number(process.env.NEXT_PUBLIC_RESERVATION_WINDOW_MS) || 180_000;
