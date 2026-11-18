from django.db import migrations


def add(apps, schema_editor):
    # the QR on the box sticker (mock/box-qr.html B): june-bakery…/q/box → the page for people holding a box
    QrCode = apps.get_model("menu", "QrCode")
    QrCode.objects.get_or_create(slug="box", defaults={"name": "สติกเกอร์กล่อง", "target": "/box"})


class Migration(migrations.Migration):
    dependencies = [("menu", "0015_qr_codes")]
    operations = [migrations.RunPython(add, migrations.RunPython.noop)]
