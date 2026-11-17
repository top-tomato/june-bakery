# Agent skills ของโปรเจกต์

คู่มือที่ Claude Code โหลดใช้ตอนเขียนหน้าบ้านด้วย React + TanStack คัดลอกมาจากต้นฉบับ อ่านทุกไฟล์แล้วเมื่อ 17 พ.ย. 2026
ในไฟล์มีแต่ Markdown กับตัวอย่างโค้ด ไม่มีสคริปต์ และไม่มีคำสั่งให้ไปดึงอะไรจากเว็บ

| โฟลเดอร์ | ต้นฉบับ | commit | License |
|---|---|---|---|
| `react-best-practices/` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/react-best-practices` | `1a2c79d` (2026-10-27) | MIT |
| `tanstack-router/` | [deckardger/tanstack-agent-skills](https://github.com/deckardger/tanstack-agent-skills) `skills/tanstack-router` | `b2fc14c` (2026-09-09) | MIT (`LICENSE-tanstack-agent-skills`) |
| `tanstack-query/` | เหมือนข้างบน `skills/tanstack-query` | `b2fc14c` | MIT |
| `tanstack-integration/` | เหมือนข้างบน `skills/tanstack-integration` | `b2fc14c` | MIT |
| `three-best-practices/` | [emalorenzo/three-agent-skills](https://github.com/emalorenzo/three-agent-skills) `skills/three-best-practices` (กฎ three.js/WebGL ~120 ข้อ รวมจาก llms branch ของ three.js และบทความ Utsubo) | `f950f95` (2026-01-28) | MIT (ตาม `package.json` และ README ของ repo) |

ไม่ได้เอามา:
- `web-design-guidelines` (Vercel) สั่งให้ดึงกฎใหม่จากเว็บทุกครั้งที่ใช้ เนื้อหาเลยเปลี่ยนได้โดยไม่มีใครตรวจ
- skill เฉพาะ Next.js หรือ Vercel เพราะโปรเจกต์นี้ใช้ Django + Fly.io
- `r3f-best-practices` (React Three Fiber) เพราะฉาก 3D ของเราใช้ three.js ตรง ๆ ใน React ไม่ได้ใช้ R3F
- ไฟล์ `.zip` ที่แนบมากับ repo three-agent-skills

ถ้าจะอัปเดต ให้ดึงต้นฉบับมาใหม่ อ่าน diff ทุกไฟล์ก่อน แล้วค่อยแก้ commit ในตารางนี้
