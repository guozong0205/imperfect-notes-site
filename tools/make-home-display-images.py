#!/usr/bin/env python3
"""Create home-page display derivatives. Not a site build step.

Hero backgrounds are full-viewport CSS images, so they stay large enough to
cover a desktop window and gain a WebP sibling. Wallpaper thumbs and the
player cover are much smaller on screen, so those get separate files and the
original cover JPEGs stay in place.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
COVERS = ASSETS / "covers"
SM = COVERS / "sm"
MD = COVERS / "md"

HERO_WEBP_QUALITY = 82
HERO_JPEG_QUALITY = 84
SM_WIDTH = 480
MD_WIDTH = 960
SM_JPEG_QUALITY = 82
SM_WEBP_QUALITY = 80
MD_JPEG_QUALITY = 84
MD_WEBP_QUALITY = 82
ABOUT_WEBP_QUALITY = 82
# Player-sized files: static fallback, the active episode, and the 4K masters.
PLAYER_DERIVATIVES = {"ep09", "ep10", "ep11", "ep17", "ep26"}


def resized(image, width):
    if image.width <= width:
        return image.copy()
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def save_jpeg(image, path, quality):
    image.save(
        path,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=True,
        subsampling="4:2:2",
    )


def save_webp(image, path, quality):
    image.save(path, format="WEBP", quality=quality, method=6)


def main():
    SM.mkdir(parents=True, exist_ok=True)
    MD.mkdir(parents=True, exist_ok=True)

    for name in ("a", "b", "c", "d"):
        source = ASSETS / f"hero-statue-{name}.jpg"
        image = Image.open(source).convert("RGB")
        if name == "b" and image.width > 1920:
            image = resized(image, 1920)
            save_jpeg(image, source, HERO_JPEG_QUALITY)
        elif name == "c" and source.stat().st_size > 80_000:
            save_jpeg(image, source, HERO_JPEG_QUALITY)
            image = Image.open(source).convert("RGB")
        save_webp(image, ASSETS / f"hero-statue-{name}.webp", HERO_WEBP_QUALITY)
        print(f"hero {name}: {image.size[0]}x{image.size[1]}")

    for source in sorted(COVERS.glob("ep*.jpg")):
        image = Image.open(source).convert("RGB")
        note = f"{source.name}: {image.size[0]}"
        thumb = resized(image, SM_WIDTH)
        save_jpeg(thumb, SM / source.name, SM_JPEG_QUALITY)
        save_webp(thumb, SM / f"{source.stem}.webp", SM_WEBP_QUALITY)
        note += f" -> sm {thumb.size[0]}"
        if source.stem in PLAYER_DERIVATIVES:
            player = resized(image, MD_WIDTH)
            save_jpeg(player, MD / source.name, MD_JPEG_QUALITY)
            save_webp(player, MD / f"{source.stem}.webp", MD_WEBP_QUALITY)
            note += f" / md {player.size[0]}"
        print(note)

    about = Image.open(COVERS / "about.jpg").convert("RGB")
    save_webp(about, COVERS / "about.webp", ABOUT_WEBP_QUALITY)
    print(f"about.webp: {about.size[0]}x{about.size[1]}")


if __name__ == "__main__":
    main()
