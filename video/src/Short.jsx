import { AbsoluteFill, Audio, Html5Video, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
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

function QuoteScene({ scene, page, label, quote, mark, headline, after }) {
  const f = useCurrentFrame();
  const markP = interpolate(f, [18, 40], [0, 1], clamp);
  const afterO = after ? interpolate(f, [scene.frames * 0.5, scene.frames * 0.6], [0, 1], clamp) : 0;
  const [pre, hit, post] = quote;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Img src={staticFile(page)} style={{ position: "absolute", width: 1300, left: -110, top: 120, opacity: 0.16, filter: "blur(2px)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,11,12,0.9) 0%, rgba(11,11,12,0.55) 40%, rgba(11,11,12,0.92) 100%)" }} />
      <Headline top={150} size={74}>{headline}</Headline>
      <div style={{ position: "absolute", top: 640, left: 70, right: 70 }}>
        <div style={{ fontFamily: mono, fontSize: 28, letterSpacing: "0.2em", color: C.muted }}>{label}</div>
        <div style={{ marginTop: 24, background: "#f4f0e8", color: "#1c1a17", borderRadius: 6, padding: "40px 44px", fontFamily: "Georgia, serif", fontSize: 52, lineHeight: 1.32, boxShadow: "0 40px 100px rgba(0,0,0,0.6)" }}>
          {pre}
          <span style={{ background: `linear-gradient(90deg, rgba(255,90,31,0.35) ${markP * 100}%, transparent ${markP * 100}%)`, borderBottom: `5px solid ${mark}` }}>{hit}</span>
          {post}
        </div>
      </div>
      {after && (
        <div style={{ position: "absolute", top: 1330, left: 70, right: 70, opacity: afterO, fontFamily: serif, fontSize: 80, lineHeight: 1.02, color: C.paper }}>
          Nobody objected. <span style={{ fontStyle: "italic", color: C.ember }}>Nobody could read it.</span>
        </div>
      )}
    </AbsoluteFill>
  );
}

function Hook({ scene }) {
  return (
    <QuoteScene
      scene={scene}
      page="pages/hi_p018.jpg"
      label="PAGE 18 OF 246"
      mark={C.ember}
      headline={<>A 1,320 MW coal expansion, 2.2 km from a reserved forest.</>}
      quote={["“Public hearing for the 2x660 MW (Phase - II) ", "is exempted", " as per S.O. 1247(E)…”"]}
    />
  );
}

function Rec({ scene }) {
  return (
    <QuoteScene
      scene={scene}
      page="pages/hi_p025.jpg"
      label="PAGE 25 OF 246"
      mark={C.ember}
      headline={<>Then the committee decided.</>}
      quote={["“…the committee ", "recommended", " the instant proposal for grant of Environment Clearance…”"]}
      after
    />
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
  agents: { from: 0.3, zoom: 1.12, x: 150, y: 150, label: "6 Bedrock agents read in parallel", sub: "Every number verified against the page" },
  project: { from: 0.0, zoom: 1.12, x: 150, y: 60, label: "Plain language. In Hindi.", sub: "Costs computed by code, not by AI" },
  object: { from: 0.55, zoom: 0.92, x: 140, y: 120, label: "A legal objection, signed by a human", sub: "Locked with a SHA-256 receipt" },
};

function Clip({ scene }) {
  const f = useCurrentFrame();
  const setup = CLIP_SETUP[scene.clip];
  const meta = clips[scene.clip];
  const sceneSec = scene.frames / SHORT_FPS;
  const available = meta ? meta.seconds * (1 - setup.from) : sceneSec;
  const rate = Math.min(5, Math.max(0.8, available / sceneSec));
  const zoom = setup.zoom * interpolate(f, [0, scene.frames], [1, 1.04]);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 100%, rgba(255,90,31,0.25), ${C.ink} 55%)` }}>
      <Headline top={170} size={70}>{setup.label}</Headline>
      <div style={{ position: "absolute", top: 520, left: 0, right: 0, height: 900, overflow: "hidden" }}>
        <div style={{ width: 1600, height: 900, transform: `translate(${-setup.x * zoom}px, ${-setup.y * zoom}px) scale(${zoom})`, transformOrigin: "0 0" }}>
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
