# Borderlands Classic v1.5 — Sprite & Animation Runtime

เวอร์ชันนี้ต่อจาก **v1.4.2** และเน้นเปลี่ยนการแสดงผลในฉากจากการวาดตัวละคร/มอนสเตอร์ด้วยโค้ดล้วน ไปเป็น **Sprite Sheet + Animation Runtime** ที่ยังเปิดเล่นแบบ Offline ได้เหมือนเดิม

## สิ่งที่เพิ่มใน v1.5
- เพิ่ม Sprite Sheet แยกตามที่มา:
  - **Novice ชาย**: นำภาพตัว Novice และภาพทรงผมที่ผู้ใช้อัปโหลดมาจัดเฟรมและประกอบกันเป็น Sprite Atlas **19 ทรงผม** (4 ทิศ × 13 เฟรม)
  - **Swordman ชาย**: นำภาพ Swordman จากผู้ใช้มาจัดเฟรมประกอบกับทรงผมชุดเดียวกับ Novice เป็น Atlas 19 แบบ (4 ทิศ × 13 เฟรม); แทนภาพชั่วคราวแล้ว
  - **Monster**: Sprite ที่สร้างขึ้นใหม่สำหรับ Poring, Fabre, Lunatic, Willow, Hornet, Poporing และ Cavern Guardian · SOLO
- รองรับ animation state:
  - **Idle**
  - **Walk**
  - **Attack**
  - **Hit**
  - **Death**
- เชื่อม animation เข้ากับระบบต่อสู้จริง:
  - ผู้เล่นโจมตีปกติ / ใช้สกิล → แสดงท่าโจมตี
  - มอนสเตอร์โจมตี → แสดงท่าโจมตี
  - เมื่อโดนโจมตี → แสดง hit reaction
  - เมื่อตาย → แสดง death animation ก่อน respawn
- ระบบยังคงเปิดจาก `index.html` แบบ **Offline / local file** ได้ตามเดิม

## สิ่งที่ยังคงเดิม
- สูตรต่อสู้หลักยังยึดจาก v1.4.2
- Save / Load, Inventory, Equipment, Hotbar, Auto Battle, Codex ยังใช้โครงเดิม
- ไม่เพิ่มการเรียก network ใหม่ และไม่เปลี่ยนลำดับ script ใน `index.html`

## ไฟล์ที่แก้หลัก
- `js/game.js`
- `README_TH.md`
- `README_SPRITE_v1_5_TH.md`
- `assets/sprites/*.png` (Novice 19 Atlas + Swordman 19 Atlas ที่ประกอบจากภาพผู้ใช้; Monster เป็นภาพสร้างใหม่)
- `tests/user_sprite_v15.test.js` และ `tests/user_sprite_browser_v15.py`
- `README_USER_SPRITES_v1_5_TH.md`

## การทดสอบที่รันแล้ว
- `node tests/offline_check.js` ✅
- `node tests/core.test.js` ✅
- `node tests/classic_combat_completion.test.js` ✅
- `node tests/combat_runtime_v14.test.js` ✅
- `python tests/file_launch_smoke.py` → สภาพแวดล้อม sandbox บล็อก `file://` (ยังไม่ยืนยันเปิด Windows จริง); ทดสอบ rendering โดยโหลดภาพจากข้อมูลไฟล์ภายในและทดสอบ Save/Load ด้วย storage จำลอง

## หมายเหตุสิทธิ์ใช้งาน
**สิทธิ์:** `novice_ro_hair_*.png` และ `swordman_ro_hair_*.png` ดัดแปลงจากภาพ Ragnarok ที่ผู้ใช้อัปโหลด ไม่ใช่ภาพสร้างใหม่และการอัปโหลดไม่ได้พิสูจน์สิทธิ์เผยแพร่ต่อ ใช้ส่วนนี้เฉพาะเล่นส่วนตัว ตรวจสอบสิทธิ์ก่อนแจกจ่ายสาธารณะ; มอนสเตอร์ยังเป็นภาพสร้างใหม่ในโปรเจกต์ ไม่รวม Sprite Sheet ต้นฉบับใน ZIP แพตช์
