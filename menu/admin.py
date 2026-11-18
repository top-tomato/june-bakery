from django.contrib import admin
from django.http import HttpRequest

from menu.models import GalleryPhoto, Product, Review, ShopInfo


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("full_name", "price", "sort_order", "is_active")
    list_editable = ("price", "sort_order", "is_active")
    search_fields = ("name_line1", "name_line2")
    fieldsets = (
        (None, {"fields": ("name_line1", "name_line2", "description", "price")}),
        ("รูปและโมเดล", {"fields": ("image", "model_3d", "accent_color")}),
        ("จุดเด่น 3 จุดที่ชี้บนขนม", {"fields": ("highlight_1", "highlight_2", "highlight_3")}),
        ("การแสดงผล", {"fields": ("sort_order", "is_active")}),
    )


@admin.register(ShopInfo)
class ShopInfoAdmin(admin.ModelAdmin):
    """แถวเดียว: ช่องที่ว่าง หน้าเว็บจะซ่อนส่วนนั้นไว้"""

    fieldsets = (
        ("สั่งและรับ (ใต้ 'วิธีสั่ง')", {"fields": ("preorder_days", "shelf_life", "payment", "delivery", "hours")}),
        ("ตอนแปะลิงก์เว็บ", {"fields": ("share_photo",)}),
        ("เรื่องของร้าน (ซ่อนไว้จนกว่าจะใส่ข้อความ)", {"fields": ("about_title", "about_text", "about_photo")}),
        ("โซเชียล (ปุ่มท้ายหน้าเว็บ · ชื่อ IG ในลายน้ำรูป)", {"fields": ("instagram_url", "facebook_url")}),
    )

    def has_add_permission(self, request: HttpRequest) -> bool:
        return not ShopInfo.objects.exists()

    def has_delete_permission(self, request: HttpRequest, obj: object = None) -> bool:
        return False


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("author", "text", "sort_order", "is_active")
    list_editable = ("sort_order", "is_active")


@admin.register(GalleryPhoto)
class GalleryPhotoAdmin(admin.ModelAdmin):
    list_display = ("__str__", "has_video", "sort_order", "is_active")
    fields = ("image", "video", "caption", "sort_order", "is_active")

    def save_model(self, request, obj, form, change) -> None:  # type: ignore[no-untyped-def]
        # a photo replaced here becomes the new original and gets the watermark like an upload
        if "image" in form.changed_data and obj.image:
            if obj.original:
                obj.original.delete(save=False)
            obj.apply_watermark()
        super().save_model(request, obj, form, change)

    @admin.display(boolean=True, description="วิดีโอ")
    def has_video(self, obj: GalleryPhoto) -> bool:
        return bool(obj.video)
    list_editable = ("sort_order", "is_active")
