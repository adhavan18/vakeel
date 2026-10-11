"""Generate the launch video voiceover with Amazon Polly (Kajal, en-IN, generative engine).

Writes public/vo/<scene>.wav and public/vo/manifest.json with exact durations, which
the Remotion timeline uses to size each scene.
Usage: python voice.py [script.json] [scene_id ...]
"""

import json
import pathlib
import sys
import wave

import boto3

ROOT = pathlib.Path(__file__).parent
RATE = 16000
args = sys.argv[1:]
script_file = args.pop(0) if args and args[0].endswith(".json") else "script.json"
script = json.loads((ROOT / script_file).read_text(encoding="utf-8"))
voice = script["voice"]
polly = boto3.client("polly", region_name="ap-southeast-2")
out = ROOT / "public" / script.get("vo_dir", "vo")
out.mkdir(parents=True, exist_ok=True)
manifest_path = out / "manifest.json"
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
only = set(args)

for scene in script["scenes"]:
    if not scene["vo"] or (only and scene["id"] not in only):
        continue
    text = scene.get("spoken", scene["vo"])
    audio = polly.synthesize_speech(
        Text=text,
        VoiceId=voice["id"],
        Engine=voice.get("engine", "generative"),
        LanguageCode=voice.get("language", "en-IN"),
        OutputFormat="pcm",
        SampleRate=str(RATE),
    )["AudioStream"].read()
    path = out / f"{scene['id']}.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(audio)
    manifest[scene["id"]] = round(len(audio) / 2 / RATE, 2)
    print(f"{scene['id']}: {manifest[scene['id']]}s")

manifest_path.write_text(json.dumps(manifest, indent=2))
print("total voice:", round(sum(manifest.values()), 1), "s")
