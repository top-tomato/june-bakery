import re
from datetime import date
from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone

TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
TH_MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]


class UniqueName:
    """upload_to that gives every uploaded file a fresh random name (keeping the extension). Uploaded files are served
    with a one-year cache (menu/media.py), so a name must never be reused for different content — even after a delete."""

    def __init__(self, folder: str) -> None:
        self.folder = folder

    def __call__(self, instance: object, filename: str) -> str:
        import uuid
        from pathlib import PurePath

        return f"{self.folder}{uuid.uuid4().hex[:16]}{PurePath(filename).suffix.lower()}"

    def deconstruct(self) -> tuple[str, tuple[str], dict[str, object]]:  # so migrations can store it
        return ("menu.models.UniqueName", (self.folder,), {})


def make_preview(field: object, side: int = 32) -> str:
    """A 32px JPEG of the photo as a data: URI. Upscaled by the browser it looks like a soft blur of the photo,
    shown instantly (it's in the page data) until the real photo has loaded."""
    import base64
    import io

    from PIL import Image, ImageOps

    try:
        f = field.open("rb") if hasattr(field, "open") else field  # type: ignore[union-attr]
        with Image.open(f) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((side, side))
            out = io.BytesIO()
            im.save(out, "JPEG", quality=45)
    except Exception:  # a broken or missing file just gets no preview
        return ""
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()


class Product(models.Model):
    """ขนมหนึ่งเมนูที่โชว์บนหน้าเว็บ"""

    name_line1 = models.CharField("ชื่อบรรทัดแรก", max_length=60)
    name_line2 = models.CharField("ชื่อบรรทัดสอง", max_length=60, blank=True)
    description = models.CharField("คำบรรยาย", max_length=200)
    price = models.PositiveIntegerField("ราคา (บาท)", null=True, blank=True, help_text="เว้นว่าง = หน้าเว็บขึ้นว่า \"สอบถามราคา\"")
    price_unit = models.CharField("ราคานี้ได้อะไร", max_length=40, blank=True, help_text="ขึ้นข้างราคา เช่น กล่อง 4 ชิ้น (ว่าง = ขึ้นแค่ราคา)")
    image = models.ImageField("รูปขนม", upload_to=UniqueName("products/img/"))
    model_3d = models.FileField("โมเดล 3D (.glb)", upload_to=UniqueName("products/model/"), blank=True)
    accent_color = models.CharField("สีพื้นหลังประจำเมนู", max_length=7, default="#C9DE98", help_text="รหัสสีแบบ #RRGGBB")
    highlight_1 = models.CharField("จุดเด่น 1", max_length=60, blank=True)
    highlight_2 = models.CharField("จุดเด่น 2", max_length=60, blank=True)
    highlight_3 = models.CharField("จุดเด่น 3", max_length=60, blank=True)
    sort_order = models.PositiveIntegerField("ลำดับ", default=0, help_text="เลขน้อยขึ้นก่อน")
    is_active = models.BooleanField("แสดงบนเว็บ", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "ขนม"
        verbose_name_plural = "ขนม"

    def __str__(self) -> str:
        return self.full_name

    @property
    def full_name(self) -> str:
        return f"{self.name_line1}{self.name_line2}"

    def as_payload(self) -> dict[str, object]:
        """ข้อมูลเมนูนี้สำหรับ API /api/menu/ (หน้าบ้าน React ใช้ type เดียวกันใน frontend/src/api/menu.ts)"""
        return {
            "id": self.pk,
            "name": [self.name_line1, self.name_line2],
            "description": self.description,
            "price": self.price,
            "priceUnit": self.price_unit,
            "image": self.image.url,
            "model": self.model_3d.url if self.model_3d else "",
            "accent": self.accent_color,
            "highlights": [h for h in (self.highlight_1, self.highlight_2, self.highlight_3) if h],
        }


class ShopInfo(models.Model):
    """ข้อมูลร้านที่แก้ได้ใน admin (มีแถวเดียว) ช่องไหนว่าง หน้าเว็บจะซ่อนส่วนนั้นไว้"""

    hours = models.CharField("เวลาเปิด", max_length=120, blank=True, help_text="เช่น ทุกวัน 9:00–17:00 (ว่าง = บอกให้ทักถามทาง LINE)")
    preorder_days = models.PositiveSmallIntegerField("ต้องสั่งล่วงหน้ากี่วัน", null=True, blank=True)
    shelf_life = models.CharField("เก็บได้นานแค่ไหน", max_length=120, blank=True, help_text="เช่น 2 วันในตู้เย็น")
    payment = models.CharField("วิธีจ่ายเงิน", max_length=120, blank=True, help_text="เช่น โอนพร้อมเพย์ / จ่ายตอนรับ")
    delivery = models.CharField("ส่งถึงที่", max_length=120, blank=True, help_text="เช่น Grab / Lineman ค่าส่งตามระยะทาง")
    about_title = models.CharField("หัวข้อเรื่องของร้าน", max_length=80, blank=True)
    about_text = models.TextField("เรื่องของร้าน (2–3 ประโยค)", blank=True)
    about_photo = models.ImageField("รูปประกอบเรื่องของร้าน", upload_to=UniqueName("shop/"), blank=True)
    share_photo = models.ImageField(
        "รูปปกตอนแปะลิงก์", upload_to=UniqueName("shop/"), blank=True,
        help_text="รูปขนมที่ขึ้นเวลาแปะลิงก์เว็บใน LINE / Facebook (ใส่โลโก้กับคำโปรยให้เอง) ว่าง = ใช้รูปขนมชิ้นแรกในเมนู",
    )
    care = models.TextField(
        "วิธีเก็บขนม", blank=True,
        help_text="ขึ้นในหน้าที่ลูกค้าเห็นหลังสแกน QR บนกล่อง (/box) บรรทัดละข้อ เขียนแบบ หัวข้อ: รายละเอียด (ว่าง = ไม่แสดง)",
    )
    promo = models.TextField(
        "โปรเดือนนี้", blank=True,
        help_text="หน้าโปรโมชั่น (/promo) บรรทัดละโปร: ชื่อโปร | ราคา | รายละเอียด เช่น ชิฟฟ่อน 2 กล่อง | 220.- (240.-) | สั่งล่วงหน้า 1 วัน (ว่าง = เดือนนี้ไม่มีโปร)",
    )
    promo_until = models.DateField("โปรหมดเขต", null=True, blank=True, help_text="เลยวันนี้แล้วหน้าโปรขึ้นว่าไม่มีโปรเอง (ว่าง = ไม่มีวันหมดเขต)")
    promo_note = models.CharField("หมายเหตุท้ายใบโปร", max_length=120, blank=True, help_text="เช่น ใช้ร่วมกับโปรอื่นไม่ได้")
    instagram_url = models.URLField("ลิงก์ Instagram", blank=True, help_text="เช่น https://www.instagram.com/ชื่อร้าน/ (ว่าง = ไม่แสดงปุ่ม)")
    facebook_url = models.URLField("ลิงก์เพจ Facebook", blank=True, help_text="ว่าง = ไม่แสดงปุ่ม")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ข้อมูลร้าน"
        verbose_name_plural = "ข้อมูลร้าน"

    def __str__(self) -> str:
        return "ข้อมูลร้าน"

    def clean(self) -> None:
        # a bare instagram.com / facebook.com (no page) took customers to the site's front page, not the shop's
        for field, host in (("instagram_url", "instagram.com"), ("facebook_url", "facebook.com")):
            url = getattr(self, field)
            if not url:
                continue
            parts = urlsplit(url)
            if not parts.netloc.lower().endswith(host) and not (host == "facebook.com" and parts.netloc.lower().endswith("fb.com")):
                raise ValidationError({field: f"ลิงก์ต้องเป็นของ {host}"})
            if parts.path.strip("/") == "" and not parts.query:
                raise ValidationError({field: "ใส่ลิงก์หน้าร้าน ไม่ใช่หน้าแรกของเว็บ"})

    def save(self, *args: object, **kwargs: object) -> None:
        # drop tracking bits apps add when sharing a profile ("?igsh=…", "?rpxt=…"): a clean link on the site
        for field in ("instagram_url", "facebook_url"):
            url = getattr(self, field)
            if url:
                parts = urlsplit(url)
                keep = parts.query if field == "facebook_url" and "profile.php" in parts.path else ""
                setattr(self, field, f"{parts.scheme}://{parts.netloc}{parts.path.rstrip('/')}/" + (f"?{keep}" if keep else ""))
        before = ShopInfo.objects.filter(pk=self.pk).values_list("instagram_url", flat=True).first() if self.pk else None
        super().save(*args, **kwargs)  # type: ignore[arg-type]
        if before is not None and before != self.instagram_url:
            from menu.watermark import handle_from_url

            handle = handle_from_url(self.instagram_url)
            for g in GalleryPhoto.objects.exclude(original="", image=""):
                g.apply_watermark(handle)
                g.save()

    def care_tips(self) -> list[dict[str, str]]:
        """"วิธีเก็บขนม" for the /box page: one tip per line, "หัวข้อ: รายละเอียด" (no colon = just the text)"""
        tips = []
        for line in self.care.splitlines():
            line = line.strip().lstrip("-•· ").strip()
            if not line:
                continue
            head, sep, body = line.partition(":")
            tip = {"head": head.strip(), "body": body.strip()} if sep and body.strip() else {"head": "", "body": line}
            # the icon follows what the line is about: fridge, warming up before eating, else a clock
            h = tip["head"] or tip["body"]
            tip["icon"] = "fridge" if "ตู้เย็น" in h or "แช่" in h else "warm" if "ก่อนทาน" in h or "อุ่น" in h else "clock"
            tips.append(tip)
        return tips[:6]

    def promo_payload(self, today: date | None = None) -> dict[str, object] | None:
        """this month's flyer for /promo (mock/promo.html A); None = no promo now (none written, or past its end date)"""
        today = today or timezone.localdate()
        if self.promo_until and self.promo_until < today:
            return None
        items = []
        for line in self.promo.splitlines():
            line = line.strip().lstrip("-•· ").strip()
            if not line:
                continue
            name, price, detail = ([p.strip() for p in line.split("|", 2)] + ["", ""])[:3]
            # "220.- (240.-)": the price in brackets is the usual one, shown struck through
            was = ""
            m = re.fullmatch(r"(.*?)\s*\((.+)\)", price)
            if m and m.group(1):
                price, was = m.group(1).strip(), m.group(2).strip()
            items.append({"name": name, "price": price, "was": was, "detail": detail})
        if not items:
            return None
        until = self.promo_until
        return {
            "month": f"{TH_MONTHS_LONG[today.month - 1]} {today.year + 543}",
            "items": items[:8],
            "until": f"{until.day} {TH_MONTHS_SHORT[until.month - 1]} {until.year + 543}" if until else "",
            "note": self.promo_note,
        }

    @property
    def social(self) -> dict[str, str]:
        return {k: v for k, v in {"instagram": self.instagram_url, "facebook": self.facebook_url}.items() if v}

    @classmethod
    def load(cls) -> "ShopInfo":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def as_payload(self) -> dict[str, object]:
        return {
            "hours": self.hours,
            "preorderDays": self.preorder_days,
            "shelfLife": self.shelf_life,
            "payment": self.payment,
            "delivery": self.delivery,
            "about": (
                {
                    "title": self.about_title,
                    "text": self.about_text,
                    "photo": self.about_photo.url if self.about_photo else "",
                }
                if self.about_text
                else None
            ),
        }


class Review(models.Model):
    """รีวิวจากลูกค้า (ขออนุญาตลูกค้าก่อนใส่)"""

    text = models.TextField("ข้อความรีวิว")
    author = models.CharField("ชื่อลูกค้า", max_length=60, help_text="ใส่ชื่อเล่นหรือย่อได้")
    sort_order = models.PositiveIntegerField("ลำดับ", default=0)
    is_active = models.BooleanField("แสดงบนเว็บ", default=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "รีวิว"
        verbose_name_plural = "รีวิว"

    def __str__(self) -> str:
        return f"{self.author}: {self.text[:30]}"

    def as_payload(self) -> dict[str, object]:
        return {"id": self.pk, "text": self.text, "author": self.author}


class GalleryPhoto(models.Model):
    """รูปหรือวิดีโอในส่วนรูปขนมบนหน้าแรก และในสมุดรูป /gallery/"""

    image = models.ImageField("รูป", upload_to=UniqueName("gallery/"), blank=True, help_text="ถ้าใส่วิดีโอด้วย รูปนี้ใช้เป็นภาพปกของวิดีโอ (ไม่ใส่ก็ได้)")
    # the photo as uploaded (shrunk, no watermark); `image` is made from it with the watermark (menu/watermark.py)
    original = models.ImageField(upload_to=UniqueName("gallery/original/"), blank=True, editable=False)
    video = models.FileField(
        "วิดีโอ (ไม่ใส่ก็ได้)",
        upload_to=UniqueName("gallery/video/"),
        blank=True,
        validators=[FileExtensionValidator(["mp4", "webm"])],
        help_text="ไฟล์ .mp4 สั้น ๆ ไม่เกิน 20 MB เล่นเองแบบไม่มีเสียง",
    )
    caption = models.CharField("คำบรรยาย", max_length=80, blank=True)
    sort_order = models.PositiveIntegerField("ลำดับ", default=0)
    is_active = models.BooleanField("แสดงบนเว็บ", default=True)
    # tiny JPEG (data: URI, ~1 KB) shown blurred while the real photo loads; made from `image` on save
    preview = models.TextField(blank=True, editable=False)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "รูปขนม"
        verbose_name_plural = "รูปขนม"

    def __str__(self) -> str:
        return self.caption or (self.image or self.video).name

    def delete_files(self) -> None:
        """ลบไฟล์รูปและวิดีโอออกจากดิสก์ด้วย (Django ไม่ลบให้เอง)"""
        for f in (self.image, self.original, self.video):
            if f:
                f.delete(save=False)

    def as_payload(self) -> dict[str, object]:
        return {
            "id": self.pk,
            "image": self.image.url if self.image else "",
            "caption": self.caption,
            "video": self.video.url if self.video else "",
            "preview": self.preview,
        }

    def apply_watermark(self, handle: str | None = None) -> None:
        """(Re)make `image` from `original` with the current watermark. A photo uploaded before watermarks keeps its
        file as the original. Videos and video-only items are left alone."""
        from menu.watermark import handle_from_url, render

        if self.video or not (self.original or self.image):
            return
        if not self.original:
            with self.image.open("rb") as f:
                self.original.save("photo.jpg", ContentFile(f.read()), save=False)
        if handle is None:
            handle = handle_from_url(ShopInfo.load().instagram_url)
        old = self.image.name if self.image else ""
        with self.original.open("rb") as f:
            self.image.save("photo.jpg", render(f, handle), save=False)  # new unique name: caches never show the old one
        if old and old != self.original.name:
            self.image.storage.delete(old)

    def save(self, *args: object, **kwargs: object) -> None:
        # only when the photo may have changed (a caption/visibility edit passes update_fields and skips this)
        if kwargs.get("update_fields") is None:
            self.preview = make_preview(self.image) if self.image else ""
        super().save(*args, **kwargs)  # type: ignore[arg-type]

    def clean(self) -> None:
        if not self.image and not self.video:
            raise ValidationError("ใส่รูปหรือวิดีโออย่างน้อยหนึ่งอย่าง")
        if self.video and self.video.size > 20 * 1024 * 1024:
            raise ValidationError({"video": "วิดีโอใหญ่เกิน 20 MB ลองย่อไฟล์ก่อน"})


# ---------------------------------------------------------------------------------------------------------------------
# Back office (/admin/shop/, mock/admin.html). The site can't see orders made in LINE chats, so staff log orders and
# expenses there. Visits and "order on LINE" taps are counted by the site itself (no cookies, nothing personal).


class Order(models.Model):
    """ออเดอร์หนึ่งรายการที่ staff บันทึก: ขายเลย หรือสั่งล่วงหน้า (สัมมนา / ของว่างช่วงพัก) ที่มีวันเวลารับ"""

    KINDS = [("now", "ขายเลย"), ("pre", "สั่งล่วงหน้า")]
    CHANNELS = [("line", "LINE"), ("store", "หน้าร้าน"), ("other", "อื่น ๆ")]
    PAYMENTS = [("transfer", "โอน"), ("cash", "เงินสด")]

    created_at = models.DateTimeField("บันทึกเมื่อ", default=timezone.now, db_index=True)
    kind = models.CharField("แบบ", max_length=4, choices=KINDS, default="now")
    pickup_at = models.DateTimeField("วันเวลารับ", null=True, blank=True, db_index=True)
    who = models.CharField("ชื่องาน / ลูกค้า", max_length=120, blank=True)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="ขนม")
    product_name = models.CharField("ชื่อขนม", max_length=120)  # kept if the product is renamed or removed
    qty = models.PositiveIntegerField("จำนวนกล่อง", default=1)
    unit_price = models.PositiveIntegerField("ราคาต่อกล่อง")
    channel = models.CharField("สั่งทาง", max_length=10, choices=CHANNELS, default="line")
    payment = models.CharField("จ่ายด้วย", max_length=10, choices=PAYMENTS, default="transfer")
    note = models.CharField("จด", max_length=160, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, editable=False)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "ออเดอร์"
        verbose_name_plural = "ออเดอร์"

    def __str__(self) -> str:
        return f"{self.product_name} × {self.qty}"

    @property
    def total(self) -> int:
        return self.qty * self.unit_price

    def clean(self) -> None:
        if self.kind == "pre" and not self.pickup_at:
            raise ValidationError({"pickup_at": "สั่งล่วงหน้าต้องมีวันเวลารับ"})
        if self.kind == "pre" and not self.who.strip():
            raise ValidationError({"who": "ใส่ชื่องานหรือลูกค้า"})


class Expense(models.Model):
    """รายจ่ายหนึ่งรายการ"""

    CATEGORIES = [
        ("ingredients", "วัตถุดิบ"),
        ("packaging", "กล่อง/ถุง"),
        ("rent", "ค่าเช่า"),
        ("utilities", "ค่าน้ำไฟ"),
        ("delivery", "ค่าส่ง"),
        ("other", "อื่น ๆ"),
    ]

    date = models.DateField("วันที่", default=timezone.localdate, db_index=True)
    category = models.CharField("หมวด", max_length=20, choices=CATEGORIES, default="ingredients")
    amount = models.DecimalField("จำนวนเงิน (บาท)", max_digits=10, decimal_places=2)
    note = models.CharField("จด", max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, editable=False)

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = "รายจ่าย"
        verbose_name_plural = "รายจ่าย"

    def __str__(self) -> str:
        return f"{self.get_category_display()} {self.amount}"


class ClosedDay(models.Model):
    """วันที่ร้านหยุด (ขึ้นบนหน้าเว็บด้วย)"""

    date = models.DateField("วันที่", unique=True)
    note = models.CharField("หมายเหตุ", max_length=80, blank=True)

    class Meta:
        ordering = ["date"]
        verbose_name = "วันหยุดร้าน"
        verbose_name_plural = "วันหยุดร้าน"

    def __str__(self) -> str:
        return str(self.date)


class DailyStat(models.Model):
    """นับคนเข้าเว็บ / คนกดสั่งทาง LINE ต่อวัน ต่อช่องทาง (ไม่เก็บข้อมูลส่วนตัว)"""

    KINDS = [("visit", "เข้าเว็บ"), ("tap", "กดสั่งทาง LINE")]

    date = models.DateField(default=timezone.localdate)
    kind = models.CharField(max_length=10, choices=KINDS)
    source = models.CharField(max_length=20)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["date", "kind", "source"], name="one_stat_row")]


class QrCode(models.Model):
    """QR ที่ทำในหลังร้าน (หน้า QR code) ถ้านับยอด QR จะพาไป /q/<slug> ก่อน แล้วส่งต่อไปปลายทาง (แก้ปลายทางทีหลังได้)"""

    name = models.CharField("ชื่อ (ไว้จำ)", max_length=60)
    target = models.CharField("ลิงก์ปลายทาง", max_length=500, help_text="https://… หรือหน้าในเว็บเรา เช่น /box")
    slug = models.SlugField("รหัสลิงก์สั้น", max_length=16, unique=True)
    tracked = models.BooleanField("นับยอดสแกน", default=True)
    logo = models.BooleanField("โลโก้ตรงกลาง", default=True)
    black = models.BooleanField("สีดำ", default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "QR code"
        verbose_name_plural = "QR code"

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        if not valid_target(self.target):
            raise ValidationError({"target": "ลิงก์ต้องขึ้นต้นด้วย https:// หรือ / (หน้าในเว็บเรา)"})


def valid_target(url: str) -> bool:
    """https://… / http://… or a path on this site ("/box"); never "//host" or javascript: and the like"""
    url = url.strip()
    if url.startswith("/"):
        return not url.startswith("//") and "\\" not in url
    parts = urlsplit(url)
    return parts.scheme in ("http", "https") and bool(parts.netloc)


class QrScan(models.Model):
    """ยอดสแกนต่อวันของ QR แต่ละอัน (ไม่เก็บ IP หรือข้อมูลคนสแกน)"""

    qr = models.ForeignKey(QrCode, on_delete=models.CASCADE, related_name="scans")
    date = models.DateField(db_index=True)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["qr", "date"], name="one_scan_row_per_day")]
