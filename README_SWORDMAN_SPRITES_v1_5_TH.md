# เพิ่ม Swordman Sprite จากภาพผู้ใช้ (v1.5)

## ใช้กับเกมรุ่นไหน
ติดตั้ง **หลังจาก** `Borderlands_Classic_v1_5_USER_SPRITES_ONLY_CHANGED.zip` แล้วเท่านั้น แพตช์ Swordman นี้มีเฉพาะไฟล์ที่เปลี่ยนจากรุ่นนั้น: `js/game.js`, Sprite Atlas 19 ไฟล์, README และ Regression Tests; ไม่ใช่เกมเต็ม ไม่ใช่แพตช์สำหรับ v1.4.2 โดยตรง

## แหล่งภาพและขอบเขต
- ใช้ภาพ `PC _ Computer - Ragnarok Online - Classes (Male) - Swordsman.png` และภาพทรงผมชายเดิมจากไฟล์ที่ผู้ใช้อัปโหลด
- จัด Sprite Atlas `assets/sprites/swordman_ro_hair_00.png`–`18.png` จำนวน 19 แบบ ขนาด 1248×448: แถว Down/Left/Right/Up และคอลัมน์ Idle 0–1, Walk 2–5, Attack 6–8, Hit 9, Death 10–12
- เป็นการจับคู่เฟรมที่มีอยู่จาก Sprite Sheet เพื่อให้เข้ากับ Runtime เดิม บางมุมใช้ภาพใกล้เคียง; ไม่อ้างว่าเป็นแอนิเมชันแบบทางการ/ครบทุกมุม
- ปรับ Render จากภาพ Swordman ชั่วคราวเป็น Sprite ใหม่นี้; เลือกทรงผมใน Settings แล้วใช้ร่วมกันทั้ง Novice และ Swordman
- เมื่อเปลี่ยนอาชีพจาก Novice → Swordman ยังรักษาตัวเลือกทรงผมใน Save เดิม; ไม่แก้สูตรต่อสู้/EXP/Equipment/Divine Pride หรือคีย์เซฟ
- แพตช์นี้ไม่มีมอนสเตอร์ Ragnarok ต้นฉบับ; มอนสเตอร์ยังใช้ภาพสร้างใหม่ก่อนหน้า

## ตรวจสอบ
- `node tests/swordman_ro_sprite_v15.test.js` ตรวจทั้ง 19 atlas, ขนาดเฟรม, การเชื่อมใน game.js
- `python tests/user_sprite_browser_v15.py` ตรวจใน Chromium ผ่าน HTML/JS/PNG ที่ฝังข้อมูลไฟล์ในหน่วยความจำ ทดสอบ Novice → Swordman, ทรงผม, Save/Load และเฟรมโจมตี
- Sandbox นี้ไม่อนุญาต `file://` หรือ `127.0.0.1`; จึงยังไม่ยืนยันการดับเบิลคลิกบน Windows จริง ผู้เล่นเปิดเกมด้วย `START.bat` ของเกมเดิมและรายงานปัญหาหากพบ

## สิทธิ์
ภาพ Atlas แปลงมาจากงาน Ragnarok ที่ผู้ใช้อัปโหลด สิทธิ์แจกจ่ายต่อ **ยังไม่ได้รับการยืนยัน** ไม่ใช่ asset ที่สร้างใหม่ ปัจจุบันจัดชุดนี้เพื่อการเล่นส่วนตัวเท่านั้น ก่อนเผยแพร่สาธารณะต้องตรวจสิทธิ์ให้ถูกต้อง
