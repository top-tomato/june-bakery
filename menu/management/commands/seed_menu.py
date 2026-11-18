from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandParser

from menu.models import Product

SEED_DIR = Path(settings.BASE_DIR) / "seed"

PRODUCTS = [
    {
        "name_line1": "ชิฟฟ่อน",
        "name_line2": "มะพร้าวใบเตย",
        "description": "ชิฟฟ่อนใบเตยเนื้อนุ่ม หน้ามะพร้าวอ่อนอบสีทอง",
        "price": 120,
        "price_unit": "กล่อง 4 ชิ้น",
        "accent_color": "#C9DE98",
        "highlight_1": "มะพร้าวอ่อนเป็นเส้น",
        "highlight_2": "หน้าอบสีทอง",
        "highlight_3": "เนื้อชิฟฟ่อนใบเตย",
        "sort_order": 1,
        "image": "img/pandan.jpg",
        "model_3d": "model/pandan.glb",
    },
    {
        "name_line1": "ขนมปังกระเทียม",
        "name_line2": "ครีมชีส",
        "description": "ขนมปังกระเทียมอบร้อน ครีมชีสเยิ้มทุกแฉก",
        "price": 45,
        "accent_color": "#F3A18F",
        "highlight_1": "กระเทียมและพาร์สลีย์",
        "highlight_2": "ครีมชีสเยิ้มทุกแฉก",
        "highlight_3": "ขนมปังอบสีทอง",
        "sort_order": 2,
        "image": "img/garlic.jpg",
        "model_3d": "model/garlic.glb",
    },
]


class Command(BaseCommand):
    help = "ใส่เมนูเริ่มต้นสองรายการจากโฟลเดอร์ seed/ (ข้ามเมนูที่มีอยู่แล้ว)"

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--if-empty", action="store_true", help="ทำเฉพาะตอนที่ยังไม่มีขนมในระบบเลย")

    def handle(self, *args: object, **options: object) -> None:
        if options["if_empty"] and Product.objects.exists():
            self.stdout.write("มีขนมในระบบแล้ว ไม่ใส่เมนูเริ่มต้น")
            return
        for data in PRODUCTS:
            fields = dict(data)
            image_path = SEED_DIR / fields.pop("image")
            model_path = SEED_DIR / fields.pop("model_3d")
            if Product.objects.filter(name_line1=fields["name_line1"], name_line2=fields["name_line2"]).exists():
                self.stdout.write(f"มีอยู่แล้ว ข้าม: {fields['name_line1']}{fields['name_line2']}")
                continue
            product = Product(**fields)
            with image_path.open("rb") as image_file, model_path.open("rb") as model_file:
                product.image.save(image_path.name, File(image_file), save=False)
                product.model_3d.save(model_path.name, File(model_file), save=False)
                product.save()
            self.stdout.write(self.style.SUCCESS(f"เพิ่มแล้ว: {product}"))
