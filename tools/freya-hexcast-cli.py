#!/usr/bin/env python3
"""Freya HexCast 8-bit dither CLI.

Render image inputs as terminal dither character art and optionally export
Freya-style asset packs (logo, favicon, banner, gif).
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


DEFAULT_CHARSET = " .,:;ox%#@"
try:
    from generate_freya_logos import SOURCES as BATCH_SOURCES  # type: ignore
except Exception:
    BATCH_SOURCES = {
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
    fitted = ImageOps.fit(img, (px, px), method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))
    dithered = fitted.quantize(colors=16, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    return dithered.convert("RGBA")


def upscale_pixel(sprite: Image.Image, size: int = 512) -> Image.Image:
    up = sprite.resize((size, size), Image.Resampling.NEAREST)
    return up.filter(ImageFilter.SHARPEN)


def save_logo(sprite: Image.Image, name: str, out_dir: Path) -> Path:
    logo = upscale_pixel(sprite, 512)
    border = Image.new("RGBA", (560, 560), (12, 18, 32, 255))
    border.paste(logo, (24, 24), logo)
    out = out_dir / f"{name}-logo.png"
    border.save(out)
    return out


def save_favicon(sprite: Image.Image, name: str, out_dir: Path) -> Path:
    out = out_dir / f"{name}-favicon.png"
    sprite.resize((32, 32), Image.Resampling.NEAREST).save(out)
    return out


def save_banner(sprite: Image.Image, name: str, out_dir: Path) -> Path:
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
    out = out_dir / f"{name}-banner.png"
    banner.save(out)
    return out


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


def save_gif(sprite: Image.Image, name: str, out_dir: Path) -> Path:
    frames = list(gif_frames(sprite))
    out = out_dir / f"{name}.gif"
    frames[0].save(
        out,
        save_all=True,
        append_images=frames[1:],
        duration=110,
        loop=0,
        optimize=False,
        disposal=2,
    )
    return out


def _resize_for_terminal(img: Image.Image, width: int, height: int | None) -> Image.Image:
    src = img.convert("RGB")
    if height is None:
        aspect = src.height / max(1, src.width)
        height = max(8, int(width * aspect * 0.55))
    return ImageOps.fit(src, (width, height), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def _dither(img: Image.Image, palette_size: int) -> Image.Image:
    quantized = img.quantize(
        colors=max(2, min(256, palette_size)),
        method=Image.Quantize.FASTOCTREE,
        dither=Image.Dither.FLOYDSTEINBERG,
    )
    return quantized.convert("RGB")


def _char_for_rgb(r: int, g: int, b: int, charset: str, invert: bool) -> str:
    lum = (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
    idx = int((lum / 255.0) * (len(charset) - 1))
    if invert:
        idx = (len(charset) - 1) - idx
    return charset[idx]


def render_hexcast_text(
    src: Path,
    width: int,
    height: int | None,
    palette_size: int,
    charset: str,
    invert: bool,
    color: bool,
) -> str:
    base = Image.open(src).convert("RGB")
    img = _dither(_resize_for_terminal(base, width, height), palette_size=palette_size)
    lines: list[str] = []
    px = img.load()
    for y in range(img.height):
        row: list[str] = []
        for x in range(img.width):
            r, g, b = px[x, y]
            ch = _char_for_rgb(r, g, b, charset, invert)
            if color:
                row.append(f"\x1b[38;2;{r};{g};{b}m{ch}")
            else:
                row.append(ch)
        if color:
            row.append("\x1b[0m")
        lines.append("".join(row))
    return "\n".join(lines)


def cmd_render(args: argparse.Namespace) -> int:
    text = render_hexcast_text(
        src=args.input,
        width=args.width,
        height=args.height,
        palette_size=args.palette,
        charset=args.charset,
        invert=args.invert,
        color=not args.no_color,
    )
    print(text)
    if args.save_txt:
        args.save_txt.parent.mkdir(parents=True, exist_ok=True)
        args.save_txt.write_text(text + "\n", encoding="utf-8")
        print(f"[saved] {args.save_txt}")
    return 0


def cmd_pack(args: argparse.Namespace) -> int:
    out_dir = args.out / args.name
    out_dir.mkdir(parents=True, exist_ok=True)
    sprite = make_sprite(args.input, px=args.sprite_size)
    files = [
        save_logo(sprite, args.name, out_dir),
        save_favicon(sprite, args.name, out_dir),
        save_banner(sprite, args.name, out_dir),
        save_gif(sprite, args.name, out_dir),
    ]
    print(f"[pack] {args.name}")
    for fp in files:
        print(f" - {fp}")
    return 0


def cmd_batch(args: argparse.Namespace) -> int:
    selected = set(args.only or BATCH_SOURCES.keys())
    missing_names = [name for name in selected if name not in BATCH_SOURCES]
    if missing_names:
        print("[error] unknown names: " + ", ".join(sorted(missing_names)))
        print("[hint] available: " + ", ".join(sorted(BATCH_SOURCES)))
        return 2

    failures: list[str] = []
    for name in sorted(selected):
        src = Path(BATCH_SOURCES[name])
        if not src.exists():
            failures.append(f"{name}: missing source at {src}")
            continue
        out_dir = args.out / name
        out_dir.mkdir(parents=True, exist_ok=True)
        sprite = make_sprite(src, px=args.sprite_size)
        files = [
            save_logo(sprite, name, out_dir),
            save_favicon(sprite, name, out_dir),
            save_banner(sprite, name, out_dir),
            save_gif(sprite, name, out_dir),
        ]
        print(f"[batch] {name}")
        for fp in files:
            print(f" - {fp}")
    if failures:
        print("[error] batch completed with missing sources:")
        for msg in failures:
            print(" - " + msg)
        return 1
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="freya-hexcast",
        description="8-bit HexCast dither CLI for FreyaUnits character art.",
    )
    sub = p.add_subparsers(dest="command", required=True)

    render = sub.add_parser("render", help="Render an input image as terminal dither art.")
    render.add_argument("input", type=Path, help="Input image path.")
    render.add_argument("--width", type=int, default=84, help="Terminal character width.")
    render.add_argument("--height", type=int, default=None, help="Terminal character height.")
    render.add_argument("--palette", type=int, default=16, help="Quantize palette size (2-256).")
    render.add_argument("--charset", default=DEFAULT_CHARSET, help="Dark-to-light character ramp.")
    render.add_argument("--invert", action="store_true", help="Invert brightness mapping.")
    render.add_argument("--no-color", action="store_true", help="Disable ANSI truecolor output.")
    render.add_argument("--save-txt", type=Path, default=None, help="Optional output text file.")
    render.set_defaults(func=cmd_render)

    pack = sub.add_parser("pack", help="Generate logo/favicon/banner/gif from one character image.")
    pack.add_argument("name", help="Character name used in output filenames.")
    pack.add_argument("input", type=Path, help="Input image path.")
    pack.add_argument(
        "--out",
        type=Path,
        default=Path("tools/generated/freya-logos"),
        help="Output root directory.",
    )
    pack.add_argument("--sprite-size", type=int, default=64, help="Sprite resolution before upscaling.")
    pack.set_defaults(func=cmd_pack)

    batch = sub.add_parser(
        "batch",
        help="Generate all default Freya character packs using the existing source map.",
    )
    batch.add_argument(
        "--out",
        type=Path,
        default=Path("tools/generated/freya-logos"),
        help="Output root directory.",
    )
    batch.add_argument("--sprite-size", type=int, default=64, help="Sprite resolution before upscaling.")
    batch.add_argument(
        "--only",
        nargs="*",
        default=None,
        help="Optional names subset (e.g. ErikaFreya FreyaBowtie).",
    )
    batch.set_defaults(func=cmd_batch)
    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        return 1
    if hasattr(args, "input") and isinstance(args.input, Path) and not args.input.exists():
        raise FileNotFoundError(f"Input not found: {args.input}")
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
