"""แยกตัวละครเต็มตัวออกเป็น body ไม่มีหัว + head (หัว+หน้า+ผม) ตามสถาปัตยกรรมของเกม"""
from PIL import Image

def row_widths(im):
    a=im.getchannel('A'); w,h=im.size; px=a.load()
    out=[]
    for y in range(h):
        xs=[x for x in range(w) if px[x,y]>0]
        out.append((min(xs),max(xs),len(xs)) if xs else None)
    return out

def neck_y(im, hint=None, tol=4):
    """คอ = แถวที่แคบที่สุดในช่วง 25-55% ของความสูงตัวละคร (ระหว่างหัวกับไหล่)

    ท่าที่ยกแขนขึ้นไม่มีคอแคบจริงในช่วงนั้น ความกว้างจะไล่ลงเรื่อย ๆ จนค่าต่ำสุด
    ไปตกที่ขอบล่างของช่วงค้นหา แล้วตัดลำตัวส่วนบนไปอยู่กับหัว เฟรมแรกของท่าฟัน
    เจอแบบนี้ 5 จาก 6 ชุด

    hint = จุดคอของท่ายืนทิศเดียวกัน ถ้าผลที่หาได้ห่างจาก hint เกิน tol ให้ใช้ hint
    แทน เพราะทุกเฟรมสร้างจาก reference เดียวกัน ตัวละครจึงยืนที่ระดับเดิม
    """
    rows=row_widths(im); bb=im.getchannel('A').getbbox()
    top,bot=bb[1],bb[3]; span=bot-top
    lo,hi=top+int(span*0.25), top+int(span*0.55)
    best,besty=10**9,lo
    for y in range(lo,hi):
        r=rows[y]
        if r and r[2]<best: best,besty=r[2],y
    if hint is not None and abs(besty-hint)>tol: return hint
    return besty

def split(full_path, bald_path):
    full=Image.open(full_path).convert('RGBA')
    bald=Image.open(bald_path).convert('RGBA')
    ny=neck_y(bald)
    head=Image.new('RGBA',full.size,(0,0,0,0))
    body=Image.new('RGBA',full.size,(0,0,0,0))
    fp,hp,bp=full.load(),head.load(),body.load()
    balp=bald.load()
    for y in range(full.height):
        for x in range(full.width):
            if y<ny: hp[x,y]=fp[x,y]          # เหนือคอ = หัว (จากภาพที่มีผม)
            else:    bp[x,y]=balp[x,y]        # ใต้คอ = ตัว (จากภาพหัวโล้น ผมไม่ปลิวลงมา)
    return head,body,ny
