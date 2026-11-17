from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    # รูปและโมเดล 3D ที่อัปโหลดผ่าน admin เว็บนี้เล็กพอให้ Django ส่งไฟล์เองได้ ไม่ต้องมี web server แยก
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    path("", include("menu.urls")),
]
