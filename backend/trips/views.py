from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .auth import require_client_id
from .models import DailyLog, Trip, TripEvent
from .serializers import (
    CorrectionSerializer,
    DailyLogSerializer,
    SignSerializer,
    TripCreateSerializer,
    TripEventCreateSerializer,
    TripEventSerializer,
    TripSerializer,
    TripUpdateSerializer,
)


def _trip_for_client(trip_id, client_id):
    return get_object_or_404(Trip, id=trip_id, client_id=client_id)


@api_view(["GET", "POST"])
def trips_collection(request):
    client_id = require_client_id(request)
    if request.method == "GET":
        qs = Trip.objects.filter(client_id=client_id).order_by("-updated_at")
        return Response(TripSerializer(qs, many=True).data)

    serializer = TripCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    new_status = serializer.validated_data.get("status", Trip.STATUS_PLANNED)
    if new_status == Trip.STATUS_ACTIVE:
        clash = Trip.objects.filter(client_id=client_id, status=Trip.STATUS_ACTIVE).exists()
        if clash:
            return Response(
                {"detail": "Another trip is already active for this client."},
                status=status.HTTP_409_CONFLICT,
            )
    logs_data = serializer.validated_data.pop("logs", [])
    trip = Trip.objects.create(client_id=client_id, **serializer.validated_data)
    for log in logs_data:
        DailyLog.objects.create(trip=trip, **log)
    return Response(TripSerializer(trip).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
def trip_detail(request, trip_id):
    client_id = require_client_id(request)
    trip = _trip_for_client(trip_id, client_id)
    if request.method == "GET":
        return Response(TripSerializer(trip).data)
    if request.method == "DELETE":
        trip.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = TripUpdateSerializer(trip, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    new_status = serializer.validated_data.get("status")
    if new_status == Trip.STATUS_ACTIVE and trip.status != Trip.STATUS_ACTIVE:
        clash = Trip.objects.filter(client_id=client_id, status=Trip.STATUS_ACTIVE).exclude(id=trip.id).exists()
        if clash:
            return Response(
                {"detail": "Another trip is already active for this client."},
                status=status.HTTP_409_CONFLICT,
            )
    if trip.status == Trip.STATUS_COMPLETED and new_status and new_status != Trip.STATUS_COMPLETED:
        return Response(
            {"detail": "Completed trips cannot transition back."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    serializer.save()
    return Response(TripSerializer(trip).data)


@api_view(["POST"])
def trip_events(request, trip_id):
    client_id = require_client_id(request)
    trip = _trip_for_client(trip_id, client_id)
    payload = request.data
    items = payload if isinstance(payload, list) else [payload]
    serializer = TripEventCreateSerializer(data=items, many=True)
    serializer.is_valid(raise_exception=True)

    created = []
    with transaction.atomic():
        next_seq = (trip.events.count() or 0)
        for event in serializer.validated_data:
            existing = trip.events.filter(client_event_id=event["client_event_id"]).first()
            if existing:
                created.append(existing)
                continue
            seq = event.get("sequence_number")
            if seq is None:
                next_seq += 1
                seq = next_seq
            try:
                tev = TripEvent.objects.create(
                    trip=trip,
                    sequence_number=seq,
                    event_type=event["event_type"],
                    payload=event.get("payload", {}),
                    occurred_at=event["occurred_at"],
                    client_event_id=event["client_event_id"],
                )
            except IntegrityError:
                tev = trip.events.get(client_event_id=event["client_event_id"])
            created.append(tev)
        trip.save(update_fields=["updated_at"])
    return Response(TripEventSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def trip_logs(request, trip_id):
    client_id = require_client_id(request)
    trip = _trip_for_client(trip_id, client_id)
    return Response(DailyLogSerializer(trip.logs.all().order_by("log_date"), many=True).data)


@api_view(["PATCH"])
def trip_log_detail(request, trip_id, log_date):
    client_id = require_client_id(request)
    trip = _trip_for_client(trip_id, client_id)
    log = get_object_or_404(DailyLog, trip=trip, log_date=log_date)
    if log.signed:
        return Response(
            {"detail": "Log is signed; use the corrections endpoint."},
            status=status.HTTP_409_CONFLICT,
        )
    new_data = request.data.get("log_data")
    if new_data is None:
        return Response({"detail": "log_data is required."}, status=status.HTTP_400_BAD_REQUEST)
    log.log_data = new_data
    log.save(update_fields=["log_data"])
    return Response(DailyLogSerializer(log).data)


@api_view(["POST"])
def trip_log_sign(request, trip_id, log_date):
    client_id = require_client_id(request)
    trip = _trip_for_client(trip_id, client_id)
    log = get_object_or_404(DailyLog, trip=trip, log_date=log_date)
    if log.signed:
        return Response(
            {"detail": "Log is already signed."},
            status=status.HTTP_409_CONFLICT,
        )
    serializer = SignSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    log.signature_image = serializer.validated_data["signature_image"]
    log.signed_at = serializer.validated_data.get("signed_at") or timezone.now()
    log.signed = True
    log.save(update_fields=["signature_image", "signed_at", "signed"])
    return Response(DailyLogSerializer(log).data)


@api_view(["POST"])
def trip_log_corrections(request, trip_id, log_date):
    client_id = require_client_id(request)
    trip = _trip_for_client(trip_id, client_id)
    log = get_object_or_404(DailyLog, trip=trip, log_date=log_date)
    if not log.signed:
        return Response(
            {"detail": "Log must be signed before corrections."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    serializer = CorrectionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    correction = dict(serializer.validated_data)
    correction["timestamp"] = timezone.now().isoformat()
    correction["client_event_id"] = str(correction["client_event_id"])
    corrections = list(log.corrections or [])
    if any(c.get("client_event_id") == correction["client_event_id"] for c in corrections):
        return Response(DailyLogSerializer(log).data, status=status.HTTP_200_OK)
    corrections.append(correction)
    log.corrections = corrections
    log.save(update_fields=["corrections"])
    return Response(DailyLogSerializer(log).data, status=status.HTTP_201_CREATED)
