import { AbsoluteFill, Img, Html5Video, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import clips from "../public/clips/manifest.json";
import { C, serif, sans, mono, deva } from "./theme.js";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
const ease = Easing.bezier(0.22, 1, 0.36, 1);

export function Grain() {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: 0.05,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      }}
    />
  );
}

function Eyebrow({ children, style }) {
  return <div style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.22em", textTransform: "uppercase", color: C.muted, ...style }}>{children}</div>;
}

function Typewriter({ text, start = 0, cps = 28, style }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(0, Math.floor(((f - start) / fps) * cps));
  return (
    <span style={style}>
      {text.slice(0, n)}
      {n < text.length && <span style={{ color: C.ember }}>▍</span>}
    </span>
  );
}

function Words({ text, start = 0, every = 3, style, highlight = [] }) {
  const f = useCurrentFrame();
  return (
    <span style={style}>
      {text.split(" ").map((w, i) => {
        const o = interpolate(f, [start + i * every, start + i * every + 10], [0, 1], clamp);
        const y = interpolate(f, [start + i * every, start + i * every + 14], [18, 0], { ...clamp, easing: ease });
        return (
          <span key={i} style={{ display: "inline-block", opacity: o, transform: `translateY(${y}px)`, marginRight: "0.25em", color: highlight.includes(i) ? C.ember : undefined }}>
            {w}
          </span>
        );
      })}
    </span>
  );
}

// ---------- 1. Cold open ----------
export function ColdOpen() {
  return (
    <AbsoluteFill style={{ background: C.ink, padding: "0 180px", justifyContent: "center" }}>
      <Typewriter text="20 JUNE 2025 · NARMADA HALL, NEW DELHI" start={6} style={{ fontFamily: mono, fontSize: 28, letterSpacing: "0.18em", color: C.muted }} />
      <div style={{ fontFamily: serif, fontSize: 92, lineHeight: 1.05, color: C.paper, marginTop: 40, maxWidth: 1500 }}>
        <Words text="A government committee met to decide the future of six coal power plants." start={40} every={4} highlight={[10, 11, 12, 13]} />
      </div>
    </AbsoluteFill>
  );
}

// ---------- 2. Wall of pages ----------
export function PageWall({ scene }) {
  const f = useCurrentFrame();
  const cols = 12;
  const pages = Array.from({ length: 60 }, (_, i) => `pages/p${String(i + 1).padStart(3, "0")}.jpg`);
  const scale = interpolate(f, [0, scene.frames * 0.75], [3.4, 0.92], { ...clamp, easing: ease });
  const count = Math.round(interpolate(f, [10, scene.frames * 0.6], [1, 246], clamp));
  const chars = Math.round(interpolate(f, [10, scene.frames * 0.6], [0, 621869], clamp));
  const tagO = interpolate(f, [scene.frames * 0.62, scene.frames * 0.72], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 150px)`, gap: 14, transform: `scale(${scale})`, transformOrigin: "center", filter: "grayscale(0.35) brightness(0.8)" }}>
          {pages.map((p, i) => (
            <Img key={p} src={staticFile(p)} style={{ width: 150, height: 212, objectFit: "cover", borderRadius: 3, opacity: interpolate(f, [i * 0.4, i * 0.4 + 8], [0, 1], clamp) }} />
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(11,11,12,0.15) 0%, rgba(11,11,12,0.92) 75%)" }} />
      <AbsoluteFill style={{ padding: 110, justifyContent: "flex-end" }}>
        <div style={{ display: "flex", gap: 90, alignItems: "flex-end" }}>
          <div>
            <div style={{ fontFamily: serif, fontSize: 200, lineHeight: 0.85, color: C.ember }}>{count}</div>
            <Eyebrow style={{ marginTop: 18 }}>pages</Eyebrow>
          </div>
          <div>
            <div style={{ fontFamily: serif, fontSize: 120, lineHeight: 0.9, color: C.paper }}>{chars.toLocaleString("en-IN")}</div>
            <Eyebrow style={{ marginTop: 18 }}>characters</Eyebrow>
          </div>
          <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 64, color: C.muted, opacity: tagO, marginLeft: "auto" }}>Public. Unreadable.</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- 3. The buried line ----------
const PAGE_W = 1309;
const PAGE_H = 1853;

export function ZoomPage({ src, region, marks, f, start, end, label }) {
  const { width: W, height: H } = useVideoConfig();
  const vertical = H > W;
  const t = interpolate(f, [start + 10, start + 55], [0, 1], { ...clamp, easing: ease });
  const fit = vertical ? (W * 0.94) / PAGE_W : 960 / PAGE_H;
  const [x0, y0, x1, y1] = region;
  const zoom = (vertical ? W * 0.98 : 1700) / (x1 - x0);
  const s = fit + (zoom - fit) * t;
  const cx = PAGE_W / 2 + ((x0 + x1) / 2 - PAGE_W / 2) * t;
  const cy = PAGE_H / 2 + ((y0 + y1) / 2 - PAGE_H / 2) * t;
  const o = interpolate(f, [start, start + 8, end - 8, end], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: o, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${W / 2 - cx * s}px, ${H / 2 - cy * s}px) scale(${s})` }}>
        <Img src={staticFile(src)} style={{ width: PAGE_W, height: PAGE_H, display: "block", boxShadow: "0 40px 120px rgba(0,0,0,0.6)" }} />
        {marks.map((m, i) => {
          const w = interpolate(f, [start + 60 + i * 10, start + 80 + i * 10], [0, 1], { ...clamp, easing: ease });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: m[0],
                top: m[1],
                width: (m[2] - m[0]) * w,
                height: m[3] - m[1],
                background: m[4] ? "rgba(255,90,31,0.0)" : "rgba(255,90,31,0.28)",
                borderBottom: `4px solid ${C.ember}`,
                outline: m[4] ? `4px solid ${C.ember}` : "none",
                borderRadius: 2,
                mixBlendMode: "multiply",
              }}
            />
          );
        })}
      </div>
      <div style={{ position: "absolute", right: 70, top: 60, fontFamily: mono, fontSize: 26, color: C.paper, background: "rgba(11,11,12,0.85)", padding: "10px 18px", borderRadius: 8 }}>
        {label}
      </div>
    </AbsoluteFill>
  );
}

export function Buried({ scene }) {
  const f = useCurrentFrame();
  const n = scene.frames;
  const a = Math.round(n * 0.46);
  const b = Math.round(n * 0.8);
  const endO = interpolate(f, [b, b + 12], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#151517" }}>
      <ZoomPage
        f={f}
        start={0}
        end={a}
        src="pages/hi_p018.jpg"
        region={[90, 830, 1220, 940]}
        marks={[[97, 848, 1212, 880], [97, 878, 415, 910]]}
        label="PAGE 18 OF 246"
      />
      <ZoomPage
        f={f}
        start={a - 4}
        end={b + 4}
        src="pages/hi_p025.jpg"
        region={[90, 1215, 1220, 1300]}
        marks={[[97, 1230, 1212, 1260], [1010, 1228, 1172, 1262, true]]}
        label="PAGE 25 OF 246"
      />
      <AbsoluteFill style={{ background: C.ink, opacity: endO, justifyContent: "center", padding: "0 180px" }}>
        <div style={{ fontFamily: serif, fontSize: 120, lineHeight: 1.0, color: C.paper }}>
          <Words text="Nobody objected." start={b + 8} every={5} />
        </div>
        <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 120, lineHeight: 1.0, color: C.ember, marginTop: 10 }}>
          <Words text="Nobody could read it." start={b + 26} every={5} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- 4. Title ----------
export function Title() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 40, transform: `scale(${0.92 + 0.08 * s})`, opacity: s }}>
        <div style={{ fontFamily: serif, fontSize: 260, color: C.paper, letterSpacing: "-0.02em" }}>Vakeel</div>
        <div style={{ fontFamily: deva, fontSize: 120, color: C.ember }}>वकील</div>
      </div>
      <div style={{ fontFamily: sans, fontSize: 36, color: C.muted, marginTop: 10, opacity: interpolate(f, [24, 40], [0, 1], clamp) }}>
        An AI advocate for the people next door.
      </div>
    </AbsoluteFill>
  );
}

// ---------- 5-8. Product footage ----------
const CLIP_LABELS = {
  agents: ["Step Functions · Map state", "1 Amazon Bedrock agent per project"],
  verify: ["Verifier · deterministic code", "No quote on the page, no claim"],
  project: ["Plain language · Hindi · Odia", "Every figure links to its page"],
  object: ["Human-in-the-loop", "Step Functions waitForTaskToken"],
};

export function Clip({ scene }) {
  const f = useCurrentFrame();
  const meta = clips[scene.clip];
  const sceneSec = scene.frames / 30;
  const rate = meta ? Math.min(6, Math.max(0.6, meta.seconds / (sceneSec - 0.3))) : 1;
  const zoom = interpolate(f, [0, scene.frames], [1.0, 1.045]);
  const [l1, l2] = CLIP_LABELS[scene.clip] || ["", ""];
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 120%, rgba(255,90,31,0.22), ${C.ink} 60%)` }}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: 1600, height: 900 + 40, borderRadius: 18, overflow: "hidden", border: `1px solid ${C.line}`, boxShadow: "0 50px 140px rgba(0,0,0,0.75)", transform: `scale(${zoom})`, background: C.ink2 }}>
          <div style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", background: "#161618", borderBottom: `1px solid ${C.line}` }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <div key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.8 }} />
            ))}
            <div style={{ marginLeft: 16, fontFamily: mono, fontSize: 15, color: C.dim }}>{meta?.url || "vakeel"}</div>
          </div>
          {meta ? (
            <Html5Video src={staticFile(`clips/${scene.clip}.webm`)} playbackRate={rate} muted style={{ width: 1600, height: 900, objectFit: "cover" }} />
          ) : (
            <div style={{ width: 1600, height: 900, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, color: C.dim, fontSize: 28 }}>[{scene.clip} footage]</div>
          )}
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 70, top: 46, display: "flex", gap: 12, opacity: interpolate(f, [6, 18], [0, 1], clamp) }}>
        <div style={{ fontFamily: mono, fontSize: 20, color: C.ink, background: C.ember, padding: "6px 14px", borderRadius: 999 }}>{l1}</div>
        <div style={{ fontFamily: mono, fontSize: 20, color: C.paper, background: "rgba(26,26,29,0.9)", border: `1px solid ${C.line}`, padding: "6px 14px", borderRadius: 999 }}>{l2}</div>
      </div>
    </AbsoluteFill>
  );
}

// ---------- 9. Architecture ----------
function Node({ x, y, w = 250, title, sub, at, tone = C.line, f }) {
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 18, stiffness: 140 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, transform: `translateY(${(1 - s) * 20}px)`, opacity: s }}>
      <div style={{ border: `1px solid ${tone}`, background: C.ink2, borderRadius: 14, padding: "16px 18px" }}>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 24, color: C.paper }}>{title}</div>
        {sub && <div style={{ fontFamily: mono, fontSize: 15, color: C.muted, marginTop: 6 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Arrow({ x1, y1, x2, y2, at, f, color = C.dim }) {
  const p = interpolate(f, [at, at + 12], [0, 1], clamp);
  return <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p} stroke={color} strokeWidth={2.5} strokeDasharray="6 6" />;
}

export function Architecture({ scene }) {
  const f = useCurrentFrame();
  const k = scene.frames / 450;
  const at = (n) => Math.round(n * k);
  const row1 = 300;
  const row2 = 580;
  const nodes = [
    [70, row1, "Filing (PDF)", "PARIVESH", 0, C.line],
    [370, row1, "Amazon S3", "presigned upload", 20, C.line],
    [670, row1, "Step Functions", "Map · 1 agent / project", 40, C.ember],
    [970, row1, "Amazon Bedrock", "Nova 2 Lite · tool-forced JSON", 60, C.ember],
    [1270, row1, "Verifier", "quote must be on the page", 80, C.signal],
    [1570, row1, "DynamoDB", "projects · logs · budget", 100, C.line],
    [370, row2, "CloudFront + S3", "web app", 130, C.line],
    [670, row2, "API Gateway + Lambda", "throttled HTTP API", 145, C.line],
    [970, row2, "Step Functions", "waitForTaskToken", 160, C.ember],
    [1270, row2, "Human signature", "exact phrase + SHA-256", 175, C.signal],
  ];
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <div style={{ position: "absolute", left: 70, top: 70 }}>
        <Eyebrow>Built on AWS</Eyebrow>
        <div style={{ fontFamily: serif, fontSize: 76, color: C.paper, marginTop: 10 }}>An AI that is not allowed to make anything up.</div>
      </div>
      <Eyebrow style={{ position: "absolute", left: 70, top: row1 - 46 }}>Read & verify</Eyebrow>
      <Eyebrow style={{ position: "absolute", left: 370, top: row2 - 46 }}>Act, only with a human</Eyebrow>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {[370, 670, 970, 1270, 1570].map((x, i) => (
          <Arrow key={x} f={f} at={at(10 + i * 20)} x1={x - 50} y1={row1 + 45} x2={x - 2} y2={row1 + 45} />
        ))}
        {[670, 970, 1270].map((x, i) => (
          <Arrow key={x} f={f} at={at(140 + i * 15)} x1={x - 50} y1={row2 + 45} x2={x - 2} y2={row2 + 45} />
        ))}
      </svg>
      {nodes.map(([x, y, t, s, a, tone]) => (
        <Node key={t + x} f={f} x={x} y={y} title={t} sub={s} at={at(a)} tone={tone} />
      ))}
      <div style={{ position: "absolute", left: 70, bottom: 200, display: "flex", gap: 14, opacity: interpolate(f, [at(200), at(220)], [0, 1], clamp) }}>
        {["Daily Bedrock budget cap", "Every filing read once, cached", "Money math in code, not the model", "Zero servers to run"].map((t) => (
          <div key={t} style={{ fontFamily: mono, fontSize: 19, color: C.paper, border: `1px solid ${C.line}`, background: C.ink2, padding: "8px 16px", borderRadius: 999 }}>
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

// ---------- 10. Close ----------
export function Close({ scene }) {
  const n = scene.frames;
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: "center", padding: "0 180px" }}>
      <div style={{ fontFamily: serif, fontSize: 96, lineHeight: 1.05, color: C.paper, maxWidth: 1550 }}>
        <Words text="Every coal plant, mine and dam needs a clearance." start={6} every={4} />
      </div>
      <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 96, lineHeight: 1.05, color: C.ember, marginTop: 24, maxWidth: 1550 }}>
        <Words text="Now the people next door can read it first." start={Math.round(n * 0.45)} every={4} />
      </div>
    </AbsoluteFill>
  );
}

export function End() {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 12], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: "center", alignItems: "center", opacity: o }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 26 }}>
        <div style={{ fontFamily: serif, fontSize: 150, color: C.paper }}>Vakeel</div>
        <div style={{ fontFamily: deva, fontSize: 70, color: C.ember }}>वकील</div>
      </div>
      <div style={{ fontFamily: sans, fontSize: 32, color: C.muted, marginTop: 6 }}>Read the filing before it's approved.</div>
      <div style={{ fontFamily: mono, fontSize: 22, color: C.dim, marginTop: 50 }}>{clips.webUrl || ""}</div>
      <div style={{ fontFamily: mono, fontSize: 18, color: C.dim, marginTop: 14 }}>Built on AWS · Environmental Hacks 2026 · Air track</div>
    </AbsoluteFill>
  );
}
