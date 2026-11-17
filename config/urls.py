from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from menu.media import serve_media

urlpatterns = [
    path("admin/", admin.site.urls),
    # รูป โมเดล 3D และวิดีโอที่อัปโหลดผ่าน admin เว็บนี้เล็กพอให้ Django ส่งไฟล์เองได้ ไม่ต้องมี web server แยก
    # (serve_media รองรับ Range ซึ่ง Safari บน iPhone ต้องใช้ตอนเล่นวิดีโอ)
    re_path(r"^media/(?P<path>.*)$", serve_media),
    path("", include("menu.urls")),
]
