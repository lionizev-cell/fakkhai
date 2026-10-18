# บอท Messenger เพจความลับพลังตัวเลข

บอทจะเงียบจนกว่าลูกค้าจะส่งเบอร์ 10 หลัก หรือพิมพ์ "เช็คเบอร์" แล้วจะถามเพศ วันเกิด เวลาเกิด จังหวัด อาชีพ ทีละข้อ แล้วตอบผลเบื้องต้น
คะแนนและคำอ่านมาจากสคริปต์ของเว็บ palangtuaylek.html โดยตรง (โหลดใหม่ทุก 6 ชั่วโมง) แก้เว็บเมื่อไร บอทตามทันเอง

ลูกค้าพิมพ์ "เจาะลึก" หรือคุณพิมพ์ตอบลูกค้าเองจากเพจ บอทจะหยุดกับลูกค้าคนนั้น 12 ชั่วโมง
ลูกค้าพิมพ์ "เริ่มใหม่" เพื่อล้างข้อมูลวันเกิด

## ขั้นตอนติดตั้ง (ทำจากมือถือได้)

1. GitHub: สร้าง repo ใหม่ชื่อ palang-bot แล้วอัปโหลดไฟล์ server.js engine.js package.json
2. render.com: สมัครด้วย GitHub, New > Web Service, เลือก repo palang-bot, Build Command เว้นว่าง, Start Command `node server.js`, แผน Free
3. Meta for Developers (developers.facebook.com): Create App > ประเภท Business > เพิ่ม Messenger
   - Messenger > Settings > Generate token ของเพจความลับพลังตัวเลข → คัดลอกเก็บไว้
   - App settings > Basic > App Secret → คัดลอกเก็บไว้
4. กลับไป Render > Environment ใส่
   - PAGE_ACCESS_TOKEN = token จากข้อ 3
   - APP_SECRET = App Secret จากข้อ 3
   - VERIFY_TOKEN = ตั้งเอง เช่น palang2569
5. Meta > Messenger > Webhooks
   - Callback URL: https://ชื่อแอป.onrender.com/webhook
   - Verify token: คำเดียวกับ VERIFY_TOKEN
   - Subscribe: messages, messaging_postbacks, message_echoes
6. ทดสอบ: ทักเพจจากบัญชีตัวเอง ส่งเบอร์ไป
7. เปิดให้ลูกค้าทั่วไปใช้: App Review ขอสิทธิ์ pages_messaging แล้วเปลี่ยนแอปเป็น Live

## หมายเหตุ
- Render แบบฟรีจะหลับเมื่อไม่มีคนใช้ 15 นาที ข้อความแรกหลังหลับอาจช้า 30-60 วินาที แก้ได้ด้วย uptimerobot.com ตั้งให้เรียก https://ชื่อแอป.onrender.com ทุก 10 นาที
- ข้อมูลที่ลูกค้ากรอกเก็บในหน่วยความจำ ถ้าเซิร์ฟเวอร์รีสตาร์ท ลูกค้าที่กรอกค้างอยู่ต้องเริ่มใหม่
- เปลี่ยนลิงก์ไลน์ได้ด้วยตัวแปร LINE_URL
