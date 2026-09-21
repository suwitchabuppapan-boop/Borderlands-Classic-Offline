# Borderlands Classic v1.4.1 — Combat Rebuild (Patch only)

**ติดตั้ง:** ต้องมีเกม Borderlands Classic **v1.4** ก่อน สำรองเกมและ Export Save, แตก ZIP นี้ทับโฟลเดอร์ v1.4 พร้อม Replace All. ห้ามนำไปทับ v1.3f โดยตรง. ตัวติดตั้งไม่ได้ลบ Save หรือ Divine Pride importer. เปิด START.bat ตามเดิม.

## เปลี่ยนจริงในเวอร์ชันนี้
- เปลี่ยนตัวคำนวณต่อสู้ให้การโจมตีธรรมดา, Bash/Magnum Break, และมอนสเตอร์ผ่าน Classic resolver แทน ATK - DEF แบบ Solo เดิม
- แยก Base ATK, Weapon ATK และความแปรผันอาวุธ; Hard/Soft DEF, MATK min/max, MDEF, HIT/FLEE, CRIT แสดงผล, Critical vs LUK เป้าหมาย, Perfect Dodge, ASPD ตามอาชีพและอาวุธที่เกมรองรับ
- เพิ่ม Element ระดับ 1–4, Size ของดาบ/หมัด, Race/Size/Element bonus hooks (อุปกรณ์ในเกมตอนนี้ยังไม่มีการ์ด); การโจมตี Critical ข้าม Hard/Soft DEF, สกิลโจมตีปกติไม่ติด Critical
- บันทึก Monster Combat Metadata ของมอนสเตอร์ Ragnarok 6 ชนิดจาก rAthena pre-re โดยแยก Cavern Guardian ที่เกมแต่งเองอย่างชัดเจน; ใช้ ATK Min–Max และ Attack Delay ของมอนสเตอร์กับการต่อสู้จริง
- First Aid ฟื้น 5 HP ใช้ 3 SP; Bash multiplier และ SP cost รายระดับ; Provoke ปรับ DEF/ATK พร้อมโอกาสสำเร็จและข้อยกเว้น Boss/Undead; Magnum Break SP 30, HP cost, กระเด็น, ระยะเวลา Buff และ Cast Delay (ตัว Buff/การแบ่งธาตุยังเป็น approximation ดูข้อจำกัดด้านล่าง)
- ฟื้น HP/SP ตามช่วงเวลาพื้นฐานแทนฟื้นต่อเนื่องทุกเฟรม; AGI ไม่เพิ่มความเร็วเดิน; หน้าต่าง Status/Skills แสดงสถิติคำนวณและค่าทรัพยากรตามระดับสกิล

## ขอบเขตที่ยังไม่ตรง Ragnarok 100%
- เวอร์ชันนี้ครอบคลุม Novice, Swordman และอาวุธหมัด/ดาบมือเดียวเท่านั้น ยังไม่มี Bow, Katar, Magic Damage Pipeline ที่ใช้จริง, Skill/Status Effects ทั้งเกม หรือการต่อสู้กับผู้เล่น
- Magnum Break แสดงและคิดเป็น Fire AoE แบบย่อ และโบนัส Fire 10 วินาทีใช้ผลลัพธ์ของการโจมตีหลักเป็นฐาน ไม่ใช่ขั้นตอนแยก pre-DEF ตาม Wiki ครบทุกกรณี. เป้าหมายที่ดูดซับธาตุติดลบจะถูกนับว่าไม่รับความเสียหาย โดยยังไม่เกิดการฟื้น HP.
- สูตร Level/Stat point, ค่าร้านค้า, ไอเทม SOLO, Drop, Monster Movement และ EXP multiplier ยังเป็น Solo ตามฐานเดิม; ไม่ได้แปลงเป็นฐานทางการของ Ragnarok.
- First Aid เริ่มติดตัวตามระบบเดิมแทนการทำ Quest ปลดล็อก; ไม่มี Fatal Blow และระบบสถานะผิดปกติเต็มชุด.
- ตัวเกมไม่เชื่อมต่อ API ระหว่างเล่น ไม่ฝัง API Key และไม่รวมรูป Gravity ในแพตช์.

## แหล่งอ้างอิง
- https://irowiki.org/classic/Attacks
- https://irowiki.org/classic/ASPD
- https://irowiki.org/classic/Element
- https://irowiki.org/classic/Bash
- https://irowiki.org/classic/Magnum_Break
- https://irowiki.org/classic/Provoke
- https://raw.githubusercontent.com/rathena/rathena/master/db/pre-re/mob_db.yml

## ทดสอบ
มี `tests/classic_combat_v141.test.js` และ `tests/runtime_wiring_v141.test.js` ใช้ `node` เพื่อทดสอบ (เฉพาะผู้พัฒนา). ระบบ Windows file:// ไม่สามารถเปิดยืนยันใน sandbox ที่มีข้อจำกัด แต่ทดสอบใน Chromium ด้วยการฝังไฟล์ Local แล้ว. ถ้าทดสอบแล้วพบค่าเพี้ยน ส่ง Save JSON และ Screenshot เพื่อแก้เฉพาะส่วนต่อไป.
