import { create } from "zustand";

import type { DutyStatus } from "@/hos/types";

interface ActiveTripState {
  tripId: string | null;
  currentStatus: DutyStatus;
  statusSince: string | null; // ISO
  lastLocation: { lat: number; lng: number; recorded_at: string } | null;
  setActive: (tripId: string | null) => void;
  setStatus: (status: DutyStatus, at: string) => void;
  setLocation: (lat: number, lng: number, at: string) => void;
  reset: () => void;
}

export const useActiveTrip = create<ActiveTripState>(set => ({
  tripId: null,
  currentStatus: "off_duty",
  statusSince: null,
  lastLocation: null,
  setActive: tripId => set({ tripId }),
  setStatus: (status, at) => set({ currentStatus: status, statusSince: at }),
  setLocation: (lat, lng, at) => set({ lastLocation: { lat, lng, recorded_at: at } }),
  reset: () => set({ tripId: null, currentStatus: "off_duty", statusSince: null, lastLocation: null }),
}));
