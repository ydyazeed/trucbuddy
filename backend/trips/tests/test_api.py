import json
import uuid

import pytest
from rest_framework.test import APIClient

from trips.models import DailyLog, Trip, TripEvent


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def cid():
    return str(uuid.uuid4())


@pytest.fixture
def other_cid():
    return str(uuid.uuid4())


def trip_payload(**overrides):
    base = {
        "inputs": {
            "current": {"label": "Chicago, IL", "lat": 41.88, "lng": -87.63},
            "pickup": {"label": "St. Louis, MO", "lat": 38.63, "lng": -90.20},
            "dropoff": {"label": "Dallas, TX", "lat": 32.78, "lng": -96.80},
            "cycle_hours": 12.0,
        },
        "plan": {"legs": [], "schedule": [], "dailyLogs": []},
        "status": "planned",
    }
    base.update(overrides)
    return base


@pytest.mark.django_db
def test_missing_client_id_rejected(client):
    res = client.post("/api/trips/", trip_payload(), format="json")
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_invalid_client_id_rejected(client):
    res = client.post(
        "/api/trips/",
        trip_payload(),
        format="json",
        HTTP_X_CLIENT_ID="not-a-uuid",
    )
    assert res.status_code in (401, 403)


@pytest.mark.django_db
def test_create_trip(client, cid):
    res = client.post("/api/trips/", trip_payload(), format="json", HTTP_X_CLIENT_ID=cid)
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "planned"
    assert "id" in body
    assert Trip.objects.filter(id=body["id"], client_id=cid).exists()


@pytest.mark.django_db
def test_list_trips_filters_by_client(client, cid, other_cid):
    client.post("/api/trips/", trip_payload(), format="json", HTTP_X_CLIENT_ID=cid)
    client.post("/api/trips/", trip_payload(), format="json", HTTP_X_CLIENT_ID=other_cid)
    res = client.get("/api/trips/", HTTP_X_CLIENT_ID=cid)
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1


@pytest.mark.django_db
def test_get_trip_cross_client_404(client, cid, other_cid):
    res = client.post("/api/trips/", trip_payload(), format="json", HTTP_X_CLIENT_ID=cid)
    trip_id = res.json()["id"]
    res2 = client.get(f"/api/trips/{trip_id}/", HTTP_X_CLIENT_ID=other_cid)
    assert res2.status_code == 404


@pytest.mark.django_db
def test_invalid_cycle_hours(client, cid):
    bad = trip_payload()
    bad["inputs"]["cycle_hours"] = 99
    res = client.post("/api/trips/", bad, format="json", HTTP_X_CLIENT_ID=cid)
    assert res.status_code == 400


@pytest.mark.django_db
def test_only_one_active_trip(client, cid):
    a = client.post("/api/trips/", trip_payload(status="active"), format="json", HTTP_X_CLIENT_ID=cid)
    assert a.status_code == 201
    b = client.post("/api/trips/", trip_payload(status="active"), format="json", HTTP_X_CLIENT_ID=cid)
    assert b.status_code == 409


@pytest.mark.django_db
def test_completed_cannot_revert(client, cid):
    res = client.post("/api/trips/", trip_payload(status="completed"), format="json", HTTP_X_CLIENT_ID=cid)
    trip_id = res.json()["id"]
    res2 = client.patch(
        f"/api/trips/{trip_id}/",
        {"status": "active"},
        format="json",
        HTTP_X_CLIENT_ID=cid,
    )
    assert res2.status_code == 400


@pytest.mark.django_db
def test_event_append_idempotent(client, cid):
    res = client.post("/api/trips/", trip_payload(), format="json", HTTP_X_CLIENT_ID=cid)
    trip_id = res.json()["id"]
    cev = str(uuid.uuid4())
    body = {
        "event_type": "status_change",
        "payload": {"status": "driving"},
        "occurred_at": "2026-04-28T12:00:00Z",
        "client_event_id": cev,
    }
    r1 = client.post(f"/api/trips/{trip_id}/events/", body, format="json", HTTP_X_CLIENT_ID=cid)
    r2 = client.post(f"/api/trips/{trip_id}/events/", body, format="json", HTTP_X_CLIENT_ID=cid)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert TripEvent.objects.filter(trip_id=trip_id).count() == 1


@pytest.mark.django_db
def test_event_batch(client, cid):
    res = client.post("/api/trips/", trip_payload(), format="json", HTTP_X_CLIENT_ID=cid)
    trip_id = res.json()["id"]
    batch = [
        {
            "event_type": "status_change",
            "occurred_at": "2026-04-28T12:00:00Z",
            "client_event_id": str(uuid.uuid4()),
        },
        {
            "event_type": "location_ping",
            "occurred_at": "2026-04-28T12:05:00Z",
            "client_event_id": str(uuid.uuid4()),
        },
    ]
    r = client.post(f"/api/trips/{trip_id}/events/", batch, format="json", HTTP_X_CLIENT_ID=cid)
    assert r.status_code == 201
    assert len(r.json()) == 2


@pytest.mark.django_db
def test_log_patch_blocked_after_signing(client, cid):
    res = client.post(
        "/api/trips/",
        {**trip_payload(), "logs": [{"log_date": "2026-04-28", "log_data": {"rows": []}}]},
        format="json",
        HTTP_X_CLIENT_ID=cid,
    )
    trip_id = res.json()["id"]
    sign = client.post(
        f"/api/trips/{trip_id}/logs/2026-04-28/sign/",
        {"signature_image": "data:image/png;base64,abc"},
        format="json",
        HTTP_X_CLIENT_ID=cid,
    )
    assert sign.status_code == 200
    patch = client.patch(
        f"/api/trips/{trip_id}/logs/2026-04-28/",
        {"log_data": {"rows": ["edited"]}},
        format="json",
        HTTP_X_CLIENT_ID=cid,
    )
    assert patch.status_code == 409


@pytest.mark.django_db
def test_log_correction_requires_signing(client, cid):
    res = client.post(
        "/api/trips/",
        {**trip_payload(), "logs": [{"log_date": "2026-04-28", "log_data": {"rows": []}}]},
        format="json",
        HTTP_X_CLIENT_ID=cid,
    )
    trip_id = res.json()["id"]
    bad = client.post(
        f"/api/trips/{trip_id}/logs/2026-04-28/corrections/",
        {
            "field_path": "rows[0]",
            "corrected_value": {"hours": 8},
            "reason": "fixing typo for compliance",
            "client_event_id": str(uuid.uuid4()),
        },
        format="json",
        HTTP_X_CLIENT_ID=cid,
    )
    assert bad.status_code == 400


@pytest.mark.django_db
def test_log_correction_after_signing(client, cid):
    res = client.post(
        "/api/trips/",
        {**trip_payload(), "logs": [{"log_date": "2026-04-28", "log_data": {"rows": []}}]},
        format="json",
        HTTP_X_CLIENT_ID=cid,
    )
    trip_id = res.json()["id"]
    client.post(
        f"/api/trips/{trip_id}/logs/2026-04-28/sign/",
        {"signature_image": "data:image/png;base64,abc"},
        format="json",
        HTTP_X_CLIENT_ID=cid,
    )
    cev = str(uuid.uuid4())
    body = {
        "field_path": "rows[0]",
        "corrected_value": {"hours": 8},
        "reason": "fixing typo for compliance",
        "client_event_id": cev,
    }
    r1 = client.post(
        f"/api/trips/{trip_id}/logs/2026-04-28/corrections/", body, format="json", HTTP_X_CLIENT_ID=cid
    )
    r2 = client.post(
        f"/api/trips/{trip_id}/logs/2026-04-28/corrections/", body, format="json", HTTP_X_CLIENT_ID=cid
    )
    assert r1.status_code == 201
    assert r2.status_code == 200
    log = DailyLog.objects.get(trip_id=trip_id)
    assert len(log.corrections) == 1


@pytest.mark.django_db
def test_delete_trip(client, cid, other_cid):
    res = client.post("/api/trips/", trip_payload(), format="json", HTTP_X_CLIENT_ID=cid)
    trip_id = res.json()["id"]
    cross = client.delete(f"/api/trips/{trip_id}/", HTTP_X_CLIENT_ID=other_cid)
    assert cross.status_code == 404
    own = client.delete(f"/api/trips/{trip_id}/", HTTP_X_CLIENT_ID=cid)
    assert own.status_code == 204
    gone = client.get(f"/api/trips/{trip_id}/", HTTP_X_CLIENT_ID=cid)
    assert gone.status_code == 404


@pytest.mark.django_db
def test_double_sign_blocked(client, cid):
    res = client.post(
        "/api/trips/",
        {**trip_payload(), "logs": [{"log_date": "2026-04-28", "log_data": {"rows": []}}]},
        format="json",
        HTTP_X_CLIENT_ID=cid,
    )
    trip_id = res.json()["id"]
    body = {"signature_image": "data:image/png;base64,abc"}
    r1 = client.post(f"/api/trips/{trip_id}/logs/2026-04-28/sign/", body, format="json", HTTP_X_CLIENT_ID=cid)
    r2 = client.post(f"/api/trips/{trip_id}/logs/2026-04-28/sign/", body, format="json", HTTP_X_CLIENT_ID=cid)
    assert r1.status_code == 200
    assert r2.status_code == 409
