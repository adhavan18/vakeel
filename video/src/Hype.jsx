import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { loadFont as loadOriya } from "@remotion/google-fonts/NotoSansOriya";
import script from "../script_v3.json";
import voManifest from "../public/vo_v3/manifest.json";
import screens from "../public/screens/manifest.json";
import { C, serif, sans, mono, deva } from "./theme.js";
import { ScreenScene, SPECS } from "./ScreenScene.jsx";

// "Hype" cut: a beat-locked launch film. Every scene is a whole number of bars at
// 128.6 BPM (14 frames a beat at 30 fps), so cuts land on downbeats of score_v3.py.
// Words on screen are timed to the narration from its text, so a re-recorded voice
// re-times everything automatically.

const oriya = loadOriya("normal", { weights: ["400", "600"], subsets: ["oriya"] }).fontFamily;

export const FPS3 = 30;
const { beatFrames: BEAT, voDelay: VO_DELAY, tail: TAIL } = script.timing;
const BAR = BEAT * 4;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const out = Easing.bezier(0.16, 1, 0.3, 1);
const inout = Easing.bezier(0.65, 0, 0.35, 1);
const AWS = "#ff9900";
const GREEN = "#30d158";
const RED = "#ff453a";

export function timelineV3() {
  let at = 0;
  const scenes = script.scenes.map((s) => {
    const vo = voManifest[s.id] || 0;
    const need = vo ? Math.ceil((VO_DELAY + vo * FPS3 + TAIL) / BAR) : 0;
    const frames = Math.max(s.bars, need) * BAR;
    const scene = { ...s, from: at, frames, voSeconds: vo };
    at += frames;
    return scene;
  });
  return { scenes, total: at };
}

// Frame (within the scene) at which `phrase` is spoken, estimated from character
// position with extra weight for pauses at punctuation. Mirrored in score_v3.py.
const weight = (s) => [...s].reduce((a, c) => a + (".?!".includes(c) ? 7 : c === "," ? 4 : 1), 0);
function at(scene, phrase, shift = 0) {
  const i = scene.vo.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0) throw new Error(`phrase "${phrase}" not in ${scene.id} narration`);
  return Math.round(VO_DELAY + (weight(scene.vo.slice(0, i)) / weight(scene.vo)) * scene.voSeconds * FPS3 + shift);
}

// ---------- motion primitives ----------
function slam(f, start, { from = 1.35, dur = 7, blur = 14 } = {}) {
  const p = interpolate(f, [start, start + dur], [0, 1], { ...clamp, easing: out });
  return {
    opacity: interpolate(f, [start, start + 2], [0, 1], clamp),
    transform: `scale(${from + (1 - from) * p})`,
    filter: p < 1 ? `blur(${(1 - p) * blur}px)` : undefined,
  };
}
const rise = (f, start, dist = 40, dur = 12) => ({
  opacity: interpolate(f, [start, start + 6], [0, 1], clamp),
  transform: `translateY(${interpolate(f, [start, start + dur], [dist, 0], { ...clamp, easing: out })}px)`,
});
const shake = (f, start, amp = 14) => {
  const k = Math.max(0, 1 - (f - start) / 10);
  if (f < start || k <= 0) return "translate(0,0)";
  return `translate(${Math.sin(f * 2.7) * amp * k}px, ${Math.cos(f * 3.3) * amp * k}px)`;
};
const roll = (f, start, dur, to) => Math.round(interpolate(f, [start, start + dur], [0, to], { ...clamp, easing: out }));
const pulse = (f) => Math.exp(-((f % BEAT) / BEAT) * 5);
const fmt = (n) => n.toLocaleString("en-US");

function Stage({ energy = 1, tint = C.ember, children }) {
  const f = useCurrentFrame();
  const p = energy >= 2 ? pulse(f) : 0;
  return (
    <AbsoluteFill style={{ background: "#07080b", overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 55% at 50% 115%, ${tint}${energy >= 2 ? "55" : "30"}, transparent 70%)`, opacity: 0.75 + 0.25 * p }} />
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1.2px, transparent 1.3px)",
          backgroundSize: "36px 36px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black, transparent)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
}

function Flash({ frames = 6, color = "#fff" }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, frames], [0.9, 0], clamp);
  return o > 0 ? <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: "none" }} /> : null;
}

function Chapter({ text }) {
  const f = useCurrentFrame();
  if (!text) return null;
  const [num, ...rest] = text.split(" ");
  return (
    <div style={{ position: "absolute", right: 224, top: 16, display: "flex", alignItems: "center", gap: 10, ...rise(f, 2, 12, 10) }}>
      <div style={{ fontFamily: mono, fontSize: 18, color: "#0b0b0c", background: C.ember, padding: "5px 11px", borderRadius: 8 }}>{num}</div>
      <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.16em", color: "#fff", textTransform: "uppercase" }}>{rest.join(" ")}</div>
    </div>
  );
}

const Mono = ({ children, style }) => <div style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted, ...style }}>{children}</div>;

// ---------- 1. hook ----------
function Hook({ scene }) {
  const f = useCurrentFrame();
  const lines = [
    [at(scene, "Every coal plant"), "Every coal plant", {}],
    [at(scene, "in India"), "in India", {}],
    [at(scene, "needs"), "needs government", {}],
    [at(scene, "permission."), "permission.", { color: C.ember }],
    [at(scene, "And every"), "And every permission", {}],
    [at(scene, "is public"), "is public.", { color: C.ember, fontSize: 230 }],
  ];
  let cur = 0;
  lines.forEach((l, i) => f >= l[0] && (cur = i));
  const [start, text, style] = lines[cur];
  const flick = Math.floor(f / 3) % 40;
  return (
    <Stage energy={1}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 0.16 }}>
        <Img src={staticFile(`pages/p${String(flick + 1).padStart(3, "0")}.jpg`)} style={{ height: 1000, filter: "grayscale(1) contrast(1.4)", transform: `rotate(${(flick % 5) - 2}deg)` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: shake(f, start, 6) }}>
        <div key={cur} style={{ fontFamily: serif, fontSize: 168, letterSpacing: "-0.04em", color: "#fff", textAlign: "center", lineHeight: 1, ...style, ...slam(f, start) }}>{text}</div>
      </AbsoluteFill>
    </Stage>
  );
}

// ---------- 2. wall of pages ----------
function Wall({ scene }) {
  const f = useCurrentFrame();
  const n = scene.frames;
  const tPages = at(scene, "Two hundred");
  const tChars = at(scene, "Six hundred");
  const scroll = interpolate(f, [0, n], [0, -1400], { easing: inout });
  const pages = Array.from({ length: 96 }, (_, i) => `pages/p${String((i % 60) + 1).padStart(3, "0")}.jpg`);
  return (
    <Stage energy={1}>
      <AbsoluteFill style={{ perspective: 1300, perspectiveOrigin: "50% 20%" }}>
        <div style={{ position: "absolute", left: -500, top: 120, width: 2900, transformStyle: "preserve-3d", transform: `rotateX(58deg) rotateZ(-14deg) translateY(${scroll}px)` }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 220px)", gap: 22 }}>
            {pages.map((p, i) => (
              <Img key={i} src={staticFile(p)} style={{ width: 220, height: 311, borderRadius: 4, opacity: interpolate(f, [i * 0.35, i * 0.35 + 6], [0, 0.9], clamp), boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }} />
            ))}
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #07080b 0%, rgba(7,8,11,0.2) 35%, rgba(7,8,11,0.35) 60%, #07080b 100%)" }} />
      <div style={{ position: "absolute", left: 120, top: 110, fontFamily: serif, fontSize: 96, color: "#fff", letterSpacing: "-0.03em", ...slam(f, VO_DELAY) }}>Public. Like this.</div>
      <div style={{ position: "absolute", left: 120, bottom: 110, display: "flex", gap: 110, alignItems: "flex-end" }}>
        <div style={{ ...rise(f, tPages) }}>
          <div style={{ fontFamily: serif, fontSize: 230, lineHeight: 0.85, color: C.ember, letterSpacing: "-0.05em" }}>{roll(f, tPages, 16, 246)}</div>
          <Mono style={{ marginTop: 14 }}>pages</Mono>
        </div>
        <div style={{ ...rise(f, tChars) }}>
          <div style={{ fontFamily: serif, fontSize: 150, lineHeight: 0.85, color: "#fff", letterSpacing: "-0.04em" }}>{fmt(roll(f, tChars, 18, 620940))}</div>
          <Mono style={{ marginTop: 14 }}>characters</Mono>
        </div>
      </div>
    </Stage>
  );
}

// ---------- 3. the needle ----------
const PW = 1309;
const PH = 1853;
function PageZoom({ src, region, marks, f, start, markAt, label, stamp, stampAt, stampColor = RED }) {
  const t = interpolate(f, [start, start + 14], [0, 1], { ...clamp, easing: out });
  const fit = 1000 / PH;
  const [x0, y0, x1, y1] = region;
  const zoom = 1640 / (x1 - x0);
  const s = fit + (zoom - fit) * t;
  const cx = PW / 2 + ((x0 + x1) / 2 - PW / 2) * t;
  const cy = PH / 2 + ((y0 + y1) / 2 - PH / 2) * t;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${960 - cx * s}px, ${540 - cy * s}px) scale(${s})` }}>
        <Img src={staticFile(src)} style={{ width: PW, height: PH, display: "block" }} />
        {marks.map((m, i) => {
          const w = interpolate(f, [markAt + i * 6, markAt + i * 6 + 10], [0, 1], { ...clamp, easing: out });
          return <div key={i} style={{ position: "absolute", left: m[0], top: m[1], width: (m[2] - m[0]) * w, height: m[3] - m[1], background: m[4] ? "transparent" : "rgba(255,90,31,0.3)", borderBottom: `4px solid ${C.ember}`, outline: m[4] ? `4px solid ${C.ember}` : "none", mixBlendMode: "multiply" }} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 80, top: 64, fontFamily: mono, fontSize: 28, color: "#fff", background: "rgba(7,8,11,0.88)", padding: "10px 18px", borderRadius: 10 }}>{label}</div>
      {stamp && f >= stampAt && (
        <div style={{ position: "absolute", right: 110, bottom: 120, transform: `rotate(-7deg) ${slam(f, stampAt, { from: 2.2, dur: 6, blur: 0 }).transform}`, opacity: slam(f, stampAt).opacity }}>
          <div style={{ fontFamily: serif, fontSize: 92, color: stampColor, border: `8px solid ${stampColor}`, borderRadius: 18, padding: "6px 30px", background: "rgba(255,255,255,0.86)", letterSpacing: "0.02em" }}>{stamp}</div>
        </div>
      )}
    </AbsoluteFill>
  );
}

function Needle({ scene }) {
  const f = useCurrentFrame();
  const t18 = at(scene, "Page eighteen", -4);
  const tSkip = at(scene, "skips its public hearing");
  const t25 = at(scene, "Page twenty-five", -4);
  const tOk = at(scene, "Approved");
  const riffle = Math.min(17, Math.floor(interpolate(f, [0, Math.max(1, t18)], [1, 17.99], clamp)));
  const whip = interpolate(f, [t25 - 5, t25, t25 + 5], [0, 1, 0], clamp);
  return (
    <Stage energy={2}>
      {f < t18 && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <Img src={staticFile(`pages/p${String(riffle).padStart(3, "0")}.jpg`)} style={{ height: 1000, boxShadow: "0 40px 120px rgba(0,0,0,0.7)" }} />
          <div style={{ position: "absolute", left: 80, top: 64, fontFamily: mono, fontSize: 28, color: "#fff", background: "rgba(7,8,11,0.88)", padding: "10px 18px", borderRadius: 10 }}>PAGE {String(riffle).padStart(2, "0")} OF 246</div>
        </AbsoluteFill>
      )}
      {f >= t18 && f < t25 && (
        <PageZoom f={f} start={t18} markAt={tSkip - 6} stampAt={tSkip + 14} stamp="NO PUBLIC HEARING" src="pages/hi_p018.jpg" region={[90, 830, 1220, 940]} marks={[[97, 848, 1212, 880], [97, 878, 415, 910]]} label="PAGE 18 OF 246" />
      )}
      {f >= t25 && (
        <PageZoom f={f} start={t25} markAt={t25 + 8} stampAt={tOk} stamp="APPROVED" src="pages/hi_p025.jpg" region={[90, 1215, 1220, 1300]} marks={[[97, 1230, 1212, 1260], [1010, 1228, 1172, 1262, true]]} label="PAGE 25 OF 246" />
      )}
      {whip > 0 && <AbsoluteFill style={{ backdropFilter: `blur(${whip * 24}px)`, background: `rgba(7,8,11,${whip * 0.5})` }} />}
    </Stage>
  );
}

// ---------- 4. nobody ----------
function Nobody({ scene }) {
  const f = useCurrentFrame();
  const a = at(scene, "Nobody objected");
  const b = at(scene, "nobody could read it");
  const z = interpolate(f, [0, scene.frames], [1, 1.08]);
  return (
    <AbsoluteFill style={{ background: "#000", justifyContent: "center", padding: "0 170px", transform: `scale(${z})` }}>
      <div style={{ fontFamily: serif, fontSize: 150, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1, ...slam(f, a, { from: 1.15 }) }}>Nobody objected.</div>
      <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 150, color: C.ember, letterSpacing: "-0.04em", lineHeight: 1.05, marginTop: 18, ...slam(f, b, { from: 1.15 }) }}>Nobody could read it.</div>
    </AbsoluteFill>
  );
}

// ---------- 5. title ----------
function Title({ scene }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 14, stiffness: 180 } });
  const split = Math.max(0, 1 - f / 10) * 18;
  const tag = at(scene, "An AI advocate");
  const rays = Array.from({ length: 18 }, (_, i) => i);
  return (
    <Stage energy={3}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: 0.5 + 0.5 * pulse(f) }}>
        <div style={{ width: 2600, height: 2600, transform: `rotate(${f * 0.4}deg)`, background: `repeating-conic-gradient(from 0deg, ${C.ember}22 0deg 6deg, transparent 6deg 20deg)`, maskImage: "radial-gradient(circle, black 0%, transparent 55%)", WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 55%)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: shake(f, 0, 18) }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 44, transform: `scale(${1.5 - 0.5 * s})` }}>
          <div style={{ position: "relative", fontFamily: serif, fontSize: 300, letterSpacing: "-0.05em", color: "#fff", textShadow: `${split}px 0 0 rgba(255,0,80,0.8), ${-split}px 0 0 rgba(0,200,255,0.8)` }}>Vakeel</div>
          <div style={{ fontFamily: deva, fontWeight: 600, fontSize: 140, color: C.ember, ...rise(f, 8, 60) }}>वकील</div>
        </div>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 46, color: "rgba(255,255,255,0.8)", marginTop: 10, ...rise(f, tag) }}>An AI advocate for the people next door.</div>
      </AbsoluteFill>
      <Flash frames={8} />
    </Stage>
  );
}

// ---------- product screens ----------
const NEAR = {
  labels: ["District search", "every filing, mapped"],
  shots: [{ src: "launch/feed.jpg", w: 0.4 }, { src: "launch/search.jpg", w: 0.6 }],
  camera: [[0, 1.12, 860, 330], [0.3, 1.3, 980, 260], [0.48, 1.3, 980, 260], [0.72, 1.45, 420, 430], [1, 1.5, 400, 440]],
  cursor: [[0, 640, 640], [0.3, 1060, 213, true], [0.5, 1070, 216], [0.78, 420, 440], [1, 424, 444]],
};
const CALLOUTS = {
  drop: [["any PARIVESH filing", 0.15], ["up to 400 pages", 0.55]],
  agents: [["1 agent per project", 0.2], ["in parallel", 0.5], ["Amazon Bedrock · Nova 2 Lite", 0.75]],
  receipts: [["every figure → its page", 0.3]],
  near: [["Korba, Chhattisgarh", 0.6]],
  object: [["drafted from the record", 0.25], ["you sign. not the AI.", 0.7]],
};

function Screen({ scene }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spec = scene.id === "near" ? NEAR : SPECS[scene.screen];
  const s = spring({ frame: f, fps, config: { damping: 20, stiffness: 120 } });
  const calls = CALLOUTS[scene.id] || [];
  return (
    <Stage energy={3} tint="#0071e3">
      <AbsoluteFill style={{ perspective: 2200 }}>
        <AbsoluteFill style={{ transform: `rotateX(${(1 - s) * 22}deg) rotateY(${(1 - s) * -18}deg) scale(${0.82 + 0.18 * s}) translateY(${(1 - s) * 80}px)`, transformOrigin: "50% 60%" }}>
          <ScreenScene scene={scene} spec={spec} url={screens.url} labels={spec.labels} backdrop={false} />
        </AbsoluteFill>
      </AbsoluteFill>
      {calls.map(([text, frac], i) => {
        const t = Math.round(frac * scene.frames);
        const next = calls[i + 1] ? Math.round(calls[i + 1][1] * scene.frames) : scene.frames;
        if (f < t || f >= next) return null;
        return (
          <div key={i} style={{ position: "absolute", left: 110, bottom: 90, ...slam(f, t, { from: 1.25 }) }}>
            <div style={{ fontFamily: serif, fontSize: 84, color: "#fff", background: "rgba(7,8,11,0.86)", padding: "10px 30px 16px", borderRadius: 20, letterSpacing: "-0.03em", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)" }}>{text}</div>
          </div>
        );
      })}
      <Chapter text={scene.chapter} />
    </Stage>
  );
}

// ---------- 8. speed ----------
const LANES = ["Korba Power · 1,320 MW", "KSK Mahanadi · 1,800 MW", "NLC Talabira · 1x800 MW", "GMR Kamalanga · 350 MW", "Jindal Tamnar · 4x600 MW", "NTPC Darlipali · 800 MW"];
function Speed({ scene }) {
  const f = useCurrentFrame();
  const tSec = at(scene, "Fifty-two");
  const secs = interpolate(f, [0, tSec], [0, 52], { ...clamp, easing: Easing.in(Easing.quad) });
  return (
    <Stage energy={3}>
      <div style={{ position: "absolute", left: 110, top: 150, width: 760 }}>
        <Mono style={{ color: AWS }}>Step Functions · Map state · 3 at a time</Mono>
        {LANES.map((l, i) => {
          const wave = Math.floor(i / 3);
          const p = interpolate(f, [wave * tSec * 0.45, wave * tSec * 0.45 + tSec * 0.55], [0, 1], { ...clamp, easing: inout });
          return (
            <div key={l} style={{ marginTop: 26 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono, fontSize: 22, color: p >= 1 ? GREEN : "#fff" }}>
                <span>AGENT 0{i + 1} · {l}</span>
                <span>{p >= 1 ? "done" : p > 0 ? "reading" : "queued"}</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.1)", marginTop: 10, overflow: "hidden" }}>
                <div style={{ width: `${p * 100}%`, height: "100%", background: p >= 1 ? GREEN : C.ember }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", right: 120, top: 190, textAlign: "right" }}>
        <div style={{ ...rise(f, VO_DELAY) }}>
          <div style={{ fontFamily: serif, fontSize: 150, lineHeight: 0.9, color: "#fff", letterSpacing: "-0.05em" }}>246 pages</div>
        </div>
        <div style={{ fontFamily: serif, fontSize: 330, lineHeight: 0.95, color: f >= tSec ? C.ember : "rgba(255,255,255,0.85)", letterSpacing: "-0.06em", fontVariantNumeric: "tabular-nums", transform: shake(f, tSec, 16), marginTop: 20 }}>
          {f >= tSec ? "52s" : `${secs.toFixed(1)}s`}
        </div>
        <Mono style={{ marginTop: 10, opacity: f >= tSec ? 1 : 0 }}>queued to finished · live site</Mono>
      </div>
      {f >= tSec && f < tSec + 6 && <AbsoluteFill style={{ background: "#fff", opacity: interpolate(f, [tSec, tSec + 6], [0.5, 0]) }} />}
      <Chapter text={scene.chapter} />
    </Stage>
  );
}

// ---------- 9. verify ----------
function Check({ f, t, ok, children }) {
  if (f < t) return null;
  return (
    <div style={{ display: "flex", gap: 14, fontFamily: mono, fontSize: 22, color: ok ? GREEN : RED, marginTop: 10, ...rise(f, t, 14, 8) }}>
      <span>{ok ? "✓" : "✕"}</span>
      <span style={{ color: "rgba(255,255,255,0.85)" }}>{children}</span>
    </div>
  );
}
function ClaimCard({ f, start, label, value, quote, page, checks, verdict, verdictAt, good }) {
  const color = good ? GREEN : RED;
  const fall = good ? 0 : interpolate(f, [verdictAt + 16, verdictAt + 30], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  return (
    <div style={{ width: 860, background: "#111216", border: `1px solid ${f >= verdictAt ? color : "rgba(255,255,255,0.12)"}`, borderRadius: 22, padding: "26px 30px", position: "relative", ...rise(f, start), transform: `${rise(f, start).transform} translateY(${fall * 700}px) rotate(${fall * 9}deg)`, opacity: rise(f, start).opacity * (1 - fall * 0.8) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Mono style={{ fontSize: 18 }}>{label}</Mono>
        <Mono style={{ fontSize: 18 }}>{page}</Mono>
      </div>
      <div style={{ fontFamily: serif, fontSize: 64, color: "#fff", letterSpacing: "-0.03em", marginTop: 6 }}>{value}</div>
      <div style={{ fontFamily: sans, fontSize: 24, color: "rgba(255,255,255,0.7)", marginTop: 10, lineHeight: 1.35 }}>“{quote}”</div>
      <div style={{ marginTop: 14, width: 520 }}>{checks.map(([t, ok, text]) => <Check key={text} f={f} t={t} ok={ok}>{text}</Check>)}</div>
      {f >= verdictAt && (
        <div style={{ position: "absolute", right: 26, bottom: 24, transform: `rotate(-8deg) ${slam(f, verdictAt, { from: 2, dur: 6, blur: 0 }).transform}` }}>
          <div style={{ fontFamily: serif, fontSize: 52, color, border: `6px solid ${color}`, borderRadius: 14, padding: "2px 18px", background: "rgba(7,8,11,0.85)" }}>{verdict}</div>
        </div>
      )}
    </div>
  );
}
function Verify({ scene }) {
  const f = useCurrentFrame();
  const tQuote = at(scene, "word-for-word");
  const tCode = at(scene, "code checks");
  const end = Math.round(VO_DELAY + scene.voSeconds * FPS3);
  const tA = Math.min(end - 4, tCode + 22);
  return (
    <Stage energy={2}>
      {f < tQuote - 4 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontFamily: serif, fontSize: 170, color: "#fff", letterSpacing: "-0.05em", ...slam(f, VO_DELAY), textShadow: `${Math.sin(f * 1.7) * 6}px 0 0 rgba(255,69,58,0.7)` }}>AI makes things up.</div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ padding: "120px 110px", flexDirection: "row", gap: 60, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <ClaimCard f={f} start={tQuote - 4} label="Water requirement" page="page 14" value="104,110 m³ / day" quote="The water requirement for the proposed project is estimated as 104110 m3/day" checks={[[tCode, true, "quote found on page 14"], [tCode + 8, true, "104110 appears inside the quote"]]} verdict="VERIFIED" verdictAt={tA} good />
            <ClaimCard f={f} start={tQuote + 6} label="Total capacity" page="page ?" value="1,920 MW" quote="Total Technology adopted 1920 MW Sub & Super Critical" checks={[[tCode + 14, false, "quote not found in the filing"]]} verdict="REJECTED" verdictAt={tA + 8} />
          </div>
          <QuotePanel f={f} start={tQuote} scan={tCode} />
        </AbsoluteFill>
      )}
      <Chapter text={scene.chapter} />
    </Stage>
  );
}


// Page 14 at full resolution; the scan line finds the quote, then the camera pushes in.
function QuotePanel({ f, start, scan }) {
  const W = 780;
  const s0 = W / PW;
  const z = interpolate(f, [scan + 10, scan + 28], [0, 1], { ...clamp, easing: inout });
  const s = s0 + (1.25 - s0) * z;
  const tx = (W / 2 - 650 * s) * z;
  const ty = (410 - 750 * s) * z;
  const mark = interpolate(f, [scan + 16, scan + 26], [0, 1], { ...clamp, easing: out });
  return (
    <div style={{ width: W, position: "relative", height: 820, borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: "0 40px 100px rgba(0,0,0,0.6)", ...rise(f, start) }}>
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
        <Img src={staticFile("pages/hi_p014.jpg")} style={{ width: PW, height: PH, display: "block" }} />
        {[[97, 722, 1212, 748], [97, 752, 432, 776]].map((m, i) => (
          <div key={i} style={{ position: "absolute", left: m[0], top: m[1], width: (m[2] - m[0]) * mark, height: m[3] - m[1], background: "rgba(48,209,88,0.32)", borderBottom: `3px solid ${GREEN}`, mixBlendMode: "multiply" }} />
        ))}
      </div>
      {f >= scan && f < scan + 24 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: `${interpolate(f, [scan, scan + 16], [0, 54], clamp)}%`, height: 6, background: C.ember, boxShadow: `0 0 30px 8px ${C.ember}` }} />
      )}
      <div style={{ position: "absolute", left: 18, top: 18, fontFamily: mono, fontSize: 18, color: "#fff", background: "rgba(7,8,11,0.85)", padding: "6px 12px", borderRadius: 8 }}>the PDF · page 14</div>
    </div>
  );
}

// ---------- 10. purge ----------
function rand(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
const DOTS = Array.from({ length: 284 }, (_, i) => i);
const REJECTED = new Set([...DOTS].sort((a, b) => rand(a) - rand(b)).slice(0, 65));
function Purge({ scene }) {
  const f = useCurrentFrame();
  const tOut = at(scene, "Sixty-five");
  const tKeep = at(scene, "Two hundred and nineteen");
  const cols = 24;
  return (
    <Stage energy={2}>
      <div style={{ position: "absolute", left: 110, top: 100, fontFamily: serif, fontSize: 120, color: "#fff", letterSpacing: "-0.04em", ...slam(f, VO_DELAY) }}>No quote, no claim.</div>
      <div style={{ position: "absolute", left: 110, top: 290, display: "grid", gridTemplateColumns: `repeat(${cols}, 34px)`, gap: 12 }}>
        {DOTS.map((i) => {
          const appear = interpolate(f, [(i % cols) * 0.5 + Math.floor(i / cols) * 0.8, (i % cols) * 0.5 + Math.floor(i / cols) * 0.8 + 6], [0, 1], clamp);
          const bad = REJECTED.has(i);
          const d = rand(i + 9) * 10;
          const fall = bad ? interpolate(f, [tOut + d, tOut + d + 22], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) }) : 0;
          const color = bad && f >= tOut + d - 6 ? RED : !bad && f >= tKeep ? GREEN : "rgba(255,255,255,0.75)";
          return <div key={i} style={{ width: 34, height: 34, borderRadius: 9, background: color, opacity: appear * (1 - fall), transform: `translateY(${fall * 900}px) rotate(${fall * (rand(i) * 120 - 60)}deg) scale(${0.4 + 0.6 * appear})` }} />;
        })}
      </div>
      <div style={{ position: "absolute", right: 110, top: 300, textAlign: "right" }}>
        <div style={{ ...rise(f, tOut) }}>
          <div style={{ fontFamily: serif, fontSize: 190, lineHeight: 0.9, color: RED, letterSpacing: "-0.05em" }}>{roll(f, tOut, 14, 65)}</div>
          <Mono>thrown out</Mono>
        </div>
        <div style={{ marginTop: 40, ...rise(f, tKeep) }}>
          <div style={{ fontFamily: serif, fontSize: 190, lineHeight: 0.9, color: GREEN, letterSpacing: "-0.05em" }}>{roll(f, tKeep, 14, 219)}</div>
          <Mono>verified word for word</Mono>
        </div>
      </div>
      <Chapter text={scene.chapter} />
    </Stage>
  );
}

// ---------- 11. plain language ----------
function Plain({ scene }) {
  const f = useCurrentFrame();
  const tEn = at(scene, "In English");
  const tHi = at(scene, "In Hindi");
  const tOr = at(scene, "In Odia");
  const cards = [
    [tEn, "English", "Korba Power expands a 1,320 MW coal plant, drawing 104,110 m³ a day from the Hasdeo River.", sans, "Korba, Chhattisgarh"],
    [tHi, "हिन्दी", "कोरबा पावर लिमिटेड ने पथादी जंगल के पास 1320 मेगावाट कोयला प्लांट का विस्तार किया, हसदेव नदी से 104,110 मीटर³/दिन पानी निकाला", deva, "Korba, Chhattisgarh"],
    [tOr, "ଓଡ଼ିଆ", "GMR Kamalanga Energy Limited ମଧ୍ୟରେ କମଲାଙ୍ଗାରେ ଆଶା ହସ୍ପିଟାଲ ପାଖରେ 350 ମେଗାଓଟ କୋଇଲ ପ୍ରଯୋଜନା ଯୋଗାଇଛି", oriya, "Kamalanga, Odisha"],
  ];
  let cur = -1;
  cards.forEach((c, i) => f >= c[0] - 4 && (cur = i));
  const shot = f >= tHi - 4 ? "project/001.jpg" : "project/000.jpg";
  return (
    <Stage energy={3}>
      <div style={{ position: "absolute", left: 110, top: 96, fontFamily: serif, fontSize: 92, color: "#fff", letterSpacing: "-0.04em", ...slam(f, VO_DELAY) }}>Plain language.</div>
      <AbsoluteFill style={{ perspective: 1800 }}>
        <div style={{ position: "absolute", left: 90, top: 260, width: 900, height: 563, borderRadius: 16, overflow: "hidden", transform: "rotateY(16deg) rotateX(4deg)", transformOrigin: "0 50%", boxShadow: "0 50px 120px rgba(0,0,0,0.6)", ...rise(f, 4) }}>
          <Img src={staticFile(`screens/${shot}`)} style={{ width: 1440 * 0.9, marginLeft: -60, marginTop: -40 }} />
        </div>
      </AbsoluteFill>
      {cur >= 0 && (
        <div key={cur} style={{ position: "absolute", left: 1050, top: 300, width: 760, ...slam(f, cards[cur][0] - 4, { from: 1.12 }) }}>
          <div style={{ display: "inline-block", fontFamily: `${cards[cur][3]}, ${sans}`, fontWeight: 600, fontSize: 30, color: "#0b0b0c", background: C.ember, padding: "6px 18px", borderRadius: 999 }}>{cards[cur][1]}</div>
          <div style={{ fontFamily: `${cards[cur][3]}, ${sans}`, fontWeight: 600, fontSize: cur ? 50 : 58, lineHeight: 1.3, color: "#fff", marginTop: 24 }}>{cards[cur][2]}</div>
          <Mono style={{ marginTop: 22, fontSize: 18 }}>{cards[cur][4]}</Mono>
        </div>
      )}
      <Chapter text={scene.chapter} />
    </Stage>
  );
}

// ---------- 12. impact ----------
function Tile({ f, t, big, unit, formula, page, color = "#fff", value, suffix = "" }) {
  return (
    <div style={{ background: "#111216", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 26, padding: "28px 34px", ...slam(f, t, { from: 1.12 }) }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Mono style={{ fontSize: 18 }}>{unit}</Mono>
        <Mono style={{ fontSize: 18 }}>{page}</Mono>
      </div>
      <div style={{ fontFamily: serif, fontSize: 130, lineHeight: 1, color, letterSpacing: "-0.05em", marginTop: 8 }}>
        {value != null ? `${big.replace("#", interpolate(f, [t, t + 14], [0, value], { ...clamp, easing: out }).toFixed(value % 1 ? 1 : 0))}${suffix}` : big}
      </div>
      <div style={{ fontFamily: mono, fontSize: 19, color: C.muted, marginTop: 12 }}>{formula}</div>
    </div>
  );
}
function Impact({ scene }) {
  const f = useCurrentFrame();
  const tCode = at(scene, "Then code");
  const tCo2 = at(scene, "Six point eight");
  const tWater = at(scene, "Water for");
  return (
    <Stage energy={3}>
      <div style={{ position: "absolute", left: 110, top: 86, display: "flex", alignItems: "center", gap: 22, ...slam(f, tCode, { from: 1.2 }) }}>
        <div style={{ fontFamily: serif, fontSize: 84, color: "#fff", letterSpacing: "-0.04em" }}>The math is code.</div>
        <div style={{ fontFamily: mono, fontSize: 20, color: "#0b0b0c", background: GREEN, padding: "6px 14px", borderRadius: 999 }}>NOT THE MODEL</div>
      </div>
      <div style={{ position: "absolute", left: 110, right: 110, top: 240, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
        {f >= tCo2 && <Tile f={f} t={tCo2} big="#M t" value={6.8} unit="CO₂ a year" page="page 1" formula="1,320 MW × 8,760 h × 0.65 PLF × 0.9 t/MWh" />}
        {f >= tCo2 + BEAT * 2 && <Tile f={f} t={tCo2 + BEAT * 2} big="₹4,887 cr" unit="est. climate damage a year" page="page 1" color={C.ember} formula="6.76 Mt × US$86 social cost × ₹84" />}
        {f >= tWater && <Tile f={f} t={tWater} big="# lakh" value={7.7} unit="people's water, every day" page="page 14" color="#64d2ff" formula="104,110 m³/day ÷ 135 L per person" />}
        {f >= tWater + BEAT * 2 && <Tile f={f} t={tWater + BEAT * 2} big="#" value={2.4} unit="coal trains burned a day" page="page 6" formula="9,024 t/day ÷ 3,800 t per rake" />}
      </div>
      <Mono style={{ position: "absolute", left: 110, bottom: 56, fontSize: 18, opacity: f >= tCo2 ? 1 : 0 }}>Korba, Chhattisgarh · inputs verified on the cited pages · factors from CEA, CPHEEO, Ricke et al. 2018</Mono>
      <Chapter text={scene.chapter} />
    </Stage>
  );
}

// ---------- 16. human ----------
function Human({ scene }) {
  const f = useCurrentFrame();
  const tWait = at(scene, "Step Functions waits");
  const tDays = at(scene, "Up to seven days");
  const end = scene.frames;
  const signed = f >= end - BEAT * 2;
  const left = Math.max(0, 7 * 86400 - Math.floor(interpolate(f, [tDays, end], [0, 86400 * 0.6], clamp)));
  const clock = `${Math.floor(left / 86400)}d ${String(Math.floor((left % 86400) / 3600)).padStart(2, "0")}:${String(Math.floor((left % 3600) / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  const nodes = [
    ["Draft objection", "Bedrock · from the record", "done"],
    ["Wait for a human", "waitForTaskToken", signed ? "done" : "wait"],
    ["Signed & locked", "exact sentence + SHA-256", signed ? "done" : "idle"],
  ];
  return (
    <Stage energy={2}>
      {f < tWait - 2 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 30, padding: "34px 70px", borderRadius: 999, background: "#1c1c1f", border: "2px solid rgba(255,255,255,0.15)", ...slam(f, VO_DELAY), transform: `${slam(f, VO_DELAY).transform} translateX(${Math.sin(f * 1.3) * Math.max(0, 1 - (f - 20) / 12) * 14 * (f > 20 ? 1 : 0)}px)` }}>
            <svg width="70" height="78" viewBox="0 0 11 12"><rect x="1" y="5" width="9" height="7" rx="1.5" fill={C.ember} /><path d="M3 5V3.6a2.5 2.5 0 0 1 5 0V5" stroke={C.ember} strokeWidth="1.4" fill="none" /></svg>
            <div style={{ fontFamily: serif, fontSize: 120, color: "rgba(255,255,255,0.5)", letterSpacing: "-0.04em" }}>Send</div>
          </div>
          <div style={{ fontFamily: serif, fontSize: 64, color: "#fff", marginTop: 40, ...rise(f, at(scene, "until you sign")) }}>Not until you sign it.</div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ padding: "110px 110px" }}>
          <Mono style={{ color: AWS }}>AWS Step Functions · objection workflow</Mono>
          <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 70 }}>
            {nodes.map(([t, sub, st], i) => {
              const color = st === "done" ? GREEN : st === "wait" ? "#ffd60a" : "rgba(255,255,255,0.25)";
              const glow = st === "wait" ? 0.5 + 0.5 * pulse(f) : 0;
              return (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 40, ...rise(f, tWait - 2 + i * 5) }}>
                  <div style={{ width: 470, padding: "30px 32px", borderRadius: 22, background: "#111216", border: `3px solid ${color}`, boxShadow: glow ? `0 0 ${60 * glow}px rgba(255,214,10,${0.5 * glow})` : "none" }}>
                    <div style={{ fontFamily: mono, fontSize: 18, color }}>{st === "done" ? "✓ SUCCEEDED" : st === "wait" ? "⏸ WAITING" : "PENDING"}</div>
                    <div style={{ fontFamily: serif, fontSize: 52, color: "#fff", letterSpacing: "-0.03em", marginTop: 8 }}>{t}</div>
                    <div style={{ fontFamily: mono, fontSize: 19, color: C.muted, marginTop: 8 }}>{sub}</div>
                  </div>
                  {i < 2 && <div style={{ fontFamily: mono, fontSize: 40, color: C.dim }}>→</div>}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 90, display: "flex", alignItems: "baseline", gap: 30, ...rise(f, tDays) }}>
            <div style={{ fontFamily: serif, fontSize: 150, color: "#ffd60a", letterSpacing: "-0.05em", fontVariantNumeric: "tabular-nums" }}>{clock}</div>
            <Mono>task token expires in</Mono>
          </div>
        </AbsoluteFill>
      )}
      <Chapter text={scene.chapter} />
    </Stage>
  );
}

// ---------- 17. AWS stack ----------
const SERVICES = [
  ["Bedrock", "Amazon Bedrock", "Nova 2 Lite · tool-forced JSON"],
  ["Step Functions", "AWS Step Functions", "Map state · waitForTaskToken"],
  ["Lambda", "AWS Lambda", "Python 3.12 · arm64"],
  ["DynamoDB", "Amazon DynamoDB", "single table · budget counter"],
  ["S3", "Amazon S3", "presigned uploads · SigV4"],
  ["CloudFront", "Amazon CloudFront", "web app · origin access control"],
  ["Amazon Location", "Amazon Location Service", "geocoding fallback"],
];
function Stack({ scene }) {
  const f = useCurrentFrame();
  const tCap = at(scene, "With a hard daily");
  return (
    <Stage energy={3} tint={AWS}>
      <div style={{ position: "absolute", left: 110, top: 80, fontFamily: serif, fontSize: 104, color: "#fff", letterSpacing: "-0.04em", ...slam(f, VO_DELAY) }}>
        All serverless. <span style={{ color: AWS }}>All AWS.</span>
      </div>
      <div style={{ position: "absolute", left: 110, right: 110, top: 270, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
        {SERVICES.map(([key, name, role], i) => {
          const t = at(scene, key);
          if (f < t) return <div key={key} />;
          return (
            <div key={key} style={{ background: "#111216", borderRadius: 22, padding: "28px 28px", borderTop: `5px solid ${AWS}`, ...slam(f, t, { from: 1.25 }) }}>
              <Mono style={{ fontSize: 16, color: AWS }}>0{i + 1}</Mono>
              <div style={{ fontFamily: serif, fontSize: 46, color: "#fff", letterSpacing: "-0.03em", marginTop: 10, lineHeight: 1.05 }}>{name}</div>
              <div style={{ fontFamily: mono, fontSize: 18, color: C.muted, marginTop: 12 }}>{role}</div>
            </div>
          );
        })}
        {f >= tCap && (
          <div style={{ background: AWS, borderRadius: 22, padding: "28px 28px", ...slam(f, tCap, { from: 1.25 }) }}>
            <Mono style={{ fontSize: 16, color: "#0b0b0c" }}>guardrail</Mono>
            <div style={{ fontFamily: serif, fontSize: 46, color: "#0b0b0c", letterSpacing: "-0.03em", marginTop: 10, lineHeight: 1.05 }}>Daily Bedrock budget cap</div>
            <div style={{ fontFamily: mono, fontSize: 18, color: "#0b0b0c", marginTop: 12 }}>atomic counter · fails closed</div>
          </div>
        )}
      </div>
    </Stage>
  );
}

// ---------- 18. proof ----------
function Proof({ scene }) {
  const f = useCurrentFrame();
  const items = [
    [at(scene, "Three real"), 3, "real filings"],
    [at(scene, "Seven hundred"), 732, "pages read"],
    [at(scene, "Seventeen"), 17, "projects"],
  ];
  const tAll = at(scene, "Every claim");
  return (
    <Stage energy={3}>
      <Mono style={{ position: "absolute", left: 110, top: 110, ...rise(f, 0) }}>live on AWS · ap-southeast-2 · real government filings</Mono>
      <div style={{ position: "absolute", left: 110, right: 110, top: 260, display: "flex", justifyContent: "space-between" }}>
        {items.map(([t, v, label]) => (
          <div key={label} style={{ opacity: f >= t ? 1 : 0, ...(f >= t ? slam(f, t) : {}) }}>
            <div style={{ fontFamily: serif, fontSize: 300, lineHeight: 0.9, color: "#fff", letterSpacing: "-0.06em" }}>{roll(f, t, 10, v)}</div>
            <Mono>{label}</Mono>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 110, bottom: 140, display: "flex", gap: 50, alignItems: "baseline", ...rise(f, tAll) }}>
        <div style={{ fontFamily: serif, fontSize: 88, color: C.ember, letterSpacing: "-0.04em" }}>Every claim checked.</div>
        <div style={{ fontFamily: mono, fontSize: 30, color: GREEN }}>219 ✓</div>
        <div style={{ fontFamily: mono, fontSize: 30, color: RED }}>65 ✕</div>
      </div>
    </Stage>
  );
}

// ---------- 19. stakes ----------
function Stakes({ scene }) {
  const f = useCurrentFrame();
  const tNum = at(scene, "a hundred and fifteen");
  const tLine = at(scene, "The clearance file");
  const z = interpolate(f, [0, scene.frames], [1, 1.06]);
  return (
    <AbsoluteFill style={{ background: "#000", transform: `scale(${z})` }}>
      {f < tLine - 4 ? (
        <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px" }}>
          <div style={{ fontFamily: serif, fontSize: 300, lineHeight: 0.9, color: C.ember, letterSpacing: "-0.06em", ...rise(f, tNum - 6, 30, 20) }}>{fmt(roll(f, tNum - 6, 30, 115000))}</div>
          <div style={{ fontFamily: serif, fontSize: 64, color: "#fff", marginTop: 20, ...rise(f, 4, 30, 20) }}>early deaths a year linked to India's coal power.</div>
          <div style={{ fontFamily: sans, fontSize: 22, color: C.dim, marginTop: 20, ...rise(f, tNum + 20) }}>Source: Conservation Action Trust & Urban Emissions, via Scientific American</div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px" }}>
          <div style={{ fontFamily: serif, fontSize: 120, lineHeight: 1.04, color: "#fff", letterSpacing: "-0.04em", ...rise(f, tLine - 4, 30, 24) }}>
            The clearance file is the last place anyone can <span style={{ color: C.ember, fontStyle: "italic" }}>say no.</span>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

// ---------- 20-21. close and end ----------
function Close({ scene }) {
  const f = useCurrentFrame();
  const t2 = at(scene, "can read it first");
  return (
    <Stage energy={2}>
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px" }}>
        <div style={{ fontFamily: serif, fontSize: 112, lineHeight: 1.04, color: "#fff", letterSpacing: "-0.04em", ...rise(f, VO_DELAY, 30, 18) }}>Vakeel makes sure the people who'll breathe it</div>
        <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 150, lineHeight: 1.04, color: C.ember, letterSpacing: "-0.05em", marginTop: 14, ...slam(f, t2, { from: 1.2 }) }}>can read it first.</div>
      </AbsoluteFill>
    </Stage>
  );
}

function End() {
  const f = useCurrentFrame();
  return (
    <Stage energy={1}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: shake(f, 0, 10) }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 30, ...slam(f, 0, { from: 1.3 }) }}>
          <div style={{ fontFamily: serif, fontSize: 210, letterSpacing: "-0.05em", color: "#fff" }}>Vakeel</div>
          <div style={{ fontFamily: deva, fontWeight: 600, fontSize: 100, color: C.ember }}>वकील</div>
        </div>
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 40, color: "rgba(255,255,255,0.8)", ...rise(f, 10) }}>Read the filing before it's approved.</div>
        <div style={{ display: "flex", gap: 40, marginTop: 60, fontFamily: mono, fontSize: 26, color: "#fff", ...rise(f, 20) }}>
          <span>{screens.url}</span>
          <span style={{ color: C.dim }}>·</span>
          <span>github.com/adhavan18/vakeel</span>
        </div>
        <Mono style={{ marginTop: 26, fontSize: 18, ...rise(f, 28) }}>Built on AWS · Environmental Hacks 2026 · Air track</Mono>
      </AbsoluteFill>
      <Flash frames={6} />
    </Stage>
  );
}

const SCENES = { hook: Hook, wall: Wall, needle: Needle, nobody: Nobody, title: Title, speed: Speed, verify: Verify, purge: Purge, plain: Plain, impact: Impact, near: Screen, human: Human, stack: Stack, proof: Proof, stakes: Stakes, close: Close, end: End };

function Grain() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: 0.06,
        backgroundPosition: `${(f * 37) % 220}px ${(f * 53) % 220}px`,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

export const Hype = () => {
  const { scenes } = timelineV3();
  return (
    <AbsoluteFill style={{ background: "#07080b" }}>
      <Audio src={staticFile(script.music.file)} volume={0.5} />
      {scenes.map((s) => {
        const Comp = s.screen ? Screen : SCENES[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={s.id}>
            <Comp scene={s} />
            {s.voSeconds > 0 && (
              <Sequence from={VO_DELAY}>
                <Audio src={staticFile(`${script.vo_dir}/${s.id}.wav`)} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
      <Grain />
    </AbsoluteFill>
  );
};
