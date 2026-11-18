"""Send every other host to the shop's own domain (CANONICAL_HOST, e.g. junedessert.com).

The printed QR stickers say june-bakery.fly.dev/q/box, so the old host must keep working: it answers with a permanent
redirect to the same path on the new domain (the scan is then counted there). Unset (local, preview app) = no redirect.
"""

from collections.abc import Callable

from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponsePermanentRedirect


class CanonicalHostMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        canonical = settings.CANONICAL_HOST
        if canonical and request.get_host().split(":")[0].lower() != canonical:
            return HttpResponsePermanentRedirect(f"https://{canonical}{request.get_full_path()}")
        return self.get_response(request)
