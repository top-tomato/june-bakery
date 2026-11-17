from urllib.parse import quote

import segno
from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.utils.safestring import SafeString, mark_safe
from django.views.decorators.clickjacking import xframe_options_sameorigin

from menu.models import Product


def line_qr_svg(url: str) -> SafeString:
    """QR code ของลิงก์เพิ่มเพื่อน LINE เป็น SVG ฝังในหน้าได้เลย"""
    svg = segno.make(url, error="m").svg_inline(scale=4, border=1, dark="#243B37", light=None, omitsize=True)
    return mark_safe(svg)


@xframe_options_sameorigin  # ให้หน้า phone-preview ของเว็บเราเองฝังหน้านี้ในกรอบได้
def index(request: HttpRequest) -> HttpResponse:
    products = Product.objects.filter(is_active=True)
    line_add_url = f"https://line.me/R/ti/p/{quote(settings.LINE_OA_ID)}"
    if not products:
        return render(request, "menu/empty.html", {"line_add_url": line_add_url})
    context = {
        "products": [product.as_payload() for product in products],
        "product_names": [product.full_name for product in products],
        "line_oa_id": settings.LINE_OA_ID,
        "line_add_url": line_add_url,
        "line_qr_svg": line_qr_svg(line_add_url),
    }
    return render(request, "menu/index.html", context)


def phone_preview(request: HttpRequest) -> HttpResponse:
    """หน้าเว็บในกรอบกว้าง 390px ไว้ดูแบบจอมือถือบนเดสก์ท็อป"""
    return render(request, "menu/phone_preview.html")
