from django.conf import settings
from django.urls import path

from menu import qr, stats, views

app_name = "menu"

urlpatterns = [
    path("api/menu/", views.api_menu, name="api-menu"),
    path("api/hit/", stats.hit, name="hit"),
    # หน้าของแอป React (TanStack Router จัดการเส้นทางต่อในเบราว์เซอร์) เพิ่มที่นี่เมื่อมีหน้าใหม่
    # QR บนกล่อง: ลิงก์สั้นที่นับยอดสแกน (menu/qr.py) และหน้าสำหรับคนที่ถือกล่อง
    path("q/<slug:slug>", qr.go, name="qr-go"),
    path("box", views.app, name="box"),  # React page (frontend/src/routes/box.tsx), same animations as the landing page
    path("", views.app, name="index"),
    path("book/", views.app, name="book"),
    path("gallery/", views.app, name="gallery"),
]

if settings.DEBUG:
    urlpatterns.append(path("phone-preview/", views.phone_preview, name="phone-preview"))
