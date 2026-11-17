# June Bakery

เว็บโชว์เมนูของร้าน June Bakery ลูกค้าเข้ามาดูขนม (มีโมเดล 3D หมุนดูได้) แล้วกดไปคุยและสั่งกับร้านทาง LINE Official Account `@561hgrea` เว็บนี้ยังไม่รับออเดอร์และไม่รับชำระเงินเอง

## สิ่งที่มีในเว็บ

- **หน้าเมนู** (`/`): ขนมแต่ละเมนูพร้อมโมเดล 3D ถ้าเมนูไหนไม่มีโมเดลหรือเครื่องลูกค้าเปิด 3D ไม่ได้ จะแสดงรูปถ่ายแทน
- **กล่อง 6 ชิ้น**: ลูกค้าเลือกขนมใส่กล่อง แล้วกดส่งรายการเข้าแชต LINE ของร้าน
- **ปุ่มและ QR code ไป LINE**: สร้างจากค่า `LINE_OA_ID` เปลี่ยน ID แล้ว QR เปลี่ยนตาม
- **หลังบ้าน** (`/admin/`): เพิ่ม แก้ ซ่อน และเรียงลำดับขนม

## เทคโนโลยี

- Python 3.12+ และ Django 5.2 จัดการ package ด้วย [uv](https://docs.astral.sh/uv/)
- ฐานข้อมูล SQLite
- หน้าเว็บเป็น HTML/CSS/JS ธรรมดาใน template เดียว ใช้ three.js (โหลดจาก CDN) แสดงโมเดล `.glb`
- ใช้งานจริงด้วย gunicorn + WhiteNoise ใน Docker

## โครงสร้าง

```
config/            การตั้งค่าโปรเจกต์ (settings, urls)
menu/              app หลัก: ตาราง Product, admin, view, template, เทสต์
  templates/menu/  index.html (หน้าเว็บ), empty.html, phone_preview.html
  management/commands/seed_menu.py   คำสั่งใส่เมนูตั้งต้น
seed/              รูปและโมเดล 3D ของเมนูตั้งต้น
mock/              หน้าตัวอย่างที่ยังไม่ได้ลงโค้ดจริง (เช่น แชต LINE กับบอต)
line-assets/       รูปที่ใช้ใน LINE Official Account (โปรไฟล์, ภาพพื้นหลัง, rich menu)
Dockerfile, docker-entrypoint.sh, fly.toml   สำหรับ deploy
```

## เริ่มใช้งานในเครื่อง

```bash
uv sync
uv run python manage.py migrate
uv run python manage.py seed_menu          # ใส่เมนูตั้งต้น 2 รายการ
uv run python manage.py createsuperuser    # บัญชีเข้า /admin/
uv run python manage.py runserver
```

เปิด http://127.0.0.1:8000/ ส่วน http://127.0.0.1:8000/phone-preview/ แสดงหน้าเดียวกันในกรอบจอมือถือ (มีเฉพาะตอน debug)

รันเทสต์:

```bash
uv run python manage.py test
```

## เพิ่มหรือแก้ขนม

เข้า `/admin/` → ขนม → เพิ่ม

| ช่อง | ใช้ทำอะไร |
|---|---|
| ชื่อบรรทัดแรก / บรรทัดสอง | ชื่อเมนู แบ่งสองบรรทัดเพื่อจัดหัวข้อใหญ่บนเว็บ |
| คำบรรยาย, ราคาต่อชิ้น | แสดงใต้ชื่อและในกล่อง 6 ชิ้น |
| รูปขนม | รูปสี่เหลี่ยมจัตุรัส ใช้ในกล่อง การ์ด และแทนโมเดล 3D |
| โมเดล 3D (.glb) | ไม่บังคับ ควรย่อให้เหลือราว 4 MB ก่อนอัปโหลด |
| สีพื้นหลังประจำเมนู | รหัสสี `#RRGGBB` ของฉากเมนูนั้น |
| จุดเด่น 1–3 | ข้อความที่มีเส้นชี้บนตัวขนม |
| ลำดับ, แสดงบนเว็บ | เรียงและซ่อนเมนู |

## ตัวแปรสภาพแวดล้อม

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `DJANGO_DEBUG` | `1` | `1` คือโหมดพัฒนา ตั้งเป็น `0` เมื่อใช้งานจริง |
| `DJANGO_SECRET_KEY` | มีค่าสำรองเฉพาะโหมดพัฒนา | บังคับตั้งเมื่อ `DJANGO_DEBUG=0` |
| `DJANGO_ALLOWED_HOSTS` | ว่าง | โดเมนที่อนุญาต คั่นด้วยจุลภาค |
| `DATA_DIR` | โฟลเดอร์โปรเจกต์ | ที่เก็บ `db.sqlite3` และ `media/` ตอนใช้งานจริงชี้ไปที่ดิสก์ถาวร |
| `LINE_OA_ID` | `@561hgrea` | ID ของ LINE Official Account รวม `@` |

## Deploy ขึ้น Fly.io

ตั้งค่าไว้ใน `fly.toml`: app ชื่อ `june-bakery` เครื่องที่สิงคโปร์ และดิสก์ถาวร `june_data` ต่อที่ `/data`

ครั้งแรก:

```bash
fly auth login
fly apps create june-bakery
fly volumes create june_data --region sin --size 1
fly secrets set DJANGO_SECRET_KEY="$(openssl rand -base64 48)"
fly deploy
fly ssh console -C "python manage.py createsuperuser"
```

ครั้งต่อไปใช้ `fly deploy` อย่างเดียว ตอนเครื่องเปิด `docker-entrypoint.sh` จะ migrate ฐานข้อมูลและใส่เมนูตั้งต้นให้เองถ้ายังไม่มีขนมในระบบ

ถ้าชื่อ app ซ้ำกับคนอื่น ให้เปลี่ยนทั้ง `app` และ `DJANGO_ALLOWED_HOSTS` ใน `fly.toml` ให้ตรงกัน

> สถานะ ณ 17 พ.ย. 2026: deploy แล้วที่ https://june-bakery.fly.dev/ (เครื่องเดียวที่สิงคโปร์ ดิสก์ `june_data` 1GB)
> ถ้าใช้ flyctl ที่ติดตั้งผ่าน `curl -L https://fly.io/install.sh | sh` ตัวโปรแกรมอยู่ที่ `~/.fly/bin/flyctl`

## LINE Official Account

ตั้งค่าใน [LINE Official Account Manager](https://manager.line.biz) ไม่ได้อยู่ในโค้ด

- เปิดแชต ร้านตอบลูกค้าเอง
- ข้อความทักทายตอนเพิ่มเพื่อน
- Rich menu 3 ปุ่ม: ดูเมนู, เว็บไซต์, คุยกับแอดมิน (ปุ่มเว็บไซต์เปิด https://june-bakery.fly.dev/ ปุ่มอื่นส่งข้อความเข้าแชต)

แผนถัดไปคือบอตตอบเมนูและจำโปรไฟล์ลูกค้าจาก LINE (ลูกค้าสมัครผ่าน LINE เท่านั้น ไม่มีการสมัครบนเว็บ) ดูหน้าตัวอย่างที่ `mock/line-chat.html`

## วิธีทำงานกับ repo นี้

1. งานทุกชิ้นทำบน branch ใหม่ที่แตกจาก `main` ไม่ commit ลง `main` ตรง ๆ
2. ก่อนรวมเข้า `main` ต้องเพิ่มรายการใน [CHANGELOG.md](CHANGELOG.md) ใต้หัวข้อ `Unreleased`
3. เทสต์ต้องผ่านก่อนรวม
