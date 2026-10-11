"""Beat-locked score for the hype cut (Hype.jsx), synthesised in numpy.

128.6 BPM (14 frames a beat at 30 fps). Scene lengths are computed exactly as
timelineV3() does, so drops, fills and impacts land on the cuts, and the
on-screen "slams" get a hit timed from the narration text the same way.
Writes public/<music.file> from script_v3.json.
Usage: python score_v3.py
"""

import json
import math
import pathlib
import wave

import numpy as np
from scipy.signal import lfilter

ROOT = pathlib.Path(__file__).parent
SR = 44100
FPS = 30
script = json.loads((ROOT / "script_v3.json").read_text(encoding="utf-8"))
vo = json.loads((ROOT / "public" / script["vo_dir"] / "manifest.json").read_text())
BEATF, VO_DELAY, TAIL = script["timing"]["beatFrames"], script["timing"]["voDelay"], script["timing"]["tail"]
BAR = BEATF * 4
BEAT = BEATF / FPS
rng = np.random.default_rng(11)

scenes, at = [], 0
for s in script["scenes"]:
    v = vo.get(s["id"], 0)
    need = math.ceil((VO_DELAY + v * FPS + TAIL) / BAR) if v else 0
    frames = max(s["bars"], need) * BAR
    scenes.append({**s, "from": at, "frames": frames, "voSeconds": v})
    at += frames
TOTAL = at / FPS
N = int((TOTAL + 4) * SR)
drums = np.zeros((N, 2))
music = np.zeros((N, 2))
fx = np.zeros((N, 2))
side = np.ones(N)


def weight(s):
    return sum(7 if c in ".?!" else 4 if c == "," else 1 for c in s)


def phrase_time(scene, phrase, shift=0):
    i = scene["vo"].lower().index(phrase.lower())
    frame = VO_DELAY + weight(scene["vo"][:i]) / weight(scene["vo"]) * scene["voSeconds"] * FPS + shift
    return (scene["from"] + frame) / FPS


def place(bus, sig, start, gain=1.0, pan=0.0):
    i = int(round(start * SR))
    if i < 0 or i >= N:
        return
    sig = sig[: N - i]
    left, right = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    bus[i : i + len(sig), 0] += sig * gain * left * 1.414
    bus[i : i + len(sig), 1] += sig * gain * right * 1.414


def hz(note):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    return 440.0 * 2 ** ((names[note[:-1]] + 12 * (int(note[-1]) + 1) - 69) / 12)


def lowpass(x, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def hp_noise(n, amount=1):
    noise = rng.normal(0, 1, n)
    for _ in range(amount):
        noise = np.diff(np.concatenate([[0], noise]))
    return noise


# ---------- instruments ----------
def kick():
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    click = hp_noise(n) * np.exp(-t * 400) * 0.25
    return np.tanh((body + click) * 1.6)


def clap():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = hp_noise(n)
    env = np.zeros(n)
    for d in (0, 0.011, 0.022):
        k = int(d * SR)
        env[k:] += np.exp(-(t[: n - k]) * 60)
    env += np.exp(-t * 14) * 0.5
    return noise * env * 0.35


def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    return hp_noise(n, 2) * np.exp(-t * (14 if open_ else 90)) * 0.18


def crash():
    n = int(2.4 * SR)
    t = np.arange(n) / SR
    return hp_noise(n, 2) * np.exp(-t * 1.6) * 0.16


def saw(freq, n, detune_cents=(0,)):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for c in detune_cents:
        f = freq * 2 ** (c / 1200)
        out += 2 * ((t * f + rng.uniform()) % 1) - 1
    return out / len(detune_cents)


def stab(freqs, dur=0.32, bright=4200):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = sum(saw(f, n, (-18, -7, 0, 7, 18)) for f in freqs) / len(freqs)
    sig = lowpass(sig, bright)
    return sig * np.exp(-t * 6) * np.minimum(1, t / 0.004)


def bass(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * freq * t)
    grit = lowpass(saw(freq, n), 500) * 0.5
    env = np.minimum(1, t / 0.006) * np.exp(-t * 3.5)
    return (sub + grit) * env


def pluck(freq, dur=0.22):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.sign(np.sin(2 * np.pi * freq * t)) * 0.4 + np.sin(2 * np.pi * freq * t)
    return lowpass(sig, 3500) * np.exp(-t * 16)


def pad(freqs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for f0 in freqs:
        for d in (-0.1, 0, 0.1):
            f = f0 * 2 ** (d / 12)
            for k in range(1, 6):
                sig += np.sin(2 * np.pi * f * k * t + rng.uniform(0, 6.28)) / k ** 1.7
    a, r = min(0.4, dur / 4), min(0.8, dur / 3)
    env = np.minimum(1, t / a) * np.minimum(1, (dur - t) / r)
    return sig * env / (len(freqs) * 6)


def piano(freq, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = sum(np.sin(2 * np.pi * freq * k * t) * np.exp(-t * (2.2 + k)) / k for k in range(1, 6))
    return sig * np.minimum(1, t / 0.003)


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ramp = (t / dur) ** 2.4
    noise = np.convolve(rng.normal(0, 1, n), np.ones(12) / 12, mode="same")
    tone = np.sin(2 * np.pi * np.cumsum(180 + 1400 * (t / dur) ** 2) / SR) * 0.25
    return (noise + tone) * ramp * 0.5


def whoosh(dur=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.sin(np.pi * t / dur) ** 2
    return np.convolve(hp_noise(n), np.ones(6) / 6, mode="same") * env * 0.25


def impact():
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    f = 32 + 80 * np.exp(-t * 7)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.8) * 1.8 + hp_noise(n) * np.exp(-t * 22) * 0.3)


def hit():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 70 + 160 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12) + hp_noise(n) * np.exp(-t * 70) * 0.35


def click():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 260) * 0.6


def snare():
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    return (hp_noise(n) * 0.6 + np.sin(2 * np.pi * 190 * t) * 0.6) * np.exp(-t * 22) * 0.4


# Cache sounds that do not vary.
K, CL, HC, HO, CR, SN, HIT, CLK, IMP = kick(), clap(), hat(), hat(True), crash(), snare(), hit(), click(), impact()

CHORDS = [("D3", "F3", "A3"), ("A#2", "D3", "F3"), ("F2", "A2", "C3"), ("C3", "E3", "G3")]
ROOTS = ["D2", "A#1", "F2", "C2"]


def kick_at(t0, gain=0.9):
    place(drums, K, t0, gain)
    i = int(t0 * SR)
    m = int(0.2 * SR)
    if i < N:
        seg = side[i : i + m]
        seg *= 1 - 0.65 * np.exp(-np.arange(len(seg)) / SR / 0.07)


bar_index = 0
for si, s in enumerate(scenes):
    start = s["from"] / FPS
    bars = s["frames"] // BAR
    e = s["energy"]
    nxt = scenes[si + 1] if si + 1 < len(scenes) else None
    if si:
        place(fx, whoosh(), start - 0.3, 0.5)
    if e >= 3 and (si == 0 or scenes[si - 1]["energy"] < 3):
        place(drums, CR, start, 1.0)
        place(fx, IMP, start, 0.55)
    for b in range(bars):
        t0 = start + b * 4 * BEAT
        chord = CHORDS[bar_index % 4]
        root = ROOTS[bar_index % 4]
        bar_index += 1
        last = b == bars - 1
        if e == 1:
            place(music, pad([hz(n) for n in chord], 4 * BEAT + 0.3), t0, 0.5)
            for k in range(4):
                place(drums, K, t0 + k * BEAT, 0.35 if k % 2 else 0.55)
            for k in range(8):
                place(drums, HC, t0 + k * BEAT / 2, 0.35, 0.3 if k % 2 else -0.3)
            for k in range(8):
                place(music, pluck(hz(chord[k % 3][:-1] + "4")), t0 + k * BEAT / 2, 0.12, 0.4 if k % 2 else -0.4)
        elif e == 2:
            place(music, pad([hz(n) for n in chord], 4 * BEAT + 0.3), t0, 0.45)
            for k in range(4):
                kick_at(t0 + k * BEAT, 0.75)
                place(music, bass(hz(root), BEAT / 2), t0 + k * BEAT + BEAT / 2, 0.42)
            for k in (1, 3):
                place(drums, CL, t0 + k * BEAT, 0.5)
            for k in range(8):
                place(drums, HC, t0 + k * BEAT / 2, 0.45, 0.3 if k % 2 else -0.3)
            for k in range(16):
                place(music, pluck(hz(chord[(k * 2) % 3][:-1] + ("5" if k % 4 == 3 else "4"))), t0 + k * BEAT / 4, 0.1, 0.5 if k % 2 else -0.5)
        elif e == 3:
            place(music, pad([hz(n) for n in chord], 4 * BEAT + 0.3), t0, 0.35)
            for k in range(4):
                kick_at(t0 + k * BEAT, 0.95)
                place(music, bass(hz(root), BEAT / 2), t0 + k * BEAT + BEAT / 2, 0.55)
            for k in (1, 3):
                place(drums, CL, t0 + k * BEAT, 0.75)
            for k in range(16):
                place(drums, HC, t0 + k * BEAT / 4, 0.32 + 0.18 * (k % 2), 0.3 if k % 2 else -0.3)
            for k in range(4):
                place(drums, HO, t0 + k * BEAT + BEAT / 2, 0.45, 0.2)
            freqs = [hz(n[:-1] + str(int(n[-1]) + 1)) for n in chord]
            for pos in (0, 0.75, 1.5, 2.5, 3.25):
                place(music, stab(freqs), t0 + pos * BEAT, 0.3, 0.2 if pos % 1 else -0.2)
            for k in range(16):
                place(music, pluck(hz(chord[k % 3][:-1] + ("5" if k % 8 >= 4 else "4"))), t0 + k * BEAT / 4, 0.09, 0.5 if k % 2 else -0.5)
            if b % 4 == 0 and b:
                place(drums, CR, t0, 0.6)
        elif e == 0:
            place(music, pad([hz(n) for n in CHORDS[0]], 4 * BEAT + 0.4), t0, 0.35)
            place(drums, K, t0, 0.5) if b == 0 else None
            if last:
                for k in range(16):
                    if k < 14:
                        place(drums, SN, t0 + k * BEAT / 4, 0.2 + 0.5 * k / 16)
        elif e == -1:
            place(music, pad([hz(n) for n in chord], 4 * BEAT + 0.5), t0, 0.5)
            place(music, pad([hz(root)], 4 * BEAT + 0.5), t0, 0.5)
            for k, n in enumerate((chord[0], chord[2], chord[1], chord[2])):
                place(music, piano(hz(n[:-1] + "4")), t0 + k * BEAT, 0.22, 0.25 if k % 2 else -0.25)
        elif e == 4:
            if b == 0:
                place(fx, IMP, t0, 0.8)
                place(drums, CR, t0, 1.0)
                kick_at(t0, 1.0)
                place(music, stab([hz("D4"), hz("F#4"), hz("A4")], 1.6, 3000), t0, 0.4)
                place(music, pad([hz("D3"), hz("F#3"), hz("A3"), hz("D4")], 4 * BEAT * bars + 1.5), t0, 0.55)
                place(music, pad([hz("D1")], 4 * BEAT * bars + 1.5), t0, 0.6)
        # Risers and fills into a bigger section.
        if last and nxt and nxt["energy"] > max(e, 1) and e != 0:
            place(fx, riser(4 * BEAT), t0, 0.35)
            if e >= 2:
                for k in range(8):
                    place(drums, SN, t0 + 2 * BEAT + k * BEAT / 4, 0.25 + 0.4 * k / 8)
    if e == 0:
        place(fx, riser(s["frames"] / FPS - 0.15), start, 0.45)
    if e == -1 and nxt:
        place(fx, riser(4 * BEAT), start + s["frames"] / FPS - 4 * BEAT, 0.3)

# Hits on the on-screen slams (same phrases and offsets as Hype.jsx).
HITS = {
    "hook": ["Every coal plant", "in India", "needs", "permission.", "And every", "is public"],
    "wall": ["Two hundred", "Six hundred"],
    "needle": [("Page eighteen", -4), ("skips its public hearing", 14), ("Page twenty-five", -4), "Approved"],
    "nobody": ["Nobody objected", "nobody could read it"],
    "speed": ["Fifty-two"],
    "verify": [("word-for-word", -4)],
    "purge": ["Sixty-five", "Two hundred and nineteen"],
    "plain": [("In English", -4), ("In Hindi", -4), ("In Odia", -4)],
    "impact": ["Then code", "Six point eight", ("Six point eight", BEATF * 2), "Water for", ("Water for", BEATF * 2)],
    "human": ["Step Functions waits", "Up to seven days"],
    "stack": ["Bedrock", "Step Functions", "Lambda", "DynamoDB", "S3", "CloudFront", "Amazon Location", "With a hard daily"],
    "proof": ["Three real", "Seven hundred", "Seventeen"],
    "close": ["can read it first"],
}
# Cursor clicks in the product scenes (fractions from the ScreenScene specs).
CLICKS = {"drop": [0.6], "agents": [0.93], "receipts": [0.3], "near": [0.3], "object": [0.055, 0.13, 0.35, 0.6, 0.88]}
by_id = {s["id"]: s for s in scenes}
for sid, items in HITS.items():
    for item in items:
        phrase, shift = (item, 0) if isinstance(item, str) else item
        place(fx, HIT, phrase_time(by_id[sid], phrase, shift), 0.45 if by_id[sid]["energy"] < 3 else 0.3)
for sid, fracs in CLICKS.items():
    s = by_id[sid]
    for fr in fracs:
        place(fx, CLK, (s["from"] + fr * s["frames"]) / FPS, 0.35)

# Mix: sidechain the melodic bus to the kick, reverb on music and fx.
music *= side[:, None]
wet_in = music + fx * 0.6
ir_n = int(1.8 * SR)
ir = rng.normal(0, 1, (ir_n, 2)) * np.exp(-np.arange(ir_n) / SR * 3.2)[:, None]
size = 1 << int(np.ceil(np.log2(N + ir_n)))
wet = np.stack([np.fft.irfft(np.fft.rfft(wet_in[:, c], size) * np.fft.rfft(ir[:, c], size), size)[:N] for c in range(2)], axis=1)
wet *= 0.22 * np.max(np.abs(wet_in)) / (np.max(np.abs(wet)) + 1e-9)
mix = drums * 0.9 + music + fx + wet
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix = mix[: int(TOTAL * SR)]
fade = int(1.5 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix *= 0.85 / np.max(np.abs(mix))
with wave.open(str(ROOT / "public" / script["music"]["file"]), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print(f"score {TOTAL:.1f}s, {bar_index} bars at {60 / BEAT:.1f} BPM")
for s in scenes:
    print(f"  {s['id']:9s} {s['from'] / FPS:6.1f}s  {s['frames'] // BAR} bars  energy {s['energy']}")
