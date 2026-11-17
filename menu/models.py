from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models


class Product(models.Model):
    """ขนมหนึ่งเมนูที่โชว์บนหน้าเว็บ"""

    name_line1 = models.CharField("ชื่อบรรทัดแรก", max_length=60)
    name_line2 = models.CharField("ชื่อบรรทัดสอง", max_length=60, blank=True)
    description = models.CharField("คำบรรยาย", max_length=200)
    price = models.PositiveIntegerField("ราคาต่อชิ้น (บาท)")
    image = models.ImageField("รูปขนม", upload_to="products/img/")
    model_3d = models.FileField("โมเดล 3D (.glb)", upload_to="products/model/", blank=True)
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
    about_title = models.CharField("หัวข้อเรื่องของร้าน", max_length=80, blank=True)
    about_text = models.TextField("เรื่องของร้าน (2–3 ประโยค)", blank=True)
    about_photo = models.ImageField("รูปประกอบเรื่องของร้าน", upload_to="shop/", blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ข้อมูลร้าน"
        verbose_name_plural = "ข้อมูลร้าน"

    def __str__(self) -> str:
        return "ข้อมูลร้าน"

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

    image = models.ImageField("รูป", upload_to="gallery/", blank=True, help_text="ถ้าใส่วิดีโอด้วย รูปนี้ใช้เป็นภาพปกของวิดีโอ (ไม่ใส่ก็ได้)")
    video = models.FileField(
        "วิดีโอ (ไม่ใส่ก็ได้)",
        upload_to="gallery/video/",
        blank=True,
        validators=[FileExtensionValidator(["mp4", "webm"])],
        help_text="ไฟล์ .mp4 สั้น ๆ ไม่เกิน 20 MB เล่นเองแบบไม่มีเสียง",
    )
    caption = models.CharField("คำบรรยาย", max_length=80, blank=True)
    sort_order = models.PositiveIntegerField("ลำดับ", default=0)
    is_active = models.BooleanField("แสดงบนเว็บ", default=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "รูปขนม"
        verbose_name_plural = "รูปขนม"

    def __str__(self) -> str:
        return self.caption or (self.image or self.video).name

    def delete_files(self) -> None:
        """ลบไฟล์รูปและวิดีโอออกจากดิสก์ด้วย (Django ไม่ลบให้เอง)"""
        for f in (self.image, self.video):
            if f:
                f.delete(save=False)

    def as_payload(self) -> dict[str, object]:
        return {
            "id": self.pk,
            "image": self.image.url if self.image else "",
            "caption": self.caption,
            "video": self.video.url if self.video else "",
        }

    def clean(self) -> None:
        if not self.image and not self.video:
            raise ValidationError("ใส่รูปหรือวิดีโออย่างน้อยหนึ่งอย่าง")
        if self.video and self.video.size > 20 * 1024 * 1024:
            raise ValidationError({"video": "วิดีโอใหญ่เกิน 20 MB ลองย่อไฟล์ก่อน"})
