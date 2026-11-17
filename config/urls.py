from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from menu import gallery_upload
from menu.media import serve_media

urlpatterns = [
    # หน้าอัปโหลดรูป Gallery สำหรับ staff (ต้องอยู่ก่อน admin/ เพราะ admin จับทุกอย่างใต้ admin/)
    path("admin/gallery-upload/", gallery_upload.page, name="gallery-upload"),
    path("admin/gallery-upload/file/", gallery_upload.upload, name="gallery-upload-file"),
    path("admin/gallery-upload/<int:pk>/", gallery_upload.update, name="gallery-upload-update"),
    path("admin/gallery-upload/<int:pk>/delete/", gallery_upload.delete, name="gallery-upload-delete"),
    path("admin/gallery-upload/order/", gallery_upload.reorder, name="gallery-upload-order"),
    path("admin/shop/", include("menu.backoffice_urls")),  # หลังร้าน (staff)
    path("admin/", admin.site.urls),
    # รูป โมเดล 3D และวิดีโอที่อัปโหลดผ่าน admin เว็บนี้เล็กพอให้ Django ส่งไฟล์เองได้ ไม่ต้องมี web server แยก
    # (serve_media รองรับ Range ซึ่ง Safari บน iPhone ต้องใช้ตอนเล่นวิดีโอ)
    re_path(r"^media/(?P<path>.*)$", serve_media),
    path("", include("menu.urls")),
]
