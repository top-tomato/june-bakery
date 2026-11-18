"""หลังร้าน /admin/shop/ (mock/admin.html): สรุปร้าน ออเดอร์ รายจ่าย ปฏิทิน เมนูขนม รีวิว ข้อมูลร้าน บัญชี staff

ทุกหน้าใช้ได้กับบัญชี staff (ไม่ต้องตั้งสิทธิ์รายตาราง) ยกเว้นบัญชี staff ที่ให้เฉพาะเจ้าของ (superuser)
ฟอร์มเป็น POST ธรรมดาแล้วกลับหน้าเดิม ตัวกรองเป็นลิงก์ GET ใช้ได้แม้ JavaScript ไม่ทำงาน
"""

import calendar as pycal
from datetime import date, datetime, time, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from django import forms
from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth.forms import UserCreationForm
from django.db.models import F, Q, QuerySet, Sum
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.html import format_html
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.safestring import SafeString, mark_safe
from django.views.decorators.http import require_POST

from menu.models import ClosedDay, DailyStat, Expense, Order, Product, Review, ShopInfo

TH_DAYS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."]
TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
TH_MONTHS_LONG = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"]
SOURCE_NAMES = {"line": "LINE", "richmenu": "Rich menu", "instagram": "Instagram", "facebook": "Facebook", "tiktok": "TikTok", "google": "Google", "direct": "เข้าตรง", "other": "อื่น ๆ"}


def th_date(d: date, weekday: bool = True) -> str:
    return f"{TH_DAYS[d.weekday()] + ' ' if weekday else ''}{d.day} {TH_MONTHS[d.month - 1]}"


def day_start(d: date) -> datetime:
    return timezone.make_aware(datetime.combine(d, time.min))


def money(qs: "QuerySet[Order]") -> int:
    return int(qs.aggregate(v=Sum(F("qty") * F("unit_price")))["v"] or 0)


def pieces(qs: "QuerySet[Order]") -> int:
    return int(qs.aggregate(v=Sum("qty"))["v"] or 0)


def back(request: HttpRequest, default: str) -> HttpResponseRedirect:
    """Return to the page the form was sent from (only our own pages)."""
    nxt = request.POST.get("next") or request.GET.get("next") or ""
    if nxt and url_has_allowed_host_and_scheme(nxt, allowed_hosts={request.get_host()}) and nxt.startswith("/admin/"):
        return HttpResponseRedirect(nxt)
    return redirect(default)


def base_context(request: HttpRequest, active: str, title: str) -> dict[str, Any]:
    today = timezone.localdate()
    return {
        "active": active,
        "title": title,
        "today": today,
        "today_orders": Order.objects.filter(created_at__gte=day_start(today)).count(),
        "upcoming": Order.objects.filter(kind="pre", pickup_at__gte=day_start(today)).count(),
        "products": Product.objects.filter(is_active=True),
        "is_owner": request.user.is_superuser,
    }


# ---------------------------------------------------------------- summary


def _bars(values: list[int], labels: list[date], fmt: str, color: str, height: int, unit: str) -> SafeString:
    """A 30-day bar chart as inline SVG: thin bars rounded at the top, a recessive grid, a <title> per bar."""
    w, left, top = 360, 40, 10
    base = height - 22
    top_v = max(values) if values and max(values) > 0 else 1
    step = 1000 if unit == "baht" else (50 if top_v > 50 else 10)
    nice = max(step, -(-top_v // step) * step)
    bw = (w - left - 6) / max(1, len(values))
    parts: list[str] = []
    for k in range(3):
        v = nice * k / 2
        y = base - (base - top) * k / 2
        label = f"{v / 1000:g}k" if unit == "baht" else f"{v:g}"
        parts.append(f'<line x1="{left}" x2="{w}" y1="{y}" y2="{y}" stroke="var(--grid)"/><text x="{left - 6}" y="{y + 4}" text-anchor="end">{label}</text>')
    for i, v in enumerate(values):
        h = (base - top) * v / nice
        x = left + i * bw + 1
        bwid = bw - 2
        y = base - h
        r = min(4, bwid / 2, h)
        tip = fmt.format(d=th_date(labels[i], weekday=False), v=f"{v:,}")
        path = f"M{x},{base}V{y + r}Q{x},{y} {x + r},{y}H{x + bwid - r}Q{x + bwid},{y} {x + bwid},{y + r}V{base}Z" if h > 0 else ""
        parts.append(
            f'<g data-tip="{tip}"><rect x="{left + i * bw}" y="{top}" width="{bw}" height="{base - top}" fill="transparent"/>'
            + (f'<path d="{path}" fill="{color}" opacity="{1 if i == len(values) - 1 else 0.8}"/>' if path else "")
            + f"<title>{tip}</title></g>"
        )
    for i in (0, len(values) // 2, len(values) - 1):
        anchor = "end" if i == len(values) - 1 else "middle"
        x = w if i == len(values) - 1 else left + i * bw + bw / 2
        parts.append(f'<text x="{x}" y="{height - 6}" text-anchor="{anchor}">{labels[i].day}/{labels[i].month}</text>')
    return mark_safe(f'<svg class="chart" viewBox="0 0 {w} {height}" role="img">{"".join(parts)}</svg>')  # numbers and our own text only


def _change(cur: int, prev: int | None) -> SafeString | str:
    if not prev:
        return ""
    p = round((cur - prev) / prev * 100)
    return format_html('<b class="{}">{} {}%</b> จากช่วงก่อน', "up" if p >= 0 else "down", "▲" if p >= 0 else "▼", abs(p))


@staff_member_required
def summary(request: HttpRequest) -> HttpResponse:
    today = timezone.localdate()
    r = request.GET.get("r", "1")
    days = {"1": 1, "7": 7, "30": 30}.get(r, 1)
    start = today - timedelta(days=days - 1)
    cur = Order.objects.filter(created_at__gte=day_start(start))
    prev = Order.objects.filter(created_at__gte=day_start(start - timedelta(days=days)), created_at__lt=day_start(start)) if days < 30 else None
    stats = DailyStat.objects.filter(date__gte=start)
    prev_stats = DailyStat.objects.filter(date__gte=start - timedelta(days=days), date__lt=start) if days < 30 else None
    visits = int(stats.filter(kind="visit").aggregate(v=Sum("count"))["v"] or 0)
    taps = int(stats.filter(kind="tap").aggregate(v=Sum("count"))["v"] or 0)
    sales = money(cur)

    month_start = today.replace(day=1)
    income = money(Order.objects.filter(created_at__gte=day_start(month_start)))
    out = Expense.objects.filter(date__gte=month_start).aggregate(v=Sum("amount"))["v"] or Decimal(0)

    span = [today - timedelta(days=29 - i) for i in range(30)]
    by_day_sales = {d: 0 for d in span}
    for o in Order.objects.filter(created_at__gte=day_start(span[0])).only("created_at", "qty", "unit_price"):
        by_day_sales[timezone.localtime(o.created_at).date()] = by_day_sales.get(timezone.localtime(o.created_at).date(), 0) + o.total
    by_day_visits = {d: 0 for d in span}
    for s in DailyStat.objects.filter(kind="visit", date__gte=span[0]):
        by_day_visits[s.date] = by_day_visits.get(s.date, 0) + s.count

    sources = {}
    for s in stats.filter(kind="visit"):
        sources[s.source] = sources.get(s.source, 0) + s.count
    src_rows = sorted(((SOURCE_NAMES.get(k, k), v) for k, v in sources.items()), key=lambda x: -x[1])
    src_max = max([v for _, v in src_rows], default=1)

    funnel = [("เข้าเว็บ", visits), ("กดสั่งทาง LINE", taps), ("ออเดอร์ที่บันทึก", cur.count())]
    f_max = max([n for _, n in funnel] + [1])

    tomorrow = today + timedelta(days=1)
    pre = Order.objects.filter(kind="pre")
    recent_orders = list(Order.objects.all()[:5])
    recent_exp = list(Expense.objects.all()[:3])
    ctx = base_context(request, "summary", "สรุปร้าน") | {
        "r": str(days),
        "range_label": {1: "วันนี้", 7: "7 วัน", 30: "เดือนนี้"}[days],
        "sales": sales,
        "sales_change": _change(sales, money(prev) if prev is not None else None),
        "orders_n": cur.count(),
        "pcs": pieces(cur),
        "visits": visits,
        "visits_change": _change(visits, int(prev_stats.filter(kind="visit").aggregate(v=Sum("count"))["v"] or 0) if prev_stats is not None else None),
        "taps": taps,
        "tap_rate": round(taps / visits * 100) if visits else 0,
        "income": income,
        "out": out,
        "profit": Decimal(income) - out,
        "sales_chart": _bars([by_day_sales[d] for d in span], span, "{d} · ฿{v}", "var(--bar)", 170, "baht"),
        "visit_chart": _bars([by_day_visits[d] for d in span], span, "{d} · {v} คน", "var(--bar2)", 150, "people"),
        "funnel": [(k, n, n / f_max * 100) for k, n in funnel],
        "sources": [(k, n, n / src_max * 100) for k, n in src_rows],
        "pick_today": pre.filter(pickup_at__date=today).order_by("pickup_at"),
        "pick_tomorrow": pre.filter(pickup_at__date=tomorrow).order_by("pickup_at"),
        "recent_orders": recent_orders,
        "recent_exp": recent_exp,
    }
    ctx["tomorrow_pcs"] = pieces(ctx["pick_tomorrow"])
    return render(request, "backoffice/summary.html", ctx)


# ---------------------------------------------------------------- orders


@staff_member_required
def orders(request: HttpRequest) -> HttpResponse:
    today = timezone.localdate()
    f = {"r": request.GET.get("r", "1"), "kind": request.GET.get("kind", "all"), "via": request.GET.get("via", "all"), "q": request.GET.get("q", "").strip()}
    days = {"1": 1, "7": 7, "30": 30}.get(f["r"], 1)
    qs = Order.objects.filter(created_at__gte=day_start(today - timedelta(days=days - 1)))
    if f["kind"] in ("now", "pre"):
        qs = qs.filter(kind=f["kind"])
    if f["via"] in dict(Order.CHANNELS):
        qs = qs.filter(channel=f["via"])
    if f["q"]:
        qs = qs.filter(Q(who__icontains=f["q"]) | Q(note__icontains=f["q"]))

    def link(**change: str) -> str:
        from urllib.parse import urlencode

        return "?" + urlencode({k: v for k, v in (f | change).items() if v and v != "all"})

    groups = {
        "r": [(v, label, link(r=v)) for v, label in (("1", "วันนี้"), ("7", "7 วัน"), ("30", "เดือนนี้"))],
        "kind": [(v, label, link(kind=v)) for v, label in (("all", "ทุกแบบ"), ("now", "ขายเลย"), ("pre", "สั่งล่วงหน้า"))],
        "via": [(v, label, link(via=v)) for v, label in [("all", "ทุกช่องทาง"), *Order.CHANNELS]],
    }
    active_chips = []
    if f["kind"] != "all":
        active_chips.append((dict(Order.KINDS).get(f["kind"], ""), link(kind="all")))
    if f["via"] != "all":
        active_chips.append((dict(Order.CHANNELS).get(f["via"], ""), link(via="all")))
    ctx = base_context(request, "orders", "ออเดอร์") | {
        "f": f,
        "days": days,
        "groups": groups,
        "active_chips": active_chips,
        "orders": qs,
        "n": qs.count(),
        "pcs": pieces(qs),
        "total": money(qs),
    }
    return render(request, "backoffice/orders.html", ctx)


@staff_member_required
@require_POST
def order_add(request: HttpRequest) -> HttpResponse:
    p = request.POST
    product = Product.objects.filter(pk=p.get("product")).first() or Product.objects.filter(is_active=True).first()
    try:
        qty = max(1, int(p.get("qty", "1")))
    except ValueError:
        qty = 1
    o = Order(
        kind="pre" if p.get("kind") == "pre" else "now",
        product=product,
        product_name=product.full_name if product else (p.get("product_name") or "ขนม"),
        qty=qty,
        unit_price=0,
        channel=p.get("channel") if p.get("channel") in dict(Order.CHANNELS) else "line",
        payment=p.get("payment") if p.get("payment") in dict(Order.PAYMENTS) else "transfer",
        who=(p.get("who") or "").strip()[:120],
        note=(p.get("note") or "").strip()[:160],
        created_by=request.user,  # type: ignore[misc]
    )
    # the price typed in the form (prefilled from the menu; the menu may have none yet: "สอบถามราคา")
    try:
        o.unit_price = int(str(p.get("unit_price", "")).replace(",", "").split(".")[0])
    except ValueError:
        o.unit_price = product.price if product and product.price is not None else -1
    if o.unit_price < 0:
        messages.error(request, "ใส่ราคาต่อชิ้นก่อน")
        return back(request, "backoffice:orders")
    if o.kind == "pre":
        try:
            d = date.fromisoformat(p.get("pickup_date", ""))
            t = time.fromisoformat(p.get("pickup_time") or "10:00")
            o.pickup_at = timezone.make_aware(datetime.combine(d, t))
        except ValueError:
            o.pickup_at = None
        if o.pickup_at and ClosedDay.objects.filter(date=o.pickup_at.date()).exists():
            messages.error(request, "วันนั้นร้านหยุด เลือกวันอื่นนะ")
            return back(request, "backoffice:orders")
    try:
        o.full_clean(exclude=["product", "created_by"])
    except Exception as e:  # ValidationError: show the first message
        msgs = getattr(e, "messages", None) or [str(e)]
        messages.error(request, msgs[0])
        return back(request, "backoffice:orders")
    o.save()
    messages.success(request, "บันทึกนัดรับแล้ว" if o.kind == "pre" else "บันทึกออเดอร์แล้ว")
    return back(request, "backoffice:orders")


@staff_member_required
@require_POST
def order_delete(request: HttpRequest, pk: int) -> HttpResponse:
    get_object_or_404(Order, pk=pk).delete()
    messages.success(request, "ลบออเดอร์แล้ว")
    return back(request, "backoffice:orders")


# ---------------------------------------------------------------- expenses


@staff_member_required
def expenses(request: HttpRequest) -> HttpResponse:
    today = timezone.localdate()
    which = request.GET.get("m", "this")
    first = today.replace(day=1)
    if which == "last":
        first = (first - timedelta(days=1)).replace(day=1)
    last = first.replace(day=pycal.monthrange(first.year, first.month)[1])
    qs = Expense.objects.filter(date__gte=first, date__lte=last)
    ctx = base_context(request, "expenses", "รายจ่าย") | {
        "which": which,
        "expenses": qs,
        "total": qs.aggregate(v=Sum("amount"))["v"] or 0,
        "month_label": f"{TH_MONTHS_LONG[first.month - 1]} {first.year + 543}",
    }
    return render(request, "backoffice/expenses.html", ctx)


@staff_member_required
@require_POST
def expense_add(request: HttpRequest) -> HttpResponse:
    try:
        amount = Decimal(request.POST.get("amount", "").replace(",", ""))
    except InvalidOperation:
        amount = Decimal(0)
    if amount <= 0:
        messages.error(request, "ใส่จำนวนเงินก่อน")
        return back(request, "backoffice:expenses")
    try:
        d = date.fromisoformat(request.POST.get("date", "")) if request.POST.get("date") else timezone.localdate()
    except ValueError:
        d = timezone.localdate()
    cat = request.POST.get("category")
    Expense.objects.create(
        date=d,
        category=cat if cat in dict(Expense.CATEGORIES) else "other",
        amount=amount,
        note=(request.POST.get("note") or "").strip()[:160],
        created_by=request.user,  # type: ignore[misc]
    )
    messages.success(request, "บันทึกรายจ่ายแล้ว")
    return back(request, "backoffice:expenses")


@staff_member_required
@require_POST
def expense_delete(request: HttpRequest, pk: int) -> HttpResponse:
    get_object_or_404(Expense, pk=pk).delete()
    messages.success(request, "ลบรายจ่ายแล้ว")
    return back(request, "backoffice:expenses")


# ---------------------------------------------------------------- calendar


@staff_member_required
def calendar(request: HttpRequest) -> HttpResponse:
    today = timezone.localdate()
    try:
        sel = date.fromisoformat(request.GET.get("d", "")) if request.GET.get("d") else today
    except ValueError:
        sel = today
    try:
        y, m = (int(x) for x in request.GET.get("m", "").split("-"))
        month = date(y, m, 1)
    except ValueError:
        month = sel.replace(day=1)
    # Sunday-first grid of 6 weeks
    start = month - timedelta(days=(month.weekday() + 1) % 7)
    cells = [start + timedelta(days=i) for i in range(42)]
    pre = Order.objects.filter(kind="pre", pickup_at__gte=day_start(cells[0]), pickup_at__lt=day_start(cells[-1] + timedelta(days=1)))
    counts: dict[date, int] = {}
    for o in pre:
        d = timezone.localtime(o.pickup_at).date()  # type: ignore[arg-type]
        counts[d] = counts.get(d, 0) + 1
    closed = set(ClosedDay.objects.filter(date__gte=cells[0], date__lte=cells[-1]).values_list("date", flat=True))
    prev_m = (month - timedelta(days=1)).replace(day=1)
    next_m = (month + timedelta(days=32)).replace(day=1)
    ctx = base_context(request, "calendar", "ปฏิทิน") | {
        "month_label": f"{TH_MONTHS_LONG[month.month - 1]} {month.year + 543}",
        "prev_m": prev_m.strftime("%Y-%m"),
        "next_m": next_m.strftime("%Y-%m"),
        "m": month.strftime("%Y-%m"),
        "cells": [
            {"d": d, "iso": d.isoformat(), "out": d.month != month.month, "today": d == today, "sel": d == sel, "closed": d in closed, "n": counts.get(d, 0)}
            for d in cells
        ],
        "sel": sel,
        "sel_label": f"{['วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์', 'วันอาทิตย์'][sel.weekday()]}ที่ {sel.day} {TH_MONTHS_LONG[sel.month - 1]}",
        "sel_closed": sel in closed or ClosedDay.objects.filter(date=sel).exists(),
        "sel_orders": Order.objects.filter(kind="pre", pickup_at__date=sel).order_by("pickup_at"),
    }
    return render(request, "backoffice/calendar.html", ctx)


@staff_member_required
@require_POST
def closed_toggle(request: HttpRequest) -> HttpResponse:
    try:
        d = date.fromisoformat(request.POST.get("date", ""))
    except ValueError:
        return back(request, "backoffice:calendar")
    row = ClosedDay.objects.filter(date=d).first()
    if row:
        row.delete()
        messages.success(request, f"{th_date(d)} เปิดร้านตามปกติ")
    else:
        ClosedDay.objects.create(date=d)
        messages.success(request, f"{th_date(d)} ตั้งเป็นวันหยุดแล้ว (ขึ้นบนหน้าเว็บด้วย)")
    return back(request, "backoffice:calendar")


# ---------------------------------------------------------------- menu, reviews, shop info


class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ["name_line1", "name_line2", "price", "description", "highlight_1", "highlight_2", "highlight_3", "is_active"]


@staff_member_required
def menu(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        product = get_object_or_404(Product, pk=request.POST.get("id"))
        form = ProductForm(request.POST, instance=product, prefix=f"p{product.pk}")
        if form.is_valid():
            form.save()
            messages.success(request, f"บันทึก {product.full_name} แล้ว")
            return redirect("backoffice:menu")
        messages.error(request, "บันทึกไม่ได้ ตรวจช่องที่ขึ้นสีแดง")
    forms_ = [ProductForm(instance=p, prefix=f"p{p.pk}") for p in Product.objects.all()]
    return render(request, "backoffice/menu.html", base_context(request, "menu", "เมนูขนม") | {"forms": forms_})


@staff_member_required
def reviews(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        action = request.POST.get("action")
        if action == "add":
            text, author = (request.POST.get("text") or "").strip(), (request.POST.get("author") or "").strip()
            if text and author:
                Review.objects.create(text=text, author=author[:60])
                messages.success(request, "เพิ่มรีวิวแล้ว")
            else:
                messages.error(request, "ใส่ข้อความและชื่อลูกค้า")
        elif action in ("toggle", "delete"):
            rv = get_object_or_404(Review, pk=request.POST.get("id"))
            if action == "toggle":
                rv.is_active = not rv.is_active
                rv.save(update_fields=["is_active"])
                messages.success(request, "แสดงบนเว็บแล้ว" if rv.is_active else "ซ่อนแล้ว")
            else:
                rv.delete()
                messages.success(request, "ลบรีวิวแล้ว")
        return redirect("backoffice:reviews")
    return render(request, "backoffice/reviews.html", base_context(request, "reviews", "รีวิว") | {"reviews": Review.objects.all()})


class ShopForm(forms.ModelForm):
    class Meta:
        model = ShopInfo
        fields = ["preorder_days", "shelf_life", "payment", "delivery", "hours", "about_title", "about_text", "about_photo", "instagram_url", "facebook_url"]
        widgets = {"about_text": forms.Textarea(attrs={"rows": 4})}


@staff_member_required
def shop(request: HttpRequest) -> HttpResponse:
    info = ShopInfo.load()
    form = ShopForm(request.POST or None, request.FILES or None, instance=info)
    if request.method == "POST":
        if form.is_valid():
            form.save()
            messages.success(request, "บันทึกข้อมูลร้านแล้ว")
            return redirect("backoffice:shop")
        messages.error(request, "บันทึกไม่ได้ ตรวจช่องที่ขึ้นสีแดง")
    return render(request, "backoffice/shop.html", base_context(request, "shop", "ข้อมูลร้าน") | {"form": form})


# ---------------------------------------------------------------- staff accounts (owner only)


class StaffForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = get_user_model()
        fields = ("username",)


@staff_member_required
@user_passes_test(lambda u: u.is_superuser, login_url="/admin/login/")
def staff(request: HttpRequest) -> HttpResponse:
    User = get_user_model()
    form = StaffForm(request.POST or None) if request.POST.get("action") == "add" else StaffForm()
    if request.method == "POST":
        if request.POST.get("action") == "add":
            if form.is_valid():
                u = form.save(commit=False)
                u.is_staff = True
                u.save()
                messages.success(request, f"เพิ่ม staff {u.username} แล้ว")
                return redirect("backoffice:staff")
            messages.error(request, "เพิ่มไม่ได้ ตรวจช่องที่ขึ้นสีแดง")
        elif request.POST.get("action") == "toggle":
            u = get_object_or_404(User, pk=request.POST.get("id"), is_superuser=False)
            u.is_active = not u.is_active
            u.save(update_fields=["is_active"])
            messages.success(request, f"{u.username} {'ใช้งานได้' if u.is_active else 'ปิดการเข้าใช้แล้ว'}")
            return redirect("backoffice:staff")
    people = User.objects.filter(is_staff=True).order_by("-is_superuser", "username")
    return render(request, "backoffice/staff.html", base_context(request, "staff", "บัญชี staff") | {"people": people, "form": form})
