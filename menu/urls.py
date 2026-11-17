from django.conf import settings
from django.urls import path

from menu import views

app_name = "menu"

urlpatterns = [
    path("", views.index, name="index"),
]

if settings.DEBUG:
    urlpatterns.append(path("phone-preview/", views.phone_preview, name="phone-preview"))
