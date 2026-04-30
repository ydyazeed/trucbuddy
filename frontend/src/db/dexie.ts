import Dexie, { type Table } from "dexie";

export interface QueuedEvent {
  id?: number;
  trip_id: string;
  client_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  enqueued_at: string;
  attempts: number;
}

export interface CachedTrip {
  id: string;
  data: unknown;
  updated_at: string;
}

class TruckDB extends Dexie {
  events!: Table<QueuedEvent, number>;
  trips!: Table<CachedTrip, string>;

  constructor() {
    super("trucbuddy");
    this.version(1).stores({
      events: "++id,trip_id,client_event_id,enqueued_at",
      trips: "id,updated_at",
    });
  }
}

export const db = new TruckDB();
