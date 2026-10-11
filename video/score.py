"""Original score for the launch film, synthesised in numpy and timed to the scenes.

Reads script.json + public/vo/manifest.json the same way the Remotion timeline does,
so musical moments (title hit, product section, resolve) land on the right frames.
Writes public/music.wav.
"""

import json
import pathlib
import sys
import wave

import numpy as np

ROOT = pathlib.Path(__file__).parent
SR = 44100
FPS = 30
rng = np.random.default_rng(7)

script = json.loads((ROOT / (sys.argv[1] if len(sys.argv) > 1 else "script.json")).read_text(encoding="utf-8"))
vo = json.loads((ROOT / "public" / script.get("vo_dir", "vo") / "manifest.json").read_text())
M = script.get("music", {"file": "music.wav", "title": "title", "product": "agents", "close": "close", "end": "end"})

starts, at = {}, 0
for s in script["scenes"]:
    frames = round(max(s["min"], vo.get(s["id"], 0) + 0.9 if vo.get(s["id"]) else 0) * FPS)
    starts[s["id"]] = at / FPS
    at += frames
TOTAL = at / FPS
N = int(TOTAL * SR) + SR
t = np.arange(N) / SR
mix = np.zeros((N, 2))


def hz(note: str) -> float:
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    return 440.0 * 2 ** ((names[note[:-1]] + 12 * (int(note[-1]) + 1) - 69) / 12)


def place(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i : i + len(sig), 0] += sig * gain * left
    mix[i : i + len(sig), 1] += sig * gain * right


def env(n, attack, release):
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    e[:a] = np.linspace(0, 1, a)
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def pad_note(freq, dur, bright=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    sig = np.zeros(n)
    for detune in (-0.12, 0.0, 0.11):
        f = freq * 2 ** (detune / 12)
        for k in range(1, 7):
            sig += (bright / k ** 1.6) * np.sin(2 * np.pi * f * k * tt + rng.uniform(0, 6.28))
    lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.11 * tt + rng.uniform(0, 6.28))
    return sig * lfo * env(n, min(2.5, dur / 3), min(3.0, dur / 2.5)) / 9


def pluck(freq, dur=1.2):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    sig = np.sin(2 * np.pi * freq * tt) + 0.35 * np.sin(4 * np.pi * freq * tt) + 0.12 * np.sin(6 * np.pi * freq * tt)
    return sig * np.exp(-tt * 4.2) * env(n, 0.004, 0.05)


def tick():
    n = int(0.05 * SR)
    noise = rng.normal(0, 1, n)
    noise = np.diff(np.concatenate([[0], noise]))  # crude high-pass
    return noise * np.exp(-np.arange(n) / SR * 160) * 0.5


def boom():
    n = int(4.0 * SR)
    tt = np.arange(n) / SR
    f = 30 + 70 * np.exp(-tt * 6)
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.4)
    sig += rng.normal(0, 1, n) * np.exp(-tt * 18) * 0.25
    return sig


def riser(dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    ramp = (tt / dur) ** 2.2
    noise = rng.normal(0, 1, n)
    smooth = np.convolve(noise, np.ones(40) / 40, mode="same")
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * (tt / dur) ** 2) / SR)
    return (smooth * 0.9 + tone * 0.15) * ramp


title_at = starts[M["title"]]
product_at = starts[M["product"]]
close_at = starts[M["close"]]
end_at = starts[M["end"]]
first = script["scenes"]

# 1. Tension: low D drone + ticking clock, getting busier toward the title.
place(pad_note(hz("D2"), title_at + 1.0, bright=0.6), 0, gain=0.55)
a2_at, f3_at = title_at * 0.3, title_at * 0.55
place(pad_note(hz("A2"), title_at - a2_at + 1.0, bright=0.5), a2_at, gain=0.3, pan=0.3)
place(pad_note(hz("F3"), title_at - f3_at + 1.0, bright=0.5), f3_at, gain=0.22, pan=-0.3)
x, step = 0.6, 1.0
while x < title_at - 0.4:
    place(tick(), x, gain=0.35, pan=0.5 if int(x * 2) % 2 else -0.5)
    step = max(0.25, step * 0.985)
    x += step
place(riser(3.2), title_at - 3.2, gain=0.22)
place(boom(), title_at + 0.12, gain=0.9)

# 2. Product: i-VI-III-VII in D minor with a soft eighth-note pulse.
chords = [("D3", "F3", "A3"), ("A#2", "D3", "F3"), ("F2", "A2", "C3"), ("C3", "E3", "G3")]
bar = 4 * 60 / 96
x, i = product_at, 0
while x < close_at:
    notes = chords[i % 4]
    for j, nt in enumerate(notes):
        place(pad_note(hz(nt), bar * 1.25), x, gain=0.33, pan=(j - 1) * 0.35)
    place(pad_note(hz(notes[0][:-1] + "1"), bar * 1.25, bright=0.4), x, gain=0.35)
    for k in range(8):
        nt = notes[k % 3]
        octave = int(nt[-1]) + 1 + (k // 4)
        place(pluck(hz(nt[:-1] + str(octave))), x + k * bar / 8 * 1.0 * 2 / 2, gain=0.09 + 0.02 * (k % 2), pan=0.4 if k % 2 else -0.4)
    x += bar
    i += 1

# 3. Resolve: warm D major for the close, then a long fade on the end card.
for j, nt in enumerate(("D3", "F#3", "A3", "D4")):
    place(pad_note(hz(nt), TOTAL - close_at + 0.5), close_at, gain=0.3, pan=(j - 1.5) * 0.3)
place(pad_note(hz("D1"), TOTAL - close_at + 0.5, bright=0.4), close_at, gain=0.4)
place(boom() * 0.5, end_at + 0.1, gain=0.6)

# Reverb: convolve with a decaying-noise impulse response.
ir_n = int(2.6 * SR)
ir = rng.normal(0, 1, (ir_n, 2)) * np.exp(-np.arange(ir_n) / SR * 2.4)[:, None]
size = 1 << int(np.ceil(np.log2(N + ir_n)))
wet = np.stack([np.fft.irfft(np.fft.rfft(mix[:, c], size) * np.fft.rfft(ir[:, c], size), size)[:N] for c in range(2)], axis=1)
out = mix + 0.18 * wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(mix))

fade = int(2.5 * SR)
out[-fade:] *= np.linspace(1, 0, fade)[:, None]
out *= 0.7 / np.max(np.abs(out))
pcm = (out * 32767).astype(np.int16)
with wave.open(str(ROOT / "public" / M["file"]), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"score {TOTAL:.1f}s, title at {title_at:.1f}s, product at {product_at:.1f}s, close at {close_at:.1f}s")
