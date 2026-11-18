# June Bakery

เว็บโชว์เมนูของร้าน June Bakery ลูกค้าเข้ามาดูขนม (มีโมเดล 3D หมุนดูได้) แล้วกดไปคุยและสั่งกับร้านทาง LINE Official Account `@561hgrea` เว็บนี้ยังไม่รับออเดอร์และไม่รับชำระเงินเอง

## สิ่งที่มีในเว็บ

- **หน้าเมนู** (`/`): ขนมแต่ละเมนูพร้อมโมเดล 3D ถ้าเมนูไหนไม่มีโมเดลหรือเครื่องลูกค้าเปิด 3D ไม่ได้ จะแสดงรูปถ่ายแทน มีแผนที่หน้าร้านและช่องทางติดต่อ
- **สมุดเมนู** (`/book/`): สมุดสันห่วงพลิกหน้าได้ มือถือแสดงทีละหน้า จอกว้างกางสองหน้า
- **Gallery** (`/gallery/`): รูปและวิดีโอทั้งหมดจากหน้าอัปโหลดของ staff เป็นหน้าสแครปบุ๊กยาว เปิดด้วยม่านโลโก้ แตะรูปดูเต็มจอ หน้าแรกโชว์ 6 รูปแรกพร้อมปุ่ม "ดูทั้งหมด"
- **API** (`/api/menu/`): ข้อมูลเมนู ลิงก์ LINE และที่อยู่ร้าน เป็น JSON
- **รูปปกตอนแปะลิงก์** (og:image 1200×630): หน้าแรกเป็นรูปขนมเต็มกรอบ + โลโก้และคำโปรย (รูปเลือกได้ที่ หลังร้าน → ข้อมูลร้าน ว่าง = รูปขนมชิ้นแรก) หน้า Gallery เป็นรูป 8 รูปแรกเรียงกัน เซิร์ฟเวอร์สร้างเองใน `media/og/` (`menu/og.py`) ตัวหนังสือเป็น PNG ทำไว้ล่วงหน้าจาก `menu/assets/og/source.html` แก้ไฟล์นั้นแล้วรัน `cd frontend && npm run og:layers` และเพิ่ม `VERSION` ใน `menu/og.py`
- **ปุ่มและ QR code ไป LINE**: สร้างจากค่า `LINE_OA_ID` เปลี่ยน ID แล้ว QR เปลี่ยนตาม
- **หลังบ้าน** (`/admin/`): เพิ่ม แก้ ซ่อน และเรียงลำดับขนม

## เทคโนโลยี

- Python 3.12+ และ Django 5.2 จัดการ package ด้วย [uv](https://docs.astral.sh/uv/)
- ฐานข้อมูล SQLite
- หน้าบ้าน: React 19 + TypeScript + TanStack Router (หน้าและลิงก์) + TanStack Query (ข้อมูลจาก API) build ด้วย Vite อยู่ในโฟลเดอร์ `frontend/`
- three.js แสดงโมเดล `.glb` (แยกเป็นไฟล์ที่โหลดทีหลัง หน้าเว็บไม่ต้องรอ) และ WebGL เขียนเองสำหรับม่านครีมกับหยดครีม
- Django ทำหน้าที่ API และหน้าเปล่าที่โหลดแอป React (ฝังข้อมูลเมนูไว้ในหน้าให้เลย หน้าแรกไม่ต้องเรียก API ซ้ำ)
- ใช้งานจริงด้วย gunicorn + WhiteNoise ใน Docker

## โครงสร้าง

```
config/            การตั้งค่าโปรเจกต์ (settings, urls)
menu/              app หลัก: ตาราง Product, admin, API, เทสต์
  templates/menu/  app.html (หน้าเปล่าของแอป React), phone_preview.html
  templatetags/vite.py  ใส่ไฟล์ JS/CSS ที่ Vite build ลงในหน้า
frontend/          แอป React + TanStack (Vite)
  src/routes/      หน้าเว็บ (TanStack Router แบบไฟล์) index.tsx, book.tsx
  src/features/    โค้ดของแต่ละหน้า home/ (ฉาก 3D, ม่านครีม, หยดครีม, ส่วนต่าง ๆ) book/
  src/api/menu.ts  type ของข้อมูล + query ของ TanStack Query
  src/lib/         ของใช้ร่วม: frame loop เดียวของทั้งหน้า, ความสูงจอแบบคงที่, WebGL helper
  e2e/             เทสต์ Playwright
.claude/skills/    คู่มือ React, TanStack และ three.js ให้ Claude Code ใช้ตอนเขียนโค้ด
  management/commands/seed_menu.py   คำสั่งใส่เมนูตั้งต้น
seed/              รูปและโมเดล 3D ของเมนูตั้งต้น
mock/              หน้าตัวอย่างที่ยังไม่ได้ลงโค้ดจริง (เช่น แชต LINE กับบอต)
line-assets/       รูปที่ใช้ใน LINE Official Account (โปรไฟล์, ภาพพื้นหลัง, rich menu)
Dockerfile, docker-entrypoint.sh, fly.toml   สำหรับ deploy
```

## เริ่มใช้งานในเครื่อง

ต้องมี Python 3.12+ กับ [uv](https://docs.astral.sh/uv/) และ Node 22+

```bash
uv sync
uv run python manage.py migrate
uv run python manage.py seed_menu          # ใส่เมนูตั้งต้น 2 รายการ
uv run python manage.py createsuperuser    # บัญชีเข้า /admin/
(cd frontend && npm ci && npm run build)   # build หน้าบ้านครั้งแรก
uv run python manage.py runserver
```

เปิด http://127.0.0.1:8000/ ส่วน http://127.0.0.1:8000/phone-preview/ แสดงหน้าเดียวกันในกรอบจอมือถือ (มีเฉพาะตอน debug)

**แก้หน้าบ้านแบบเห็นผลทันที (hot reload):** เปิดสองหน้าต่าง

```bash
cd frontend && npm run dev                                         # Vite ที่พอร์ต 5173
VITE_DEV_SERVER=http://localhost:5173 uv run python manage.py runserver   # Django โหลดโค้ดจาก Vite
```

**ทดสอบบนมือถือจริง:** รัน Django ที่ `0.0.0.0:8765` แล้วเปิด `http://<IP ของเครื่อง>:8765/` จากมือถือใน Wi-Fi เดียวกัน หน้าเว็บจะโชว์ตัววัด fps และส่งตัวเลขเข้า log ของ runserver (`GET /__dbg?...`) เอง สวิตช์อื่นใส่ต่อท้าย URL ได้ เช่น `?no3d`, `?lowres`, `?nodrips`, `?nomap`

รันเทสต์:

```bash
uv run python manage.py test                 # Django: API, หน้าเปล่า, tag ของ Vite
cd frontend && npm run typecheck && npm run lint
cd frontend && npm run build && npm run test:e2e   # Playwright (ใช้ Chrome ในเครื่อง) ต้องรัน Django ที่พอร์ต 8765 ก่อน
```

## เพิ่มหรือแก้ขนม

เข้า `/admin/` → ขนม → เพิ่ม

| ช่อง | ใช้ทำอะไร |
|---|---|
| ชื่อบรรทัดแรก / บรรทัดสอง | ชื่อเมนู แบ่งสองบรรทัดเพื่อจัดหัวข้อใหญ่บนเว็บ |
| คำบรรยาย, ราคาต่อชิ้น | แสดงใต้ชื่อ ในส่วนเล่าเรื่อง และในสมุดเมนู |
| รูปขนม | ใช้ในสมุดเมนู รูปตัวอย่างตอนแชร์ลิงก์ และแทนโมเดล 3D |
| โมเดล 3D (.glb) | ไม่บังคับ ควรย่อให้เหลือราว 4 MB ก่อนอัปโหลด |
| สีพื้นหลังประจำเมนู | รหัสสี `#RRGGBB` ของฉากเมนูนั้น |
| จุดเด่น 1–3 | ข้อความที่มีเส้นชี้บนตัวขนม |
| ลำดับ, แสดงบนเว็บ | เรียงและซ่อนเมนู |

**ข้อมูลอื่นที่แก้ได้ใน admin** ช่องไหนยังว่าง หน้าเว็บจะซ่อนส่วนนั้นไว้

| เมนูใน admin | ใช้ทำอะไร |
|---|---|
| ข้อมูลร้าน | สั่งล่วงหน้ากี่วัน เก็บได้นานแค่ไหน วิธีจ่ายเงิน (ขึ้นใต้ "วิธีสั่ง"), เวลาเปิด, เรื่องของร้าน + รูป |
| รีวิว | ข้อความรีวิวจากลูกค้า (ขออนุญาตลูกค้าก่อน) |
| รูปขนม | **ใช้หน้า `/admin/gallery-upload/` ง่ายกว่า** (staff ทุกคนเข้าได้ ลิงก์อยู่ที่หัว admin) รูปหรือวิดีโอสั้น (.mp4 ไม่เกิน 20 MB รูปเป็นภาพปก) ในส่วนรูปขนมบนหน้าแรก (6 อันแรก) และในหน้า `/gallery/` ทั้งหมด | รูปที่อัปโหลดได้ลายน้ำ (โลโก้ + ชื่อ IG จากข้อมูลร้าน) เอง เก็บต้นฉบับไว้

## หลังร้าน (staff)

เข้า `/admin/login/` แล้วจะมาที่ **หลังร้าน `/admin/shop/`**: สรุปร้าน, ออเดอร์ (ขายเลย / สั่งล่วงหน้า), รายจ่าย, ปฏิทินนัดรับและวันหยุดร้าน, Gallery, เมนูขนม, รีวิว, ข้อมูลร้าน บัญชีที่เป็น staff ใช้ได้ทุกหน้า ยกเว้น "บัญชี staff" กับ "ตั้งค่าเต็ม (Django)" ที่ให้เฉพาะเจ้าของ (superuser) ตัวเลขคนเข้าเว็บนับจากหน้าเว็บเอง (`/api/hit/`) ไม่นับตอนเปิดในเครื่องที่ localhost เว้นแต่ใส่ `?hits`

## ตัวแปรสภาพแวดล้อม

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `DJANGO_DEBUG` | `1` | `1` คือโหมดพัฒนา ตั้งเป็น `0` เมื่อใช้งานจริง |
| `DJANGO_SECRET_KEY` | มีค่าสำรองเฉพาะโหมดพัฒนา | บังคับตั้งเมื่อ `DJANGO_DEBUG=0` |
| `DJANGO_ALLOWED_HOSTS` | ว่าง | โดเมนที่อนุญาต คั่นด้วยจุลภาค |
| `DATA_DIR` | โฟลเดอร์โปรเจกต์ | ที่เก็บ `db.sqlite3` และ `media/` ตอนใช้งานจริงชี้ไปที่ดิสก์ถาวร |
| `LINE_OA_ID` | `@561hgrea` | ID ของ LINE Official Account รวม `@` |
| `VITE_DEV_SERVER` | ว่าง | ตอนพัฒนาหน้าบ้าน ตั้งเป็น `http://localhost:5173` เพื่อโหลดโค้ดจาก Vite แทนไฟล์ที่ build แล้ว |

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

> สถานะ ณ 17 พ.ย. 2026: เตรียมไฟล์ครบและทดสอบโหมดใช้งานจริงในเครื่องแล้ว แต่ยังไม่เคย deploy จริง

## LINE Official Account

ตั้งค่าใน [LINE Official Account Manager](https://manager.line.biz) ไม่ได้อยู่ในโค้ด

- เปิดแชต ร้านตอบลูกค้าเอง
- ข้อความทักทายตอนเพิ่มเพื่อน
- Rich menu 3 ปุ่ม: ดูเมนู, เว็บไซต์, คุยกับแอดมิน (ตอนนี้ทุกปุ่มส่งข้อความเข้าแชต ปุ่มเว็บไซต์จะเปลี่ยนเป็นลิงก์เมื่อเว็บขึ้นจริง)

แผนถัดไปคือบอตตอบเมนูและจำโปรไฟล์ลูกค้าจาก LINE (ลูกค้าสมัครผ่าน LINE เท่านั้น ไม่มีการสมัครบนเว็บ) ดูหน้าตัวอย่างที่ `mock/line-chat.html`

## วิธีทำงานกับ repo นี้

1. งานทุกชิ้นทำบน branch ใหม่ที่แตกจาก `main` ไม่ commit ลง `main` ตรง ๆ
2. ก่อนรวมเข้า `main` ต้องเพิ่มรายการใน [CHANGELOG.md](CHANGELOG.md) ใต้หัวข้อ `Unreleased`
3. เทสต์ต้องผ่านก่อนรวม
