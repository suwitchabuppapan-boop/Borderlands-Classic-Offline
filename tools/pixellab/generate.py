"""สร้างวัตถุดิบทั้งหมดจาก PixelLab ลงใน raw/ (ผืน 64x64) พร้อม resume ถ้ารันซ้ำ"""
import api, os, json, base64, sys

STYLE={"no_background":True,"view":"high top-down","outline":"single color black outline",
       "shading":"basic shading","detail":"low detail"}
SIZE={"width":64,"height":64}
DIRS=[("down","south"),("side","west"),("up","north")]

CLASSES={
 "novice":"original chibi rpg villager boy, completely bald shaved head, plain beige cloth tunic, brown trousers, empty hands, full body standing",
 "swordman":"original chibi rpg young warrior, completely bald shaved head, light leather armour over tunic, shoulder guards, brown boots, empty hands, full body standing",
}
NEG="hair, hat, helmet, headwear, cap, weapon, sword"

HAIR=["short spiky brown hair","long flowing blonde hair","neat black bob hair",
      "wavy auburn shoulder length hair","short white messy hair","long dark blue ponytail"]

# (ชื่อท่า, action ที่ส่งให้ API, จำนวนเฟรม)
ANIMS=[("walk","walk",4),("attack","slash attack",4),("death","die falling down",4)]

def have(p): return os.path.exists(p) and os.path.getsize(p)>0
def log(*a): print(*a,flush=True)

for cls,desc in CLASSES.items():
    base=f"raw/{cls}_down_base.png"
    if not have(base):
        api.save(api.call("generate-image-pixflux",{**STYLE,"description":desc,"negative_description":NEG,
            "image_size":SIZE,"direction":"south"}),base); log("base",cls)
    for slot,pdir in DIRS[1:]:
        p=f"raw/{cls}_{slot}_base.png"
        if not have(p):
            api.save(api.call("rotate",{"from_image":{"type":"base64","base64":api.b64(base)},
                "image_size":SIZE,"from_direction":"south","to_direction":pdir,
                "from_view":"high top-down","to_view":"high top-down"}),p); log("rotate",cls,slot)
    for slot,pdir in DIRS:
        ref=f"raw/{cls}_{slot}_base.png"
        for anim,action,n in ANIMS:
            if have(f"raw/{cls}_{slot}_{anim}_0.png"): continue
            d=api.call("animate-with-text",{"description":desc,"negative_description":NEG,
                "action":action,"image_size":SIZE,
                "reference_image":{"type":"base64","base64":api.b64(ref)},
                "view":"high top-down","direction":pdir,"n_frames":n},timeout=300)
            for i,im in enumerate(d["images"]):
                open(f"raw/{cls}_{slot}_{anim}_{i}.png","wb").write(base64.b64decode(im["base64"]))
            log("anim",cls,slot,anim,len(d["images"]))

# ผม: inpaint ลงบนหัวโล้นของ novice ทุกทิศ (หัวใช้ร่วมกันทั้งสองอาชีพ)
from PIL import Image, ImageDraw
for slot,pdir in DIRS:
    bald=f"raw/novice_{slot}_base.png"
    im=Image.open(bald).convert('RGBA'); bb=im.getchannel('A').getbbox()
    hh=int((bb[3]-bb[1])*0.45)
    mask=Image.new('RGB',im.size,(0,0,0))
    ImageDraw.Draw(mask).rectangle([max(0,bb[0]-10),max(0,bb[1]-8),min(63,bb[2]+10),bb[1]+hh],fill=(255,255,255))
    mp=f"raw/mask_{slot}.png"; mask.save(mp)
    for i,h in enumerate(HAIR):
        p=f"raw/hair{i:02d}_{slot}.png"
        if have(p): continue
        api.save(api.call("inpaint",{"description":f"chibi rpg character with {h}",
            "image_size":SIZE,"inpainting_image":{"type":"base64","base64":api.b64(bald)},
            "mask_image":{"type":"base64","base64":api.b64(mp)},
            **STYLE,"direction":pdir},timeout=300),p)
        log("hair",i,slot)
log("DONE")
