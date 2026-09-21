import json,base64,os,slash
DIRS={"down":"south","side":"west","up":"north"}
for cls in ["novice","swordman"]:
    for slot,pdir in DIRS.items():
        if os.path.exists(f"raw3/{cls}_{slot}_attack_0.png"): continue
        os.makedirs("raw3",exist_ok=True)
        base=json.load(open(f"skel_{cls}_{slot}.json"))
        pre,sh=slash.weapon_arm(base,slot)
        imgs=slash.make(f"raw/{cls}_{slot}_base.png",base,slot,pdir)
        for i,im in enumerate(imgs):
            open(f"raw3/{cls}_{slot}_attack_{i}.png","wb").write(base64.b64decode(im["base64"]))
        print(f"slash {cls} {slot} (แขน {pre} ไหล่ {sh[0]:.2f})",flush=True)
print("DONE",flush=True)
