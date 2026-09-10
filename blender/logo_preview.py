# =============================================================
#  logo_preview.py — گزینه‌های نقش دوبعدی برای تأیید
#
#  همه از خطوط ساخته شده‌اند، نه سطح پر — چون قرار است اکسترود
#  شوند و دیواره بسازند، و آب باید بینشان جاری بماند.
#
#  برای کیفیت، هر قاب در دو برابر اندازه کشیده و بعد کوچک
#  می‌شود؛ وگرنه لبه‌ها پله‌پله درمی‌آیند.
#
#  اجرا:  python logo_preview.py
# =============================================================
from PIL import Image, ImageDraw, ImageFont
import math
import os

S = 420                      # اندازه‌ی نهایی هر قاب
SS = 3                       # ضریب فراوانمونه‌گیری
PAD = 44
BG = (11, 17, 30)
INK = (206, 224, 255)
DIM = (92, 116, 158)
W = 8                        # پهنای خط در مقیاس نهایی
HERE = os.path.dirname(os.path.abspath(__file__))


# -------------------------------------------------------------
#  ابزار
# -------------------------------------------------------------
def arc_pts(cx, cy, rx, ry, a0, a1, rot=0.0, n=160):
    """نقاط روی کمان بیضی، با چرخش دلخواه."""
    pts = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        x, y = rx * math.cos(a), ry * math.sin(a)
        if rot:
            c, s = math.cos(rot), math.sin(rot)
            x, y = x * c - y * s, x * s + y * c
        pts.append((cx + x, cy + y))
    return pts


def poly(d, pts, w=None, fill=INK):
    d.line(pts, fill=fill, width=w or (W * SS), joint="curve")


def dot(d, cx, cy, r, fill=INK):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)


def ring(d, cx, cy, r, w=None, fill=INK):
    poly(d, arc_pts(cx, cy, r, r, 0, 360), w, fill)


# =============================================================
#  طرح‌ها
# =============================================================
def spiral(d, cx, cy, R):
    """یک خط پیوسته از مرکز تا لبه — کانال آب هم پیوسته می‌شود."""
    turns, n = 3.4, 900
    pts = []
    for i in range(n + 1):
        t = i / n
        a = t * turns * 2 * math.pi
        r = R * (0.12 + 0.88 * t)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    poly(d, pts)
    dot(d, cx, cy, W * SS * 0.9)


def aperture(d, cx, cy, R):
    """شش تیغه‌ی دیافراگم دوربین."""
    inner = R * 0.34
    for k in range(6):
        a = k * math.pi / 3
        ax, ay = cx + R * math.cos(a), cy + R * math.sin(a)
        b = a + 2.09
        bx, by = cx + inner * math.cos(b), cy + inner * math.sin(b)
        poly(d, [(ax, ay), (bx, by)])
    ring(d, cx, cy, R)


def pulse(d, cx, cy, R):
    """موج رادیویی: کمان‌هایی با شعاع متغیر."""
    for k in range(7):
        r = R * (0.26 + k * 0.125)
        span = 44 + (k % 3) * 26
        start = -span / 2 + (k * 37 % 360)
        poly(d, arc_pts(cx, cy, r, r, start, start + span))
    dot(d, cx, cy, W * SS * 1.1)


def monogram(d, cx, cy, R):
    """دو شِوران تودرتو داخل حلقه — حرف A."""
    for scale in (1.0, 0.55):
        s = R * 0.62 * scale
        poly(d, [(cx - s, cy + s * 0.78), (cx, cy - s * 0.86),
                 (cx + s, cy + s * 0.78)])
    poly(d, [(cx - R * 0.30, cy + R * 0.20), (cx + R * 0.30, cy + R * 0.20)])
    poly(d, arc_pts(cx, cy, R, R, 24, 336))


def lattice(d, cx, cy, R):
    """شبکه‌ی شش‌ضلعی بریده‌شده در دایره."""
    a = R * 0.30
    dx, dy = a * 1.5, a * math.sqrt(3)
    for row in range(-3, 4):
        for col in range(-3, 4):
            hx = cx + col * dx
            hy = cy + row * dy + (dy / 2 if col % 2 else 0)
            if math.hypot(hx - cx, hy - cy) > R * 0.80:
                continue
            pts = [(hx + a * math.cos(math.pi / 3 * i),
                    hy + a * math.sin(math.pi / 3 * i)) for i in range(7)]
            poly(d, pts, w=int(W * SS * 0.62))
    ring(d, cx, cy, R)


def nodes(d, cx, cy, R):
    """گراف شبکه: گره‌ها و یال‌ها."""
    pts = []
    for k in range(6):
        a = k * math.pi / 3 - math.pi / 6
        pts.append((cx + R * 0.68 * math.cos(a), cy + R * 0.68 * math.sin(a)))
    for i in range(6):
        poly(d, [pts[i], pts[(i + 1) % 6]], w=int(W * SS * 0.7))
        poly(d, [pts[i], (cx, cy)], w=int(W * SS * 0.55))
    for p in pts:
        dot(d, p[0], p[1], W * SS * 1.5)
    dot(d, cx, cy, W * SS * 2.0)


def prism(d, cx, cy, R):
    """مثلث و پرتوهای شکسته — گرافیک و فیزیک با هم."""
    s = R * 0.78
    tri = [(cx, cy - s), (cx + s * 0.87, cy + s * 0.5),
           (cx - s * 0.87, cy + s * 0.5), (cx, cy - s)]
    poly(d, tri)
    poly(d, [(cx - R, cy - R * 0.10), (cx - s * 0.40, cy + R * 0.05)])
    for k, off in enumerate((-0.26, -0.10, 0.06, 0.22)):
        poly(d, [(cx + s * 0.18, cy + R * 0.16),
                 (cx + R * 1.02, cy + R * (0.16 + off))],
             w=int(W * SS * 0.66))


def lens(d, cx, cy, R):
    """شکل عدسی از تلاقی دو کمان، با حلقه‌های داخلی."""
    off = R * 0.52
    poly(d, arc_pts(cx - off, cy, R, R, -52, 52))
    poly(d, arc_pts(cx + off, cy, R, R, 128, 232))
    for k in (0.46, 0.26):
        poly(d, arc_pts(cx, cy, R * k * 0.9, R * k, 0, 360),
             w=int(W * SS * 0.72))
    dot(d, cx, cy, W * SS * 1.2)


def circuit(d, cx, cy, R):
    """مسیرهای قائم‌الزاویه از مرکز به بیرون."""
    steps = [(0.30, 0.30), (-0.44, 0.18), (0.20, -0.46), (-0.24, -0.32)]
    for k, (ux, uy) in enumerate(steps):
        x1, y1 = cx + R * ux, cy + R * uy
        poly(d, [(cx, cy), (x1, cy)], w=int(W * SS * 0.7))
        poly(d, [(x1, cy), (x1, y1)], w=int(W * SS * 0.7))
        ex = cx + R * ux * 1.9
        poly(d, [(x1, y1), (ex, y1)], w=int(W * SS * 0.7))
        dot(d, ex, y1, W * SS * 1.4)
    ring(d, cx, cy, R, w=int(W * SS * 0.8))
    dot(d, cx, cy, W * SS * 1.8)


# =============================================================
def panel(title, subtitle, drawer):
    big = Image.new("RGB", (S * SS, S * SS), BG)
    d = ImageDraw.Draw(big)
    c = S * SS // 2
    R = (S - PAD * 2) // 2 * SS
    drawer(d, c, c, R)

    im = big.resize((S, S), Image.LANCZOS)
    dd = ImageDraw.Draw(im)
    try:
        f1 = ImageFont.truetype("arialbd.ttf", 20)
        f2 = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        f1 = f2 = ImageFont.load_default()
    dd.text((20, S - 50), title, font=f1, fill=INK)
    dd.text((20, S - 26), subtitle, font=f2, fill=DIM)
    return im


DESIGNS = [
    ("D  SPIRAL", "one continuous channel", spiral),
    ("E  APERTURE", "six-blade iris", aperture),
    ("F  PULSE", "radial waveform", pulse),
    ("G  MONOGRAM", "nested A in a ring", monogram),
    ("H  LATTICE", "hex grid, clipped", lattice),
    ("I  NODES", "network graph", nodes),
    ("J  PRISM", "triangle + split rays", prism),
    ("K  LENS", "vesica + inner rings", lens),
    ("L  CIRCUIT", "orthogonal traces", circuit),
]


def main():
    gap = 16
    cols = 3
    rows = 3
    sheet = Image.new("RGB", (S * cols + gap * (cols - 1),
                              S * rows + gap * (rows - 1)), (6, 10, 18))
    for i, (t, s, fn) in enumerate(DESIGNS):
        p = panel(t, s, fn)
        sheet.paste(p, ((i % cols) * (S + gap), (i // cols) * (S + gap)))

    out = os.path.join(HERE, "logo_options_2.png")
    sheet.save(out)
    print("written:", out, sheet.size)


main()
