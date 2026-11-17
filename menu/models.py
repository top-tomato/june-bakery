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
