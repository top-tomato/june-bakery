"""ลายน้ำบนรูป Gallery (mock/watermark.html แบบ F): โลโก้ June ซ้ายบน + ชื่อ IG ขวาล่าง สีขาว ไม่มีกรอบ
มุมทั้งสองมีเงาเข้มจาง ๆ ไล่ออกไป ให้อ่านได้บนรูปสว่าง

ฝังลงในรูปที่หน้าเว็บใช้ (`GalleryPhoto.image`) โดยเก็บต้นฉบับไว้ที่ `GalleryPhoto.original` ชื่อ IG อ่านจากลิงก์ IG
ใน "ข้อมูลร้าน" (ว่าง = โลโก้อย่างเดียว) ร้านเปลี่ยนลิงก์เมื่อไร รูปทั้งหมดทำลายน้ำใหม่จากต้นฉบับ (ShopInfo.save)
"""

import io
from pathlib import Path
from urllib.parse import urlsplit

from django.core.files.base import ContentFile
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

LOGO = Path(__file__).parent / "assets" / "watermark-logo.png"  # the white logo (frontend/src/assets/logo.png)


def handle_from_url(url: str) -> str:
    """"https://www.instagram.com/june.bakery.dessert/" -> "@june.bakery.dessert" ("" when there's no page)."""
    first = urlsplit(url or "").path.strip("/").split("/")[0] if url else ""
    return f"@{first}" if first else ""


def _corner_shade(size: tuple[int, int], cx: float, cy: float, rx: float, ry: float, strength: int) -> Image.Image:
    """A soft dark ellipse fading out from a corner (alpha only)."""
    w, h = size
    small = (max(8, w // 8), max(8, h // 8))  # draw small, blur, scale up: smooth and fast
    m = Image.new("L", small, 0)
    d = ImageDraw.Draw(m)
    sx, sy = small[0] / w, small[1] / h
    for k in range(24, 0, -1):  # concentric ellipses, darker toward the corner
        f = k / 24
        a = int(strength * (1 - f) ** 1.6)
        d.ellipse(((cx - rx * f) * sx, (cy - ry * f) * sy, (cx + rx * f) * sx, (cy + ry * f) * sy), fill=a)
    return m.filter(ImageFilter.GaussianBlur(max(1, small[0] // 30))).resize(size, Image.BILINEAR)


# The site shows gallery photos cropped to these shapes (width / height; snaps.css): a square card, a tall 4:5 card.
# The marks go in the corners of the area every crop keeps, so a card never cuts them off.
CARD_SHAPES = (1.0, 0.8)


def safe_box(w: int, h: int) -> tuple[int, int, int, int]:
    bw, bh = w, h
    for a in CARD_SHAPES:
        cw, ch = (h * a, h) if w / h > a else (w, w / a)
        bw, bh = min(bw, cw), min(bh, ch)
    x0, y0 = (w - bw) / 2, (h - bh) / 2
    return int(x0), int(y0), int(x0 + bw), int(y0 + bh)


def apply(src: Image.Image, handle: str) -> Image.Image:
    im = ImageOps.exif_transpose(src).convert("RGB")
    w, h = im.size
    bx0, by0, bx1, by1 = safe_box(w, h)
    short = min(bx1 - bx0, by1 - by0)

    # 1. soft shade in the two corners
    bw, bh = bx1 - bx0, by1 - by0
    shade = _corner_shade((w, h), bx0, by0, bw * 0.46, bh * 0.30, 107)
    if handle:
        shade = _max(shade, _corner_shade((w, h), bx1, by1, bw * 0.60, bh * 0.22, 97))
    im = Image.composite(Image.new("RGB", (w, h), (0, 0, 0)), im, shade)

    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    # 2. white logo, top-left, with a soft shadow
    logo = Image.open(LOGO).convert("RGBA")
    lw = int(short * 0.22)
    logo = logo.resize((lw, int(lw * logo.height / logo.width)), Image.LANCZOS)
    white = Image.new("RGBA", logo.size, (255, 255, 255, 255))
    white.putalpha(logo.getchannel("A"))
    pad = int(short * 0.035)
    _with_shadow(layer, white, (bx0 + pad, by0 + pad), short)

    # 3. IG handle, bottom-right
    if handle:
        font = ImageFont.load_default(size=max(12, int(short * 0.036)))
        box = ImageDraw.Draw(layer).textbbox((0, 0), handle, font=font)
        tw, th = box[2] - box[0], box[3] - box[1]
        text = Image.new("RGBA", (tw + 4, th + 6), (0, 0, 0, 0))
        ImageDraw.Draw(text).text((2 - box[0], 3 - box[1]), handle, font=font, fill=(255, 255, 255, 255))
        _with_shadow(layer, text, (bx1 - pad - text.width, by1 - pad - text.height), short)

    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def _max(a: Image.Image, b: Image.Image) -> Image.Image:
    from PIL import ImageChops

    return ImageChops.lighter(a, b)


def _with_shadow(layer: Image.Image, mark: Image.Image, at: tuple[int, int], short: int) -> None:
    blur = max(1, short // 260)
    shadow = Image.new("RGBA", (mark.width + blur * 6, mark.height + blur * 6), (0, 0, 0, 0))
    a = mark.getchannel("A").point(lambda v: int(v * 0.5))
    shadow.paste((0, 0, 0, 255), (blur * 3, blur * 3 + max(1, short // 500)), a)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    layer.alpha_composite(shadow, (at[0] - blur * 3, at[1] - blur * 3))
    layer.alpha_composite(mark, at)


def render(original_file: object, handle: str) -> ContentFile:
    """Watermarked JPEG from an original image file."""
    with Image.open(original_file) as src:  # type: ignore[arg-type]
        out = apply(src, handle)
    buf = io.BytesIO()
    out.save(buf, "JPEG", quality=85, optimize=True, progressive=True)
    return ContentFile(buf.getvalue(), name="photo.jpg")
