import uuid

from django.db import models


class Trip(models.Model):
    STATUS_PLANNED = "planned"
    STATUS_ACTIVE = "active"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = [
        (STATUS_PLANNED, "Planned"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_COMPLETED, "Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client_id = models.UUIDField(db_index=True)
    inputs = models.JSONField()
    plan = models.JSONField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PLANNED, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)
        indexes = [models.Index(fields=["client_id", "status"])]


class TripEvent(models.Model):
    id = models.BigAutoField(primary_key=True)
    trip = models.ForeignKey(Trip, related_name="events", on_delete=models.CASCADE)
    sequence_number = models.PositiveIntegerField()
    event_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField()
    recorded_at = models.DateTimeField(auto_now_add=True)
    client_event_id = models.UUIDField()

    class Meta:
        ordering = ("trip_id", "sequence_number")
        constraints = [
            models.UniqueConstraint(
                fields=["trip", "client_event_id"],
                name="trips_uniq_client_event_per_trip",
            )
        ]
        indexes = [models.Index(fields=["trip", "sequence_number"])]


class DailyLog(models.Model):
    id = models.BigAutoField(primary_key=True)
    trip = models.ForeignKey(Trip, related_name="logs", on_delete=models.CASCADE)
    log_date = models.DateField()
    log_data = models.JSONField()
    signed = models.BooleanField(default=False)
    signed_at = models.DateTimeField(null=True, blank=True)
    signature_image = models.TextField(null=True, blank=True)
    corrections = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ("trip_id", "log_date")
        constraints = [
            models.UniqueConstraint(fields=["trip", "log_date"], name="trips_uniq_log_per_day"),
        ]
