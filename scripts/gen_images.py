#!/usr/bin/env python3
"""Generate proper JPG/PNG placeholder images for the Brainchild site.

The repository shipped with SVG content saved as .jpg/.png files, which
browsers only render through MIME sniffing and production servers break.
This script produces real JPEG/PNG artwork for those missing keys.
"""
from PIL import Image, ImageDraw, ImageFilter
import os, math, random

OUT = "/home/user/brainchild/public/images"
random.seed(7)

def gradient(size, top_color, bot_color):
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    tr, tg, tb = top_color
    br, bg, bb = bot_color
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(tr + (br - tr) * t)
        g = int(tg + (bg - tg) * t)
        b = int(tb + (bb - bb) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return img

def add_stars(draw, size, count=120):
    w, h = size
    for _ in range(count):
        x = random.randint(0, w - 1)
        y = random.randint(0, h - 1)
        s = random.choice([1, 1, 1, 2])
        b = random.randint(180, 255)
        draw.ellipse((x, y, x + s, y + s), fill=(b, b, b, random.randint(120, 255)))

def add_neon_grid(draw, size, color=(255, 80, 200)):
    w, h = size
    for i in range(0, w, 60):
        draw.line((i, h, w/2 + (i - w/2)*3, 0), fill=(*color, 80), width=1)
    for j in range(0, h, 40):
        t = j / h
        yw = h - j
        draw.line((0, yw, w, yw), fill=(*color, int(160 * (1 - t))), width=1)

def place_text(draw, text, size, anchor="center", color=(255,255,255)):
    w, h = size
    try:
        from PIL import ImageFont
        # Use a bundled bitmap font to avoid font lookup issues
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    except Exception:
        font = ImageFont.load_default()
        small = font
    lines = text.split("\n")
    total_h = 0
    line_sizes = []
    for i, line in enumerate(lines):
        f = font if i == 0 else small
        bbox = draw.textbbox((0,0), line, font=f)
        lw, lh = bbox[2]-bbox[0], bbox[3]-bbox[1]
        line_sizes.append((line, f, lw, lh))
        total_h += lh + 8
    y = (h - total_h)//2
    for line, f, lw, lh in line_sizes:
        x = (w - lw)//2
        # soft shadow
        draw.text((x+2, y+2), line, font=f, fill=(0,0,0,180))
        draw.text((x, y), line, font=f, fill=color)
        y += lh + 8

def make_jpg(path, size, top, bot, title, motif="stars"):
    base = gradient(size, top, bot).convert("RGBA")
    overlay = Image.new("RGBA", size, (0,0,0,0))
    d = ImageDraw.Draw(overlay)
    if motif == "stars":
        add_stars(d, size)
        # glowing orb
        cx, cy = size[0]*3//4, size[1]//3
        for r, a in [(140,40),(100,70),(60,120),(25,220)]:
            d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=(180, 200, 255, a))
    elif motif == "neon":
        add_neon_grid(d, size)
        # neon sun
        cx, cy = size[0]//2, size[1]//2 - 40
        for r, a in [(160,30),(110,70),(70,130)]:
            d.ellipse((cx-r, cy-r, cx+r, cy+r), fill=(255, 120, 220, a))
    elif motif == "news":
        # abstract streaks
        for i in range(20):
            y = random.randint(0, size[1])
            shade = random.randint(200, 255)
            d.line((0, y, size[0], y - random.randint(-80,80)), fill=(shade, shade, 255, 50), width=2)
    elif motif == "studio":
        # warm ambient streaks
        for i in range(15):
            x = random.randint(0, size[0])
            d.line((x, 0, x + random.randint(-100,100), size[1]), fill=(255, 220, 180, 40), width=3)
    base = Image.alpha_composite(base, overlay)
    tlayer = Image.new("RGBA", size, (0,0,0,0))
    td = ImageDraw.Draw(tlayer)
    place_text(td, title, size)
    base = Image.alpha_composite(base, tlayer).convert("RGB")
    base.save(path, "JPEG", quality=86)
    print(f"wrote {path} ({os.path.getsize(path)} bytes)")

def make_png(path, size, color=(255,200,100)):
    """Cute cartoonish mascot placeholder — a smiling blob with big eyes."""
    img = Image.new("RGBA", size, (0,0,0,0))
    d = ImageDraw.Draw(img)
    w, h = size
    # body
    body_color = color
    d.ellipse((w*0.15, h*0.20, w*0.85, h*0.95), fill=body_color)
    # ears / horns
    d.polygon([(w*0.25, h*0.25), (w*0.20, h*0.05), (w*0.38, h*0.22)], fill=body_color)
    d.polygon([(w*0.75, h*0.25), (w*0.80, h*0.05), (w*0.62, h*0.22)], fill=body_color)
    # eyes
    for cx in (w*0.38, w*0.62):
        d.ellipse((cx-18, h*0.45-18, cx+18, h*0.45+18), fill=(30,20,40,255))
        d.ellipse((cx-10, h*0.45-12, cx-2, h*0.45-4), fill=(255,255,255,255))
    # smile
    d.arc((w*0.38, h*0.52, w*0.62, h*0.72), 10, 170, fill=(30,20,40,255), width=4)
    # cheeks
    for cx in (w*0.28, w*0.72):
        d.ellipse((cx-12, h*0.60-8, cx+12, h*0.60+8), fill=(255, 150, 170, 120))
    img.save(path, "PNG")
    print(f"wrote {path} ({os.path.getsize(path)} bytes)")

os.makedirs(f"{OUT}/games", exist_ok=True)
os.makedirs(f"{OUT}/news", exist_ok=True)

# Project Nebula — deep space
NEB_TOP, NEB_BOT = (6, 10, 40), (80, 30, 120)
make_jpg(f"{OUT}/games/nebula-cover.jpg", (1280, 720), NEB_TOP, NEB_BOT, "PROJECT NEBULA\nZero-Gravity Survival", motif="stars")
make_jpg(f"{OUT}/games/nebula-1.jpg", (1280, 720), (10, 5, 35), (60, 20, 90), "Docking Bay", motif="stars")
make_jpg(f"{OUT}/games/nebula-2.jpg", (1280, 720), (5, 15, 50), (30, 70, 140), "Deep Space Walk", motif="stars")

# Neon Drifter — cyberpunk pink
NEON_TOP, NEON_BOT = (20, 4, 40), (120, 10, 90)
make_jpg(f"{OUT}/games/neon-cover.jpg", (1280, 720), NEON_TOP, NEON_BOT, "NEON DRIFTER\nCyberpunk Racing", motif="neon")
make_jpg(f"{OUT}/games/neon-1.jpg", (1280, 720), (30, 2, 50), (180, 30, 120), "Downtown Sprint", motif="neon")
make_jpg(f"{OUT}/games/neon-2.jpg", (1280, 720), (10, 10, 40), (60, 130, 200), "Skyline Chase", motif="neon")

# News
make_jpg(f"{OUT}/news/nebula-alpha.jpg", (1280, 720), (12, 10, 50), (120, 60, 160), "NEBULA CLOSED ALPHA", motif="stars")
make_jpg(f"{OUT}/news/studio-expansion.jpg", (1280, 720), (40, 20, 10), (240, 160, 80), "STUDIO EXPANSION 2026", motif="studio")

# Small mascot PNG for favicon-like use (full res mascot_pix.png already exists)
make_png(f"{OUT}/mascot.png", (96, 96), color=(255, 190, 90))
print("Done.")
