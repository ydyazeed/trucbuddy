import uuid

from rest_framework import authentication, exceptions


class ClientPrincipal:
    """Lightweight principal carrying the anonymous client UUID."""

    def __init__(self, client_id):
        self.client_id = client_id

    @property
    def is_authenticated(self):
        return True

    def __str__(self):
        return f"client:{self.client_id}"


class ClientIdAuthentication(authentication.BaseAuthentication):
    HEADER = "HTTP_X_CLIENT_ID"

    def authenticate(self, request):
        raw = request.META.get(self.HEADER)
        if not raw:
            return None
        try:
            client_id = uuid.UUID(str(raw))
        except (ValueError, AttributeError, TypeError):
            raise exceptions.AuthenticationFailed("Invalid X-Client-Id header.")
        return (ClientPrincipal(client_id), None)


def require_client_id(request):
    user = getattr(request, "user", None)
    if user is None or not isinstance(user, ClientPrincipal):
        raise exceptions.NotAuthenticated("Missing X-Client-Id header.")
    return user.client_id
