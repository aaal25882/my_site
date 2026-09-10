# =============================================================
#  kufic.py — «امیرعلی» به خط کوفی بنّایی، در قاب ستاره‌ی هشت‌پر
#
#  دو سنت عمومی روی هم:
#    • کوفی بنّایی — نوشتن روی شبکه‌ی مربعی، پهنای قلم و فاصله
#      هر دو یک خانه. همین قاعده نوشته را شبیه هزارتو می‌کند.
#    • خاتم / ستاره‌ی هشت‌پر — دو مربع با چرخش ۴۵ درجه روی هم.
#
#  هر حرف با نقشه‌ی متنی تعریف شده تا اصلاحش آسان باشد:
#      '#' = قلم،  '.' = خالی
#
#  خروجی:
#      kufic_preview.png   — برای دیدن و تأیید
#      kufic_mask.png      — ماسک سیاه‌وسفید برای اکسترود در Blender
#
#  اجرا:  python kufic.py
# =============================================================
from PIL import Image, ImageDraw
import os

HERE = os.path.dirname(os.path.abspath(__file__))

GRID = 37           # ابعاد شبکه
C = GRID // 2       # مرکز
SQ = 13             # نیم‌ضلع مربع راست
DIA = 18            # شعاع لوزی (مربع چرخیده)
BORDER_W = 2        # ضخامت قاب، بر حسب خانه


# -------------------------------------------------------------
#  حروف — راست‌به‌چپ. شکل هر حرف به جایگاهش در کلمه بستگی دارد.
# -------------------------------------------------------------
LETTERS = {
    # ا — الف
    "alif": [
        "#",
        "#",
        "#",
        "#",
        "#",
    ],

    # م — میم آغازی: سرِ بسته، دنباله‌ی پایین‌رونده
    "mim_i": [
        "###",
        "#.#",
        "###",
        "..#",
        "..#",
    ],

    # ی — یای میانی: دندانه روی کرسی
    "ya_m": [
        "...",
        "...",
        "...",
        "#..",
        "###",
    ],

    # ر — رای پایانی
    "ra_f": [
        "...",
        "###",
        "#..",
        "#..",
        "#..",
    ],

    # ع — عین آغازی: دهانِ باز
    "ain_i": [
        "#.#",
        "#.#",
        "###",
        "..#",
        "..#",
    ],

    # ل — لام میانی: قامت بلند
    "lam_m": [
        "..#",
        "..#",
        "..#",
        "..#",
        "..#",
    ],

    # ی — یای پایانی: کشیده روی کرسی
    "ya_f": [
        "....",
        "....",
        "#...",
        "#...",
        "####",
    ],
}

WORD_TOP = ["ra_f", "ya_m", "mim_i", "alif"]     # امیر
WORD_BOT = ["ya_f", "lam_m", "ain_i"]            # علی


# -------------------------------------------------------------
#  هندسه‌ی ستاره
# -------------------------------------------------------------
def in_star(x, y):
    dx, dy = abs(x - C), abs(y - C)
    return max(dx, dy) <= SQ or (dx + dy) <= DIA


def blank():
    return [[0] * GRID for _ in range(GRID)]


def star_outline(g):
    """لبه‌ی بیرونی ستاره را به ضخامت BORDER_W می‌کشد."""
    edge = set()
    for y in range(GRID):
        for x in range(GRID):
            if not in_star(x, y):
                continue
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if not (0 <= nx < GRID and 0 <= ny < GRID) or not in_star(nx, ny):
                    edge.add((x, y))
                    break

    for _ in range(BORDER_W - 1):
        grow = set()
        for (x, y) in edge:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < GRID and 0 <= ny < GRID and in_star(nx, ny):
                    grow.add((nx, ny))
        edge |= grow

    for (x, y) in edge:
        g[y][x] = 1


def stamp(g, art, ox, oy):
    for r, row in enumerate(art):
        for c, ch in enumerate(row):
            if ch == "#":
                y, x = oy + r, ox + c
                if 0 <= y < GRID and 0 <= x < GRID:
                    g[y][x] = 1


def lay_word(g, names, oy, right_edge, gap=2):
    """از راست به چپ می‌چیند و پهنای کل را برمی‌گرداند."""
    x = right_edge
    for name in names:
        art = LETTERS[name]
        x -= len(art[0])
        stamp(g, art, x, oy)
        x -= gap
    return right_edge - (x + gap)


def word_width(names, gap=2):
    return sum(len(LETTERS[n][0]) for n in names) + gap * (len(names) - 1)


def build():
    g = blank()
    star_outline(g)

    # دو بند نوشته، وسط‌چین، داخل ستاره
    top_w = word_width(WORD_TOP)
    bot_w = word_width(WORD_BOT)
    lay_word(g, WORD_TOP, C - 8, C + top_w // 2)
    lay_word(g, WORD_BOT, C + 3, C + bot_w // 2)
    return g


# -------------------------------------------------------------
def render(g, cell, fg, bg, pad):
    size = GRID * cell + pad * 2
    im = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(im)
    for y in range(GRID):
        for x in range(GRID):
            if g[y][x]:
                d.rectangle([pad + x * cell, pad + y * cell,
                             pad + (x + 1) * cell - 1,
                             pad + (y + 1) * cell - 1], fill=fg)
    return im


def main():
    g = build()

    render(g, 20, (208, 226, 255), (11, 17, 30), 36).save(
        os.path.join(HERE, "kufic_preview.png"))
    mask = render(g, 24, (255, 255, 255), (0, 0, 0), 0)
    mask.save(os.path.join(HERE, "kufic_mask.png"))

    filled = sum(sum(r) for r in g)
    inside = sum(1 for y in range(GRID) for x in range(GRID) if in_star(x, y))
    print("grid %dx%d   star cells %d   filled %d (%.1f%% of star)"
          % (GRID, GRID, inside, filled, 100.0 * filled / inside))
    print("mask:", mask.size)


main()
