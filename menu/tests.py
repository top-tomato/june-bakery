import json
import re
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse

from menu.models import Product

# GIF ขนาด 1x1 พิกเซล ใช้แทนรูปขนมในเทสต์
TINY_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,"
    b"\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


def make_product(**overrides: object) -> Product:
    fields: dict[str, object] = {
        "name_line1": "ชิฟฟ่อน",
        "name_line2": "ใบเตย",
        "description": "นุ่ม",
        "price": 45,
        "image": SimpleUploadedFile("p.gif", TINY_GIF, content_type="image/gif"),
    }
    fields.update(overrides)
    return Product.objects.create(**fields)


def menu_payload(html: str) -> list[dict[str, object]]:
    match = re.search(r'<script id="menu-data" type="application/json">(.*?)</script>', html, re.S)
    assert match is not None
    return json.loads(match.group(1))


class IndexViewTests(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        media_root = cls.enterClassContext(tempfile.TemporaryDirectory())
        cls.enterClassContext(override_settings(MEDIA_ROOT=media_root))

    def test_empty_menu_shows_placeholder_page(self) -> None:
        response = self.client.get(reverse("menu:index"))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "menu/empty.html")

    def test_lists_active_products_in_sort_order(self) -> None:
        make_product(name_line1="สอง", name_line2="", sort_order=2, price=60)
        make_product(name_line1="หนึ่ง", name_line2="", sort_order=1)
        make_product(name_line1="ซ่อน", name_line2="", is_active=False)

        response = self.client.get(reverse("menu:index"))

        payload = menu_payload(response.content.decode())
        self.assertEqual([item["n"][0] for item in payload], ["หนึ่ง", "สอง"])
        self.assertEqual(payload[1]["price"], 60)
        self.assertEqual(payload[0]["model"], "")

    @override_settings(LINE_OA_ID="@junebakery")
    def test_order_links_point_to_line_official(self) -> None:
        make_product()
        response = self.client.get(reverse("menu:index"))
        self.assertContains(response, "https://line.me/R/ti/p/%40junebakery")
        self.assertNotContains(response, "instagram.com")
        self.assertContains(response, '<div class="qr"><svg')
        self.assertContains(response, "@junebakery</b>")

    def test_index_can_be_framed_by_phone_preview(self) -> None:
        make_product()
        response = self.client.get(reverse("menu:index"))
        self.assertEqual(response["X-Frame-Options"], "SAMEORIGIN")
