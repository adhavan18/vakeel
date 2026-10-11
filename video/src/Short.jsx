import { AbsoluteFill, Audio, Html5Video, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import script from "../short_script.json";
import vo from "../public/vo_short/manifest.json";
import clips from "../public/clips/manifest.json";
import { C, serif, sans, mono, deva } from "./theme.js";
import { Grain, ZoomPage } from "./scenes.jsx";

export const SHORT_FPS = 30;
const VO_DELAY = 6;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };

export function shortTimeline() {
  let at = 0;
  const scenes = script.scenes.map((s) => {
    const seconds = Math.max(s.min, vo[s.id] ? vo[s.id] + 0.6 : 0);
    const frames = Math.round(seconds * SHORT_FPS);
    const scene = { ...s, from: at, frames, voSeconds: vo[s.id] || 0 };
    at += frames;
    return scene;
  });
  return { scenes, total: at };
}

function Headline({ children, top = 150, size = 76, color = C.paper, italic = false }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [4, 16], [0, 1], clamp);
  const y = interpolate(f, [4, 20], [24, 0], clamp);
  return (
    <div style={{ position: "absolute", top, left: 70, right: 70, fontFamily: serif, fontStyle: italic ? "italic" : "normal", fontSize: size, lineHeight: 1.04, color, opacity: o, transform: `translateY(${y}px)` }}>
      {children}
    </div>
  );
}

function Hook({ scene }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#151517" }}>
      <ZoomPage f={f} start={0} end={scene.frames + 10} src="pages/hi_p018.jpg" region={[90, 830, 1220, 940]} marks={[[97, 848, 1212, 880], [97, 878, 415, 910]]} label="PAGE 18 OF 246" />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,11,12,0.96) 0%, rgba(11,11,12,0) 32%, rgba(11,11,12,0) 62%, rgba(11,11,12,0.96) 100%)" }} />
      <Headline>A 1,320 MW coal plant expansion skipped its <span style={{ color: C.ember }}>public hearing.</span></Headline>
    </AbsoluteFill>
  );
}

function Rec({ scene }) {
  const f = useCurrentFrame();
  const late = interpolate(f, [scene.frames * 0.45, scene.frames * 0.55], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#151517" }}>
      <ZoomPage f={f} start={0} end={scene.frames + 10} src="pages/hi_p025.jpg" region={[90, 1215, 1220, 1300]} marks={[[97, 1230, 1212, 1260], [1010, 1228, 1172, 1262, true]]} label="PAGE 25 OF 246" />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,11,12,0.96) 0%, rgba(11,11,12,0) 32%, rgba(11,11,12,0) 62%, rgba(11,11,12,0.96) 100%)" }} />
      <Headline>Then the committee <span style={{ color: C.ember }}>recommended it.</span></Headline>
      <div style={{ position: "absolute", bottom: 330, left: 70, right: 70, opacity: late, fontFamily: serif, fontSize: 84, lineHeight: 1.02, color: C.paper }}>
        Nobody objected.
        <br />
        <span style={{ fontStyle: "italic", color: C.ember }}>Nobody could read it.</span>
      </div>
    </AbsoluteFill>
  );
}

function Title() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 2, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: serif, fontSize: 210, color: C.paper, opacity: s, transform: `scale(${0.9 + 0.1 * s})` }}>Vakeel</div>
      <div style={{ fontFamily: deva, fontSize: 110, color: C.ember, opacity: s, marginTop: -10 }}>वकील</div>
    </AbsoluteFill>
  );
}

const CLIP_SETUP = {
  agents: { from: 0.3, label: "6 Bedrock agents read in parallel", sub: "Every number verified against the page" },
  project: { from: 0.0, label: "Plain language. In Hindi.", sub: "Costs computed by code, not by AI" },
  object: { from: 0.55, label: "A legal objection, signed by a human", sub: "Locked with a SHA-256 receipt" },
};

function Clip({ scene }) {
  const f = useCurrentFrame();
  const setup = CLIP_SETUP[scene.clip];
  const meta = clips[scene.clip];
  const sceneSec = scene.frames / SHORT_FPS;
  const available = meta ? meta.seconds * (1 - setup.from) : sceneSec;
  const rate = Math.min(5, Math.max(0.8, available / sceneSec));
  const zoom = interpolate(f, [0, scene.frames], [1.32, 1.42]);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 100%, rgba(255,90,31,0.25), ${C.ink} 55%)` }}>
      <Headline top={170} size={70}>{setup.label}</Headline>
      <div style={{ position: "absolute", top: 520, left: 0, right: 0, height: 900, overflow: "hidden" }}>
        <div style={{ width: 1600, height: 900, transform: `translateX(${(1080 - 1600 * zoom) / 2}px) scale(${zoom})`, transformOrigin: "0 0" }}>
          {meta ? (
            <Html5Video src={staticFile(`clips/${scene.clip}.webm`)} startFrom={Math.round(meta.seconds * setup.from * SHORT_FPS)} playbackRate={rate} muted style={{ width: 1600, height: 900 }} />
          ) : (
            <div style={{ width: 1600, height: 900, background: C.ink2 }} />
          )}
        </div>
      </div>
      <div style={{ position: "absolute", top: 1450, left: 70, right: 70, fontFamily: mono, fontSize: 30, color: C.muted, opacity: interpolate(f, [10, 22], [0, 1], clamp) }}>{setup.sub}</div>
    </AbsoluteFill>
  );
}

function Close() {
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: "center", padding: "0 80px" }}>
      <div style={{ fontFamily: serif, fontSize: 110, lineHeight: 1.0, color: C.paper }}>
        Read the filing <span style={{ fontStyle: "italic", color: C.ember }}>before it's approved.</span>
      </div>
    </AbsoluteFill>
  );
}

function End() {
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: serif, fontSize: 170, color: C.paper }}>Vakeel</div>
      <div style={{ fontFamily: deva, fontSize: 80, color: C.ember, marginTop: -6 }}>वकील</div>
      <div style={{ fontFamily: mono, fontSize: 30, color: C.muted, marginTop: 60 }}>{clips.webUrl || ""}</div>
      <div style={{ fontFamily: sans, fontSize: 34, color: C.dim, marginTop: 24 }}>Built on AWS · #BharatBuilds</div>
    </AbsoluteFill>
  );
}

const COMPONENTS = { s_hook: Hook, s_rec: Rec, s_title: Title, s_agents: Clip, s_project: Clip, s_object: Clip, s_close: Close, s_end: End };

function Captions({ text, voSeconds }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text || !voSeconds) return null;
  const words = text.split(" ");
  const t = (f - VO_DELAY) / fps;
  if (t < 0 || t > voSeconds + 0.3) return null;
  const chunk = 4;
  const idx = Math.min(words.length - 1, Math.floor((t / voSeconds) * words.length));
  const startW = Math.floor(idx / chunk) * chunk;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 170, pointerEvents: "none" }}>
      <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 52, color: C.paper, textAlign: "center", padding: "0 60px", textShadow: "0 4px 24px rgba(0,0,0,0.9)" }}>
        {words.slice(startW, startW + chunk).map((w, i) => (
          <span key={i} style={{ color: startW + i === idx ? C.ember : C.paper }}>{w} </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}

export const Short = () => {
  const { scenes } = shortTimeline();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Audio src={staticFile("music_short.wav")} volume={0.32} />
      {scenes.map((s) => {
        const Comp = COMPONENTS[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={s.id}>
            <Comp scene={s} />
            {s.voSeconds > 0 && (
              <Sequence from={VO_DELAY}>
                <Audio src={staticFile(`vo_short/${s.id}.wav`)} />
              </Sequence>
            )}
            <Captions text={s.vo} voSeconds={s.voSeconds} />
          </Sequence>
        );
      })}
      <Grain />
    </AbsoluteFill>
  );
};
