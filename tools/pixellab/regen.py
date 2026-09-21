"""generate ท่าโจมตี/ตายใหม่ด้วย action ที่ไม่ลาก weapon กับสัตว์ประหลาดเข้ามา"""
import api,base64,os
DESCS={
 "novice":"original chibi rpg villager boy, completely bald shaved head, plain beige cloth tunic, brown trousers, empty hands",
 "swordman":"original chibi rpg young warrior, completely bald shaved head, light leather armour over tunic, shoulder guards, brown boots, empty hands",
}
NEG=("sword, weapon, blade, axe, staff, shield, slash effect, motion trail, energy arc, "
     "wings, monster, creature, extra limbs, floating, flying, multiple characters, hair, hat")
ANIMS=[("attack","punch forward with fist"),("death","fall down and lie on the ground")]
DIRS=[("down","south"),("side","west"),("up","north")]
for cls,desc in DESCS.items():
    for slot,pdir in DIRS:
        for anim,action in ANIMS:
            if os.path.exists(f"raw2/{cls}_{slot}_{anim}_0.png"): continue
            os.makedirs("raw2",exist_ok=True)
            d=api.call("animate-with-text",{"description":desc,"negative_description":NEG,"action":action,
              "image_size":{"width":64,"height":64},
              "reference_image":{"type":"base64","base64":api.b64(f"raw/{cls}_{slot}_base.png")},
              "view":"high top-down","direction":pdir,"n_frames":4},timeout=300)
            for i,im in enumerate(d["images"]):
                open(f"raw2/{cls}_{slot}_{anim}_{i}.png","wb").write(base64.b64decode(im["base64"]))
            print("regen",cls,slot,anim,flush=True)
print("DONE",flush=True)
