"""Import the founder's recorded takes (public/<user_dir>/<scene>.webm|wav|m4a|mp3, vo_user by default) into
public/vo_final as clean 44.1 kHz mono WAVs: decoded with PyAV, silence trimmed at both
ends, loudness evened out. Lines without a take keep the Polly version.
Usage: python import_voice.py [script_v2.json]
"""

import json
import pathlib
import sys
import wave

import av
import numpy as np

ROOT = pathlib.Path(__file__).parent
SR = 44100
script = json.loads((ROOT / (sys.argv[1] if len(sys.argv) > 1 else "script_v2.json")).read_text(encoding="utf-8"))
src = ROOT / "public" / script.get("user_dir", "vo_user")
dst = ROOT / "public" / script["vo_dir"]
manifest_path = dst / "manifest.json"
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}


def decode(path: pathlib.Path) -> np.ndarray:
    container = av.open(str(path))
    resampler = av.AudioResampler(format="flt", layout="mono", rate=SR)
    chunks = []
    for frame in container.decode(audio=0):
        for out in resampler.resample(frame):
            chunks.append(out.to_ndarray().reshape(-1))
    for out in resampler.resample(None):
        chunks.append(out.to_ndarray().reshape(-1))
    container.close()
    return np.concatenate(chunks) if chunks else np.zeros(0, np.float32)


def trim(x: np.ndarray, pad: float = 0.12) -> np.ndarray:
    win = int(0.02 * SR)
    if len(x) < win * 3:
        return x
    frames = x[: len(x) // win * win].reshape(-1, win)
    rms = np.sqrt((frames ** 2).mean(axis=1))
    threshold = max(0.01, rms.max() * 0.06)
    voiced = np.where(rms > threshold)[0]
    if not len(voiced):
        return x
    a = max(0, voiced[0] * win - int(pad * SR))
    b = min(len(x), (voiced[-1] + 1) * win + int(pad * 1.5 * SR))
    return x[a:b]


def level(x: np.ndarray, target_rms: float = 0.085) -> np.ndarray:
    voiced = x[np.abs(x) > 0.02]
    rms = np.sqrt((voiced ** 2).mean()) if len(voiced) else 0
    if rms > 0:
        x = x * (target_rms / rms)
    peak = np.max(np.abs(x)) if len(x) else 0
    return x * (0.95 / peak) if peak > 0.95 else x


done = []
for scene in script["scenes"]:
    if not scene["vo"]:
        continue
    takes = [p for ext in ("webm", "wav", "m4a", "mp3", "ogg") for p in src.glob(f"{scene['id']}.{ext}")]
    if not takes:
        continue
    audio = level(trim(decode(takes[0])))
    with wave.open(str(dst / f"{scene['id']}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
    manifest[scene["id"]] = round(len(audio) / SR, 2)
    done.append(f"{scene['id']} ({manifest[scene['id']]}s)")

manifest_path.write_text(json.dumps(manifest, indent=2))
missing = [s["id"] for s in script["scenes"] if s["vo"] and not any(d.startswith(s["id"] + " ") for d in done)]
print("imported:", ", ".join(done) or "none")
print("still Polly:", ", ".join(missing) or "none")
print("total voice:", round(sum(v for k, v in manifest.items() if any(s["id"] == k for s in script["scenes"])), 1), "s")
