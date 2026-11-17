import json
import re
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
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
        self.assertEqual(data["gallery"][0]["video"], "")

    def test_gallery_video_must_be_mp4_or_webm(self) -> None:
        g = GalleryPhoto(image=SimpleUploadedFile("g.gif", TINY_GIF, content_type="image/gif"), video=SimpleUploadedFile("v.mov", b"x"))
        with self.assertRaises(ValidationError):
            g.full_clean()

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

    def test_book_routes_use_the_same_shell(self) -> None:
        for name in ("menu:book", "menu:gallery"):
            response = self.client.get(reverse(name))
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, 'id="bootstrap"')

    def test_can_be_framed_by_phone_preview(self) -> None:
        response = self.client.get(reverse("menu:index"))
        self.assertEqual(response["X-Frame-Options"], "SAMEORIGIN")


class MediaServeTests(MediaTestCase):
    """Safari on iPhone (and LINE's browser) only plays a video if the server answers byte ranges with 206."""

    def setUp(self) -> None:
        Path(settings.MEDIA_ROOT, "gallery").mkdir(parents=True, exist_ok=True)
        Path(settings.MEDIA_ROOT, "gallery", "v.mp4").write_bytes(bytes(range(256)) * 4)  # 1024 bytes

    def get(self, path: str, **headers: str):
        return self.client.get(f"/media/{path}", headers=headers)

    def test_whole_file(self) -> None:
        r = self.get("gallery/v.mp4")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Accept-Ranges"], "bytes")
        self.assertEqual(r["Content-Type"], "video/mp4")
        self.assertEqual(len(b"".join(r.streaming_content)), 1024)

    def test_byte_range(self) -> None:
        r = self.get("gallery/v.mp4", Range="bytes=0-1")
        self.assertEqual(r.status_code, 206)
        self.assertEqual(r["Content-Range"], "bytes 0-1/1024")
        self.assertEqual(b"".join(r.streaming_content), bytes([0, 1]))
        self.assertEqual(self.get("gallery/v.mp4", Range="bytes=1000-")["Content-Range"], "bytes 1000-1023/1024")
        self.assertEqual(self.get("gallery/v.mp4", Range="bytes=-24")["Content-Range"], "bytes 1000-1023/1024")
        self.assertEqual(self.get("gallery/v.mp4", Range="bytes=2000-").status_code, 416)

    def test_cached_for_a_year_and_revalidates(self) -> None:
        r = self.get("gallery/v.mp4")
        self.assertIn("max-age=31536000", r["Cache-Control"])
        self.assertEqual(self.get("gallery/v.mp4", **{"If-Modified-Since": r["Last-Modified"]}).status_code, 304)

    def test_uploads_get_unique_names(self) -> None:
        a = GalleryPhoto.objects.create(image=SimpleUploadedFile("same.gif", TINY_GIF, "image/gif"))
        b = GalleryPhoto.objects.create(image=SimpleUploadedFile("same.gif", TINY_GIF, "image/gif"))
        self.assertNotEqual(a.image.name, b.image.name)
        self.assertNotIn("same", a.image.name)
        self.assertTrue(a.image.name.startswith("gallery/") and a.image.name.endswith(".gif"))

    def test_no_escaping_the_media_folder(self) -> None:
        self.assertEqual(self.get("../config/settings.py").status_code, 404)
        self.assertEqual(self.get("gallery").status_code, 404)
        self.assertEqual(self.get("gallery/missing.mp4").status_code, 404)


def png_bytes(size: tuple[int, int] = (3000, 2000)) -> bytes:
    import io

    from PIL import Image

    out = io.BytesIO()
    Image.new("RGB", size, (200, 120, 90)).save(out, "PNG")
    return out.getvalue()


class GalleryUploadTests(MediaTestCase):
    """The staff upload page (menu/gallery_upload.py)."""

    def setUp(self) -> None:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        self.staff = User.objects.create_user("staff", password="x", is_staff=True)  # no per-table permissions
        self.customer = User.objects.create_user("someone", password="x")

    def test_staff_only(self) -> None:
        url = reverse("gallery-upload")
        self.assertEqual(self.client.get(url).status_code, 302)  # to the admin login
        self.client.force_login(self.customer)
        self.assertEqual(self.client.get(url).status_code, 302)
        self.client.force_login(self.staff)
        self.assertContains(self.client.get(url), "เลือกรูปหรือวิดีโอ")

    def test_photo_is_shrunk_and_listed(self) -> None:
        self.client.force_login(self.staff)
        r = self.client.post(reverse("gallery-upload-file"), {"file": SimpleUploadedFile("big.png", png_bytes(), "image/png"), "caption": "ชิ้นแรก"})
        self.assertEqual(r.status_code, 200, r.content)
        g = GalleryPhoto.objects.get()
        self.assertEqual(g.caption, "ชิ้นแรก")
        self.assertTrue(g.image.name.endswith(".jpg"))
        self.assertEqual(max(g.image.width, g.image.height), 1600)
        self.assertEqual(self.client.get(reverse("menu:api-menu")).json()["gallery"][0]["caption"], "ชิ้นแรก")

    def test_photo_gets_a_tiny_blur_preview(self) -> None:
        self.client.force_login(self.staff)
        self.client.post(reverse("gallery-upload-file"), {"file": SimpleUploadedFile("big.png", png_bytes(), "image/png")})
        preview = self.client.get(reverse("menu:api-menu")).json()["gallery"][0]["preview"]
        self.assertTrue(preview.startswith("data:image/jpeg;base64,"))
        self.assertLess(len(preview), 3000)

    def test_video_without_poster(self) -> None:
        self.client.force_login(self.staff)
        r = self.client.post(reverse("gallery-upload-file"), {"file": SimpleUploadedFile("clip.mp4", b"\x00" * 100, "video/mp4")})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["image"], "")
        self.assertTrue(r.json()["video"].endswith(".mp4"))

    def test_rejects_non_images(self) -> None:
        self.client.force_login(self.staff)
        r = self.client.post(reverse("gallery-upload-file"), {"file": SimpleUploadedFile("x.txt", b"hello", "text/plain")})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(GalleryPhoto.objects.count(), 0)

    def test_reorder_hide_caption_delete(self) -> None:
        self.client.force_login(self.staff)
        a, b = (GalleryPhoto.objects.create(image=SimpleUploadedFile(f"{n}.gif", TINY_GIF, "image/gif"), sort_order=i) for i, n in enumerate("ab"))
        self.client.post(reverse("gallery-upload-order"), {"ids": [b.pk, a.pk]}, content_type="application/json")
        self.assertEqual(list(GalleryPhoto.objects.values_list("pk", flat=True)), [b.pk, a.pk])
        self.client.post(reverse("gallery-upload-update", args=[a.pk]), {"active": False, "caption": " ใหม่ "}, content_type="application/json")
        a.refresh_from_db()
        self.assertEqual((a.is_active, a.caption), (False, "ใหม่"))
        path = Path(b.image.path)
        self.client.post(reverse("gallery-upload-delete", args=[b.pk]))
        self.assertFalse(GalleryPhoto.objects.filter(pk=b.pk).exists())
        self.assertFalse(path.exists())

    def test_only_post_changes_things(self) -> None:
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get(reverse("gallery-upload-order")).status_code, 405)


class AdminLoginTests(TestCase):
    def test_login_page_in_the_shop_look(self) -> None:
        r = self.client.get("/admin/login/?next=/admin/gallery-upload/")
        self.assertContains(r, "เข้าสู่ระบบร้าน")
        self.assertContains(r, 'name="next" value="/admin/gallery-upload/"')

    def test_staff_can_sign_in(self) -> None:
        from django.contrib.auth import get_user_model

        get_user_model().objects.create_user("staff", password="pw-for-test-only", is_staff=True)
        r = self.client.post("/admin/login/?next=/admin/gallery-upload/", {"username": "staff", "password": "pw-for-test-only", "next": "/admin/gallery-upload/"})
        self.assertRedirects(r, "/admin/gallery-upload/")
        self.assertContains(self.client.get("/admin/"), "อัปโหลดรูป Gallery")


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
