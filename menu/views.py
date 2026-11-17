from urllib.parse import quote

import segno
from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.cache import cache_control
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.http import require_GET

from menu.models import Product

# หน้าร้าน (มีสาขาเดียว) พิกัดจากแผนที่ที่เจ้าของร้านส่งมา
SHOP = {
    "name": "หน้าร้าน June",
    "address": "10 พหลโยธิน · ใกล้อนุสาวรีย์ชัยสมรภูมิ",
    "hours": "ทักถามทาง LINE ได้เลย",
    "lat": 13.767586,
    "lng": 100.539543,
}


def line_qr_svg(url: str) -> str:
    """QR code ของลิงก์เพิ่มเพื่อน LINE เป็น SVG (สร้างจากฝั่งเซิร์ฟเวอร์เอง ไม่ได้มาจากผู้ใช้)"""
    return segno.make(url, error="m").svg_inline(scale=4, border=1, dark="#243B37", light=None, omitsize=True)


def menu_data() -> dict[str, object]:
    """ข้อมูลทั้งหมดที่หน้าบ้านใช้ ทั้งใน API และที่ฝังไว้ในหน้าตอนโหลดครั้งแรก"""
    line_add_url = f"https://line.me/R/ti/p/{quote(settings.LINE_OA_ID)}"
    return {
        "products": [product.as_payload() for product in Product.objects.filter(is_active=True)],
        "line": {
            "oaId": settings.LINE_OA_ID,
            "addUrl": line_add_url,
            "qrSvg": line_qr_svg(line_add_url),
        },
        # only links the shop has set; the page shows a button for each one
        "social": {k: v for k, v in {"instagram": settings.SHOP_INSTAGRAM_URL, "facebook": settings.SHOP_FACEBOOK_URL}.items() if v},
        "shop": {
            **SHOP,
            "mapsUrl": f"https://www.google.com/maps/search/?api=1&query={SHOP['lat']},{SHOP['lng']}",
        },
    }


@require_GET
@cache_control(public=True, max_age=60)
def api_menu(request: HttpRequest) -> JsonResponse:
    return JsonResponse(menu_data(), json_dumps_params={"ensure_ascii": False})


@xframe_options_sameorigin  # ให้หน้า phone-preview ของเว็บเราเองฝังหน้านี้ในกรอบได้
def app(request: HttpRequest) -> HttpResponse:
    """หน้าเปล่าของแอป React ทุกหน้า ฝังข้อมูลเมนูไว้ให้เลย หน้าแรกจะได้ไม่ต้องรอเรียก API อีกรอบ"""
    data = menu_data()
    return render(request, "menu/app.html", {"bootstrap": data, "products": data["products"], "shop": data["shop"]})


def phone_preview(request: HttpRequest) -> HttpResponse:
    """หน้าเว็บในกรอบกว้าง 390px ไว้ดูแบบจอมือถือบนเดสก์ท็อป"""
    return render(request, "menu/phone_preview.html")
