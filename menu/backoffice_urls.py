from django.urls import path

from menu import backoffice, qr

app_name = "backoffice"

urlpatterns = [
    path("", backoffice.summary, name="summary"),
    path("orders/", backoffice.orders, name="orders"),
    path("orders/add/", backoffice.order_add, name="order-add"),
    path("orders/<int:pk>/delete/", backoffice.order_delete, name="order-delete"),
    path("expenses/", backoffice.expenses, name="expenses"),
    path("expenses/add/", backoffice.expense_add, name="expense-add"),
    path("expenses/<int:pk>/delete/", backoffice.expense_delete, name="expense-delete"),
    path("calendar/", backoffice.calendar, name="calendar"),
    path("calendar/closed/", backoffice.closed_toggle, name="closed-toggle"),
    path("menu/", backoffice.menu, name="menu"),
    path("reviews/", backoffice.reviews, name="reviews"),
    path("shop/", backoffice.shop, name="shop"),
    path("promo/", backoffice.promo, name="promo"),
    path("staff/", backoffice.staff, name="staff"),
    path("qr/", qr.codes, name="qr"),
    path("qr/preview.svg", qr.preview, name="qr-preview"),
    path("qr/<int:pk>.<str:fmt>", qr.image, name="qr-image"),
    path("qr/<int:pk>/sheet/", qr.sticker_sheet, name="qr-sheet"),
]
