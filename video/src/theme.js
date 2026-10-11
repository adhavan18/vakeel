import { loadFont as loadDisplay } from "@remotion/google-fonts/InterTight";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadDeva } from "@remotion/google-fonts/NotoSansDevanagari";

// Display face: only the 600 weight is loaded, so every headline renders semibold.
loadDisplay("italic", { weights: ["600"], subsets: ["latin"] });
export const serif = loadDisplay("normal", { weights: ["600"], subsets: ["latin"] }).fontFamily;
export const sans = loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily;
export const deva = loadDeva("normal", { weights: ["400", "600"], subsets: ["devanagari"] }).fontFamily;

export const C = {
  ink: "#0b0b0c",
  ink2: "#121214",
  ink3: "#1a1a1d",
  line: "#2a2a2e",
  paper: "#ede9e1",
  muted: "#9a968e",
  dim: "#6b6862",
  ember: "#ff5a1f",
  amber: "#f5b83d",
  signal: "#3ddc97",
  sky: "#7cc4ff",
};
