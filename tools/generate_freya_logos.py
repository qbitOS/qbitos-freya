#!/usr/bin/env python3
"""Generate 8-bit dithered Freya character brand assets."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / "tools" / "generated" / "freya-logos"

SOURCES: dict[str, Path] = {
    "ErikaFreya": Path(
        "/Users/tref/.cursor/projects/Users-tref-uvspeed/assets/"
        "D128FC59-F47C-4479-8BE5-A6164DA2FC66_4_5005_c-974e0fe4-4293-4347-894c-a83474fc00b4.png"
    ),
    "FreyaBowtie": Path(
        "/Users/tref/.cursor/projects/Users-tref-uvspeed/assets/"
        "9CC9654E-56BC-4EB9-927F-4C7C16DAFE50_4_5005_c-561cceb0-b1e9-44bb-ab8e-45d5063dd8fd.png"
    ),
    "FreyaCane": Path(
        "/Users/tref/.cursor/projects/Users-tref-uvspeed/assets/"
        "1DD4D30E-EED7-41E8-AF83-2DB62C95B5D1_4_5005_c-908fedc1-253f-4f89-8e52-09be53464f76.png"
    ),
}


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("DejaVuSans-Bold.ttf", "Arial Bold.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_sprite(src: Path, px: int = 64) -> Image.Image:
    img = Image.open(src).convert("RGB")
    # Keep character centered; slightly favor upper-body details.
    fitted = ImageOps.fit(img, (px, px), method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))
    dithered = fitted.quantize(colors=16, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    return dithered.convert("RGBA")


def upscale_pixel(sprite: Image.Image, size: int = 512) -> Image.Image:
    up = sprite.resize((size, size), Image.Resampling.NEAREST)
    # Subtle edge crisping for logo usage.
    up = up.filter(ImageFilter.SHARPEN)
    return up


def save_logo(sprite: Image.Image, name: str, out_dir: Path) -> None:
    logo = upscale_pixel(sprite, 512)
    border = Image.new("RGBA", (560, 560), (12, 18, 32, 255))
    border.paste(logo, (24, 24), logo)
    border.save(out_dir / f"{name}-logo.png")


def save_favicon(sprite: Image.Image, name: str, out_dir: Path) -> None:
    icon = sprite.resize((32, 32), Image.Resampling.NEAREST)
    icon.save(out_dir / f"{name}-favicon.png")


def save_banner(sprite: Image.Image, name: str, out_dir: Path) -> None:
    w, h = 1500, 500
    banner = Image.new("RGBA", (w, h), (8, 12, 20, 255))
    draw = ImageDraw.Draw(banner)
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(12 + (30 - 12) * t)
        g = int(16 + (58 - 16) * t)
        b = int(28 + (96 - 28) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b, 255))

    hero = upscale_pixel(sprite, 380)
    banner.paste(hero, (80, 60), hero)

    title_font = _font(86)
    sub_font = _font(34)
    draw.text((520, 150), name, fill=(232, 242, 255, 255), font=title_font)
    draw.text((520, 252), "FreyaUnits 8-bit Character Series", fill=(164, 196, 232, 255), font=sub_font)
    draw.text((520, 300), "HexCast Dither Pack", fill=(130, 168, 214, 255), font=sub_font)
    banner.save(out_dir / f"{name}-banner.png")


def gif_frames(sprite: Image.Image) -> Iterable[Image.Image]:
    base = upscale_pixel(sprite, 320).convert("RGBA")
    for i in range(8):
        frame = Image.new("RGBA", (380, 380), (10, 14, 26, 255))
        pulse = 1.0 + (0.08 if i % 4 in (1, 2) else 0.0)
        enhanced = ImageEnhance.Brightness(base).enhance(pulse)
        glow = ImageEnhance.Color(enhanced).enhance(1.08)
        offset = 24 + (1 if i % 2 else 0)
        frame.paste(glow, (30, offset), glow)
        scan = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(scan)
        for y in range(0, frame.height, 4):
            d.line([(0, y), (frame.width, y)], fill=(0, 0, 0, 22))
        yield Image.alpha_composite(frame, scan).convert("P", palette=Image.Palette.ADAPTIVE, colors=64)


def save_gif(sprite: Image.Image, name: str, out_dir: Path) -> None:
    frames = list(gif_frames(sprite))
    frames[0].save(
        out_dir / f"{name}.gif",
        save_all=True,
        append_images=frames[1:],
        duration=110,
        loop=0,
        optimize=False,
        disposal=2,
    )


def main() -> None:
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    for name, src in SOURCES.items():
        if not src.exists():
            raise FileNotFoundError(f"Missing source image for {name}: {src}")
        out_dir = OUT_ROOT / name
        out_dir.mkdir(parents=True, exist_ok=True)
        sprite = make_sprite(src)
        save_logo(sprite, name, out_dir)
        save_favicon(sprite, name, out_dir)
        save_banner(sprite, name, out_dir)
        save_gif(sprite, name, out_dir)
        print(f"generated: {name} -> {out_dir}")


if __name__ == "__main__":
    main()
