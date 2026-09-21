> **อัปเดตล่าสุด v1.5:** โปรดอ่าน `README_SPRITE_v1_5_TH.md` ก่อนใช้งาน และใช้ร่วมกับ `README_COMBAT_v1_4_2_TH.md` สำหรับรายละเอียด Combat / น้ำหนัก / Hotbar

# Borderlands Classic — Pre-Renewal SOLO v1.3 (Screenshot-based UI)

**เกมเล่นคนเดียวแบบ Offline ที่พัฒนาต่อจาก `Borderlands_Solo_Offline_v1.zip`** โดยเพิ่มข้อมูลอ้างอิง Ragnarok Classic Pre-Renewal แบบคัดเฉพาะส่วน ไม่ใช่ Ragnarok Online client, private server หรือไฟล์ต้นฉบับจาก Gravity / dev.cointh.com. ไม่เกี่ยวข้องกับผู้พัฒนา/ผู้ถือสิทธิ์ Ragnarok Online อย่างเป็นทางการ

## เริ่มเล่นบน Windows
1. แตก ZIP ออกเป็นโฟลเดอร์ก่อน อย่าเปิดเกมจากหน้าต่าง ZIP โดยตรง
2. ดับเบิลคลิก `START.bat` หรือเปิด `index.html` ด้วย Chrome/Edge/Firefox
3. เล่นเกมได้โดย **ไม่ต้องติดตั้ง Python, ไม่ต้องมี API Key, ไม่ต้องต่อเน็ต, ไม่ต้องเปิดเซิร์ฟเวอร์**; ภาพทั้งหมดวาดด้วยโค้ด Canvas ในเครื่อง (ใช้เน็ตเฉพาะเมื่อสั่ง Import API เอง)
4. ถ้าเซฟผ่านการเปิด `file://` ไม่คงอยู่ ให้เปิด Settings → Export Save เพื่อเก็บ .json แยกก่อนปิดเกม แล้ว Import กลับเมื่อเล่นใหม่

## UI v1.3 — อ้างอิงภาพหน้าจอจากผู้ใช้
- ยกเลิกโครงหน้าจอสามคอลัมน์: โลกเต็มจอ, ข้อมูลตัวละครมุมซ้ายบน, กริดเมนู 5×3 มุมซ้าย, มินิแมปมุมขวาบน, Quest Journal ขวาล่าง และ Hotbar 9 ช่องล่างกลาง
- เมนูไอคอนจะเปิดหน้าต่างลอย: Status, Skill, Bag, Quest, Shop, Auto, Codex, Log และ Settings; กด ✕ หรือ Esc เพื่อปิดหน้าต่าง
- คลิกมินิแมปเพื่อสั่งเดิน, ปุ่มรูปแผนที่หรือ M เพื่อซ่อน/แสดง; ปุ่ม − บน HUD และ Quest ย่อ/ขยายกล่องได้
- Hotbar แสดงช่อง 1–9 แต่คีย์บอร์ดยังคงใช้ปุ่มเดิมจาก v1.2: ปุ่ม **1–4** เรียกสกิล, **5 / H** ใช้ยา HP, **6** ใช้ยา SP, **7 / Space** โจมตี, **8 / E** คุย NPC และ **9 / F** Auto (ไม่เปลี่ยนผังการควบคุมหรือสูตรต่อสู้)
- ช่อง Items ใน HUD เป็น **จำนวนไอเทมทั้งหมดในกระเป๋า** ไม่ใช่ระบบ Weight ของ Ragnarok (ยังไม่ได้จำลองน้ำหนักจริง). FPS ด้านล่างอ่านค่าจากรันไทม์; ONLINE แทนด้วย SOLO OFFLINE อย่างถูกต้อง
- เปลี่ยน UI/การแสดงผลและมินิแมปเท่านั้น: เซฟคีย์เดิม, สูตรต่อสู้, ระบบ 3 แผนที่ และตัวนำเข้า Divine Pride แยกจากการเล่นยังอยู่ครบ. เวอร์ชัน v1.5 ใช้ภาพ Novice/ทรงผมที่ผู้ใช้อัปโหลดมาประกอบเป็น Atlas สำหรับเล่นส่วนตัว (สิทธิ์เผยแพร่ยังไม่ได้รับการยืนยัน)

## วิธีเล่น / ระบบ
| ปุ่ม | การทำงาน |
|---|---|
| WASD / ลูกศร / คลิกพื้น | เดิน / เดินไปจุดที่คลิก |
| คลิกมอนสเตอร์ / Space | เลือกเป้าหมาย / โจมตีเมื่ออยู่ในระยะ |
| 1 | First Aid: ฟื้นเลือด (ทักษะเริ่มต้น SOLO) |
| 2 | Bash: ต้องเปลี่ยน Swordman และเรียนสกิล |
| 3 | Magnum Break: ต้อง Bash Lv.5 ก่อน |
| 4 | Provoke: ต้อง Bash Lv.2 ก่อน |
| H | ใช้ยา HP |
| F | เปิด/ปิด Auto Play; Auto ทำงานเฉพาะเมื่อเปิดหน้าเกม |
| E | คุย NPC ใกล้ตัว |
| I / Q | กระเป๋า / เควสต์ |
| M | ซ่อน/แสดงมินิแมป |
| Esc | ปิดหน้าต่างลอย |

- ระบบ 3 แผนที่: **Starter Meadow** (Poring / Fabre / Lunatic), **Woodland** (Willow / Hornet), **Cavern** (Poporing / Cavern Guardian — บอสสร้างใหม่สำหรับ SOLO). ออกจากแผนที่ทางประตูขวาและย้อนทางประตูซ้าย
- Monster Database: Monster ID, Level, HP, ATK, DEF, Base/Job EXP คัดตัวเลขจริงจาก `rAthena db/pre-re/mob_db.yml` ณ วันตรวจสอบ 18 ก.ย. 2026; ตาราง Drop คัดบางรายการ/อัตรา ไม่ใช่ฐานข้อมูลครบทั้งหมด
- Base EXP ตาราง Classic ของ iRO Wiki **ระดับ 1–30**; หลังจากนั้นใช้สูตรต่อยอด SOLO ไม่อ้างว่าเป็นค่า RO. Job EXP Novice 1–10 / First Class 1–50 อ้างอิงตาราง Classic
- **Novice Job Lv.10 → Swordman**: เดินเข้าหา NPC `Guild Guide` ที่แผนที่ 1 (ประมาณ X305 Y344) กด `E` หรือเปิดแท็บ `Skills` แล้วกดปุ่มเปลี่ยนอาชีพเมื่ออยู่ใกล้ NPC
- หลังเปลี่ยนอาชีพ Job Level เริ่มใหม่ที่ 1; ทุกครั้งที่ Swordman Job Level เพิ่ม จะได้ 1 Skill Point ใช้เรียน Bash / Magnum Break / Provoke ในแท็บ Skills
- สเตตัส STR / AGI / VIT / INT / DEX / LUK และค่า HIT / FLEE; ค่า HP/ATK/DEF/Crit/Stat point cost ใช้ **สูตรดัดแปลง SOLO** ไม่ใช่สูตรทางการของ Ragnarok
- Base/Job EXP จากมอนสเตอร์และเควสต์คูณ **×5** จากค่าฐาน เพื่อให้เล่นคนเดียวได้; ความเสียหายมอนสเตอร์คูณประมาณ **×0.52** (ก่อนหัก DEF). ค่าเงิน, ราคา, ไอเทมสวมใส่, ผู้พิทักษ์ถ้ำ, แผนที่, Quest และรางวัลพิเศษเป็นการออกแบบใหม่ทั้งหมด
- วัสดุจากมอนสเตอร์ขายได้ใน Inventory ด้วยปุ่ม `ขาย ×จำนวน` โดยราคาขายเป็นค่า SOLO (ไม่ได้อ้างอิงราคา Ragnarok)

## Save เกม v1 → v1.1

เกม v1.3 ใช้เซฟคีย์เดิมของ v1.1 `borderlands-solo-save-v2` โดยค้น `borderlands-solo-save-v1` เดิม **เฉพาะเมื่อยังไม่มีเซฟ v2**; แปลงครั้งเดียวและไม่ลบเซฟเก่า. เก็บค่าเงิน, จำนวนของที่ยังรองรับ, สวมใส่, สถานที่, Level, ค่าสเตตัส 5 ค่าเดิม และจำนวนมอนสเตอร์ที่เคยล่า โดยเพิ่ม LUK = 5; ดัดแปลง EXP คงเหลือให้ไม่เกินเกณฑ์ใหม่เพื่อกันข้อมูลผิดพลาด; **Quest v1 รีเซ็ตจากตอนแรก** เพราะเป้าหมายเปลี่ยน; สกิลจาก v1 จะไม่ถูกแปลงเป็น Swordman โดยอัตโนมัติ. หากย้ายเกมไปโฟลเดอร์ใหม่หรือเปลี่ยนเบราว์เซอร์ storage อาจไม่ตามมา: ใช้ Export Save v1 แล้ว Import Save ที่ Settings ของ v1.3 ได้

หากอยากเก็บเกมเดิมไว้ ไม่ต้องลบโฟลเดอร์ v1. ทดสอบ Save v1.1 ด้วย `Export` ก่อน Reset

## Divine Pride API · วิธีใช้งาน v1.3 (คงตัวนำเข้าเดิมจาก v1.2) (เลือกทำได้ ไม่บังคับ)
1. แตก ZIP ออกเป็นโฟลเดอร์ใน Windows ก่อน และต้องเชื่อมต่ออินเทอร์เน็ตเฉพาะเวลานำเข้าข้อมูล
2. ดับเบิลคลิก **`IMPORT_DIVINE_PRIDE.bat`** (ใช้ Windows PowerShell 5.1 ที่มากับ Windows; ไม่มี Python / VPS) พิมพ์หรือวาง API Key ที่หน้าต่าง PowerShell โดยระบบซ่อนข้อความที่พิมพ์ **ไม่ต้องส่ง Key ให้ผู้ช่วย**
3. โปรแกรมเรียกตาม ID ที่กำหนดไว้เท่านั้น: มอนสเตอร์ **1002 Poring, 1007 Fabre, 1063 Lunatic, 1010 Willow, 1004 Hornet, 1031 Poporing**; ไอเทม **501 Red Potion, 909 Jellopy**; สกิล **5 Bash, 6 Provoke, 7 Magnum Break** รวมสูงสุด 11 requests หากไม่มี cache; ข้อมูลจากเซิร์ฟเวอร์ `thROC` และภาษา `th`
4. รอจบแล้วเปิด/รีเฟรช `index.html` → กดไอคอนหนังสือ 📖 (**Codex**) ทางซ้าย; ข้อมูลจะแสดงเปรียบเทียบ rAthena Pre-Renewal ที่อยู่ในเกม กับผลลัพธ์ Divine Pride แยกกัน
5. ไฟล์ผลลัพธ์ `data/divine-pride-cache.js` เก็บเฉพาะค่าที่เลือกและเวลาอัปเดต **ไม่มี API Key, ภาพ หรือ iconUrl**; นำไฟล์นี้ไปใช้เล่น Offline ได้บนเครื่องเดิม การเรียกครั้งถัดไปข้าม ID ที่มี cache อยู่แล้ว
6. หากเปลี่ยน Key, เซิร์ฟเวอร์, หรือต้องการดึงข้อมูลใหม่ ให้ปิดเกมและแทน `data/divine-pride-cache.js` ด้วยไฟล์เริ่มต้นใน ZIP ก่อน แล้วเรียก importer อีกครั้ง (อย่าแก้ไฟล์ Save)

**ขอบเขต:** นี่คือการทดลองนำเข้าข้อมูลบางรายการพร้อม Codex สำหรับอ่าน/เปรียบเทียบ ยัง *ไม่* ปรับสูตรต่อสู้, Monster Spawn, Drop, ราคา/ไอเทม, ค่าสกิล หรือ Save จากข้อมูล API โดยอัตโนมัติ เพราะ API อาจเป็นข้อมูล patch คนละรุ่นกับ Pre-Renewal. การที่เว็บ API ส่ง `health` ไม่ได้หมายความว่า HP ในเกมถูกเปลี่ยนแล้ว. บอส Guardian เป็นมอนสเตอร์แต่งขึ้น ไม่เรียก API.

**Rate limit / ความปลอดภัย:** คำขอส่งแบบลำดับทีละรายการ หน่วง 1.1 วินาทีหลังคำขอแรก ตรวจ HTTP 429 และรอ `Retry-After` เพื่อ retry เพียงครั้งเดียวแล้วหยุดหากยังถูกจำกัด; 401/403 หยุดทันที, 404 ข้าม. ผลสำเร็จเขียน Cache ทันทีเพื่อกลับมาทำรายการที่ยังไม่มีได้อีกครั้ง. Key ถูกใช้ในหน่วยความจำเพื่อส่ง query `apiKey` ผ่าน HTTPS เท่านั้นและไม่เก็บใน ZIP/Cache/Save; ผู้ให้บริการ API ยังเห็น Key ในคำขอ จึงอย่าแชร์ Key หรือบันทึก log ที่มี URL เต็ม. ปริมาณที่แต่ละบัญชีใช้ได้อาจต่างกัน; โปรดปฏิบัติตามเงื่อนไขผู้ให้บริการ. โปรแกรม importer ยังไม่ได้ทดสอบการยืนยันตัวตนกับ Key จริงในการทดสอบแพ็กนี้.

## แหล่งข้อมูลและสิทธิ์ใช้งาน
- [Divine Pride official API documentation](https://www.divine-pride.net/tools/api-doc) — API, header `x-server`, authentication, caching, rate limit และขอบเขตการใช้แบบ lookup เฉพาะ ID; ไม่ดึงฐานทั้งหมด ไม่รวมภาพจาก API ในเกม
- [rAthena db/pre-re/mob_db.yml](https://github.com/rathena/rathena/blob/master/db/pre-re/mob_db.yml) — Monster ID / selected numeric facts and selected drop rates, project copyright rAthena Development Team, GPL-3.0-or-later; attribution here and `LICENSE-GPL-3.0.txt` included. This pack includes a small independently assembled subset, **not the upstream database or source code**.
- [iRO Wiki Classic Base EXP Chart](https://irowiki.org/classic/Base_EXP_Chart) — level requirements up to Lv.30
- [iRO Wiki Classic Job EXP Chart](https://irowiki.org/classic/Job_EXP_Chart) — Novice and First Class requirements
- [iRO Wiki Classic Swordman](https://irowiki.org/classic/Swordman) — Novice Lv.10 job change, Swordman skills
- [iRO Wiki Bash](https://irowiki.org/wiki/Bash) / [iRO Wiki Swordman skills](https://irowiki.org/wiki/Swordman) — names, skills and basic percentage references; cooldowns/gameplay customized for SOLO
- Artwork: Novice และ Swordman ชายใช้ Sprite Atlas ที่แปลงจากภาพและทรงผมของ Ragnarok ที่ผู้ใช้อัปโหลด (19 ทรงต่ออาชีพ) ส่วนมอนสเตอร์เป็น Sprite ที่สร้างใหม่ในโปรเจกต์; ไม่ใช่งานสร้างใหม่ทั้งหมดและไม่มีการยืนยันสิทธิ์แจกต่อ ไม่โหลด API ขณะเล่นเกม

Distribution: newly authored implementation and the curated dataset are supplied with the GPL-3.0 license text; upstream Ragnarok characters, trademarks and world remain their respective owners' property. The game is a non-official fan-inspired study prototype. The license for original software does **not** grant rights to redistribute Gravity artwork; transformed Novice art from user uploads is included only for private use, and public redistribution requires separate rights verification.

## File structure
- `index.html` — full game interface
- `css/style.css` — interface styling
- `js/classic-data.js` — curated pre-re numeric references plus explicit SOLO fields
- `js/core.js` — save conversion, RPG rules, jobs, skills, items/monster drops
- `js/game.js` — movement, combat, NPC, auto battle, canvas drawings
- `js/divine-pride-codex.js` — UI สำหรับเปรียบเทียบข้อมูล API กับเกมแยกกันและ sanitize ชื่อจากภายนอก
- `data/divine-pride-cache.js` — cache ค่าเริ่มต้นว่าง (จะถูกเขียนโดย importer บนเครื่องคุณ)
- `IMPORT_DIVINE_PRIDE.bat`, `tools/import-divine-pride.ps1` — นำเข้าข้อมูลผ่าน PowerShell เมื่อผู้เล่นสั่งเอง; แยกจากการเปิดเกม Offline
- `tests/codex.test.js` — ทดสอบ schema, escaping, แยกข้อมูลอ้างอิงออกจาก gameplay
- `tests/core.test.js` — automated rule tests; run `node tests/core.test.js` (development only)
- `tests/browser_smoke.py` — optional Chromium/Playwright gameplay regression smoke check for developers, **not needed to play**
- `tests/ui_v13.test.py` — optional screenshot-inspired HUD layout, menu/minimap interactions and viewport regression test
- `docs/superpowers/` — design + implementation plan
- `LICENSE-GPL-3.0.txt` — license copy

### Known limitations
Only the Novice → Swordman first-class route is playable. Not implemented: all other jobs, second class, full original RO status/damage formula, official item-card/refining systems, entire Ragnarok maps, multiplayer, original asset API imports, or cloud farming. Most numeric monster values are referenced; AI/pathing/attack intervals and visual assets are newly designed, so behavior does not claim 1:1 parity with Ragnarok.
