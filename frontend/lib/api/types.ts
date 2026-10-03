import type {
  AdminAction,
  AdminMetrics,
  Allocations,
  AttackSummary,
  AuditEntry,
  Comparison,
  EventInfo,
  Me,
  MyEntries,
  RegisterRequest,
  RegisterResponse,
  SimParams,
} from "@/lib/contracts";

/** Everything the UI may ask of a backend. `live.ts` and `mock.ts` both implement it. Every drop is scoped to one event. */
export interface Api {
  listEvents(): Promise<EventInfo[]>;
  getEvent(eventId: string): Promise<EventInfo>;
  getMe(eventId: string): Promise<Me>;
  myEntries(): Promise<MyEntries["entries"]>;
  register(eventId: string, body: RegisterRequest): Promise<RegisterResponse>;
  confirm(eventId: string, reservationId: string, idempotencyKey: string): Promise<Me>;
  admin: {
    metrics(eventId: string): Promise<AdminMetrics>;
    comparison(eventId: string, params: SimParams): Promise<Comparison>;
    attacks(eventId: string): Promise<AttackSummary>;
    allocations(eventId: string): Promise<Allocations>;
    audit(eventId: string): Promise<AuditEntry[]>;
    action(eventId: string, action: AdminAction): Promise<void>;
    runSimulator(eventId: string, params: SimParams): Promise<{ run_id: string }>;
    stopSimulator(eventId: string): Promise<void>;
  };
}

export class ApiError extends Error {
  constructor(
    public status: number, // 0 = network failure
    public code: string,
    message: string,
    public retryAfter?: number, // seconds
  ) {
    super(message);
  }
}
