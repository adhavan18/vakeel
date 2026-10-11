import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import script from "../script_v2.json";
import voManifest from "../public/vo_final/manifest.json";
import screens from "../public/screens/manifest.json";
import { C, sans } from "./theme.js";
import * as S from "./scenes.jsx";
import { ScreenScene, SPECS } from "./ScreenScene.jsx";

export const FPS2 = 30;
const VO_DELAY = 8;

function Stakes({ scene }) {
  const f = useCurrentFrame();
  const n = scene.frames;
  const rows = [
    ["115,000", "early deaths a year linked to India's coal power", "Conservation Action Trust / Urban Emissions"],
    ["78%", "of coal plants exempted from sulphur scrubbers, July 2025", "MoEFCC notification, via CREA"],
    ["1", "clearance file: the last place anyone can say no", ""],
  ];
  const at = [0.02, 0.3, 0.6].map((x) => Math.round(x * n));
  return (
    <AbsoluteFill style={{ background: C.ink, padding: "0 170px", justifyContent: "center" }}>
      {rows.map(([big, text, src], i) => {
        const o = interpolate(f, [at[i], at[i] + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const y = interpolate(f, [at[i], at[i] + 18], [26, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 36, opacity: o, transform: `translateY(${y}px)`, marginTop: i ? 34 : 0 }}>
            <div style={{ fontFamily: S.displayFont, fontSize: 132, color: i === 2 ? C.paper : C.ember, minWidth: 470, textAlign: "right", letterSpacing: "-0.03em" }}>{big}</div>
            <div>
              <div style={{ fontFamily: S.displayFont, fontSize: 46, color: C.paper, lineHeight: 1.1 }}>{text}</div>
              {src && <div style={{ fontFamily: sans, fontSize: 18, color: C.dim, marginTop: 8 }}>Source: {src}</div>}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

const MOTION = { cold: S.ColdOpen, wall: S.PageWall, buried: S.Buried, title: S.Title, arch: S.Architecture, close: Stakes, end: S.End };

export function timelineV2() {
  let at = 0;
  const scenes = script.scenes.map((s) => {
    const vo = voManifest[s.id];
    const frames = Math.round(Math.max(s.min, vo ? vo + 0.9 : 0) * FPS2);
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
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 40, pointerEvents: "none" }}>
      <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 30, lineHeight: 1.35, color: "#fff", background: "rgba(10,13,22,0.78)", backdropFilter: "blur(8px)", padding: "10px 22px", borderRadius: 12, maxWidth: 1400, textAlign: "center" }}>
        {current.trim()}
      </div>
    </AbsoluteFill>
  );
}

function musicVolume(scenes) {
  const windows = scenes.filter((s) => s.voSeconds > 0).map((s) => [s.from + VO_DELAY, s.from + VO_DELAY + Math.round(s.voSeconds * FPS2)]);
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

export const LaunchV2 = () => {
  const { scenes } = timelineV2();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Audio src={staticFile(script.music.file)} volume={musicVolume(scenes)} />
      {scenes.map((s) => {
        const body = s.screen ? (
          <ScreenScene scene={s} spec={SPECS[s.screen]} url={screens.url} labels={SPECS[s.screen].labels} />
        ) : (
          (() => {
            const Comp = MOTION[s.id];
            return <Comp scene={s} />;
          })()
        );
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={s.id}>
            <Fade frames={s.frames}>{body}</Fade>
            {s.voSeconds > 0 && (
              <Sequence from={VO_DELAY}>
                <Audio src={staticFile(`${script.vo_dir}/${s.id}.wav`)} />
              </Sequence>
            )}
            <Captions text={s.vo} voSeconds={s.voSeconds} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
