# Borderlands v1.5a — Sprite Scale & Clarity Fix

ฐานติดตั้ง: Borderlands Classic v1.4.2 FULL + v1.5 User Novice Sprites + v1.5 Swordman Sprite patch (ตามลำดับ)

## แก้ไขจริง
- แสดงภาพ Novice ที่ขนาดเฟรมต้นฉบับ 64 × 112 พิกเซล และ Swordman 96 × 112 พิกเซล (แทนการย่อลงเหลือ 42 × 74 / 64 × 74 ก่อนขยายทั้ง Canvas)
- วางจุดกึ่งกลางบนแกน X ของตัวละครให้ตรงกับ world position และอ้างตำแหน่งเท้าที่ y=108 ของเฟรม 112px เพื่อรักษาตำแหน่งเท้าเดิม
- ใช้การวาดบนพิกเซลจำนวนเต็ม; Canvas ปิด image smoothing อยู่แล้ว และ CSS ใช้ image-rendering: pixelated อยู่แล้ว จึงรักษาสภาพเดิมโดยไม่ปรับขนาดฉากหรือความเร็วโลก
- Monster ทั้ง 7 ประเภทไม่เปลี่ยนขนาด; hitbox, ระยะโจมตี, ฟิสิกส์, Combat, Save, Hair ID, Hotbar และ Divine Pride ไม่มีการแก้ไข

## รายการไฟล์
- js/game.js — ปรับเฉพาะขนาด/จุดยึด Sprite ของผู้เล่น
- tests/sprite_scale_v15a.test.js — ทดสอบ frame width, foot anchor, monster size และการ render พื้นฐาน
- tests/sprite_scale_browser_v15a.py — Chromium integration ด้วยไฟล์ PNG จริงแบบ inline เพื่อผ่านข้อจำกัด file:// ของ sandbox ทดสอบการเดิน/Auto ด้วย
- README_SPRITE_v1_5a_TH.md — เอกสารนี้

## วิธีติดตั้ง
1. สำรองโฟลเดอร์เกมและไฟล์ Save ก่อน
2. แตก ZIP v1.5a ทับโฟลเดอร์เกมที่ติดตั้งแพตช์ Swordman v1.5 แล้ว เลือก Replace All
3. เปิด START.bat ตามเดิม เกมไม่ต้องใช้ Python; สคริปต์ใน tests/ เป็นไฟล์ทดสอบสำหรับผู้พัฒนาเท่านั้น

## ข้อจำกัดที่ต้องแจ้ง
- การทดสอบใน Chromium ใช้ original PNG bytes แบบ inline แทน file:// เพราะสภาพแวดล้อมทดสอบบล็อกการเข้าถึง file:// จึงยังไม่ได้ยืนยันการเปิดจาก Windows เครื่องของผู้ใช้จริง
- CSS ปัจจุบันขยาย Canvas ให้เต็มขนาดจอ ถ้าสัดส่วนจอไม่ใช่จำนวนเต็ม ความกว้างของพิกเซลบนจออาจไม่เท่ากัน แต่ภาพจะไม่ผ่านการย่อ 2/3 เท่าที่ทำให้รายละเอียดหายก่อนแสดงผลอีกแล้ว
- เวอร์ชันนี้แก้ขนาด/ความคม ไม่ใช่ Layered Renderer: ไฟล์ Novice/Swordman 19 ทรงผมยังเป็น atlas ประกอบล่วงหน้าจาก v1.5; งานแยก Head/Body จริงเป็นเฟสต่อไป
- Sprite ที่ผู้ใช้อัปโหลดสำหรับเล่นส่วนตัว ไม่ได้ยืนยันสิทธิ์แจกจ่ายต่อ
