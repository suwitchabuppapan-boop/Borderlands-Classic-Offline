"""ท่าฟันดาบ: สั่งโครงกระดูกให้แขนเหวี่ยง ไม่ใช่หมุน sprite ดาบ

/animate-with-skeleton รับ keypoints 3 เฟรมพอดี = คอลัมน์ 6/7/8 ของเกม

เลือกแขนที่ถือดาบจาก "ตำแหน่ง x บนจอ" ไม่ใช่จาก label เพราะ estimate-skeleton
เดาทิศตัวละครเอง label LEFT/RIGHT จึงสลับข้างไม่แน่นอนระหว่างทิศและอาชีพ
ฝั่งที่ถูกต้องคือฝั่งเดียวกับที่ drawEquippedWeapon วาดดาบ: ขวาจอสำหรับ down/up
(xSide=+1) และซ้ายจอสำหรับ side ซึ่งเป็นต้นฉบับของแถว 'left' (xSide=-1)
"""
import api

WEAPON_SIDE={"down":+1,"side":-1,"up":+1}

# ส่วนโค้งของการฟัน เป็นระยะห่างจากหัวไหล่ (dx คูณด้วยฝั่ง, dy ใช้ตรง ๆ)
# ยกขึ้นหลัง -> เหวี่ยงออกหน้า -> ตวัดลงข้ามตัว
ARC=[
 {"elbow":(0.11,-0.07), "hand":(0.17,-0.19), "neck":(-0.01, 0.01)},
 {"elbow":(0.13, 0.06), "hand":(0.23, 0.14), "neck":( 0.01, 0.02)},
 {"elbow":(0.02, 0.15), "hand":(-0.12,0.29), "neck":(-0.02, 0.03)},
]

def weapon_arm(base, slot):
    """คืน (prefix, shoulder_xy) ของแขนฝั่งที่ถือดาบ"""
    by={k["label"]:k for k in base}
    L,R=by["LEFT SHOULDER"],by["RIGHT SHOULDER"]
    pick = (L if L["x"]>R["x"] else R) if WEAPON_SIDE[slot]>0 else (L if L["x"]<R["x"] else R)
    return pick["label"].split()[0], (pick["x"],pick["y"])

def poses(base, slot):
    side=WEAPON_SIDE[slot]
    pre,(sx,sy)=weapon_arm(base, slot)
    neck=next(k for k in base if k["label"]=="NECK")
    out=[]
    for a in ARC:
        ov={f"{pre} ELBOW":(sx+side*a["elbow"][0], sy+a["elbow"][1]),
            f"{pre} ARM":  (sx+side*a["hand"][0],  sy+a["hand"][1]),
            "NECK":        (neck["x"]+side*a["neck"][0], neck["y"]+a["neck"][1])}
        out.append([{"x":float(ov.get(k["label"],(k["x"],k["y"]))[0]),
                     "y":float(ov.get(k["label"],(k["x"],k["y"]))[1]),
                     "label":k["label"],"z_index":int(k["z_index"])} for k in base])
    return out, pre, (sx,sy)

def make(ref_png, base_kp, slot, direction, size=64, gs=6.0):
    frames,_,_=poses(base_kp, slot)
    d=api.call("animate-with-skeleton",{
      "image_size":{"width":size,"height":size},
      "reference_image":{"type":"base64","base64":api.b64(ref_png)},
      "skeleton_keypoints":frames,
      "view":"high top-down","direction":direction,
      "guidance_scale":gs},timeout=280)
    return d["images"]
