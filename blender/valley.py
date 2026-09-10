# =============================================================
#  valley.py — رندر درّه‌ی هزارتو برای پس‌زمینه‌ی صحنه
#
#  اجرا:
#      blender -b -P valley.py
#
#  خروجی در پوشه‌ی render/ کنار همین فایل ساخته می‌شود.
#
#  هندسه دقیقاً همان تابع ارتفاعِ v2/js/scene.js است، تا رندر با
#  موقعیت نشانگرها و زاویه‌ی دوربینِ وب هم‌خوان باشد.
# =============================================================

import bpy
import bmesh
import math
import os
from mathutils import Vector

# -------------------------------------------------------------
#  تنظیمات — این چند عدد را می‌توانید دست بزنید
# -------------------------------------------------------------
GRID = 800            # تفکیک شبکه‌ی زمین؛ باید ریزه‌کاری ماسک را حل کند
SIZE = 1150.0         # زمین تا افق کشیده می‌شود؛ هزارتو در مرکزش می‌ماند
SAMPLES = 300         # نمونه‌های Cycles؛ با denoise کافی است
RES_X, RES_Y = 2560, 1440
USE_GPU = True

# --- نوردهی و فضا ---------------------------------------------
EXPOSURE = -1.15      # منفی = تاریک‌تر. کلید اصلی حال‌وهوا.
FOG_DENSITY = 0.0018
SUN_ENERGY = 3.1
FILL_ENERGY = 900.0
MARKER_EMISSION = 9.0
MARKER_LAMP_ENERGY = 2600.0
SMOKE_H = 26.0
SMOKE_DENSITY = 0.34
LOW_MIST_DENSITY = 0.014  # پایین نگه داشته می‌شود تا رنگ بماند، نه گویِ سفید

# زاویه‌ی دوربین: عدد بزرگ‌تر یعنی نزدیک‌تر به افق.
# کمی بالاتر آمد تا داخل کانال‌ها و سطح آب دیده شود.
CAM_PHI = 0.95
CAM_THETA = -1.05
CAM_DIST = 430.0

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else os.getcwd()
OUT_DIR = os.path.join(HERE, "render")


# =============================================================
#  ۱. نویز — همان hash/value noise فایل جاوااسکریپت
# =============================================================
def _hash(x, y):
    n = math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return n - math.floor(n)


def vnoise(x, y):
    xi, yi = math.floor(x), math.floor(y)
    xf, yf = x - xi, y - yi
    u = xf * xf * (3 - 2 * xf)
    v = yf * yf * (3 - 2 * yf)
    a = _hash(xi, yi)
    b = _hash(xi + 1, yi)
    c = _hash(xi, yi + 1)
    d = _hash(xi + 1, yi + 1)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v


def fbm(x, y, octaves=5):
    s, amp, f, norm = 0.0, 0.5, 1.0, 0.0
    for _ in range(octaves):
        s += vnoise(x * f, y * f) * amp
        norm += amp
        f *= 2.03
        amp *= 0.5
    return s / norm


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# =============================================================
#  ۲. ارتفاع زمین
# =============================================================
# -------------------------------------------------------------
#  نقش دوبعدی — همین که ضخامت می‌گیرد
#
#  هیچ برجستگی‌ای در مرکز نیست. کف صاف است، دیواره‌ها سقف تخت
#  و بدنه‌ی عمودی دارند. دقیقاً مثل یک طرح وکتور که اکسترود شده.
# -------------------------------------------------------------
WALL_H = 28.0        # ضخامت طرح
WATER_LEVEL = 13.5    # سطح آب در کانال‌ها؛ پایین‌تر از سقف دیواره‌ها
LINE_W = 7.5         # نیم‌پهنای خطوط
EDGE = 0.7           # نرمی لبه؛ کوچک‌تر = تیزتر
GAP_HALF = 0.34      # نیم‌پهنای زاویه‌ای شکاف حلقه‌ها

# (شعاع، زاویه‌ی مرکز شکاف) — شکاف‌ها مسیر هزارتو را می‌سازند
RINGS = [
    (34.0, 0.55),
    (58.0, 2.70),
    (82.0, 4.35),
    (106.0, 5.90),
]

# شِوران مرکزی: دو پاره‌خط که یک ‹^› می‌سازند
CHEVRON = [
    ((-26.0, 15.0), (0.0, -19.0)),
    ((0.0, -19.0), (26.0, 15.0)),
]


def _wrap(a):
    """زاویه را به بازه‌ی (-pi, pi] می‌برد."""
    return (a + math.pi) % (2 * math.pi) - math.pi


def _seg_dist(px, pz, ax, az, bx, bz):
    """فاصله‌ی نقطه تا پاره‌خط."""
    vx, vz = bx - ax, bz - az
    wx, wz = px - ax, pz - az
    L2 = vx * vx + vz * vz
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, (wx * vx + wz * vz) / L2))
    return math.hypot(px - (ax + t * vx), pz - (az + t * vz))


# -------------------------------------------------------------
#  نقش از فایل تصویر
#
#  اگر logo_mask.png کنار این اسکریپت باشد، همان اکسترود می‌شود
#  و طرحِ رویه‌ای پایین نادیده گرفته می‌شود.
#      سفید = دیواره،  سیاه = کانال
# -------------------------------------------------------------
MASK_PATH = os.path.join(HERE, "logo_mask.png")
LOGO_SPAN = 460.0     # نقش روی چه عرضی از زمین پهن شود — قاب را پر کند

_mask_px = None
_mask_w = _mask_h = 0


_mask_invert = False


def try_load_mask():
    """ماسک را می‌خواند و خودش تشخیص می‌دهد قلم‌ها روشن‌اند یا تیره.

    طرح‌هایی که با قلم سیاه روی زمینه‌ی سفید کشیده می‌شوند
    (حالت رایج) باید معکوس شوند، چون اینجا روشنی یعنی دیواره.
    """
    global _mask_px, _mask_w, _mask_h, _mask_invert
    if not os.path.exists(MASK_PATH):
        print("[valley] no logo_mask.png — using built-in pattern")
        return False

    img = bpy.data.images.load(MASK_PATH)
    _mask_w, _mask_h = img.size
    _mask_px = list(img.pixels)          # RGBA، اعشاری

    # چهار گوشه را می‌خوانیم: اگر روشن بودند، زمینه سفید است
    def corner(px, py):
        return _mask_px[(py * _mask_w + px) * 4]

    m = 3
    corners = [corner(m, m), corner(_mask_w - 1 - m, m),
               corner(m, _mask_h - 1 - m),
               corner(_mask_w - 1 - m, _mask_h - 1 - m)]
    _mask_invert = (sum(corners) / 4.0) > 0.5

    print("[valley] mask loaded: %dx%d   invert=%s"
          % (_mask_w, _mask_h, _mask_invert))
    return True


def sample_mask(x, z):
    """نقش را از تصویر می‌خواند و به ۰ یا ۱ گرد می‌کند.

    گِرد کردن عمدی است: خاکستریِ ضدپله به دیواره‌ی نیم‌ارتفاع
    تبدیل می‌شود و لبه‌ی تیزِ «طرح دوبعدیِ ضخامت‌دار» را خراب
    می‌کند. پس آستانه می‌گذاریم.
    """
    half = LOGO_SPAN / 2.0
    u = (x + half) / LOGO_SPAN
    v = (z + half) / LOGO_SPAN
    if u < 0.0 or u > 1.0 or v < 0.0 or v > 1.0:
        return 0.0

    px = min(_mask_w - 1, max(0, int(u * _mask_w)))
    py = min(_mask_h - 1, max(0, int(v * _mask_h)))
    val = _mask_px[(py * _mask_w + px) * 4]       # کانال قرمز
    if _mask_invert:
        val = 1.0 - val
    return 1.0 if val > 0.5 else 0.0


BLUR = 5.4            # شعاع نرم‌کردن لبه، بر حسب واحد جهانی


def mask_soft(x, z):
    """چند نمونه دور نقطه می‌گیرد و میانگین می‌کند.

    نمونه‌ی تکی فقط ۰ یا ۱ می‌دهد، یعنی دیواره‌ی قائم. میانگینِ
    همسایه‌ها یک شیب پیوسته می‌سازد — همان چیزی که بعد می‌شود
    رویش فرسایش نشاند.
    """
    b, c = BLUR, BLUR * 0.7
    pts = ((0, 0), (b, 0), (-b, 0), (0, b), (0, -b),
           (c, c), (-c, c), (c, -c), (-c, -c))
    return sum(sample_mask(x + dx, z + dz) for dx, dz in pts) / len(pts)


def logo_mask(x, z):
    """۱ روی خطوط نقش، ۰ بیرونشان، با لبه‌ی باریک بینشان."""
    if _mask_px is not None:
        return mask_soft(x, z)
    r = math.hypot(x, z)
    th = math.atan2(z, x)

    best = 1e9

    # حلقه‌های شکاف‌دار
    for rad, gap_c in RINGS:
        if abs(_wrap(th - gap_c)) < GAP_HALF:
            continue                       # این زاویه شکاف است
        d = abs(r - rad)
        if d < best:
            best = d

    # شِوران مرکزی
    for (ax, az), (bx, bz) in CHEVRON:
        d = _seg_dist(x, z, ax, az, bx, bz)
        if d < best:
            best = d

    return 1.0 - smoothstep(LINE_W - EDGE, LINE_W + EDGE, best)


def terrain_h(x, z):
    r = math.hypot(x, z)

    m = logo_mask(x, z)
    h = m * WALL_H

    # --- فرسایش هندسی ---
    # بافت سنگ باید در فرم باشد نه در رنگ. این سه لایه رأس‌های
    # واقعی مش را جابه‌جا می‌کنند، پس سیلوئت و لبه‌ها هم می‌شکنند.
    #
    # flank روی دامنه‌ها بیشینه است (m≈۰.۵) و روی سقف و کف صفر —
    # فرسایش جایی می‌نشیند که شیب هست، مثل کوه واقعی.
    flank = 4.0 * m * (1.0 - m)

    # شیارهای عمودی روی دامنه‌ها؛ فرکانس ناهمسان تا کشیده شوند
    h += (fbm(x * 0.185 + 7, z * 0.052 + 3, 4) - 0.5) * 2.6 * flank
    h += (fbm(x * 0.052 + 61, z * 0.185 + 29, 4) - 0.5) * 2.6 * flank

    # چین‌های درشت‌تر روی کل حجم
    h += (fbm(x * 0.048 + 22, z * 0.048 + 31, 4) - 0.5) * 2.4 * m

    # دانه‌ی ریز همه‌جا، تا سطح هیچ‌جا صاف نماند
    h += (fbm(x * 0.155 + 3, z * 0.155 + 5, 3) - 0.5) * 1.1

    # کوه‌های دوردست فقط برای افق. شروعشان بیرون از نقش است
    # (نقش تا شعاع LOGO_SPAN/2 پهن می‌شود) وگرنه رویش می‌افتند.
    h += fbm(x * 0.0055 + 3, z * 0.0055 + 9, 5) * 210.0 * smoothstep(300, 580, r)

    # موج بسیار ملایم روی دشت، تا مثل یک میزِ صاف به نظر نرسد
    h += (fbm(x * 0.010 + 41, z * 0.010 + 17, 3) - 0.5) * 8.0 * smoothstep(245, 340, r)

    return h


# =============================================================
#  ۳. پاک‌کردن صحنه
# =============================================================
def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials,
                  bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


# =============================================================
#  ۴. زمین
# =============================================================
def build_terrain():
    mesh = bpy.data.meshes.new("Valley")
    obj = bpy.data.objects.new("Valley", mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    step = SIZE / (GRID - 1)
    half = SIZE / 2.0

    verts = []
    for j in range(GRID):
        row = []
        z = -half + j * step
        for i in range(GRID):
            x = -half + i * step
            row.append(bm.verts.new((x, z, terrain_h(x, z))))  # Blender: Z بالا
        verts.append(row)

    bm.verts.ensure_lookup_table()
    for j in range(GRID - 1):
        for i in range(GRID - 1):
            bm.faces.new((verts[j][i], verts[j][i + 1],
                          verts[j + 1][i + 1], verts[j + 1][i]))

    bm.to_mesh(mesh)
    bm.free()

    # سایه‌زنی نرم. با فرسایشِ هندسی، سایه‌زنی تخت هر وجه را جدا
    # نشان می‌داد و سطح ارّه‌ای می‌شد.
    for poly in mesh.polygons:
        poly.use_smooth = True

    # گردکردن هندسه: ستیغ‌ها را از حالت تیغه‌ای درمی‌آورد
    sm = obj.modifiers.new("Round", type="SMOOTH")
    sm.factor = 0.32
    sm.iterations = 1

    # مودیفایر فرسایش عمداً حذف شد — با یک طرح دوبعدیِ ضخامت‌دار
    # جور درنمی‌آید.

    return obj


# =============================================================
#  ۵. جنس صخره
# =============================================================
def rock_material(obj):
    """جنس سنگ با بافت چندلایه.

    یک رنگِ تخت، سطح را پلاستیکی می‌کند. سنگ به چند مقیاس بافت
    نیاز دارد که روی هم بنشینند:
        • نویز درشت  → تغییر رنگ و لَک‌های بزرگ
        • ورونوی      → ترک و درزِ سنگ
        • نویز متوسط  → ناهمواری اصلی
        • نویز ریز    → دانه‌ی سطح
    زبری هم ثابت نیست؛ با نویز تغییر می‌کند تا بازتاب یکنواخت نباشد.
    """
    mat = bpy.data.materials.new("Rock")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Metallic"].default_value = 0.0

    # مختصات شیء، تا مقیاس بافت به ابعاد واقعی زمین بسته باشد
    coord = nt.nodes.new("ShaderNodeTexCoord")

    def noise(scale, detail, rough=0.55, distortion=0.0):
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        if "Distortion" in n.inputs:
            n.inputs["Distortion"].default_value = distortion
        nt.links.new(coord.outputs["Object"], n.inputs["Vector"])
        return n

    n_big = noise(0.012, 8.0, 0.62, 0.4)     # لکه‌های بزرگ، ~۸۰ واحد
    n_mid = noise(0.090, 14.0, 0.58)         # ناهمواری اصلی، ~۱۱ واحد
    n_fine = noise(0.420, 10.0, 0.50)        # دانه‌ی سطح، ~۲.۴ واحد

    # ترک‌های سنگ
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 0.055
    nt.links.new(coord.outputs["Object"], vor.inputs["Vector"])

    # --- رنگ: از خاکستریِ سرد تا آبیِ تیره ---
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[0].color = (0.018, 0.028, 0.048, 1.0)
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = (0.075, 0.095, 0.130, 1.0)
    nt.links.new(n_big.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

    # --- زبری متغیر ---
    rough = nt.nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.74
    rough.inputs["To Max"].default_value = 0.97
    nt.links.new(n_mid.outputs["Fac"], rough.inputs["Value"])
    nt.links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])

    # --- برجستگی: سه لایه روی هم ---
    b1 = nt.nodes.new("ShaderNodeBump")
    b1.inputs["Strength"].default_value = 0.85
    b1.inputs["Distance"].default_value = 2.0
    nt.links.new(n_mid.outputs["Fac"], b1.inputs["Height"])

    b2 = nt.nodes.new("ShaderNodeBump")
    b2.inputs["Strength"].default_value = 0.50
    b2.inputs["Distance"].default_value = 0.7
    nt.links.new(n_fine.outputs["Fac"], b2.inputs["Height"])
    nt.links.new(b1.outputs["Normal"], b2.inputs["Normal"])

    b3 = nt.nodes.new("ShaderNodeBump")
    b3.inputs["Strength"].default_value = 0.45
    b3.inputs["Distance"].default_value = 1.3
    nt.links.new(vor.outputs["Distance"], b3.inputs["Height"])
    nt.links.new(b2.outputs["Normal"], b3.inputs["Normal"])

    nt.links.new(b3.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    obj.data.materials.append(mat)


# =============================================================
#  ۶. مه حجمی — همان چیزی که عمق تصویر را می‌سازد
# =============================================================
def build_low_mist():
    """مه غلیظِ کم‌ارتفاع که فقط در کانال‌ها می‌نشیند.

    امضای بصری صحنه‌ی مرجع همین است: صخره تیره می‌ماند و کفِ
    کانال‌ها روشن می‌شود. بدون این، کانال و دیواره هم‌ارزش‌اند و
    تصویر تخت به نظر می‌رسد.
    """
    top = WALL_H * 1.15
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, top / 2.0))
    mist = bpy.context.object
    mist.name = "LowMist"
    mist.scale = (LOGO_SPAN * 1.35, LOGO_SPAN * 1.35, top)

    mat = bpy.data.materials.new("LowMist")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.72, 0.84, 1.0, 1.0)

    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.02
    ramp.color_ramp.elements[0].color = (1, 1, 1, 1)
    ramp.color_ramp.elements[1].position = 0.36      # فقط تا نیمه‌ی دیواره‌ها
    ramp.color_ramp.elements[1].color = (0, 0, 0, 1)

    turb = nt.nodes.new("ShaderNodeTexNoise")
    turb.inputs["Scale"].default_value = 3.2
    turb.inputs["Detail"].default_value = 7.0
    nt.links.new(coord.outputs["Object"], turb.inputs["Vector"])

    m1 = nt.nodes.new("ShaderNodeMath"); m1.operation = "MULTIPLY"
    m2 = nt.nodes.new("ShaderNodeMath"); m2.operation = "MULTIPLY"
    m2.inputs[1].default_value = LOW_MIST_DENSITY

    nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], m1.inputs[0])
    nt.links.new(turb.outputs["Fac"], m1.inputs[1])
    nt.links.new(m1.outputs["Value"], m2.inputs[0])
    nt.links.new(m2.outputs["Value"], vol.inputs["Density"])
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])

    mist.data.materials.append(mat)
    return mist


def build_fog():
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 40))
    fog = bpy.context.object
    fog.name = "Fog"
    fog.scale = (SIZE * 1.2, SIZE * 1.2, 220)

    mat = bpy.data.materials.new("Fog")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.60, 0.74, 0.96, 1.0)
    vol.inputs["Density"].default_value = 1.0

    # چگالی از پایین به بالا کم می‌شود، تا مه در کف درّه جمع شود
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[0].color = (1, 1, 1, 1)
    ramp.color_ramp.elements[1].position = 0.72
    ramp.color_ramp.elements[1].color = (0, 0, 0, 1)

    mult = nt.nodes.new("ShaderNodeMath")
    mult.operation = "MULTIPLY"
    mult.inputs[1].default_value = FOG_DENSITY    # چگالی کل مه

    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mult.inputs[0])
    nt.links.new(mult.outputs["Value"], vol.inputs["Density"])
    nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])

    fog.data.materials.append(mat)
    return fog


# =============================================================
#  ۷. نور
# =============================================================
def make_mix(nt):
    """نود ترکیب رنگ. نامش بین نسخه‌های Blender عوض شده."""
    try:
        n = nt.nodes.new("ShaderNodeMix")
        n.data_type = "RGBA"
        n.blend_type = "MIX"
        return n
    except RuntimeError:
        return nt.nodes.new("ShaderNodeMixRGB")


def set_mix(n, fac, a_out, b_out, nt):
    if n.bl_idname == "ShaderNodeMix":
        n.inputs["Factor"].default_value = fac
        nt.links.new(a_out, n.inputs[6])      # A (رنگ)
        nt.links.new(b_out, n.inputs[7])      # B (رنگ)
    else:
        n.inputs["Fac"].default_value = fac
        nt.links.new(a_out, n.inputs["Color1"])
        nt.links.new(b_out, n.inputs["Color2"])


def mix_out(n):
    return n.outputs["Result"] if n.bl_idname == "ShaderNodeMix" else n.outputs["Color"]


def build_water():
    """آب ساکن در کانال‌های نقش.

    یک صفحه‌ی افقی پایین‌تر از سقف دیواره‌ها. چون دیواره‌ها بالاتر
    از سطح آب‌اند، آب فقط در کانال‌ها دیده می‌شود و بازتاب
    نشانگرهای نورانی رویش می‌افتد.
    """
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, WATER_LEVEL))
    water = bpy.context.object
    water.name = "Water"
    # تا افق کشیده می‌شود. سازه باید داخل یک پهنه‌ی آب بایستد،
    # نه وسط یک حوضچه‌ی کوچک — پیش‌تر فقط ±۲۴۸ واحد بود و
    # دشتِ اطراف خشک می‌ماند.
    water.scale = (SIZE * 3.0, SIZE * 3.0, 1)

    mat = bpy.data.materials.new("Water")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    # تیره ولی بسیار براق: بازتاب آسمان و نشانگرها را می‌گیرد
    bsdf.inputs["Base Color"].default_value = (0.050, 0.130, 0.225, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.045
    for key, val in (("Transmission Weight", 0.85), ("Transmission", 0.85)):
        if key in bsdf.inputs:                    # نام سوکت بین نسخه‌ها فرق دارد
            bsdf.inputs[key].default_value = val
            break
    if "IOR" in bsdf.inputs:
        bsdf.inputs["IOR"].default_value = 1.333

    # --- موج ---
    # آبِ کاملاً صاف فقط آسمانِ تیره را بازتاب می‌دهد و از زمین
    # جدا نمی‌شود. موج لازم است تا هر قله زاویه‌ی متفاوتی بگیرد و
    # نور را در نقاط پراکنده بشکند.
    #
    # مختصات جهانی می‌گیریم نه مختصات شیء: این صفحه چند هزار برابر
    # مقیاس خورده و در فضای محلی‌اش موج‌ها آن‌قدر کشیده می‌شدند
    # که عملاً ناپدید بودند.
    geo = nt.nodes.new("ShaderNodeNewGeometry")

    def wave(scale, detail, rough=0.5):
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        nt.links.new(geo.outputs["Position"], n.inputs["Vector"])
        return n

    w1 = wave(0.018, 5.0)      # موج بلند، ~۵۵ واحد
    w2 = wave(0.075, 7.0)      # موج میانی، ~۱۳ واحد
    w3 = wave(0.260, 5.0)      # چین‌وشکن ریز، ~۴ واحد

    b1 = nt.nodes.new("ShaderNodeBump")
    b1.inputs["Strength"].default_value = 0.55
    b1.inputs["Distance"].default_value = 2.6
    nt.links.new(w1.outputs["Fac"], b1.inputs["Height"])

    b2 = nt.nodes.new("ShaderNodeBump")
    b2.inputs["Strength"].default_value = 0.40
    b2.inputs["Distance"].default_value = 0.9
    nt.links.new(w2.outputs["Fac"], b2.inputs["Height"])
    nt.links.new(b1.outputs["Normal"], b2.inputs["Normal"])

    b3 = nt.nodes.new("ShaderNodeBump")
    b3.inputs["Strength"].default_value = 0.28
    b3.inputs["Distance"].default_value = 0.3
    nt.links.new(w3.outputs["Fac"], b3.inputs["Height"])
    nt.links.new(b2.outputs["Normal"], b3.inputs["Normal"])

    nt.links.new(b3.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    water.data.materials.append(mat)
    return water


def build_lights():
    # مهتاب از پشت — همان جهت نور صحنه‌ی وب
    bpy.ops.object.light_add(type="SUN", location=(-90, -150, 160))
    key = bpy.context.object
    key.data.energy = SUN_ENERGY
    key.data.angle = math.radians(2.5)            # سایه‌ی کمی نرم
    key.data.color = (0.78, 0.86, 1.0)
    key.rotation_euler = (math.radians(52), 0, math.radians(-32))

    # پرکننده‌ی سرد از روبه‌رو
    bpy.ops.object.light_add(type="AREA", location=(110, 90, 70))
    fill = bpy.context.object
    fill.data.energy = FILL_ENERGY
    fill.data.size = 200
    fill.data.color = (0.32, 0.48, 0.85)

    # آسمان
    world = bpy.data.worlds.new("Sky")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    wout = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "EASING"
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value[1] = math.radians(90)
    coord = nt.nodes.new("ShaderNodeTexCoord")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.012, 0.024, 0.055, 1)
    ramp.color_ramp.elements[1].color = (0.34, 0.48, 0.72, 1)

    nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])

    # ابر: بدون آن، آسمان یک گرادیانِ صاف است و آب چیزی برای
    # بازتاب‌دادن ندارد — به همین دلیل سطح آب دیده نمی‌شد.
    cloud = nt.nodes.new("ShaderNodeTexNoise")
    cloud.inputs["Scale"].default_value = 2.4
    cloud.inputs["Detail"].default_value = 9.0
    cloud.inputs["Roughness"].default_value = 0.68
    nt.links.new(coord.outputs["Generated"], cloud.inputs["Vector"])

    cramp = nt.nodes.new("ShaderNodeValToRGB")
    cramp.color_ramp.elements[0].position = 0.38
    cramp.color_ramp.elements[0].color = (0.06, 0.10, 0.18, 1)
    cramp.color_ramp.elements[1].position = 0.68
    cramp.color_ramp.elements[1].color = (0.88, 0.93, 1.00, 1)
    nt.links.new(cloud.outputs["Fac"], cramp.inputs["Fac"])

    mix = make_mix(nt)
    set_mix(mix, 0.62, ramp.outputs["Color"], cramp.outputs["Color"], nt)
    nt.links.new(mix_out(mix), bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.9
    nt.links.new(bg.outputs["Background"], wout.inputs["Surface"])


# =============================================================
#  ۸. نشانگرهای پروژه‌ها — هم‌مکان با صحنه‌ی وب
# =============================================================
MARKER_COLORS = [
    (0.42, 0.55, 1.00),   # آئورا
    (0.20, 0.85, 0.62),   # خیریه
    (1.00, 0.45, 0.30),   # دامستیکا
    (0.98, 0.78, 0.25),   # رزومه‌استودیو
    (0.35, 0.80, 1.00),   # خرید از چین
    (0.85, 0.40, 0.95),   # توپر
    (0.45, 0.95, 0.45),   # داشبورد اکسل
    (1.00, 0.35, 0.55),   # بازی و انیمیشن
]


def export_marker_positions(cam):
    """مختصات نمایشگرِ دودها را روی تصویر می‌نویسد.

    سایت باید نشانگرهای تعاملی را دقیقاً روی همان دودهایی بگذارد
    که در رندر پخته شده‌اند. چشمی جاگذاری‌کردن با هر تغییر دوربین
    به‌هم می‌ریزد؛ این‌طور همیشه هم‌خوان می‌ماند.
    """
    import json
    from bpy_extras.object_utils import world_to_camera_view
    scene = bpy.context.scene
    deps = bpy.context.evaluated_depsgraph_get()
    scene.view_layers[0].update()

    out = []
    n = len(MARKER_COLORS)
    for idx, col in enumerate(MARKER_COLORS):
        ang = (idx / n) * 2 * math.pi + 0.7
        rad = [42.0, 95.0, 143.0, 191.0][idx % 4]
        x = math.cos(ang) * rad
        y = math.sin(ang) * rad
        base = max(terrain_h(x, y), WATER_LEVEL)
        world = Vector((x, y, base + SMOKE_H * 0.30))
        co = world_to_camera_view(scene, cam, world)
        out.append({
            "i": idx,
            "x": round(co.x * 100, 2),          # درصد از چپ
            "y": round((1.0 - co.y) * 100, 2),  # درصد از بالا
            "depth": round(co.z, 1),
            "color": "#%02x%02x%02x" % tuple(
                min(255, int(c ** (1 / 2.2) * 255)) for c in col),
            "onscreen": 0.0 < co.x < 1.0 and 0.0 < co.y < 1.0,
        })

    path = os.path.join(HERE, "markers.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("[valley] markers.json written (%d on screen)"
          % sum(1 for m in out if m["onscreen"]))
    _ = deps


def build_markers():
    """ستون دود رنگی با چراغ در پایه‌اش.

    گویِ توپر، نقطه‌ی سفیدِ بی‌روح می‌ساخت. اینجا هر نشانگر یک
    حجم دود است که از پایین نورانی می‌شود — نور از داخلِ دود
    عبور می‌کند و رنگ را در حجم پخش می‌کند.
    """
    n = len(MARKER_COLORS)
    for idx, col in enumerate(MARKER_COLORS):
        ang = (idx / n) * 2 * math.pi + 0.7
        rad = [42.0, 95.0, 143.0, 191.0][idx % 4]
        x = math.cos(ang) * rad
        y = math.sin(ang) * rad
        base = max(terrain_h(x, y), WATER_LEVEL)

        # --- چراغ در پایه ---
        bpy.ops.object.light_add(type="POINT", location=(x, y, base + 1.6))
        lamp = bpy.context.object
        lamp.name = "MarkerLamp_%d" % (idx + 1)
        lamp.data.energy = MARKER_LAMP_ENERGY
        lamp.data.shadow_soft_size = 1.2
        lamp.data.color = col

        # --- ستون دود ---
        bpy.ops.mesh.primitive_cone_add(
            radius1=3.2, radius2=9.0, depth=SMOKE_H,
            location=(x, y, base + SMOKE_H / 2.0))
        smoke = bpy.context.object
        smoke.name = "MarkerSmoke_%d" % (idx + 1)

        mat = bpy.data.materials.new("Smoke_%d" % (idx + 1))
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        vol = nt.nodes.new("ShaderNodeVolumePrincipled")
        vol.inputs["Color"].default_value = (col[0], col[1], col[2], 1.0)

        # چگالی از پایین به بالا کم می‌شود تا دود در هوا محو شود
        coord = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        fade = nt.nodes.new("ShaderNodeValToRGB")
        fade.color_ramp.elements[0].position = 0.05
        fade.color_ramp.elements[0].color = (1, 1, 1, 1)
        fade.color_ramp.elements[1].position = 0.95
        fade.color_ramp.elements[1].color = (0, 0, 0, 1)

        turb = nt.nodes.new("ShaderNodeTexNoise")
        turb.inputs["Scale"].default_value = 4.5
        turb.inputs["Detail"].default_value = 8.0
        nt.links.new(coord.outputs["Object"], turb.inputs["Vector"])

        mul1 = nt.nodes.new("ShaderNodeMath")
        mul1.operation = "MULTIPLY"
        mul2 = nt.nodes.new("ShaderNodeMath")
        mul2.operation = "MULTIPLY"
        mul2.inputs[1].default_value = SMOKE_DENSITY

        nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])
        nt.links.new(sep.outputs["Z"], fade.inputs["Fac"])
        nt.links.new(fade.outputs["Color"], mul1.inputs[0])
        nt.links.new(turb.outputs["Fac"], mul1.inputs[1])
        nt.links.new(mul1.outputs["Value"], mul2.inputs[0])
        nt.links.new(mul2.outputs["Value"], vol.inputs["Density"])
        nt.links.new(vol.outputs["Volume"], out.inputs["Volume"])
        smoke.data.materials.append(mat)

        # --- هدفِ کلیک برای صحنه‌ی وب (در رندر نامرئی) ---
        bpy.ops.mesh.primitive_uv_sphere_add(
            radius=2.0, location=(x, y, base + 2.0))
        core = bpy.context.object
        core.name = "MarkerCore_%d" % (idx + 1)
        cm = bpy.data.materials.new("Core_%d" % (idx + 1))
        cm.use_nodes = True
        cnt = cm.node_tree
        cnt.nodes.clear()
        cout = cnt.nodes.new("ShaderNodeOutputMaterial")
        em = cnt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (col[0], col[1], col[2], 1.0)
        em.inputs["Strength"].default_value = MARKER_EMISSION
        cnt.links.new(em.outputs["Emission"], cout.inputs["Surface"])
        core.data.materials.append(cm)


# =============================================================
#  ۹. دوربین — همان زاویه‌ی صحنه‌ی وب
#     ph=0.92 rad از محور بالا، r=206، هدف (0,0,2)
# =============================================================
def build_camera():
    ph, th, r = CAM_PHI, CAM_THETA, CAM_DIST
    horiz = r * math.sin(ph)
    x = horiz * math.cos(th)
    y = horiz * math.sin(th)
    z = r * math.cos(ph)

    bpy.ops.object.camera_add(location=(x, y, z))
    cam = bpy.context.object
    cam.data.sensor_fit = "VERTICAL"
    cam.data.angle_y = math.radians(36)           # برابر FOV صحنه‌ی وب

    target = bpy.data.objects.new("CamTarget", None)
    bpy.context.collection.objects.link(target)
    target.location = (0, 0, 18)

    con = cam.constraints.new(type="TRACK_TO")
    con.target = target
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"

    bpy.context.scene.camera = cam
    return cam


# =============================================================
#  ۱۰. تنظیمات رندر
# =============================================================
def setup_render():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.cycles.volume_bounces = 2
    scene.cycles.transparent_max_bounces = 8

    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"

    # نام تبدیل نمایش بین نسخه‌ها فرق می‌کند. اسم اشتباه بی‌صدا
    # نادیده گرفته می‌شود و تصویر سوخته بیرون می‌آید — دقیقاً همان
    # چیزی که بار اول اتفاق افتاد. پس امتحان‌شان می‌کنیم و
    # گزارش می‌دهیم کدام گرفت.
    applied = None
    for name in ("AgX", "Filmic", "Standard"):
        try:
            scene.view_settings.view_transform = name
            applied = name
            break
        except TypeError:
            continue

    for look in ("AgX - Medium High Contrast", "Medium High Contrast", "None"):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue

    scene.view_settings.exposure = EXPOSURE
    print("[valley] view transform: %s  look: %s  exposure: %.2f"
          % (applied, scene.view_settings.look, scene.view_settings.exposure))

    if USE_GPU:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for backend in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = backend
                break
            except TypeError:
                continue
        prefs.get_devices()
        enabled = []
        for d in prefs.devices:
            d.use = (d.type != "CPU")
            if d.use:
                enabled.append(d.name)
        scene.cycles.device = "GPU"
        print("[valley] GPU:", prefs.compute_device_type, enabled)


# =============================================================
#  اجرا
# =============================================================
def main():
    print("[valley] building scene ...")
    clear_scene()
    try_load_mask()

    ground = build_terrain()
    rock_material(ground)
    build_water()
    build_low_mist()
    build_fog()
    build_lights()
    build_markers()
    cam = build_camera()
    setup_render()

    # مختصات دودها روی تصویر — سایت نشانگرهای تعاملی را
    # دقیقاً رویشان می‌گذارد
    export_marker_positions(cam)
    if os.environ.get("VALLEY_FAST"):
        print("[valley] VALLEY_FAST set - skipping render")
        return

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, "valley.png")
    bpy.context.scene.render.filepath = path

    print("[valley] engine: %s   device: %s"
          % (bpy.context.scene.render.engine, bpy.context.scene.cycles.device))
    print("[valley] rendering -> %s" % path)
    bpy.ops.render.render(write_still=True)
    print("[valley] done")


main()
