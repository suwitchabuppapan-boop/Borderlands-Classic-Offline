# Borderlands Classic v1.4.2 — Combat Completion, ขอบเขตเกมที่เล่นได้

**ไฟล์หลัก:** `START.bat` หรือ `index.html` บน Windows; เปิดเล่น Offline ไม่ต้องติดตั้ง Python/Node.js หรือใช้งาน Divine Pride API ระหว่างเล่น. ก่อนติดตั้งทับให้เปิด Settings → Export Save เพื่อสำรองเซฟ. Patch `Borderlands_Classic_v1_4_2_ONLY_CHANGED.zip` ใช้ทับ **v1.4.1 เท่านั้น**; หากมีเกมรุ่นก่อนหน้านี้ ให้ใช้ ZIP เกมเต็ม `Borderlands_Classic_v1_4_2_FULL_OFFLINE.zip` แทน. หากย้ายโฟลเดอร์หรือเปลี่ยนเบราว์เซอร์ ให้ Import Save ที่ส่งออกไว้ เพราะ localStorage อาจผูกกับที่อยู่เดิม.

## สิ่งที่ทำและตรวจสอบในขอบเขตปัจจุบัน

- ระบบเดิม Novice → Swordman, 3 แผนที่, 6 มอนสเตอร์จากข้อมูลอ้างอิง + บอส SOLO, 4 สกิล, Auto Battle, UI จากผู้ใช้, Custom Hotbar และ Divine Pride Codex ยังคงอยู่. ไม่รวมเซิร์ฟเวอร์และไม่ยิง API ระหว่างต่อสู้.
- คำนวณการโจมตีธรรมดาและ Bash / Magnum Break ผ่าน resolver เดียวกัน: Critical, HIT/FLEE, Perfect Dodge, Base/Weapon ATK, Hard/Soft DEF, อาวุธ/ขนาด, ตารางธาตุ 1–4, ตัวเชื่อม bonus/reduction Race/Size/Element และการดูดซับธาตุ. แยกตัวคำนวณเวท (MATK min/max, MDEF, ธาตุ) เป็นฟังก์ชันพร้อมทดสอบ แต่ **ยังไม่มีสกิลเวทของผู้เล่น** ในเกมนี้.
- ASPD ตามอาชีพและอาวุธที่รองรับ (หมัด/ดาบมือเดียว), AGI, DEX; ใช้ Attack Interval ของผู้เล่นกับการโจมตีปกติ/Auto และ Monster Attack Delay กับมอนสเตอร์; AGI ไม่เร่งความเร็วเดิน.
- Magnum Break: เงื่อนไข Bash Lv.5, ใช้ SP30, ใช้ HP20–16 ตามระดับ, โจมตีขอบเขต 5×5, กระเด็น 2 ช่อง, Cast Delay 2 วินาที, Fire bonus 20% จาก damage **ก่อน DEF** แยกจากธาตุอาวุธ ทั้งในการใช้สกิลและโจมตีธรรมดาตลอดบัฟ 10 วินาที. กรณีดูดซับธาตุสามารถฟื้น HP เป้าหมายได้.
- Provoke: โอกาสติด, ลด DEF, เพิ่ม ATK, 30 วินาที และไม่ใช้กับ Boss/Undead ในเส้นทางที่เล่นได้. First Aid ฟื้น HP5 ใช้ SP3; Bash multiplier, SP และโบนัสแม่นยำตามระดับที่เกมรองรับ.
- สถานะตัวละคร: Poison ลด Soft DEF สำหรับ Damage จริง, ทำ HP ลดต่อวินาทีโดยไม่ต่ำกว่า 25%, หยุด Natural SP Regen; Blind ลด HIT/FLEE 25%; Stun/Sleep/Freeze หยุดเดิน/โจมตี/ใช้สกิล; Silence ห้ามสกิล; Green Potion (ร้านค้า) แก้ Poison/Blind/Silence/Chaos; บอส Cavern Guardian ที่สร้างขึ้นเป็นพิเศษมีโอกาสทำให้ติด Poison (ระบุ SOLO อย่างชัดเจน). สถานะที่ยังมีผลอยู่ถูกเก็บใน Save, เซฟเก่ายังโหลดได้ และกระเป๋าว่างไม่มียาเติมเอง.
- น้ำหนัก: นับรวมไอเทมในกระเป๋าและอุปกรณ์ที่สวมใส่; ความจุ Novice = 2000 + STR×30, Swordman เพิ่ม 800; น้ำหนักตั้งแต่ 50% หยุดฟื้น HP/SP ตามธรรมชาติ, ตั้งแต่ 90% ห้ามโจมตี/ใช้สกิล. น้ำหนักไอเทม SOLO กำหนดไว้เพื่อจำลองเกม; ไม่อ้างว่าเป็นน้ำหนักทางการทั้งหมด.
- ตัวจับเวลาฟื้น HP/SP (ยืน/เดิน) แทนการเติมเลือดทุกเฟรม และคง Save/Load, Hotbar, การซื้อขายกับ Inventory.

## สิ่งที่ *ยังไม่* ใช้ชื่อว่า Ragnarok Classic ครบ 100%

เวอร์ชันนี้ทำครบ **ขอบเขต Combat ที่มีในเกมปัจจุบัน** ไม่ใช่การจำลอง Ragnarok ทั้งเกม. ยังไม่รองรับอาชีพอื่น, เวทของ Mage ในสนามรบ, อาวุธอื่น/โบนัส Katar, PvP, Card/Refine, สถานะทุกชนิดพร้อมเงื่อนไขครบ (Freeze/Chaos ยังมีเพียงสถานะพื้นฐาน ไม่มีระบบเปลี่ยนธาตุ/เดินสับสนเต็มรูปแบบ), การร่ายและถูกขัดจังหวะระหว่างเล่นจริง (มีฟังก์ชันคำนวณและทดสอบเป็นฐานแต่ไม่มีสกิลร่ายในเกม). ไอเทมอุปกรณ์และแผนที่หลายรายการเป็น SOLO, EXP ×5 และเศรษฐกิจ/ดรอปยังเป็นค่าปรับแต่ง Solo; ไม่อ้างความตรงกับเซิร์ฟเวอร์ทางการ. กฎ/ตารางจาก Wiki อาจขึ้นกับเซิร์ฟเวอร์และยุคแพตช์และต้องตรวจใหม่เมื่อเพิ่มคลาสหรืออาวุธในอนาคต.

## ตรวจสอบด้วยตัวเอง (สำหรับผู้พัฒนา)

หากติดตั้ง Node.js และ Python พร้อม Playwright แล้ว ใช้:

```bat
node tests\classic_combat_completion.test.js
node tests\core.test.js
python tests\combat_completion_browser.py
python tests\stable_ui_v13f.py
```

ชุดทดสอบปัจจุบันตรวจสูตร, Poison DEF, Green Potion ผ่าน Hotbar, การบล็อกน้ำหนัก, เซฟกระเป๋าเปล่า, สถานะ, การใช้ Magnum และ regression UI. การทดสอบ Chromium ในสภาพแวดล้อมสร้างไฟล์ทำโดย **ฝังไฟล์ทั้งหมดเป็น HTML** แทน `file://` เนื่องจาก sandbox ปฏิเสธการเปิดแบบนั้น; จึง **ยังไม่ได้รับรอง Windows file:// ด้วยเครื่อง Windows จริง**. ไม่จำเป็นต้องใช้ชุดทดสอบเหล่านี้เพื่อเล่นเกม.

## แหล่งอ้างอิง

- https://irowiki.org/classic/Attacks
- https://irowiki.org/classic/ASPD
- https://irowiki.org/classic/Magnum_Break
- https://irowiki.org/classic/Bash
- https://irowiki.org/classic/Provoke
- https://irowiki.org/classic/Weight_Limit
- https://irowiki.org/classic/Status_Effects
- https://github.com/rathena/rathena/tree/master/db/pre-re

**สิทธิ์ภาพ:** ไฟล์เกมเต็มรวมไฟล์ Phieti PNG ที่ผู้ใช้อัปโหลดมาเพื่อทดลองเป็นการส่วนตัว ยังไม่พบเอกสารสิทธิ์สำหรับเผยแพร่ Skin ต้นทางสู่สาธารณะ. ไม่รวม Ragnarok official sprites, ROSkinViewer.exe หรือ API Key. หากต้องเผยแพร่สาธารณะ โปรดแทนภาพ Skin ด้วยภาพที่มีสิทธิ์ชัดเจนก่อน.
