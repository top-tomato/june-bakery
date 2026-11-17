"""หน้าอัปโหลดรูปเข้า Gallery สำหรับ staff (mock/gallery-upload.html)

เลือกรูป/วิดีโอทีละหลายไฟล์จากมือถือหรือลากมาวาง แต่ละไฟล์ส่งแยกกัน (มีแถบโหลด) แล้วเรียงลำดับด้วยการลาก ซ่อน/แสดง
แก้คำบรรยาย ลบ ได้ในหน้าเดียว บัญชีที่เป็น staff เข้าได้ทุกคน (ไม่ต้องตั้งสิทธิ์รายตาราง)
"""

import io
import json
from pathlib import Path

from django.contrib.admin.views.decorators import staff_member_required
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_GET, require_POST
from PIL import Image, ImageOps, UnidentifiedImageError

from menu.models import GalleryPhoto

MAX_SIDE = 1600  # phone photos are 4000px+; nobody sees more than this on the site
MAX_VIDEO = 20 * 1024 * 1024
VIDEO_TYPES = {"video/mp4": ".mp4", "video/webm": ".webm"}


def _item(g: GalleryPhoto) -> dict[str, object]:
    return {**g.as_payload(), "active": g.is_active}


def _shrink(f: UploadedFile) -> ContentFile:
    """Turn the photo upright (EXIF), shrink to MAX_SIDE, save as JPEG. Raises ValidationError if it isn't an image."""
    try:
        im = Image.open(f)
        im = ImageOps.exif_transpose(im)
    except (UnidentifiedImageError, OSError) as e:
        raise ValidationError("ไฟล์นี้ไม่ใช่รูปที่เปิดได้ (ใช้ .jpg .png .webp)") from e
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    out = io.BytesIO()
    im.save(out, "JPEG", quality=85, optimize=True, progressive=True)
    return ContentFile(out.getvalue(), name=f"{Path(f.name or 'photo').stem[:40] or 'photo'}.jpg")


@staff_member_required
@require_GET
def page(request: HttpRequest) -> HttpResponse:
    from menu.backoffice import base_context

    items = [_item(g) for g in GalleryPhoto.objects.all()]
    return render(request, "menu/gallery_upload.html", base_context(request, "gallery", "Gallery") | {"items": items})


@staff_member_required
@require_POST
def upload(request: HttpRequest) -> JsonResponse:
    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"error": "ไม่มีไฟล์"}, status=400)
    caption = (request.POST.get("caption") or "").strip()[:80]
    g = GalleryPhoto(caption=caption, sort_order=(GalleryPhoto.objects.order_by("-sort_order").values_list("sort_order", flat=True).first() or 0) + 1)
    try:
        if (f.content_type or "") in VIDEO_TYPES or Path(f.name or "").suffix.lower() in (".mp4", ".webm"):
            if f.size and f.size > MAX_VIDEO:
                raise ValidationError("วิดีโอใหญ่เกิน 20 MB ลองตัดให้สั้นลงก่อน")
            ext = VIDEO_TYPES.get(f.content_type or "", Path(f.name or "").suffix.lower())
            if ext not in (".mp4", ".webm"):
                raise ValidationError("วิดีโอต้องเป็น .mp4")
            g.video.save(f"{Path(f.name or 'video').stem[:40] or 'video'}{ext}", f, save=False)
        else:
            g.image.save("photo.jpg", _shrink(f), save=False)
        g.full_clean()
    except ValidationError as e:
        g.delete_files()
        return JsonResponse({"error": " ".join(e.messages)}, status=400)
    g.save()
    return JsonResponse(_item(g))


@staff_member_required
@require_POST
def update(request: HttpRequest, pk: int) -> JsonResponse:
    g = get_object_or_404(GalleryPhoto, pk=pk)
    data = json.loads(request.body or "{}")
    if "caption" in data:
        g.caption = str(data["caption"]).strip()[:80]
    if "active" in data:
        g.is_active = bool(data["active"])
    g.save(update_fields=["caption", "is_active"])
    return JsonResponse(_item(g))


@staff_member_required
@require_POST
def delete(request: HttpRequest, pk: int) -> JsonResponse:
    g = get_object_or_404(GalleryPhoto, pk=pk)
    g.delete_files()
    g.delete()
    return JsonResponse({"ok": True})


@staff_member_required
@require_POST
def reorder(request: HttpRequest) -> JsonResponse:
    ids = [int(i) for i in json.loads(request.body or "{}").get("ids", [])]
    with transaction.atomic():
        for n, pk in enumerate(ids, 1):
            GalleryPhoto.objects.filter(pk=pk).update(sort_order=n)
    return JsonResponse({"ok": True})
