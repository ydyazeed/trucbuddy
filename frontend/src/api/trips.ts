import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, api } from "./http";
import type { DailyLogModel, TimelineEntry } from "@/hos/types";

export interface TripDTO {
  id: string;
  inputs: {
    current: { label: string; lat: number; lng: number };
    pickup: { label: string; lat: number; lng: number };
    dropoff: { label: string; lat: number; lng: number };
    cycle_hours: number;
  };
  plan: {
    schedule: TimelineEntry[];
    dailyLogs: DailyLogModel[];
    distanceMi: number;
    durationHr: number;
    upcoming?: unknown;
    feasibility: string;
  };
  status: "planned" | "active" | "completed";
  created_at: string;
  updated_at: string;
  events?: TripEventDTO[];
  logs?: DailyLogDTO[];
}

export interface TripEventDTO {
  id: number;
  sequence_number: number;
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  recorded_at: string;
  client_event_id: string;
}

export interface DailyLogDTO {
  id: number;
  log_date: string;
  log_data: DailyLogModel;
  signed: boolean;
  signed_at: string | null;
  signature_image: string | null;
  corrections: {
    field_path: string;
    original_value?: unknown;
    corrected_value: unknown;
    reason: string;
    timestamp: string;
    client_event_id: string;
  }[];
}

export function useTrips() {
  return useQuery({
    queryKey: ["trips"],
    queryFn: () => api<TripDTO[]>("/api/trips/"),
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: ["trip", id],
    queryFn: () => api<TripDTO>(`/api/trips/${id}/`),
    enabled: !!id,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Pick<TripDTO, "inputs" | "plan" | "status">) =>
      api<TripDTO>("/api/trips/", { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trips"] }),
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/trips/${id}/`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ["trip", id] });
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}

export function useUpdateTrip(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Pick<TripDTO, "plan" | "status">>) =>
      api<TripDTO>(`/api/trips/${id}/`, { method: "PATCH", json: body }),
    onSuccess: data => {
      qc.setQueryData(["trip", id], data);
      qc.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}

export function useAppendEvent(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (event: { event_type: string; payload?: Record<string, unknown>; occurred_at: string; client_event_id: string }) =>
      api<TripEventDTO[]>(`/api/trips/${tripId}/events/`, { method: "POST", json: event }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip", tripId] }),
  });
}

export function usePatchLog(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, log_data }: { date: string; log_data: DailyLogModel }) =>
      api<DailyLogDTO>(`/api/trips/${tripId}/logs/${date}/`, { method: "PATCH", json: { log_data } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip", tripId] }),
  });
}

export function useSignLog(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, signature_image }: { date: string; signature_image: string }) =>
      api<DailyLogDTO>(`/api/trips/${tripId}/logs/${date}/sign/`, { method: "POST", json: { signature_image } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip", tripId] }),
  });
}

export function useCorrectLog(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      date,
      ...body
    }: {
      date: string;
      field_path: string;
      original_value?: unknown;
      corrected_value: unknown;
      reason: string;
      client_event_id: string;
    }) =>
      api<DailyLogDTO>(`/api/trips/${tripId}/logs/${date}/corrections/`, { method: "POST", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trip", tripId] }),
  });
}

export { ApiError };
