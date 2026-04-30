from django.urls import path

from . import views

urlpatterns = [
    path("trips/", views.trips_collection),
    path("trips/<uuid:trip_id>/", views.trip_detail),
    path("trips/<uuid:trip_id>/events/", views.trip_events),
    path("trips/<uuid:trip_id>/logs/", views.trip_logs),
    path("trips/<uuid:trip_id>/logs/<str:log_date>/", views.trip_log_detail),
    path("trips/<uuid:trip_id>/logs/<str:log_date>/sign/", views.trip_log_sign),
    path("trips/<uuid:trip_id>/logs/<str:log_date>/corrections/", views.trip_log_corrections),
]
