import json
import re
import tempfile
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.template import Context, Template
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse

from menu.models import GalleryPhoto, Product, Review, ShopInfo

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


def bootstrap(html: str) -> dict[str, object]:
    match = re.search(r'<script id="bootstrap" type="application/json">(.*?)</script>', html, re.S)
    assert match is not None
    return json.loads(match.group(1))


class MediaTestCase(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        super().setUpClass()
        media_root = cls.enterClassContext(tempfile.TemporaryDirectory())
        cls.enterClassContext(override_settings(MEDIA_ROOT=media_root))


class MenuApiTests(MediaTestCase):
    def test_lists_active_products_in_sort_order(self) -> None:
        make_product(name_line1="สอง", name_line2="", sort_order=2, price=60, highlight_1="กรอบ")
        make_product(name_line1="หนึ่ง", name_line2="", sort_order=1)
        make_product(name_line1="ซ่อน", name_line2="", is_active=False)

        data = self.client.get(reverse("menu:api-menu")).json()

        self.assertEqual([p["name"][0] for p in data["products"]], ["หนึ่ง", "สอง"])
        self.assertEqual(data["products"][1]["price"], 60)
        self.assertEqual(data["products"][1]["highlights"], ["กรอบ"])  # empty highlights are dropped
        self.assertEqual(data["products"][0]["model"], "")

    @override_settings(LINE_OA_ID="@junebakery")
    def test_line_and_shop_details(self) -> None:
        data = self.client.get(reverse("menu:api-menu")).json()
        self.assertEqual(data["line"]["oaId"], "@junebakery")
        self.assertEqual(data["line"]["addUrl"], "https://line.me/R/ti/p/%40junebakery")
        self.assertTrue(data["line"]["qrSvg"].startswith("<svg"))
        self.assertIn("13.767586,100.539543", data["shop"]["mapsUrl"])

    def test_social_links_only_when_set(self) -> None:
        self.assertEqual(self.client.get(reverse("menu:api-menu")).json()["social"], {})
        with override_settings(SHOP_INSTAGRAM_URL="https://www.instagram.com/june", SHOP_FACEBOOK_URL=""):
            social = self.client.get(reverse("menu:api-menu")).json()["social"]
        self.assertEqual(social, {"instagram": "https://www.instagram.com/june"})

    def test_optional_sections_are_empty_until_filled_in(self) -> None:
        data = self.client.get(reverse("menu:api-menu")).json()
        self.assertEqual(data["order"], {"preorderDays": None, "shelfLife": "", "payment": ""})
        self.assertIsNone(data["about"])
        self.assertEqual(data["reviews"], [])
        self.assertEqual(data["gallery"], [])
        self.assertEqual(data["shop"]["hours"], "ทักถามทาง LINE ได้เลย")

    def test_filled_in_sections(self) -> None:
        info = ShopInfo.load()
        info.preorder_days = 1
        info.shelf_life = "2 วันในตู้เย็น"
        info.hours = "ทุกวัน 9:00–17:00"
        info.about_text = "ทำเองทุกชิ้น"
        info.save()
        Review.objects.create(text="นุ่มมาก", author="ฝน")
        Review.objects.create(text="ซ่อน", author="x", is_active=False)
        GalleryPhoto.objects.create(image=SimpleUploadedFile("g.gif", TINY_GIF, content_type="image/gif"), caption="ชิ้นแรก")

        data = self.client.get(reverse("menu:api-menu")).json()

        self.assertEqual(data["order"]["preorderDays"], 1)
        self.assertEqual(data["order"]["shelfLife"], "2 วันในตู้เย็น")
        self.assertEqual(data["shop"]["hours"], "ทุกวัน 9:00–17:00")
        self.assertEqual(data["about"]["text"], "ทำเองทุกชิ้น")
        self.assertEqual([r["author"] for r in data["reviews"]], ["ฝน"])
        self.assertEqual(data["gallery"][0]["caption"], "ชิ้นแรก")

    def test_shop_info_is_a_single_row(self) -> None:
        self.assertEqual(ShopInfo.load().pk, ShopInfo.load().pk)
        self.assertEqual(ShopInfo.objects.count(), 1)

    def test_only_get(self) -> None:
        self.assertEqual(self.client.post(reverse("menu:api-menu")).status_code, 405)


class AppShellTests(MediaTestCase):
    def test_embeds_the_menu_so_the_first_screen_needs_no_request(self) -> None:
        make_product(name_line1="หนึ่ง", name_line2="")
        response = self.client.get(reverse("menu:index"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(bootstrap(response.content.decode())["products"][0]["name"][0], "หนึ่ง")

    def test_readable_without_javascript(self) -> None:
        make_product(name_line1="ชิฟฟ่อน", name_line2="ใบเตย", price=45)
        response = self.client.get(reverse("menu:index"))
        self.assertContains(response, "<b>ชิฟฟ่อนใบเตย</b> ฿45")
        self.assertContains(response, 'property="og:image"')

    def test_book_route_uses_the_same_shell(self) -> None:
        response = self.client.get(reverse("menu:book"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="bootstrap"')

    def test_can_be_framed_by_phone_preview(self) -> None:
        response = self.client.get(reverse("menu:index"))
        self.assertEqual(response["X-Frame-Options"], "SAMEORIGIN")


class ViteAssetsTagTests(SimpleTestCase):
    def render(self) -> str:
        return Template('{% load vite %}{% vite_assets "src/main.tsx" %}').render(Context())

    @override_settings(VITE_DEV_SERVER="http://localhost:5173")
    def test_dev_server(self) -> None:
        html = self.render()
        self.assertIn('src="http://localhost:5173/@vite/client"', html)
        self.assertIn('src="http://localhost:5173/src/main.tsx"', html)
        self.assertIn("@react-refresh", html)

    def test_built_files_from_manifest(self) -> None:
        manifest = {
            "src/main.tsx": {"file": "app/main-abc.js", "css": ["app/main-abc.css"], "imports": ["_shared.js"]},
            "_shared.js": {"file": "app/shared-def.js"},
        }
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "manifest.json"
            path.write_text(json.dumps(manifest))
            with override_settings(VITE_DEV_SERVER="", VITE_MANIFEST=path, DEBUG=True):
                html = self.render()
        self.assertIn('<link rel="stylesheet" href="/static/app/main-abc.css">', html)
        self.assertIn('<link rel="modulepreload" href="/static/app/shared-def.js">', html)
        self.assertIn('<script type="module" src="/static/app/main-abc.js"></script>', html)

    @override_settings(VITE_DEV_SERVER="", VITE_MANIFEST=Path("/nonexistent/manifest.json"), DEBUG=True)
    def test_missing_build_in_debug_is_a_comment_not_a_crash(self) -> None:
        self.assertIn("frontend not built", self.render())
