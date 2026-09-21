"""จำลอง drawEquippedWeapon() ของ js/game.js:78-90 เป๊ะ ๆ เพื่อลองมุมกวาดโดยไม่ต้องแก้เกม"""
import math, json, re
from PIL import Image
S='/home/user/Borderlands-Classic-Offline/assets/sprites'
W='/home/user/Borderlands-Classic-Offline/assets/weapons'
A=json.loads(re.search(r'BorderSpriteAnchors=(\{.*?\});',
    open('/home/user/Borderlands-Classic-Offline/js/sprite-anchors.js').read(),re.S).group(1))
ROW={'down':0,'left':1,'right':2,'up':3}

def draw_weapon(canvas, wimg, x, y, facing, col, swing_table, attacking=True,
                hand=(17,48,14,54), wsize=(24,36), grip=(12,29), base=0.32):
    swing = swing_table[max(0,min(len(swing_table)-1,col-6))] if attacking else 0
    xSide = -1 if facing=='left' else 1
    hx,hy,hxu,hyu = hand
    px = round(x + xSide*(hxu if facing=='up' else hx) + (-2 if facing=='left' else 0) + (xSide*3 if attacking else 0))
    py = round(y - (hyu if facing=='up' else hy) + (-4 if attacking else 0))
    angle = (-base if facing=='left' else base) + (xSide*swing*math.pi/180 if attacking else 0) + (math.pi if facing=='up' else 0)
    ww,wh=wsize; gx,gy=grip
    w = wimg.resize((ww,wh), Image.NEAREST)
    # canvas ของ ctx: translate(px,py) -> rotate -> drawImage(-12,-29)
    pad = Image.new('RGBA',(120,120),(0,0,0,0))
    pad.paste(w,(60-gx,60-gy),w)
    rot = pad.rotate(-math.degrees(angle), resample=Image.NEAREST, center=(60,60))
    canvas.alpha_composite(rot, (px-60, py-60))

def frame(cls,facing,col,style,swing_table,with_weapon=True,weapon='iron_sword',**kw):
    fw = 64 if cls=='novice' else 96
    row = ROW[facing]
    src_row = ROW['right'] if facing=='right' else row
    B=Image.open(f"{S}/body_{cls}.png").convert('RGBA').crop((col*fw,row*112,(col+1)*fw,row*112+112))
    out=Image.new('RGBA',(fw,112),(0,0,0,0)); out.paste(B,(0,0),B)
    H=Image.open(f"{S}/hair_{style:02d}.png").convert('RGBA').crop((col*64,row*48,(col+1)*64,row*48+48))
    ax,ay=A[cls][row][col]; out.alpha_composite(H,(ax,ay))
    if with_weapon:
        draw_weapon(out, Image.open(f"{W}/{weapon}.png").convert('RGBA'), fw//2, 108, facing, col, swing_table, **kw)
    return out
