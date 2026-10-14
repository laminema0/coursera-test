#!/usr/bin/env python3
"""Draws the placeholder app icon: a status trail (unverified → reported → corroborated → confirmed).

Usage: python3 scripts/make-app-icon.py   (needs Pillow: pip install pillow)
Writes MyApp/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png (opaque, 1024×1024).
"""
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
SCALE = 4  # draw large, then downsample for smooth edges
OUT = Path(__file__).resolve().parent.parent / "MyApp/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"

TOP, BOTTOM = (16, 26, 43), (22, 45, 82)
GREY, AMBER, GREEN, BLUE = (141, 150, 165), (227, 169, 42), (63, 191, 114), (74, 166, 240)


def main() -> None:
    size = SIZE * SCALE
    image = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(image)
    for y in range(size):  # vertical gradient
        t = y / (size - 1)
        draw.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)))

    def circle(cx: float, cy: float, r: float, **kwargs) -> None:
        s = SCALE
        draw.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s], **kwargs)

    cy = 512
    circle(170, cy, 52, outline=GREY, width=22 * SCALE)  # hollow: unverified
    circle(330, cy, 62, fill=AMBER)                       # reported
    circle(510, cy, 80, fill=GREEN)                       # corroborated
    circle(760, cy, 150, fill=BLUE)                       # confirmed
    check = [(690, 515), (742, 567), (838, 455)]
    draw.line([(x * SCALE, y * SCALE) for x, y in check], fill=(255, 255, 255), width=40 * SCALE, joint="curve")
    for x, y in (check[0], check[-1]):  # round line caps
        circle(x, y, 20, fill=(255, 255, 255))

    image.resize((SIZE, SIZE), Image.LANCZOS).save(OUT, optimize=True)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
