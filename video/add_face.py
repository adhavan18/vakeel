"""Put the founder on camera around the launch film.

Builds: [intro clip] + film up to the end card + [outro clip] + end card, framed on the
film's dark backdrop with a name lower-third, loudness-matched to the narration.

Usage: python add_face.py [intro.mp4] [outro.mp4]
Defaults: public/face/intro.* and public/face/outro.* (either may be missing).
CUTS below keeps only the spoken parts of each take (jump cuts, alternating a slight
zoom), so the finished film stays under the 3-minute limit.
Writes out/vakeel-launch-face.mp4.
"""

import pathlib
import sys
from fractions import Fraction

import av
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).parent
FILM = ROOT / "out/vakeel-launch-final.mp4"
END_CARD_FRAMES = 135  # the calm film's end scene is 4.5 s (script_v2.json "end")
END_CARD_KEEP = 75  # trimmed to 2.5 s, faded out, to make room for the founder
ROTATE = 180  # the takes were recorded upside down
# Seconds of each take to keep, cut in the silences between phrases (from a word-level
# transcript plus an energy check). None keeps the whole take.
CUTS = {
    "intro": [(4.45, 9.05), (9.98, 17.95), (18.95, 21.35), (22.40, 23.25), (23.88, 25.70)],
    "outro": [(5.50, 14.90), (15.98, 17.88), (19.10, 24.50)],
}
W, H, FPS, SR = 1920, 1080, 30, 44100
INK = (11, 11, 12)
EMBER = (255, 90, 31)
FONT_DIR = pathlib.Path("C:/Windows/Fonts")


def font(name, size):
    for n in name:
        p = FONT_DIR / n
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


NAME_FONT = font(["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"], 44)
ROLE_FONT = font(["segoeui.ttf", "arial.ttf"], 28)


def find(stem):
    for ext in ("mp4", "mov", "webm", "mkv", "m4v"):
        p = ROOT / "public/face" / f"{stem}.{ext}"
        if p.exists():
            return p
    return None


def frame_template():
    bg = Image.new("RGB", (W, H), INK)
    glow = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(glow)
    d.ellipse((-300, 650, 1100, 1500), fill=(70, 28, 12))
    return Image.blend(bg, glow.filter(ImageFilter.GaussianBlur(160)), 0.9)


_SHADOWS = {}


def shadow_mask(x, y, cw, ch):
    key = (x, y, cw, ch)
    if key not in _SHADOWS:
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).rounded_rectangle((x, y + 24, x + cw, y + ch + 24), radius=28, fill=160)
        _SHADOWS[key] = m.filter(ImageFilter.GaussianBlur(40))
    return _SHADOWS[key]


def compose(img, t, dur, template, zoom=1.0, lower_third=True):
    """Place one camera frame on the backdrop: 16:9 fills a large rounded card, portrait sits left."""
    canvas = template.copy()
    if zoom != 1.0:
        iw, ih = img.size
        cw0, ch0 = iw / zoom, ih / zoom
        cx, cy = iw * 0.5, ih * 0.45
        left = min(max(0, cx - cw0 / 2), iw - cw0)
        top = min(max(0, cy - ch0 / 2), ih - ch0)
        img = img.crop((round(left), round(top), round(left + cw0), round(top + ch0)))
    w, h = img.size
    if w >= h:
        cw = 1600
        ch = round(cw * h / w)
        if ch > 900:
            ch, cw = 900, round(900 * w / h)
    else:
        ch = 960
        cw = round(ch * w / h)
    card = img.resize((cw, ch), Image.LANCZOS)
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, ch - 1), radius=28, fill=255)
    x = (W - cw) // 2 if w >= h else 120
    y = (H - ch) // 2
    canvas.paste((0, 0, 0), (0, 0), shadow_mask(x, y, cw, ch))
    canvas.paste(card, (x, y), mask)
    # Lower third, eased in over the first 0.5 s.
    a = min(1.0, max(0.0, (t - 0.4) / 0.5)) if lower_third else 0
    if a > 0:
        d = ImageDraw.Draw(canvas)
        if w >= h:
            lx, ly = x + 40, y + ch - 150
            d.rounded_rectangle((lx - 20, ly - 16, lx + 560, ly + 104), radius=18, fill=(11, 11, 12))
        else:
            lx, ly = x + cw + 80, H // 2 - 60
        off = round((1 - a) * 20)
        d.rectangle((lx, ly + off, lx + 6, ly + 84 + off), fill=EMBER)
        d.text((lx + 24, ly - 4 + off), "Tamil Adhavan S K", font=NAME_FONT, fill=(237, 233, 225))
        d.text((lx + 24, ly + 50 + off), "Built Vakeel · Environmental Hacks 2026", font=ROLE_FONT, fill=(154, 150, 142))
    # Fade from and to black at the edges of the clip.
    edge = min(1.0, t / 0.25, max(0.0, (dur - t) / 0.25))
    if edge < 1:
        canvas = Image.blend(Image.new("RGB", (W, H), (0, 0, 0)), canvas, edge)
    return canvas


def decode_audio(path):
    c = av.open(str(path))
    if not c.streams.audio:
        return np.zeros((0, 2), np.float32)
    res = av.AudioResampler(format="fltp", layout="stereo", rate=SR)
    out = []
    for fr in c.decode(audio=0):
        for o in res.resample(fr):
            out.append(o.to_ndarray().T)
    for o in res.resample(None):
        out.append(o.to_ndarray().T)
    c.close()
    return np.concatenate(out) if out else np.zeros((0, 2), np.float32)


def level(x, target=0.085):
    v = x[np.abs(x).max(axis=1) > 0.02] if len(x) else x
    rms = float(np.sqrt((v ** 2).mean())) if len(v) else 0
    if rms:
        x = x * (target / rms)
    peak = float(np.abs(x).max()) if len(x) else 0
    return x * (0.95 / peak) if peak > 0.95 else x


def clip_frames(path, template, cuts, lower_third):
    """Yield composed 30 fps frames for the kept segments, reading the take once."""
    segs = cuts or [(0.0, 1e9)]
    c = av.open(str(path))
    dur_src = float(c.duration / 1e6)
    segs = [(a, min(b, dur_src)) for a, b in segs]
    total = sum(round((b - a) * FPS) for a, b in segs)
    frames = c.decode(video=0)
    cur = next(frames)
    nxt = next(frames, None)
    i = 0
    for k, (a, b) in enumerate(segs):
        zoom = 1.0 if k % 2 == 0 else 1.1
        for j in range(round((b - a) * FPS)):
            target = a + j / FPS
            while nxt is not None and nxt.time <= target:
                cur, nxt = nxt, next(frames, None)
            img = cur.to_image()
            if ROTATE:
                img = img.rotate(ROTATE, expand=True)
            yield compose(img, i / FPS, total / FPS, template, zoom, lower_third)
            i += 1
    c.close()


def clip_audio(path, cuts, n_frames):
    """Kept segments of the take, joined with 15 ms crossfades, high-passed and levelled."""
    from scipy.signal import butter, sosfilt

    full = decode_audio(path)
    segs = cuts or [(0.0, len(full) / SR)]
    xf = int(0.015 * SR)
    out = np.zeros((0, 2), np.float32)
    for a, b in segs:
        piece = full[int(a * SR):int(round((b - a) * FPS) / FPS * SR) + int(a * SR)].copy()
        if len(out) and len(piece) > xf:
            ramp = np.linspace(0, 1, xf)[:, None]
            out[-xf:] = out[-xf:] * (1 - ramp) + piece[:xf] * ramp
            piece = piece[xf:]
        out = np.concatenate([out, piece])
    out = sosfilt(butter(2, 80, "highpass", fs=SR, output="sos"), out, axis=0).astype(np.float32)
    out = level(out, 0.09)
    want = int(n_frames / FPS * SR)
    out = np.pad(out[:want], ((0, max(0, want - len(out))), (0, 0)))
    fade = int(0.08 * SR)
    out[:fade] *= np.linspace(0, 1, fade)[:, None]
    out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return out


def main():
    intro = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else find("intro")
    outro = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else find("outro")
    if not intro and not outro:
        sys.exit("No clips found. Put intro.mp4 and/or outro.mp4 in video/public/face/.")
    template = frame_template()
    film = av.open(str(FILM))
    film_frames = film.streams.video[0].frames or int(film.duration / 1e6 * FPS)
    cut = film_frames - END_CARD_FRAMES

    film_audio = decode_audio(FILM)
    parts_audio = []
    out_path = ROOT / "out/vakeel-launch-face.mp4"
    dst = av.open(str(out_path), "w", options={"movflags": "+faststart"})
    vs = dst.add_stream("libx264", rate=FPS, options={"crf": "19", "preset": "veryfast"})
    vs.width, vs.height, vs.pix_fmt = W, H, "yuv420p"
    a_s = dst.add_stream("aac", rate=SR)
    a_s.bit_rate, a_s.layout = 192000, "stereo"
    pts = 0

    def put(img):
        nonlocal pts
        f = img.reformat(format="yuv420p") if isinstance(img, av.VideoFrame) else av.VideoFrame.from_image(img)
        f.pts, f.time_base = pts, Fraction(1, FPS)
        pts += 1
        for p in vs.encode(f):
            dst.mux(p)

    def add_clip(path, key, lower_third):
        start = pts
        for img in clip_frames(path, template, CUTS.get(key), lower_third):
            put(img)
        n = pts - start
        parts_audio.append(clip_audio(path, CUTS.get(key), n))
        print(f"{path.name}: {n / FPS:.1f}s")

    if intro:
        add_clip(intro, "intro", True)
    film = av.open(str(FILM))
    last = cut + END_CARD_KEEP
    for i, fr in enumerate(film.decode(video=0)):
        if i == cut and outro:
            parts_audio.append(film_audio[: int(cut / FPS * SR)])
            film_audio = film_audio[int(cut / FPS * SR):]
            add_clip(outro, "outro", False)
        if i >= last:
            break
        if i >= last - 20:  # fade the shortened end card to black
            img = fr.to_image()
            put(Image.blend(Image.new("RGB", img.size, (0, 0, 0)), img, (last - i) / 20))
        else:
            put(fr)  # film frames go straight to the encoder, no PIL round trip
    tail = film_audio[: int(END_CARD_KEEP / FPS * SR)].copy()
    fade = int(20 / FPS * SR)
    tail[-fade:] *= np.linspace(1, 0, fade)[:, None]
    parts_audio.append(tail)
    for p in vs.encode():
        dst.mux(p)

    audio = np.concatenate(parts_audio).astype(np.float32)
    audio = np.clip(audio, -1, 1)
    n = 0
    for i in range(0, len(audio), 1024):
        block = np.ascontiguousarray(audio[i : i + 1024].T)
        af = av.AudioFrame.from_ndarray(block, format="fltp", layout="stereo")
        af.sample_rate, af.pts, af.time_base = SR, n, Fraction(1, SR)
        n += block.shape[1]
        for p in a_s.encode(af):
            dst.mux(p)
    for p in a_s.encode():
        dst.mux(p)
    dst.close()
    total = pts / FPS
    print(f"wrote {out_path.name}: {total:.1f}s" + ("  WARNING: over 3:00" if total > 180 else ""))


if __name__ == "__main__":
    main()
