"""ตัวนับคนเข้าเว็บ / คนกดสั่งทาง LINE (frontend/src/lib/hits.ts ส่งมา) สำหรับหน้าสรุปร้าน

เก็บแค่ยอดรวมต่อวัน ต่อช่องทาง ไม่มีคุกกี้ ไม่เก็บ IP หรือข้อมูลส่วนตัว บอตไม่นับ
"""

import json
import re

from django.db.models import F
from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from menu.models import DailyStat

SOURCES = {"line", "richmenu", "instagram", "facebook", "tiktok", "google", "direct", "other"}
BOT = re.compile(r"bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse", re.I)


@csrf_exempt  # a navigator.sendBeacon from the public site; it only ever adds 1 to a daily counter
@require_POST
def hit(request: HttpRequest) -> HttpResponse:
    if BOT.search(request.headers.get("User-Agent", "")):
        return HttpResponse(status=204)
    try:
        data = json.loads(request.body or b"{}")
    except ValueError:
        return HttpResponse(status=400)
    kind = data.get("k")
    if kind not in ("visit", "tap"):
        return HttpResponse(status=400)
    source = data.get("src") if data.get("src") in SOURCES else "other"
    row, _ = DailyStat.objects.get_or_create(date=timezone.localdate(), kind=kind, source=source)
    DailyStat.objects.filter(pk=row.pk).update(count=F("count") + 1)
    return HttpResponse(status=204)
