# -*- coding: utf-8 -*-
"""
敦煌 3DShow 封面生成器
尺寸：1200x700
风格：石窟幽暗氛围 + 藻井团花 + 飘带 + 金沙粒子 + 敦煌配色
"""
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ============================================================
# 配置
# ============================================================
WIDTH, HEIGHT = 1200, 700
OUTPUT_PATH = r"D:\sd-webui-aki\sd-webui-aki-v4.2\dunhuang-3dshow 2\提交\封面.png"

# 敦煌配色体系
COLOR_BG_DEEP = (26, 20, 14)       # 深炭黑（背景最深）
COLOR_BG_MID = (58, 46, 34)        # 暖棕（背景中段）
COLOR_BG_GOLD = (110, 88, 42)      # 暗棕金（背景外圈）
COLOR_GOLD = (212, 175, 55)        # 暗金 #D4AF37（主金色）
COLOR_GOLD_BRIGHT = (245, 215, 110)  # 亮金（高光）
COLOR_GOLD_DIM = (139, 105, 20)    # 暗棕金 #8B6914
COLOR_SHIQING = (74, 124, 140)     # 石青 #4A7C8C
COLOR_SHILV = (91, 140, 106)       # 石绿 #5B8C6A
COLOR_ZHUSHA = (196, 69, 54)       # 朱砂 #C44536
COLOR_TUHUANG = (196, 166, 104)    # 土黄 #C4A668
COLOR_WARM_GRAY = (201, 184, 156)  # 暖灰文字色
COLOR_TEXT_DIM = (154, 138, 106)   # 暗暖灰

# 中文字体路径
FONT_PATH_TITLE = r"C:\Windows\Fonts\msyhbd.ttc"   # 微软雅黑粗体
FONT_PATH_BODY = r"C:\Windows\Fonts\msyh.ttc"      # 微软雅黑
FONT_PATH_SERIF = r"C:\Windows\Fonts\simhei.ttf"   # 黑体


def load_font(path, size):
    """加载字体，失败则回退默认"""
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def make_radial_gradient(size, center, inner_color, outer_color):
    """生成径向渐变图像（内深外浅或内浅外深）"""
    w, h = size
    img = Image.new("RGB", (w, h), outer_color)
    pixels = img.load()
    cx, cy = center
    max_dist = math.sqrt(max(cx, w - cx) ** 2 + max(cy, h - cy) ** 2)
    for y in range(h):
        for x in range(w):
            dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            ratio = min(dist / max_dist, 1.0)
            # 用幂函数让中心更深、外圈渐亮
            ratio = ratio ** 0.85
            r = int(inner_color[0] + (outer_color[0] - inner_color[0]) * ratio)
            g = int(inner_color[1] + (outer_color[1] - inner_color[1]) * ratio)
            b = int(inner_color[2] + (outer_color[2] - inner_color[2]) * ratio)
            pixels[x, y] = (r, g, b)
    return img


def draw_caisson(draw, cx, cy, radius):
    """绘制藻井团花（多层同心圆+8瓣莲花+宝相花）"""
    # 最外圈：暗金描边大圆
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        outline=COLOR_GOLD_DIM, width=3
    )

    # 第二圈：石青色环
    r2 = radius * 0.88
    draw.ellipse(
        [cx - r2, cy - r2, cx + r2, cy + r2],
        outline=COLOR_SHIQING, width=2
    )

    # 第三圈：暗金细线
    r3 = radius * 0.78
    draw.ellipse(
        [cx - r3, cy - r3, cx + r3, cy + r3],
        outline=COLOR_GOLD, width=1
    )

    # 8瓣莲花（外层）
    r_petal_outer = radius * 0.72
    r_petal_inner = radius * 0.25
    for i in range(8):
        angle = i * math.pi / 4 - math.pi / 2
        # 花瓣四个控制点
        p1 = (cx + r_petal_inner * math.cos(angle),
              cy + r_petal_inner * math.sin(angle))
        p2 = (cx + r_petal_outer * math.cos(angle - 0.25),
              cy + r_petal_outer * math.sin(angle - 0.25))
        p3 = (cx + r_petal_outer * 1.05 * math.cos(angle),
              cy + r_petal_outer * 1.05 * math.sin(angle))
        p4 = (cx + r_petal_outer * math.cos(angle + 0.25),
              cy + r_petal_outer * math.sin(angle + 0.25))
        draw.polygon([p1, p2, p3, p4], outline=COLOR_GOLD, fill=None)
        # 花瓣内填充淡金
        draw.line([p1, p3], fill=COLOR_GOLD_DIM, width=1)

    # 中心宝相花圆心
    r_center = radius * 0.22
    draw.ellipse(
        [cx - r_center, cy - r_center, cx + r_center, cy + r_center],
        outline=COLOR_GOLD_BRIGHT, width=2
    )
    # 中心小圆点
    r_dot = radius * 0.08
    draw.ellipse(
        [cx - r_dot, cy - r_dot, cx + r_dot, cy + r_dot],
        fill=COLOR_GOLD_BRIGHT
    )

    # 8个外圈装饰小圆（石青/朱砂交替）
    r_decor = radius * 0.95
    for i in range(8):
        angle = i * math.pi / 4 + math.pi / 8 - math.pi / 2
        dx = cx + r_decor * math.cos(angle)
        dy = cy + r_decor * math.sin(angle)
        r_small = 8
        color = COLOR_ZHUSHA if i % 2 == 0 else COLOR_SHIQING
        draw.ellipse(
            [dx - r_small, dy - r_small, dx + r_small, dy + r_small],
            fill=color, outline=COLOR_GOLD, width=1
        )

    # 16个内圈小点
    r_inner_dots = radius * 0.5
    for i in range(16):
        angle = i * math.pi / 8 - math.pi / 2
        dx = cx + r_inner_dots * math.cos(angle)
        dy = cy + r_inner_dots * math.sin(angle)
        r_small = 3
        draw.ellipse(
            [dx - r_small, dy - r_small, dx + r_small, dy + r_small],
            fill=COLOR_GOLD
        )


def draw_ribbon(draw, start, end, color, width=3):
    """绘制飘带（贝塞尔曲线近似）"""
    x1, y1 = start
    x2, y2 = end
    # 控制点偏移产生飘逸曲线
    mid_x = (x1 + x2) / 2
    mid_y = (y1 + y2) / 2
    offset = 80
    cp1 = (mid_x - offset, mid_y - 60)
    cp2 = (mid_x + offset, mid_y + 60)

    # 用多段直线近似三次贝塞尔
    points = []
    steps = 60
    for i in range(steps + 1):
        t = i / steps
        x = ((1 - t) ** 3 * x1 +
             3 * (1 - t) ** 2 * t * cp1[0] +
             3 * (1 - t) * t ** 2 * cp2[0] +
             t ** 3 * x2)
        y = ((1 - t) ** 3 * y1 +
             3 * (1 - t) ** 2 * t * cp1[1] +
             3 * (1 - t) * t ** 2 * cp2[1] +
             t ** 3 * y2)
        points.append((x, y))
    # 主线
    draw.line(points, fill=color, width=width)
    # 副线（浅色描边）
    draw.line(points, fill=COLOR_GOLD_DIM, width=width + 2)


def scatter_gold_sand(img, count=200):
    """撒金沙粒子（亮金小点+发光效果）"""
    draw = ImageDraw.Draw(img, "RGBA")
    random.seed(42)
    w, h = img.size
    for _ in range(count):
        x = random.randint(0, w - 1)
        y = random.randint(0, h - 1)
        # 避开中心藻井区域
        cx, cy = w // 2, h // 2
        if math.sqrt((x - cx) ** 2 + (y - cy) ** 2) < 180:
            continue
        r = random.choice([1, 1, 2, 2, 3])
        alpha = random.randint(80, 220)
        # 亮金粒子
        draw.ellipse(
            [x - r, y - r, x + r, y + r],
            fill=(245, 215, 110, alpha)
        )
    return img


def scatter_petals(img, count=40):
    """撒花瓣（椭圆，暖色调）"""
    draw = ImageDraw.Draw(img, "RGBA")
    random.seed(7)
    w, h = img.size
    colors = [
        (196, 69, 54, 160),     # 朱砂
        (196, 166, 104, 160),   # 土黄
        (212, 175, 55, 160),    # 暗金
        (201, 184, 156, 140),   # 暖灰
    ]
    for _ in range(count):
        x = random.randint(0, w - 1)
        y = random.randint(0, h - 1)
        cx, cy = w // 2, h // 2
        if math.sqrt((x - cx) ** 2 + (y - cy) ** 2) < 200:
            continue
        # 旋转椭圆模拟花瓣
        rx = random.randint(6, 12)
        ry = random.randint(3, 5)
        color = random.choice(colors)
        # 简化：直接画椭圆
        draw.ellipse(
            [x - rx, y - ry, x + rx, y + ry],
            fill=color
        )
    return img


def draw_vignette(img):
    """添加暗角，强化中心焦点"""
    w, h = img.size
    vignette = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(vignette)
    cx, cy = w // 2, h // 2
    max_dist = math.sqrt(cx ** 2 + cy ** 2)
    # 用径向渐变制作暗角蒙版
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            ratio = dist / max_dist
            # 边缘变暗
            val = int(255 * (1 - max(ratio * 0.6 - 0.2, 0)) ** 1.5)
            draw.rectangle([x, y, x + 1, y + 1], fill=val)
    vignette = vignette.resize((w, h))
    # 应用暗角
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    result = Image.composite(img, dark, vignette)
    return result


def draw_text_with_shadow(draw, position, text, font, fill, shadow=(0, 0, 0),
                          shadow_offset=(2, 2)):
    """绘制带阴影的文字"""
    x, y = position
    sx, sy = shadow_offset
    draw.text((x + sx, y + sy), text, font=font, fill=shadow)
    draw.text((x, y), text, font=font, fill=fill)


def draw_text_with_glow(img, position, text, font, fill, glow_color=(212, 175, 55)):
    """绘制带金色光晕的文字"""
    x, y = position
    # 光晕层：多次模糊绘制
    glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    glow_draw.text((x, y), text, font=font, fill=glow_color + (180,))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=4))
    img.paste(glow_layer, (0, 0), glow_layer)
    # 主文字
    draw = ImageDraw.Draw(img)
    draw.text((x + 1, y + 1), text, font=font, fill=(0, 0, 0))
    draw.text((x, y), text, font=font, fill=fill)
    return img


def main():
    print("=" * 50)
    print("敦煌 3DShow 封面生成器")
    print("=" * 50)

    # 1. 创建径向渐变背景（中心深，外圈渐亮）
    print("[1/7] 生成径向渐变背景...")
    img = make_radial_gradient(
        (WIDTH, HEIGHT),
        (WIDTH // 2, HEIGHT // 2),
        COLOR_BG_DEEP,
        COLOR_BG_GOLD
    )

    # 2. 绘制中心藻井团花
    print("[2/7] 绘制中心藻井团花...")
    draw = ImageDraw.Draw(img)
    cx, cy = WIDTH // 2, HEIGHT // 2
    draw_caisson(draw, cx, cy, radius=240)

    # 3. 绘制飘带（左右两侧）
    print("[3/7] 绘制飞天飘带...")
    # 左上飘带
    draw_ribbon(draw, (50, 100), (450, 250), COLOR_GOLD, width=3)
    # 右上飘带
    draw_ribbon(draw, (1150, 100), (750, 250), COLOR_GOLD, width=3)
    # 左下飘带
    draw_ribbon(draw, (80, 600), (480, 480), COLOR_SHIQING, width=3)
    # 右下飘带
    draw_ribbon(draw, (1120, 600), (720, 480), COLOR_ZHUSHA, width=3)

    # 4. 撒金沙粒子
    print("[4/7] 撒金沙粒子...")
    img = scatter_gold_sand(img, count=250)

    # 5. 撒花瓣
    print("[5/7] 撒花瓣...")
    img = scatter_petals(img, count=35)

    # 6. 绘制文字
    print("[6/7] 绘制标题文字...")
    # 顶部小字
    font_top = load_font(FONT_PATH_BODY, 22)
    top_text = "千年壁画  ·  永不褪色  ·  Web3D 数字洞窟"
    bbox = draw.textbbox((0, 0), top_text, font=font_top)
    tw = bbox[2] - bbox[0]
    draw_text_with_shadow(
        draw,
        ((WIDTH - tw) // 2, 50),
        top_text,
        font_top,
        COLOR_WARM_GRAY
    )

    # 装饰分隔线
    line_y = 88
    draw.line(
        [(WIDTH // 2 - 200, line_y), (WIDTH // 2 - 30, line_y)],
        fill=COLOR_GOLD_DIM, width=1
    )
    draw.line(
        [(WIDTH // 2 + 30, line_y), (WIDTH // 2 + 200, line_y)],
        fill=COLOR_GOLD_DIM, width=1
    )
    # 中间小菱形
    cx_dot = WIDTH // 2
    draw.polygon(
        [(cx_dot, line_y - 5), (cx_dot + 5, line_y),
         (cx_dot, line_y + 5), (cx_dot - 5, line_y)],
        fill=COLOR_GOLD
    )

    # 主标题"敦煌"（超大字，暗金色带光晕）
    font_main = load_font(FONT_PATH_SERIF, 180)
    main_text = "敦 煌"
    bbox = draw.textbbox((0, 0), main_text, font=font_main)
    mw = bbox[2] - bbox[0]
    mh = bbox[3] - bbox[1]
    # 居中略偏上
    main_x = (WIDTH - mw) // 2
    main_y = cy - mh // 2 - 30
    img = draw_text_with_glow(
        img, (main_x, main_y), main_text, font_main,
        fill=COLOR_GOLD_BRIGHT, glow_color=COLOR_GOLD
    )

    # 副标题"3DShow"
    font_sub = load_font(FONT_PATH_TITLE, 56)
    sub_text = "3 D S h o w"
    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((0, 0), sub_text, font=font_sub)
    sw = bbox[2] - bbox[0]
    draw_text_with_shadow(
        draw,
        ((WIDTH - sw) // 2, main_y + mh + 10),
        sub_text,
        font_sub,
        COLOR_GOLD
    )

    # 底部副标题
    font_bottom = load_font(FONT_PATH_TITLE, 28)
    bottom_text = "数 字 洞 窟 沉 浸 式 漫 游 展 馆"
    bbox = draw.textbbox((0, 0), bottom_text, font=font_bottom)
    bw = bbox[2] - bbox[0]
    draw_text_with_shadow(
        draw,
        ((WIDTH - bw) // 2, HEIGHT - 130),
        bottom_text,
        font_bottom,
        COLOR_WARM_GRAY
    )

    # 底部朝代标签
    font_dynasty = load_font(FONT_PATH_BODY, 20)
    dynasty_text = "西魏 285窟  ·  盛唐 45窟  ·  盛唐 217窟  ·  晚唐 17窟  ·  元代 3窟"
    bbox = draw.textbbox((0, 0), dynasty_text, font=font_dynasty)
    dw = bbox[2] - bbox[0]
    draw_text_with_shadow(
        draw,
        ((WIDTH - dw) // 2, HEIGHT - 70),
        dynasty_text,
        font_dynasty,
        COLOR_TEXT_DIM
    )

    # 底部装饰线
    draw.line(
        [(WIDTH // 2 - 250, HEIGHT - 40), (WIDTH // 2 + 250, HEIGHT - 40)],
        fill=COLOR_GOLD_DIM, width=1
    )

    # 7. 添加暗角
    print("[7/7] 添加暗角效果...")
    img = draw_vignette(img)

    # 保存
    print("\n保存封面至: {}".format(OUTPUT_PATH))
    img.save(OUTPUT_PATH, "PNG", optimize=True)
    import os
    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print("封面生成完成! 文件大小: {:.1f} KB".format(size_kb))
    print("=" * 50)


if __name__ == "__main__":
    main()
