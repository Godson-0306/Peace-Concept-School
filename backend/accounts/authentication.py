from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Session auth for the SPA without CSRF (same-site cookie via Next proxy)."""

    def enforce_csrf(self, request):
        return
