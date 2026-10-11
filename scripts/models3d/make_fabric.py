"""Generate the tintable upholstery fabric maps (albedo, normal, roughness).

python scripts/models3d/make_fabric.py frontend/public/materials3d

A plain weave at THREADS_PER_TILE threads across one tile (the 3D models map
one tile to 8"), with per-thread thickness and shade variation (slub and
heathering) and soft low-frequency nap mottling. Everything is periodic, so
the maps tile seamlessly. Albedo is neutral grey around 0.86 so the viewer
can tint it with any upholstery colour.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 1024
THREADS_PER_TILE = 128          # 8" tile -> 16 threads per inch
rng = np.random.default_rng(6430)


def periodic_noise(size, scale_px):
    """Smooth tileable noise in [-1, 1]: white noise low-passed in Fourier space."""
    f = np.fft.fftfreq(size)
    fx, fy = np.meshgrid(f, f)
    spectrum = np.exp(-(fx ** 2 + fy ** 2) * (scale_px ** 2) * 4)
    field = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((size, size))) * spectrum))
    return field / np.abs(field).max()


def main(out_dir):
    out = Path(out_dir)
    p = SIZE // THREADS_PER_TILE                      # pixels per thread
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    i, j = (x // p).astype(int), (y // p).astype(int)
    u, v = (x % p + 0.5) / p, (y % p + 0.5) / p

    # per-thread variation (indices wrap, so the tile stays seamless)
    warp_thick = 0.85 + 0.3 * rng.random(THREADS_PER_TILE)
    weft_thick = 0.85 + 0.3 * rng.random(THREADS_PER_TILE)
    warp_shade = 1 + 0.025 * rng.standard_normal(THREADS_PER_TILE)
    weft_shade = 1 + 0.025 * rng.standard_normal(THREADS_PER_TILE)

    # thread cross-sections and the over/under bump along each thread
    warp = np.sin(np.pi * u) ** 0.7 * (0.65 + 0.35 * np.sin(np.pi * v)) * warp_thick[i]
    weft = np.sin(np.pi * v) ** 0.7 * (0.65 + 0.35 * np.sin(np.pi * u)) * weft_thick[j]
    warp_on_top = (i + j) % 2 == 0
    height = np.where(warp_on_top, warp, weft)
    shade = np.where(warp_on_top, warp_shade[i], weft_shade[j])
    fuzz = periodic_noise(SIZE, 1.5) * 0.08
    height = height + fuzz

    nap = periodic_noise(SIZE, 180)                   # broad, soft mottling
    albedo = 0.86 * (0.80 + 0.20 * np.clip(height, 0, 1)) * shade * (1 + 0.05 * nap)
    albedo = np.clip(albedo / albedo.mean() * 0.86, 0, 1)

    # normal map (OpenGL convention: +Y up) from the height field, wrapping
    strength = 2.2
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5 * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5 * strength
    n = np.dstack([-dx, dy, np.ones_like(dx)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)

    rough = np.clip(0.88 + 0.06 * (1 - np.clip(height, 0, 1)) + 0.02 * nap, 0, 1)

    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray((albedo * 255).astype(np.uint8)).convert("RGB").save(out / "fabric_albedo.jpg", quality=90)
    Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(out / "fabric_normal.jpg", quality=92)
    Image.fromarray((rough * 255).astype(np.uint8)).convert("RGB").save(out / "fabric_rough.jpg", quality=90)
    print("wrote", out, "albedo mean", round(float(albedo.mean()), 3))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "frontend/public/materials3d")
