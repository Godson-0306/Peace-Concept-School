import json
import logging

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .paystack import apply_successful_charge, verify_signature

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def paystack_webhook(request):
    raw = request.body or b""
    signature = request.headers.get("X-Paystack-Signature") or ""
    if not verify_signature(raw, signature):
        return HttpResponse(status=400)
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return HttpResponse(status=400)
    event = payload.get("event") or ""
    if event == "charge.success":
        try:
            apply_successful_charge(payload)
        except Exception:
            logger.exception("Paystack webhook failed to credit charge")
            return HttpResponse(status=500)
    return JsonResponse({"status": "ok"})
