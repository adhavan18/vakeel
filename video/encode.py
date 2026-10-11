"""Mux a Remotion JPEG frame sequence with the voiceover and score into an H.264 MP4.

The machine's application-control policy blocks the ffmpeg.exe Remotion ships with, so
audio is mixed here in numpy (same timeline maths as the Remotion compositions) and
encoded through PyAV's bundled libx264/AAC.

Usage: python encode.py final|hype|launch|short [frames_dir] [out.mp4]
"""

import json
import pathlib
import sys
import wave

import av
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).parent
SR = 44100
FPS = 30

CONFIG = {
    "film": {"script": "script_launch.json", "frames": "out/frames_film", "out": "out/vakeel-launch-film.mp4", "vo_delay": 8, "pad": 0.9, "duck": True, "music_gain": 0.42},
    "launch": {"script": "script.json", "frames": "out/frames_launch", "out": "out/vakeel-launch.mp4", "vo_delay": 8, "pad": 0.9, "duck": True, "music_gain": 0.42},
    "final": {"script": "script_v2.json", "frames": "out/frames_final", "out": "out/vakeel-launch-final.mp4", "vo_delay": 8, "pad": 0.9, "duck": True, "music_gain": 0.42},
    "launch2": {"script": "script_v2.json", "frames": "out/frames_launch2", "out": "out/vakeel-launch-v2.mp4", "vo_delay": 8, "pad": 0.9, "duck": True, "music_gain": 0.42},
    "hype": {"script": "script_v3.json", "frames": "out/frames_hype", "out": "out/vakeel-launch-hype.mp4", "vo_delay": 6, "pad": 0, "duck": True, "music_gain": 0.62, "duck_depth": 0.5, "voice_gain": 1.5, "bars": True},
    "short": {"script": "short_script.json", "frames": "out/frames_short", "out": "out/vakeel-short.mp4", "vo_delay": 6, "pad": 0.6, "duck": False, "music_gain": 0.32},
}[sys.argv[1]]
# Optional overrides: python encode.py <config> [frames_dir] [out.mp4]
if len(sys.argv) > 2:
    CONFIG = {**CONFIG, "frames": sys.argv[2]}
if len(sys.argv) > 3:
    CONFIG = {**CONFIG, "out": sys.argv[3]}

script = json.loads((ROOT / CONFIG["script"]).read_text(encoding="utf-8"))
vo_dir = ROOT / "public" / script.get("vo_dir", "vo")
vo = json.loads((vo_dir / "manifest.json").read_text())
music_file = script.get("music", {}).get("file", "music.wav")

scenes, at = [], 0
for s in script["scenes"]:
    if CONFIG.get("bars"):
        # Same as timelineV3() in Hype.jsx: whole bars, long enough for the narration.
        t = script["timing"]
        bar = t["beatFrames"] * 4
        need = -(-(t["voDelay"] + vo.get(s["id"], 0) * FPS + t["tail"]) // bar) if vo.get(s["id"]) else 0
        frames = int(max(s["bars"], need) * bar)
    else:
        seconds = max(s["min"], vo[s["id"]] + CONFIG["pad"] if s["id"] in vo else 0)
        frames = round(seconds * FPS)
    scenes.append({**s, "from": at, "frames": frames, "vo": vo.get(s["id"], 0)})
    at += frames
total_frames = at
n = int(total_frames / FPS * SR)


def read_wav(path):
    with wave.open(str(path)) as w:
        rate, ch = w.getframerate(), w.getnchannels()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    data = data.reshape(-1, ch)
    if ch == 1:
        data = np.repeat(data, 2, axis=1)
    if rate != SR:
        t_old = np.arange(len(data)) / rate
        t_new = np.arange(int(len(data) * SR / rate)) / SR
        data = np.stack([np.interp(t_new, t_old, data[:, c]) for c in range(2)], axis=1)
    return data


mix = np.zeros((n, 2), np.float32)
music = read_wav(ROOT / "public" / music_file)[:n]

high = CONFIG["music_gain"]
gain = np.full(n, high, np.float32)
if CONFIG["duck"]:
    # Same curve as Launch.jsx: drop the score under narration with 6-frame ramps.
    low, ramp = high - CONFIG.get("duck_depth", 0.27), int(6 / FPS * SR)
    t = np.arange(n)
    for s in scenes:
        if s["vo"]:
            a = int((s["from"] + CONFIG["vo_delay"]) / FPS * SR)
            b = a + int(s["vo"] * SR)
            dist = np.maximum(np.maximum(a - t, t - b), 0)
            gain = np.minimum(gain, low + (high - low) * np.clip(dist / ramp, 0, 1))
mix[: len(music)] += music * gain[: len(music), None]

for s in scenes:
    if not s["vo"]:
        continue
    voice = read_wav(vo_dir / f"{s['id']}.wav")
    a = int((s["from"] + CONFIG["vo_delay"]) / FPS * SR)
    b = min(n, a + len(voice))
    mix[a:b] += voice[: b - a] * CONFIG.get("voice_gain", 1.0)

peak = np.max(np.abs(mix))
if peak > 0.98:
    mix *= 0.98 / peak

frames_dir = ROOT / CONFIG["frames"]
files = sorted(frames_dir.glob("*.jpeg")) or sorted(frames_dir.glob("*.jpg"))
assert abs(len(files) - total_frames) <= 2, f"expected {total_frames} frames, found {len(files)}"

out = av.open(str(ROOT / CONFIG["out"]), "w", options={"movflags": "+faststart"})
vstream = out.add_stream("libx264", rate=FPS, options={"crf": "18", "preset": "fast" if sys.argv[1] == "film" else "medium"})
first = Image.open(files[0])
vstream.width, vstream.height = first.size
vstream.pix_fmt = "yuv420p"
astream = out.add_stream("aac", rate=SR)
astream.bit_rate = 192_000
astream.layout = "stereo"

for i, f in enumerate(files):
    if i % 300 == 0:
        print(f"encoding {i}/{len(files)}", flush=True)
    frame = av.VideoFrame.from_image(Image.open(f).convert("RGB"))
    frame.pts = i
    for p in vstream.encode(frame):
        out.mux(p)
for p in vstream.encode():
    out.mux(p)

pcm = (np.clip(mix, -1, 1) * 32767).astype(np.int16)
chunk = 1024
for i in range(0, len(pcm), chunk):
    block = pcm[i : i + chunk]
    af = av.AudioFrame.from_ndarray(np.ascontiguousarray(block).reshape(1, -1), format="s16", layout="stereo")
    af.sample_rate = SR
    af.pts = i
    for p in astream.encode(af):
        out.mux(p)
for p in astream.encode():
    out.mux(p)
out.close()


def srt_time(sec):
    ms = int(round(sec * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


# Sentence-level captions, timed by character position within each narration take.
cues = []
for s in scenes:
    text = next(x["vo"] for x in script["scenes"] if x["id"] == s["id"])
    if not s["vo"] or not text:
        continue
    parts = [p.strip() for p in text.replace("? ", "?|").replace(". ", ".|").split("|") if p.strip()]
    total = sum(len(p) for p in parts)
    t = (s["from"] + CONFIG["vo_delay"]) / FPS
    for part in parts:
        d = len(part) / total * s["vo"]
        cues.append((t, t + d, part))
        t += d
srt = "\n".join(f"{i + 1}\n{srt_time(a)} --> {srt_time(b)}\n{text}\n" for i, (a, b, text) in enumerate(cues))
(ROOT / CONFIG["out"]).with_suffix(".srt").write_text(srt, encoding="utf-8")
print(f"wrote {CONFIG['out']}: {len(files)} frames, {len(files) / FPS:.1f}s")
