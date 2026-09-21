"""raw/ + raw2/ (64x64 เต็มตัว) -> frames/ + js/sprite-anchors.js

เกมวาด body ไม่มีหัว แล้ววาง head 64x48 ทับที่ (dx+ax, dy+ay)
anchor อ้างอิง "กะโหลก" ซึ่งเหมือนกันทุกทรงผม ไม่ใช่ bbox ของผม (ผมยาวสั้นต่างกัน)

คอลัมน์ 10-12 (ท่าตาย) ไม่ได้มาจากโมเดล แต่หมุนท่ายืนเอา เพราะ animate-with-text
ทำท่าตายไม่ได้: image_guidance ต่ำ -> ตัวกลายเป็นสัตว์, สูง -> ยืนเฉยไม่ล้ม
ตัวกับหัวหมุนรอบจุดเดียวกัน (กึ่งกลางเท้า) หัวจึงติดคอตลอด
เดิม game.js ข้ามเลเยอร์หัวที่คอลัมน์ 12 เพราะ art เก่าอบหัวไว้ในตัว แต่ death ตั้ง
loop:false จึงค้างที่เฟรมนั้นตลอดเวลาที่ตาย ศพจะหัวโล้นค้าง จึงเอาเงื่อนไขนั้นออก
แล้วให้คอลัมน์ 12 มีหัวของตัวเองเหมือนคอลัมน์อื่น
"""
import os, json
from PIL import Image
from decompose import neck_y
from fall import fallen, ANGLES, PAD

FRAME={"novice":(64,112),"swordman":(96,112)}
FEET=108; HW,HH=64,48
SLOTS=["down","side","up"]
ROW={"down":0,"side":1,"up":3}
COLMAP=[("base",0),("base",0),("walk",0),("walk",1),("walk",2),("walk",3),
        ("attack",0),("attack",1),("attack",2),("base",0),
        ("death",0),("death",1),("death",2)]
SKULL_Y=6

def rawp(cls,slot,anim,idx):
    if anim=="base": return f"raw/{cls}_{slot}_base.png"
    for d in ("raw2","raw"):
        p=f"{d}/{cls}_{slot}_{anim}_{idx}.png"
        if os.path.exists(p): return p
    return f"raw/{cls}_{slot}_base.png"

def cut(img,ny):
    top=Image.new('RGBA',img.size,(0,0,0,0)); bot=Image.new('RGBA',img.size,(0,0,0,0))
    ip,tp,bp=img.load(),top.load(),bot.load()
    for y in range(img.height):
        dst=tp if y<ny else bp
        for x in range(img.width): dst[x,y]=ip[x,y]
    return top,bot

def bbox(im): return im.getchannel('A').getbbox()

def place_body(body,fw,fh,extent=None):
    """วางตัวลงกรอบ: จัดกึ่งกลางแนวนอน ส่วนล่างสุดแตะ FEET

    extent = ขอบเขตที่ใช้จัดกึ่งกลางแทนตัวเปล่า ๆ ท่าล้มต้องส่ง (ตัว+หัว) เข้ามา
    ไม่งั้นหัวที่ยื่นออกข้างจะล้นกรอบ 64px ของ novice (วัดได้ 5-8px)
    คืน (ภาพ, ฟังก์ชันแปลงพิกัดจากผืนต้นทางไปพิกัดกรอบ)"""
    bb=bbox(body)
    if not bb: return None,None
    eb=bbox(extent) if extent is not None else bb
    crop=body.crop(bb)
    X=(fw-(eb[2]-eb[0]))//2 + (bb[0]-eb[0])
    Y=FEET-(eb[3]-eb[1]) + (bb[1]-eb[1])
    out=Image.new('RGBA',(fw,fh),(0,0,0,0)); out.paste(crop,(X,Y),crop)
    return out, (lambda px,py: (px-bb[0]+X, py-bb[1]+Y))

def head_canvas(head,anchor_from):
    """ใส่หัวลงผืน 64x48 ที่ตำแหน่งคงที่ คืน (ภาพ, ตำแหน่งเนื้อหาในผืน)"""
    hb=bbox(head)
    if not hb: return None,None
    crop=head.crop(hb)
    cx=HW//2-crop.width//2; cy=anchor_from
    out=Image.new('RGBA',(HW,HH),(0,0,0,0)); out.paste(crop,(cx,cy),crop)
    return out,(cx,cy)

os.makedirs("frames",exist_ok=True)

# ---- โครงร่างร่วม: กะโหลก + จุดตัดคอ ของ novice ทุกทิศ (หัวใช้ร่วมกันสองอาชีพ) ----
skull={}
for slot in SLOTS:
    base=Image.open(f"raw/novice_{slot}_base.png").convert('RGBA')
    ny=neck_y(base); head,_=cut(base,ny)
    skull[slot]=(bbox(head),ny)

n_styles=0
while os.path.exists(f"raw/hair{n_styles:02d}_down.png"): n_styles+=1

# ---- หัว: ท่าปกติ 1 ภาพต่อทิศ + ท่าล้มเฉพาะคอลัมน์ 10,11 ----
head_pos={}                      # (slot,col) -> ตำแหน่งเนื้อหาหัวในผืน
for slot in SLOTS:
    sk,ny=skull[slot]
    SX=HW//2-(sk[2]-sk[0])//2
    head_pos[(slot,None)]=(SX,SKULL_Y)
    for i in range(n_styles):
        full=Image.open(f"raw/hair{i:02d}_{slot}.png").convert('RGBA')
        head,_=cut(full,ny)
        cv=Image.new('RGBA',(HW,HH),(0,0,0,0))
        cv.paste(head,(SX-sk[0], SKULL_Y-sk[1]),head)
        cv.save(f"frames/hair_{i:02d}_{slot}.png")
    # ท่าล้ม: หมุนหัวรอบเท้าเดียวกับตัว
    base=Image.open(f"raw/novice_{slot}_base.png").convert('RGBA')
    bh,bb_=cut(base,ny)
    for col,deg in ANGLES.items():
        _,rot_bald=fallen(bb_,bh,base,deg)
        hb=bbox(rot_bald)
        pos=(HW//2-(hb[2]-hb[0])//2, max(0,HH-(hb[3]-hb[1])-2))
        head_pos[(slot,col)]=pos
        for i in range(n_styles):
            full=Image.open(f"raw/hair{i:02d}_{slot}.png").convert('RGBA')
            h_hair,b_hair=cut(full,ny)
            _,rot=fallen(b_hair,h_hair,full,deg)
            rb=bbox(rot)
            cv=Image.new('RGBA',(HW,HH),(0,0,0,0))
            cv.paste(rot.crop(rb),pos,rot.crop(rb))
            cv.save(f"frames/hair_{i:02d}_{slot}_{col:02d}.png")

# ---- ตัว + anchors ----
anchors={}
for cls,(fw,fh) in FRAME.items():
    grid=[[None]*13 for _ in range(4)]
    for slot in SLOTS:
        base=Image.open(f"raw/{cls}_{slot}_base.png").convert('RGBA')
        bny=neck_y(base); bhead,bbody=cut(base,bny)
        for col,(anim,idx) in enumerate(COLMAP):
            if col in ANGLES:                                  # ท่าล้ม
                deg=ANGLES[col]
                rb,rh=fallen(bbody,bhead,base,deg)
                whole=rb.copy(); whole.paste(rh,(0,0),rh)   # ขอบเขตรวม กันหัวล้นกรอบ
                placed,to_frame=place_body(rb,fw,fh,whole)
                hb=bbox(rh)
                if placed: placed.save(f"frames/body_{cls}_{slot}_{col:02d}.png")
                if hb and to_frame:
                    fx,fy=to_frame(hb[0],hb[1])
                    px,py=head_pos[(slot,col)]
                    grid[ROW[slot]][col]=[fx-px, fy-py]
                continue
            full=Image.open(rawp(cls,slot,anim,idx)).convert('RGBA')
            ny=neck_y(full); head,body=cut(full,ny)
            hb=bbox(head)
            placed,to_frame=place_body(body,fw,fh)
            if not placed: continue
            placed.save(f"frames/body_{cls}_{slot}_{col:02d}.png")
            if hb:
                fx,fy=to_frame(hb[0],hb[1])
                px,py=head_pos[(slot,None)]
                grid[ROW[slot]][col]=[fx-px, fy-py]
        if slot=="side":
            for col in range(13):
                a=grid[1][col]
                if a: grid[2][col]=[fw-HW-a[0], a[1]]
    for r in range(4):
        for c in range(13):
            if grid[r][c] is None: grid[r][c]=grid[0][0] or [0,20]
    anchors[cls]=grid

open("frames/sprite-anchors.js","w").write(
 "// Generated by tools/pixellab/assemble.py from the frames it composed.\n"
 "// Head placement is measured against the bald skull of each body frame, which is\n"
 "// consistent across hairstyles; hair silhouettes are not. Columns 10-11 carry the\n"
 "// tipped-over death poses, whose head layer is rotated about the same pivot.\n"
 '(function(root){root.BorderSpriteAnchors=%s;})(typeof window!=="undefined"?window:globalThis);\n'
 % json.dumps(anchors,separators=(',',':')))
print(f"frames: {len([f for f in os.listdir('frames') if f.endswith('.png')])} png, ทรงผม {n_styles}")
