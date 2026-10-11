import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import script from "../script.json";
import voManifest from "../public/vo/manifest.json";
import { C, sans } from "./theme.js";
import * as S from "./scenes.jsx";

export const FPS = 30;
const VO_DELAY = 8; // frames of silence before each line

const COMPONENTS = {
  cold: S.ColdOpen,
  wall: S.PageWall,
  buried: S.Buried,
  title: S.Title,
  agents: S.Clip,
  verify: S.Clip,
  project: S.Clip,
  object: S.Clip,
  arch: S.Architecture,
  close: S.Close,
  end: S.End,
};

export function buildTimeline() {
  let at = 0;
  const scenes = script.scenes.map((s) => {
    const vo = voManifest[s.id];
    const seconds = Math.max(s.min, vo ? vo + 0.9 : 0);
    const frames = Math.round(seconds * FPS);
    const scene = { ...s, from: at, frames, voSeconds: vo || 0 };
    at += frames;
    return scene;
  });
  return { scenes, total: at };
}

function Fade({ frames, children }) {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, 8, frames - 8, frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

function Captions({ text, voSeconds }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text || !voSeconds) return null;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const total = sentences.reduce((n, s) => n + s.length, 0);
  const t = (f - VO_DELAY) / fps;
  if (t < 0 || t > voSeconds + 0.4) return null;
  let acc = 0;
  let current = sentences[sentences.length - 1];
  for (const s of sentences) {
    acc += (s.length / total) * voSeconds;
    if (t <= acc) {
      current = s;
      break;
    }
  }
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 54, pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: sans,
          fontSize: 30,
          lineHeight: 1.35,
          color: C.paper,
          background: "rgba(11,11,12,0.72)",
          padding: "10px 22px",
          borderRadius: 10,
          maxWidth: 1400,
          textAlign: "center",
        }}
      >
        {current.trim()}
      </div>
    </AbsoluteFill>
  );
}

function musicVolume(scenes) {
  // Duck the score under narration, let it breathe in the gaps.
  const windows = scenes.filter((s) => s.voSeconds > 0).map((s) => [s.from + VO_DELAY, s.from + VO_DELAY + Math.round(s.voSeconds * FPS)]);
  return (f) => {
    let v = 0.42;
    for (const [a, b] of windows) {
      if (f >= a - 6 && f <= b + 6) {
        const edge = Math.min(f - (a - 6), b + 6 - f);
        v = Math.min(v, 0.42 - 0.27 * Math.min(1, edge / 6));
      }
    }
    return v;
  };
}

export const Launch = () => {
  const { scenes } = buildTimeline();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Audio src={staticFile("music.wav")} volume={musicVolume(scenes)} />
      {scenes.map((s) => {
        const Comp = COMPONENTS[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={s.id}>
            <Fade frames={s.frames}>
              <Comp scene={s} />
            </Fade>
            {s.voSeconds > 0 && (
              <Sequence from={VO_DELAY}>
                <Audio src={staticFile(`vo/${s.id}.wav`)} />
              </Sequence>
            )}
            <Captions text={s.vo} voSeconds={s.voSeconds} />
          </Sequence>
        );
      })}
      <S.Grain />
    </AbsoluteFill>
  );
};
