from django.conf import settings
from django.urls import path

from menu import views

app_name = "menu"

urlpatterns = [
    path("api/menu/", views.api_menu, name="api-menu"),
    # หน้าของแอป React (TanStack Router จัดการเส้นทางต่อในเบราว์เซอร์) เพิ่มที่นี่เมื่อมีหน้าใหม่
    path("", views.app, name="index"),
    path("book/", views.app, name="book"),
]

if settings.DEBUG:
    urlpatterns.append(path("phone-preview/", views.phone_preview, name="phone-preview"))
