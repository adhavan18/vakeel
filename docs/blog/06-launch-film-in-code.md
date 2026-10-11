# We made our launch film in code: Amazon Polly, React and a synthesizer written in numpy

*Part 5 of the Vakeel build log · Environmental Hacks 2026 · #BharatBuilds*

**▶ The film:** <YOUTUBE LINK>

Our hackathon project, Vakeel, reads India's coal plant approvals for the people who live next door. We had a working product on AWS and about a day for the demo video. Screen recordings stuttered, our editing software couldn't keep up, and `ffmpeg.exe` was blocked on the build machine by Windows application control.

So we built the film the way we build software: as code that renders, with every number pulled from the live product and every cut computed. Here's the pipeline.

## 1. Narration with Amazon Polly

The script is a JSON file with one line of narration per scene. A 50-line Python script sends each line to Amazon Polly's generative engine (voice **Kajal**, `en-IN`) and writes one WAV per scene plus a manifest of exact durations:

```python
audio = polly.synthesize_speech(
    Text=scene["vo"], VoiceId="Kajal", Engine="generative",
    LanguageCode="en-IN", OutputFormat="pcm", SampleRate="16000",
)["AudioStream"].read()
manifest[scene["id"]] = round(len(audio) / 2 / 16000, 2)
```

Those durations drive everything else. Change a line, re-run Polly, and the whole film re-times itself. The Polly takes also became the **pacing guide** for the founder's own voice: a small browser recorder shows each line as a teleprompter, plays the Polly version, and saves takes straight into the project.

## 2. Scenes in React with Remotion

Each scene is a React component rendered frame by frame by [Remotion](https://www.remotion.dev). Product footage isn't a screen recording. A Playwright script captures **2× screenshots** of every state of the live app, along with the on-screen position of every button the cursor will click. The film then animates a virtual camera (keyframed zoom and pan), a cursor that glides and clicks, and crossfades between states. The result is Screen Studio-style footage with no dropped frames, because there are no frames to drop.

The kinetic type is timed to the narration from its own text. We estimate when a phrase is spoken from its character position in the line, with extra weight for pauses at commas and full stops:

```js
const weight = (s) => [...s].reduce((a, c) => a + (".?!".includes(c) ? 7 : c === "," ? 4 : 1), 0);
const at = (scene, phrase) =>
  VO_DELAY + (weight(scene.vo.slice(0, scene.vo.indexOf(phrase))) / weight(scene.vo)) * scene.voSeconds * FPS;
```

It's crude and it works: "246 pages" slams onto the screen as the voice says it, with whichever voice is recorded.

## 3. A beat-locked score, synthesized in numpy

We wanted cuts on the beat, so we picked a tempo where a beat is a whole number of frames: **14 frames at 30 fps = 128.57 BPM**. Every scene is a whole number of bars, long enough for its narration:

```js
const frames = Math.max(scene.bars, Math.ceil((VO_DELAY + vo * FPS + TAIL) / BAR)) * BAR;
```

A Python script computes the same timeline and writes the music to match: kick, clap, hats, sub bass, detuned-saw stabs and arpeggios, all built from sine waves and noise in numpy and sidechained to the kick. Each scene has an energy level: tense intro, a drop on the logo, a full groove for the product, a quiet breakdown for the human cost. Risers lead into the drops, and every on-screen "slam" gets a hit at the same frame the text lands, because both sides use the same timing function.

## 4. Mixing and encoding without ffmpeg.exe

Remotion renders a JPEG sequence. Then a Python script:

- mixes the narration over the score, **ducking the music** under every line with short ramps (the same curve as the in-browser preview);
- encodes H.264 and AAC through **PyAV**, which bundles its own libx264, so the blocked binary never runs;
- writes an `.srt` caption file timed from the narration.

A mistake worth sharing: our first mix had the voice at 0 dB over the music in the busy sections. It sounded fine on laptop speakers and would have been mush on a phone. We measured voice-to-music level per scene, then raised the voice 3.5 dB and ducked the music deeper, to roughly +10 dB.

## 5. The film can't drift from the product

Every number on screen came from the live API on the day we rendered: 246 pages read in 52 seconds, 219 claims verified, 65 rejected, ₹4,887 crore of estimated climate damage a year. When the product's numbers changed, we re-captured the screenshots instead of leaving stale stats on screen. When the narration changes, the music and the cuts follow.

## The stack

- **Voice:** Amazon Polly (generative, Kajal, en-IN), then the founder's own takes
- **Visuals:** Remotion (React), Playwright captures of the live app on CloudFront
- **Music:** numpy and scipy, written from scratch
- **Encode:** PyAV (libx264 + AAC)

The whole film is reproducible from the repo: capture, voice, score, render, encode, one command each. If you're making a hackathon demo this week, steal it: https://github.com/adhavan18/vakeel/tree/main/video

Live product: https://d4i9n8m04ddaa.cloudfront.net
