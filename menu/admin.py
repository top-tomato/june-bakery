from django.contrib import admin

from menu.models import Product


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
