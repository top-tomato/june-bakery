"""QR บนกล่อง (mock/box-qr.html, mock/admin-qr.html)

- /q/<slug>   QR ที่นับยอด: บวกยอดสแกนวันนี้ 1 แล้วส่งต่อไปปลายทาง (บอตไม่นับ ไม่เก็บ IP)
- /box        หน้าสำหรับคนที่ถือกล่อง เป็นหน้า React (frontend/src/routes/box.tsx)
- หลังร้าน → QR code: ทำ QR จากลิงก์ ใส่โลโก้ นับยอด แก้ปลายทาง โหลด PNG / SVG และพิมพ์สติกเกอร์ A4
"""

import base64
import io
import secrets
from datetime import timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import quote

import segno
from django.conf import settings
from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import F, Sum
from django.http import Http404, HttpRequest, HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET
from PIL import Image, ImageDraw

from menu.backoffice import base_context
from menu.models import QrCode, QrScan, valid_target
from menu.stats import BOT
from menu.views import SHOP

INK, BLACK = "#243b37", "#000000"
LOGO_FILE = Path(__file__).parent / "static" / "backoffice" / "login-logo.png"
SLUG_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/o, 1/l/i: easy to read out loud


def new_slug() -> str:
    while True:
        slug = "".join(secrets.choice(SLUG_CHARS) for _ in range(4))
        if not QrCode.objects.filter(slug=slug).exists():
            return slug


def absolute(request: HttpRequest, target: str) -> str:
    return request.build_absolute_uri(target) if target.startswith("/") else target


def encoded_url(request: HttpRequest, qr: QrCode) -> str:
    """what the printed code holds: our short link when counting, else the target itself"""
    return request.build_absolute_uri(f"/q/{qr.slug}") if qr.tracked else absolute(request, qr.target)


# ---------------------------------------------------------------- drawing


@lru_cache(maxsize=4)
def logo_png(color: str, width: int) -> Image.Image:
    """the June logo (palm + wordmark) in one colour, from the alpha of the back office logo"""
    src = Image.open(LOGO_FILE).convert("RGBA")
    src = src.resize((width, round(src.height * width / src.width)), Image.LANCZOS)
    out = Image.new("RGBA", src.size, color)
    out.putalpha(src.getchannel("A"))
    return out


def _plate(n: int) -> tuple[float, float]:
    """white plate behind the logo, in modules: ~30% of the code wide (covers ~7%; level H survives 30%)"""
    w = n * 0.30
    return w, w / 1.3


def qr_svg(data: str, logo: bool = True, black: bool = False, border: int = 2) -> str:
    color = BLACK if black else INK
    code = segno.make(data, error="h" if logo else "m")
    svg = code.svg_inline(scale=1, border=border, dark=color, light="#ffffff", omitsize=True)
    svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1)  # also served as a file / <img>, not only inline
    if not logo:
        return svg
    n = code.symbol_size(border=0)[0]
    pw, ph = _plate(n)
    x, y = border + (n - pw) / 2, border + (n - ph) / 2
    img = io.BytesIO()
    logo_png(color, 400).save(img, "PNG")
    lw = pw * 0.84
    lh = lw * 660 / 1000
    href = "data:image/png;base64," + base64.b64encode(img.getvalue()).decode()
    extra = (
        f'<rect x="{x:.2f}" y="{y:.2f}" width="{pw:.2f}" height="{ph:.2f}" rx="{pw * 0.16:.2f}" fill="#ffffff"/>'
        f'<image href="{href}" x="{border + (n - lw) / 2:.2f}" y="{border + (n - lh) / 2:.2f}" width="{lw:.2f}" height="{lh:.2f}"/>'
    )
    return svg.replace("</svg>", extra + "</svg>")


def qr_png(data: str, logo: bool = True, black: bool = False, size: int = 1200) -> bytes:
    color = BLACK if black else INK
    code = segno.make(data, error="h" if logo else "m")
    n = code.symbol_size(border=0)[0]
    border = 2
    scale = max(1, size // (n + 2 * border))
    buf = io.BytesIO()
    code.save(buf, kind="png", scale=scale, border=border, dark=color, light="#ffffff")
    buf.seek(0)
    im = Image.open(buf).convert("RGBA")
    if logo:
        pw, ph = (v * scale for v in _plate(n))
        cx, cy = im.width / 2, im.height / 2
        ImageDraw.Draw(im).rounded_rectangle((cx - pw / 2, cy - ph / 2, cx + pw / 2, cy + ph / 2), radius=pw * 0.16, fill="#ffffff")
        mark = logo_png(color, round(pw * 0.84))
        im.alpha_composite(mark, (round(cx - mark.width / 2), round(cy - mark.height / 2)))
    out = io.BytesIO()
    im.convert("RGB").save(out, "PNG", optimize=True)
    return out.getvalue()


# ---------------------------------------------------------------- public


@never_cache  # every scan must reach us to be counted
def go(request: HttpRequest, slug: str) -> HttpResponse:
    qr = QrCode.objects.filter(slug=slug).first()
    if qr is None:
        return redirect("/")
    if request.method == "GET" and not BOT.search(request.headers.get("User-Agent", "")):
        row, _ = QrScan.objects.get_or_create(qr=qr, date=timezone.localdate())
        QrScan.objects.filter(pk=row.pk).update(count=F("count") + 1)
    return HttpResponseRedirect(qr.target if valid_target(qr.target) else "/")


# ---------------------------------------------------------------- back office


def _shortcuts(request: HttpRequest) -> list[tuple[str, str]]:
    return [
        ("หน้ากล่อง", "/box"),
        ("เพิ่มเพื่อน LINE", f"https://line.me/R/ti/p/{quote(settings.LINE_OA_ID)}"),
        ("หน้าเว็บ", "/"),
        ("แผนที่ร้าน", f"https://www.google.com/maps/search/?api=1&query={SHOP['lat']},{SHOP['lng']}"),
    ]


def _flag(request: HttpRequest, name: str) -> bool:
    return request.POST.get(name) in ("1", "on", "true")


@staff_member_required
def codes(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        action = request.POST.get("action")
        if action == "add":
            name = (request.POST.get("name") or "").strip()[:60]
            target = (request.POST.get("target") or "").strip()
            slug = request.POST.get("slug") or ""
            if not name or not valid_target(target):
                messages.error(request, "ใส่ชื่อ และลิงก์ที่ขึ้นต้นด้วย https:// หรือ / (หน้าในเว็บเรา)")
            else:
                if not (len(slug) == 4 and all(c in SLUG_CHARS for c in slug)) or QrCode.objects.filter(slug=slug).exists():
                    slug = new_slug()
                QrCode.objects.create(name=name, target=target, slug=slug, tracked=_flag(request, "tracked"), logo=_flag(request, "logo"), black=_flag(request, "black"))
                messages.success(request, f"บันทึก QR \"{name}\" แล้ว")
        elif action == "target":
            qr = get_object_or_404(QrCode, pk=request.POST.get("id"))
            target = (request.POST.get("target") or "").strip()
            if valid_target(target):
                qr.target = target
                qr.save(update_fields=["target"])
                messages.success(request, f"เปลี่ยนปลายทางของ \"{qr.name}\" แล้ว" + ("" if qr.tracked else " (QR นี้ไม่ได้นับยอด ที่พิมพ์ไปแล้วยังไปที่เดิม)"))
            else:
                messages.error(request, "ลิงก์ต้องขึ้นต้นด้วย https:// หรือ /")
        elif action == "delete":
            qr = get_object_or_404(QrCode, pk=request.POST.get("id"))
            qr.delete()
            messages.success(request, f"ลบ \"{qr.name}\" แล้ว")
        return redirect("backoffice:qr")

    since = timezone.localdate() - timedelta(days=6)
    rows: list[dict[str, Any]] = []
    for qr in QrCode.objects.all():
        week = qr.scans.filter(date__gte=since).aggregate(v=Sum("count"))["v"] or 0
        total = qr.scans.aggregate(v=Sum("count"))["v"] or 0
        rows.append({"qr": qr, "week": week, "total": total, "show": absolute(request, qr.target), "code": encoded_url(request, qr)})
    return render(request, "backoffice/qr.html", base_context(request, "qr", "QR code") | {
        "rows": rows,
        "shortcuts": _shortcuts(request),
        "slug": new_slug(),
        "site": request.build_absolute_uri("/").rstrip("/"),
    })


@staff_member_required
@require_GET
def preview(request: HttpRequest) -> HttpResponse:
    """live preview while typing (not saved): ?u=<what the code holds>&logo=1&black=0"""
    data = (request.GET.get("u") or "").strip()[:600] or " "
    svg = qr_svg(data, logo=request.GET.get("logo") == "1", black=request.GET.get("black") == "1")
    return HttpResponse(svg, content_type="image/svg+xml")


@staff_member_required
@require_GET
def image(request: HttpRequest, pk: int, fmt: str) -> HttpResponse:
    qr = get_object_or_404(QrCode, pk=pk)
    data = encoded_url(request, qr)
    name = f"june-qr-{qr.slug}"
    if fmt == "svg":
        resp = HttpResponse(qr_svg(data, qr.logo, qr.black), content_type="image/svg+xml")
    elif fmt == "png":
        resp = HttpResponse(qr_png(data, qr.logo, qr.black), content_type="image/png")
    else:
        raise Http404
    if request.GET.get("dl"):
        resp["Content-Disposition"] = f'attachment; filename="{name}.{fmt}"'
    return resp


@staff_member_required
@require_GET
def sticker_sheet(request: HttpRequest, pk: int) -> HttpResponse:
    """A4 of sticker B (6 × 4 cm, 3 × 7): print from the browser onto sticker paper"""
    qr = get_object_or_404(QrCode, pk=pk)
    for_box = qr.target.rstrip("/") == "/box"
    return render(request, "backoffice/qr_sheet.html", {
        "qr": qr,
        "svg": qr_svg(encoded_url(request, qr), qr.logo, qr.black, border=0),
        "head": "อร่อยไหม สั่งอีกรอบ" if for_box else qr.name,
        "sub": "สแกนดูวิธีเก็บให้นุ่ม และกดสั่งทาง LINE" if for_box else "สแกนด้วยกล้องมือถือ หรือ LINE",
        "cells": range(21),
    })
