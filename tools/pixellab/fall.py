"""ท่าตายแบบล้มลง: หมุนเลเยอร์ตัวและหัวรอบจุดเดียวกัน (เท้า) ด้วยมุมเดียวกัน

animate-with-text ทำท่าตายไม่ได้เลย (igs ต่ำ->ตัวกลายเป็นสัตว์ / igs สูง->ยืนเฉย)
การหมุนภาพให้ผลแน่นอน 100% และเป็นเทคนิคที่เกม 2D ใช้จริง
สำคัญ: ตัวกับหัวต้องหมุนรอบ "จุดเดียวกัน" ไม่งั้นหัวจะหลุดออกจากคอ
"""
from PIL import Image
PAD=64                       # ขยายผืนก่อนหมุน กันตัวโดนตัดตอนนอนราบ
ANGLES={10:30,11:62,12:90}   # คอลัมน์ -> องศาที่เอียง

def padded(im):
    c=Image.new('RGBA',(im.width+PAD*2,im.height+PAD*2),(0,0,0,0))
    c.paste(im,(PAD,PAD)); return c

def pivot_of(full):
    """จุดหมุน = กึ่งกลางเท้า ในพิกัดของผืนที่ขยายแล้ว"""
    bb=full.getchannel('A').getbbox()
    return ((bb[0]+bb[2])/2+PAD, bb[3]+PAD)

def tip(layer_im, pivot, deg):
    """หมุนทวนเข็มรอบ pivot; NEAREST เพื่อคงความเป็นพิกเซล"""
    return padded(layer_im).rotate(-deg, resample=Image.NEAREST, center=pivot)

def fallen(body_up, head_up, full_up, deg):
    """คืน (ตัวที่ล้ม, หัวที่ล้ม) บนผืนที่ขยายแล้ว หมุนรอบเท้าเดียวกัน"""
    p=pivot_of(full_up)
    return tip(body_up,p,deg), tip(head_up,p,deg)
