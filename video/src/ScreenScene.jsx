import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from "remotion";
import { C, mono, sans } from "./theme.js";

// Window geometry: the 1440x900 viewport captures are shown at WIN_W wide.
const VW = 1440;
const VH = 900;
const WIN_W = 1472;
const SCALE = WIN_W / VW;
const WIN_H = VH * SCALE;
const BAR = 38;
const WIN_X = (1920 - WIN_W) / 2;
const WIN_Y = 66;

const smooth = Easing.bezier(0.45, 0, 0.2, 1);

function keyframed(t, keys, pick) {
  // keys: [[t, ...values]] sorted by t. Eased interpolation between neighbours.
  if (t <= keys[0][0]) return pick(keys[0]);
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, b] = [keys[i], keys[i + 1]];
    if (t <= b[0]) {
      const p = smooth((t - a[0]) / Math.max(1e-6, b[0] - a[0]));
      const va = pick(a), vb = pick(b);
      return va.map((v, j) => v + (vb[j] - v) * p);
    }
  }
  return pick(keys[keys.length - 1]);
}

function Backdrop() {
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 70% 60% at 15% 10%, rgba(0,113,227,0.55), transparent 60%), radial-gradient(ellipse 60% 55% at 90% 95%, rgba(255,106,0,0.35), transparent 60%), radial-gradient(ellipse 50% 50% at 80% 20%, rgba(120,80,255,0.25), transparent 60%), #0a0d16",
      }}
    />
  );
}

function Cursor({ x, y, pressed }) {
  return (
    <svg width={30} height={30} viewBox="0 0 24 24" style={{ position: "absolute", left: x - 3, top: y - 2, transform: `scale(${pressed ? 0.86 : 1})`, transformOrigin: "3px 2px", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.35))" }}>
      <path d="M3 2 L3 19 L7.6 14.8 L10.6 21.6 L13.6 20.3 L10.7 13.6 L17 13.6 Z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function ScreenScene({ scene, spec, url, labels, backdrop = true }) {
  const f = useCurrentFrame();
  const total = scene.frames;
  const t = Math.min(1, f / Math.max(1, total - 1));

  // Shots: weighted slices of the scene, crossfaded.
  const sum = spec.shots.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  const slices = spec.shots.map((s) => {
    const from = (acc / sum) * total;
    acc += s.w;
    return { ...s, from, to: (acc / sum) * total };
  });
  const fadeFrames = (s) => Math.max(1, Math.min(spec.fade ?? 7, (s.to - s.from) * 0.6));

  const [cs, cx, cy] = keyframed(t, spec.camera, (k) => [k[1], k[2], k[3]]);
  const [mx, my] = keyframed(t, spec.cursor, (k) => [k[1], k[2]]);
  // Keep the zoomed viewport inside the screenshot.
  const tx = Math.min(0, Math.max(VW - VW * cs, VW / 2 - cx * cs));
  const ty = Math.min(0, Math.max(VH - VH * cs, VH / 2 - cy * cs));

  const clicks = spec.cursor.filter((k) => k[3]).map((k) => k[0] * total);
  const pressed = clicks.some((c) => f >= c && f < c + 5);

  const enter = interpolate(f, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: smooth });

  return (
    <AbsoluteFill>
      {backdrop && <Backdrop />}
      <div
        style={{
          position: "absolute",
          left: WIN_X,
          top: WIN_Y,
          width: WIN_W,
          height: WIN_H + BAR,
          borderRadius: 16,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 50px 120px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.10)",
          transform: `translateY(${(1 - enter) * 24}px) scale(${0.985 + 0.015 * enter})`,
        }}
      >
        <div style={{ height: BAR, background: "#ececf0", display: "flex", alignItems: "center", padding: "0 16px", gap: 8, borderBottom: "1px solid #dcdce0" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
          ))}
          <div style={{ margin: "0 auto", display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 8, padding: "4px 16px", fontFamily: sans, fontSize: 14, color: "#6e6e73" }}>
            <svg width="11" height="12" viewBox="0 0 11 12"><rect x="1" y="5" width="9" height="7" rx="1.5" fill="#86868b" /><path d="M3 5V3.6a2.5 2.5 0 0 1 5 0V5" stroke="#86868b" strokeWidth="1.4" fill="none" /></svg>
            {url}
          </div>
          <div style={{ width: 52 }} />
        </div>
        <div style={{ position: "relative", width: WIN_W, height: WIN_H, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: VW, height: VH, transformOrigin: "0 0", transform: `scale(${SCALE}) translate(${tx}px, ${ty}px) scale(${cs})` }}>
            {slices.map((s, i) => {
              const ff = fadeFrames(s);
              const o = i === 0 ? 1 : interpolate(f, [s.from - ff / 2, s.from + ff / 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              if (f < s.from - ff || f > s.to + fadeFrames(slices[i + 1] || s) + 2) return null;
              return <Img key={s.src} src={staticFile(`screens/${s.src}`)} style={{ position: "absolute", inset: 0, width: VW, height: VH, opacity: o }} />;
            })}
            {clicks.map((c, i) => {
              const k = spec.cursor.find((q) => q[0] * total === c);
              const p = interpolate(f, [c, c + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              if (p <= 0 || p >= 1) return null;
              return (
                <div key={i} style={{ position: "absolute", left: k[1] - 30, top: k[2] - 30, width: 60, height: 60, borderRadius: 30, border: "3px solid rgba(0,113,227,0.9)", background: "rgba(0,113,227,0.18)", transform: `scale(${0.3 + p * 1.2})`, opacity: 1 - p }} />
              );
            })}
            <Cursor x={mx} y={my} pressed={pressed} />
          </div>
        </div>
      </div>
      {labels && (
        <div style={{ position: "absolute", left: WIN_X, top: 18, display: "flex", gap: 10, opacity: enter }}>
          <div style={{ fontFamily: mono, fontSize: 18, color: "#fff", background: "rgba(0,113,227,0.9)", padding: "5px 13px", borderRadius: 999 }}>{labels[0]}</div>
          {labels[1] && <div style={{ fontFamily: mono, fontSize: 18, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.12)", padding: "5px 13px", borderRadius: 999 }}>{labels[1]}</div>}
        </div>
      )}
    </AbsoluteFill>
  );
}

const range = (scene, a, b, w) => Array.from({ length: b - a + 1 }, (_, i) => ({ src: `${scene}/${String(a + i).padStart(3, "0")}.jpg`, w }));

// Hand-authored camera and cursor paths over the captured states (viewport CSS px).
export const SPECS = {
  home: {
    labels: ["PARIVESH filing", "drag and drop"],
    shots: [{ src: "home/000.jpg", w: 0.45 }, { src: "home/001.jpg", w: 0.55 }],
    camera: [[0, 1, 720, 450], [0.38, 1.08, 520, 330], [0.48, 1, 720, 450], [0.72, 1.32, 1000, 610], [1, 1.36, 1040, 610]],
    cursor: [[0, 1460, 980], [0.36, 820, 560], [0.6, 1181, 610, true], [1, 1181, 612]],
  },
  agents: {
    labels: ["AWS Step Functions · Map state", "1 Amazon Bedrock agent per project"],
    fade: 4,
    shots: [...range("agents", 0, 57, 0.7 / 58), { src: "agents/058.jpg", w: 0.13 }, { src: "agents/059.jpg", w: 0.17 }],
    camera: [[0, 1, 720, 450], [0.1, 1.3, 480, 520], [0.4, 1.3, 480, 540], [0.5, 1.3, 1030, 520], [0.66, 1.3, 1030, 560], [0.72, 1, 720, 450], [0.85, 1, 720, 450], [0.92, 1.28, 520, 560], [1, 1.3, 520, 560]],
    cursor: [[0, 1181, 612], [0.12, 980, 760], [0.7, 980, 760], [0.86, 700, 520], [0.93, 344, 566, true], [1, 344, 566]],
  },
  verify: {
    labels: ["Verifier · deterministic code", "no quote on the page, no claim"],
    shots: [{ src: "verify/000.jpg", w: 0.45 }, { src: "verify/001.jpg", w: 0.55 }],
    camera: [[0, 1, 720, 450], [0.16, 1.65, 520, 483], [0.42, 1.65, 520, 483], [0.47, 1, 720, 450], [0.6, 1.32, 600, 560], [1, 1.36, 600, 570]],
    cursor: [[0, 344, 566], [0.18, 468, 488], [0.42, 468, 488], [0.6, 330, 575], [1, 340, 578]],
  },
  project: {
    labels: ["Plain language · Hindi · Odia", "costs computed by code"],
    shots: [{ src: "project/000.jpg", w: 0.22 }, { src: "project/001.jpg", w: 0.26 }, { src: "project/002.jpg", w: 0.14 }, { src: "project/003.jpg", w: 0.24 }, { src: "project/004.jpg", w: 0.14 }],
    camera: [[0, 1, 720, 450], [0.1, 1.12, 620, 330], [0.19, 1.12, 620, 330], [0.24, 1.2, 640, 300], [0.46, 1.2, 640, 300], [0.5, 1, 720, 450], [0.63, 1.3, 620, 430], [0.84, 1.3, 620, 470], [0.88, 1, 720, 450], [1, 1.04, 720, 450]],
    cursor: [[0, 560, 600], [0.18, 1248, 164, true], [0.48, 1248, 166], [0.6, 579, 412, true], [0.86, 579, 414], [1, 760, 640]],
  },
  evidence: {
    labels: ["Every figure links to its page"],
    shots: [{ src: "evidence/000.jpg", w: 0.4 }, { src: "evidence/001.jpg", w: 0.6 }],
    camera: [[0, 1, 720, 450], [0.28, 1.28, 820, 620], [0.42, 1, 720, 450], [0.62, 1.45, 1100, 600], [1, 1.5, 1100, 600]],
    cursor: [[0, 760, 640], [0.3, 816, 650, true], [0.45, 820, 652], [0.75, 1153, 623], [1, 1160, 628]],
  },
  object: {
    labels: ["Human-in-the-loop", "Step Functions waitForTaskToken"],
    fade: 4,
    shots: [
      { src: "object/000.jpg", w: 0.07 }, { src: "object/001.jpg", w: 0.07 }, ...range("object", 2, 7, 0.03),
      { src: "object/008.jpg", w: 0.07 }, { src: "object/009.jpg", w: 0.08 }, { src: "object/010.jpg", w: 0.1 },
      { src: "object/011.jpg", w: 0.05 }, ...range("object", 12, 25, 0.015), { src: "object/026.jpg", w: 0.06 }, { src: "object/027.jpg", w: 0.11 },
    ],
    camera: [[0, 1, 720, 450], [0.05, 1.22, 1000, 780], [0.08, 1, 720, 450], [0.12, 1.4, 720, 440], [0.32, 1.4, 780, 520], [0.38, 1, 720, 450], [0.48, 1, 720, 450], [0.52, 1.18, 560, 470], [0.56, 1.18, 560, 470], [0.6, 1.5, 1010, 540], [0.86, 1.5, 1010, 570], [0.91, 1.22, 760, 400], [1, 1.25, 760, 400]],
    cursor: [[0, 1160, 630], [0.055, 1171, 868, true], [0.1, 740, 470], [0.13, 720, 450, true], [0.3, 860, 600], [0.35, 867, 611, true], [0.55, 1050, 500], [0.6, 1062, 498, true], [0.85, 1062, 600], [0.88, 1062, 611, true], [0.95, 1006, 350], [1, 1006, 350]],
  },
};
