"""รูปปกตอนแปะลิงก์เว็บใน LINE / Facebook (og:image, 1200x630) ตาม mock/og-card.html

- หน้าแรก (แบบ C): รูปขนมเต็มกรอบ เงาเข้มด้านซ้าย โลโก้ + "อบใหม่ หอม นุ่มนาน" สีขาว
  รูปมาจาก "รูปปกตอนแปะลิงก์" ใน ข้อมูลร้าน ถ้าว่างใช้รูปขนมชิ้นแรกในเมนู
- หน้า Gallery (แบบ D): รูปล่าสุด 8 รูปเรียงเต็มกรอบ ป้ายโลโก้ตรงกลาง เปลี่ยนตามรูปที่ staff อัปโหลด

ตัวหนังสือวาดไว้ล่วงหน้าเป็น PNG (menu/assets/og/, ทำจาก source.html ด้วย `npm run og:layers`) เพราะ Pillow บนเซิร์ฟเวอร์
วางสระ/วรรณยุกต์ไทยไม่ถูก ไฟล์การ์ดชื่อตามค่า hash ของรูปที่ใช้ เปลี่ยนรูปเมื่อไรได้ชื่อใหม่ (แอปแชตจะดึงรูปใหม่เอง)
และสร้างครั้งเดียวต่อชุดรูป
"""

import hashlib
import io
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db.models.fields.files import FieldFile
from PIL import Image, ImageDraw, ImageOps

ASSETS = Path(__file__).parent / "assets" / "og"
SIZE = (1200, 630)
VERSION = "1"  # bump when the layout or the text layers change, so every card is drawn again
CREAM = (255, 246, 230)


def _open(f: FieldFile) -> Image.Image:
    f.open("rb")
    try:
        return ImageOps.exif_transpose(Image.open(f)).convert("RGB")
    finally:
        f.close()


def _cover(im: Image.Image, size: tuple[int, int], y: float = 0.5) -> Image.Image:
    """Scale and crop to fill `size` (y = where to keep vertically, 0 top .. 1 bottom)."""
    return ImageOps.fit(im, size, Image.LANCZOS, centering=(0.5, y))


def _left_shade() -> Image.Image:
    """Dark green fading to clear: 0.82 at the left edge, 0.55 at 42%, 0 at 70% (mock C)."""
    w, h = SIZE
    row = []
    for x in range(w):
        t = x / w
        a = 0.82 + (0.55 - 0.82) * t / 0.42 if t < 0.42 else max(0.0, 0.55 * (1 - (t - 0.42) / 0.28))
        row.append(int(a * 255))
    alpha = Image.new("L", (w, 1))
    alpha.putdata(row)
    shade = Image.new("RGBA", SIZE, (20, 32, 30, 0))
    shade.putalpha(alpha.resize(SIZE))
    return shade


def home_card(photo: Image.Image) -> bytes:
    card = _cover(photo, SIZE, 0.6).convert("RGBA")
    card.alpha_composite(_left_shade())
    card.alpha_composite(Image.open(ASSETS / "home-text.png").convert("RGBA"))
    return _jpeg(card)


def gallery_card(photos: list[Image.Image]) -> bytes:
    card = Image.new("RGBA", SIZE, CREAM + (255,))
    gap, cols, rows = 10, 4, 2
    cw, ch = (SIZE[0] - gap * (cols + 1)) // cols, (SIZE[1] - gap * (rows + 1)) // rows
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, ch - 1), 18, fill=255)
    for i in range(cols * rows):
        tile = _cover(photos[i % len(photos)], (cw, ch))
        x, y = gap + (i % cols) * (cw + gap), gap + (i // cols) * (ch + gap)
        card.paste(tile, (x, y), mask)
    badge = Image.open(ASSETS / "gallery-badge.png").convert("RGBA")
    card.alpha_composite(badge, ((SIZE[0] - badge.width) // 2, (SIZE[1] - badge.height) // 2))
    return _jpeg(card)


def _jpeg(card: Image.Image) -> bytes:
    out = io.BytesIO()
    card.convert("RGB").save(out, "JPEG", quality=86, optimize=True, progressive=True)
    return out.getvalue()


def _stored(kind: str, files: list[FieldFile], draw) -> str:  # noqa: ANN001
    """URL of the card for these source files, drawing it the first time."""
    key = hashlib.sha1("|".join([VERSION, kind, *(f.name for f in files)]).encode()).hexdigest()[:12]
    name = f"og/{kind}-{key}.jpg"
    if not default_storage.exists(name):
        try:
            data = draw([_open(f) for f in files])
        except (OSError, ValueError):  # a source file is missing on disk: no card rather than a broken page
            return ""
        _, old = default_storage.listdir("og") if default_storage.exists("og") else ([], [])
        for o in old:  # drop this page's earlier cards
            if o.startswith(f"{kind}-"):
                default_storage.delete(f"og/{o}")
        default_storage.save(name, ContentFile(data))
    return default_storage.url(name)


def home_image_url() -> str:
    from menu.models import Product, ShopInfo

    photo = ShopInfo.load().share_photo
    if not photo:
        product = Product.objects.filter(is_active=True).exclude(image="").first()
        photo = product.image if product else None
    return _stored("home", [photo], lambda ims: home_card(ims[0])) if photo else ""


def gallery_image_url() -> str:
    from menu.models import GalleryPhoto

    files = [(g.original or g.image) for g in GalleryPhoto.objects.filter(is_active=True).exclude(image="")[:8]]
    return _stored("gallery", files, gallery_card) if files else home_image_url()
