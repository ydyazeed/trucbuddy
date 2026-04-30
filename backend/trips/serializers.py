from rest_framework import serializers

from .models import DailyLog, Trip, TripEvent


class TripEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripEvent
        fields = (
            "id",
            "sequence_number",
            "event_type",
            "payload",
            "occurred_at",
            "recorded_at",
            "client_event_id",
        )
        read_only_fields = ("id", "recorded_at")


class TripEventCreateSerializer(serializers.Serializer):
    event_type = serializers.CharField(max_length=64)
    payload = serializers.JSONField(required=False, default=dict)
    occurred_at = serializers.DateTimeField()
    client_event_id = serializers.UUIDField()
    sequence_number = serializers.IntegerField(required=False, min_value=0)


class DailyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyLog
        fields = (
            "id",
            "log_date",
            "log_data",
            "signed",
            "signed_at",
            "signature_image",
            "corrections",
        )
        read_only_fields = ("id", "signed", "signed_at", "signature_image", "corrections")


class TripSerializer(serializers.ModelSerializer):
    events = TripEventSerializer(many=True, read_only=True)
    logs = DailyLogSerializer(many=True, read_only=True)

    class Meta:
        model = Trip
        fields = (
            "id",
            "inputs",
            "plan",
            "status",
            "created_at",
            "updated_at",
            "events",
            "logs",
        )
        read_only_fields = ("id", "created_at", "updated_at", "events", "logs")


class TripCreateSerializer(serializers.ModelSerializer):
    logs = DailyLogSerializer(many=True, required=False)

    class Meta:
        model = Trip
        fields = ("id", "inputs", "plan", "status", "logs")
        read_only_fields = ("id",)

    def validate_inputs(self, value):
        required = {"current", "pickup", "dropoff", "cycle_hours"}
        missing = required - set(value or {})
        if missing:
            raise serializers.ValidationError(f"Missing input fields: {sorted(missing)}")
        try:
            cycle = float(value["cycle_hours"])
        except (TypeError, ValueError):
            raise serializers.ValidationError("cycle_hours must be a number")
        if cycle < 0 or cycle > 70:
            raise serializers.ValidationError("cycle_hours must be in [0, 70]")
        return value


class TripUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = ("plan", "status")


class CorrectionSerializer(serializers.Serializer):
    field_path = serializers.CharField(max_length=200)
    original_value = serializers.JSONField(required=False, allow_null=True)
    corrected_value = serializers.JSONField()
    reason = serializers.CharField(min_length=10, max_length=500)
    client_event_id = serializers.UUIDField()


class SignSerializer(serializers.Serializer):
    signature_image = serializers.CharField()
    signed_at = serializers.DateTimeField(required=False)
