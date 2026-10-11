import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, serif, mono, deva } from "./theme.js";

export const Thumbnail = () => (
  <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
    <div style={{ position: "absolute", right: -60, top: -40, width: 760, height: 900, transform: "rotate(4deg)", boxShadow: "0 40px 120px rgba(0,0,0,0.8)" }}>
      <Img src={staticFile("pages/hi_p018.jpg")} style={{ width: 760, position: "absolute", top: -110 }} />
      <div style={{ position: "absolute", left: 54, top: 380, width: 650, height: 38, background: "rgba(255,90,31,0.32)", borderBottom: `4px solid ${C.ember}` }} />
    </div>
    <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(11,11,12,1) 0%, rgba(11,11,12,0.97) 56%, rgba(11,11,12,0.25) 82%)" }} />
    <div style={{ position: "absolute", left: 64, top: 70, width: 760 }}>
      <div style={{ fontFamily: mono, fontSize: 26, letterSpacing: "0.2em", color: C.ember }}>PAGE 18 OF 246</div>
      <div style={{ fontFamily: serif, fontSize: 104, lineHeight: 0.98, color: C.paper, marginTop: 22 }}>
        This coal plant <span style={{ fontStyle: "italic", color: C.ember }}>skipped</span> its public hearing.
      </div>
      <div style={{ fontFamily: serif, fontSize: 56, lineHeight: 1.05, color: C.muted, marginTop: 26 }}>Nobody could read the file. So I built an AI that does.</div>
    </div>
    <div style={{ position: "absolute", left: 64, bottom: 48, display: "flex", alignItems: "baseline", gap: 16 }}>
      <div style={{ fontFamily: serif, fontSize: 64, color: C.paper }}>Vakeel</div>
      <div style={{ fontFamily: deva, fontSize: 36, color: C.ember }}>वकील</div>
      <div style={{ fontFamily: mono, fontSize: 20, color: C.dim, marginLeft: 14 }}>Built on AWS · Amazon Bedrock</div>
    </div>
  </AbsoluteFill>
);
