# Borderlands Classic v1.5b — Layered Character + Monster Scale + Weapon + Item Icon

**ฐานสำหรับแพตช์:** เกม v1.4.2 FULL ซึ่งลงแพตช์ v1.5 User Novice, v1.5 Swordman และ v1.5a ตามลำดับแล้วเท่านั้น
**รูปแบบส่งมอบ:** ZIP เฉพาะไฟล์เปลี่ยน/เพิ่ม ไม่ใช่เกมเต็ม; ไม่ต้องใช้ Python, Node.js หรืออินเทอร์เน็ตขณะเล่น

## สิ่งที่เปลี่ยน
- แยกหัว 19 ทรงใน `assets/sprites/hair_00.png` ถึง `hair_18.png` ออกจากตัว `body_novice.png` และ `body_swordman.png` โดยใช้ `js/sprite-anchors.js` ระบุตำแหน่งหัวในแต่ละเฟรมและอาชีพ
- `js/game.js` ประกอบ Head + Body บน Canvas ทุกเฟรม การเปลี่ยนทรงผม/อาชีพใช้ Hair ID เดิมใน Save; ไม่เรียกใช้อัตลาส `novice_ro_hair_*` / `swordman_ro_hair_*` ที่รวมภาพไว้ล่วงหน้าอีก
- เมื่อสวมดาบในสล็อต Weapon จะแสดงไฟล์ `assets/weapons/<item>.png` ตามรายการ Training Sword, Iron Sword, Moon Blade ที่มีอยู่เดิม อาวุธขยับตามเฟรมโจมตี แสดงด้านหลังเมื่อหันขึ้น ถอดอาวุธแล้วภาพอาวุธหาย ไม่แก้ความเสียหาย/สูตรหรือเวลาตี
- Monster แต่ละชนิดมี scale ของตัวเอง (Poring/Fabre/Lunatic 1.5, Willow/Boss 2, Hornet/Poporing 1.75) ขยายตำแหน่งชื่อ HP bar และพื้นที่คลิกเลือกเป้าหมายตามขนาดภาพ; hitbox สำหรับ Combat / aggro / reach ไม่เปลี่ยน
- Item Icon เป็น PNG ขนาด 24×24 จำนวน 28 รายการ แยกจาก Weapon Sprite; กระเป๋า รายละเอียดไอเทม ร้านค้า และช่อง Hotbar ของไอเทมใช้ภาพ Local ไม่ใช้ emoji เป็นหลัก

## แยกข้อมูลกราฟิก 3 หมวด
| หมวด | ตัวอย่างตำแหน่ง | ทำอะไร |
|---|---|---|
| Item Icon | `assets/icons/items/potion.png` | กระเป๋า / Hotbar / ร้านค้า |
| Weapon Sprite | `assets/weapons/rusty_sword.png` | ดาบที่ตัวละครถือในฉาก |
| Body + Head | `assets/sprites/body_swordman.png`, `assets/sprites/hair_09.png` | ภาพตัวละคร 4 ทิศ 13 เฟรม |

ชื่อ Item ID ในเกมนี้เป็นคีย์ภายใน เช่น `potion`, `rusty_sword` ไม่ใช่เลข Item ID ของ Ragnarok และไม่ควรแมปเข้ากับเลขทางการโดยอัตโนมัติ หากได้ไอคอนที่มีสิทธิ์ถูกต้องและต้องการแทนภาพชั่วคราว ให้ใช้ PNG โปร่งใสขนาด 24×24 วางทับไฟล์ `assets/icons/items/<local-id>.png` ชื่อเดิมได้ทันที ไม่ต้องแก้ Code หรือ Save

Divine Pride API `/api/database/Item/{id}` มีฟิลด์ `iconUrl` และ ragassets มี `/icons/item/{id}.png` หลังติดตั้งชุดไอคอนจากไคลเอนต์แล้ว ทั้งสองแหล่งเป็นข้อมูลอ้างอิง/ระบบนำเข้าเท่านั้น ไม่ได้อนุญาตให้นำภาพ Ragnarok ไปเผยแพร่ใน ZIP อัตโนมัติ แพตช์นี้ **ไม่ดึงไอคอนต้นฉบับ ไม่เรียก API ไม่ฝัง API Key** และใช้ภาพไอคอน/ดาบที่สร้างขึ้นใหม่; ภาพ Head/Body เป็นภาพที่ผู้ใช้อัปโหลด ซึ่งยังไม่ได้ยืนยันสิทธิ์แจกจ่ายต่อ จึงเหมาะสำหรับใช้งานส่วนตัว

อ้างอิง: https://www.divine-pride.net/tools/api-doc และ https://github.com/adsonpleal/ragassets

## ติดตั้ง
1. สำรองโฟลเดอร์เกมและ Export Save JSON ใน Settings
2. แตก ZIP v1.5b ทับโฟลเดอร์เกม **v1.5a ที่มีแพตช์ Swordman/Novice อยู่แล้ว** และ Replace All โดยรักษาโครงสร้าง `assets/`, `js/`, `css/`, `tests/`
3. เปิด `START.bat` ตามเดิม ไม่ต้องติดตั้ง Python/Node.js
4. ทดสอบเลือกอาวุธจาก Inventory → Equip, เข้า Settings เปลี่ยน Hair, เดิน/โจมตี และเปิด Bag ดูภาพไอเทม

## ผลทดสอบและข้อจำกัด
- ผ่าน JavaScript regression tests และ Chromium integration ที่ใช้ PNG bytes จากชุดติดตั้งจริงแบบ inline; ตรวจ Head/Body, 3 อาวุธ, Auto Battle, Move, Save, Monster Scale และการโหลดไอคอน
- Sandbox Chromium ปิดกั้นการนำทาง `file://` จึง **ยังไม่ยืนยันการเปิดไฟล์ตรงบน Windows เครื่องผู้ใช้**; เกมยังใช้ไฟล์ Local ทั้งหมดและไม่มี API/network runtime
- อาวุธที่ทำให้แสดงได้ในรอบนี้มี 3 ดาบตามรายการในเกมเท่านั้น ไม่ใช่อาวุธทุกชนิดใน Ragnarok และไม่ได้ใช้ Weapon Sprite ต้นฉบับของ Gravity
- ภาพมอนสเตอร์ทั้ง 7 ยังคงเป็นภาพต้นฉบับของเกม Solo v1.5 ที่สร้างขึ้นก่อนหน้า แต่ปรับขนาดและ HUD ให้สัมพันธ์กัน ยังไม่ได้แทนด้วยมอนสเตอร์จาก Ragnarok
