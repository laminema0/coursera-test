#!/usr/bin/env python3
"""Compose a Deadpan Line frame: art scaled into the picture band + subtitle.

Usage:
    python3 compose_frame.py ART.png OUT.png --subtitle "Line one, man."
    python3 compose_frame.py ART_DIR/ OUT_DIR/ --subtitle "..."   # batch

Art should be 3:2 landscape (e.g. 1080x720) on white or transparent.
Values come from ../tokens.json so the style stays in one place.
"""
import argparse
import json
import os
import textwrap

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TOKENS = json.load(open(os.path.join(HERE, "..", "tokens.json")))

FONT_CANDIDATES = [
    "Arial.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "C:/Windows/Fonts/arial.ttf",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def compose(art_path, out_path, subtitle):
    c, b, s = TOKENS["canvas"], TOKENS["band"], TOKENS["subtitle"]
    frame = Image.new("RGB", (c["width"], c["height"]), TOKENS["color"]["paper"])

    art = Image.open(art_path).convert("RGBA")
    band_h = b["bottom"] - b["top"]
    scale = min(c["width"] / art.width, band_h / art.height)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    x = (c["width"] - art.width) // 2
    y = b["top"] + (band_h - art.height) // 2
    frame.paste(art, (x, y), art)

    if subtitle:
        font = load_font(s["size"])
        draw = ImageDraw.Draw(frame)
        lines = textwrap.wrap(subtitle, s["maxCharsPerLine"])[: s["maxLines"]]
        for i, line in enumerate(lines):
            ty = s["top"] + i * s["size"] * s["lineHeight"]
            draw.text((c["width"] / 2, ty), line, font=font,
                      fill=TOKENS["color"]["inkSubtitle"], anchor="mt")
    frame.save(out_path)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("art")
    p.add_argument("out")
    p.add_argument("--subtitle", default="")
    a = p.parse_args()
    if os.path.isdir(a.art):
        os.makedirs(a.out, exist_ok=True)
        for name in sorted(os.listdir(a.art)):
            if name.lower().endswith((".png", ".jpg", ".jpeg")):
                compose(os.path.join(a.art, name), os.path.join(a.out, name), a.subtitle)
    else:
        compose(a.art, a.out, a.subtitle)


if __name__ == "__main__":
    main()
