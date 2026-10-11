import { useEffect, useRef, useState } from "react";

export function useRoute() {
  const read = () => (window.location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => {
      setParts(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return parts;
}

export const go = (path) => {
  window.location.hash = path;
};

export function usePoll(fn, deps, { interval = 1500, until } = {}) {
  const [state, setState] = useState({ data: null, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    let timer;
    const tick = async () => {
      try {
        const data = await fnRef.current();
        if (!alive) return;
        setState({ data, error: null });
        if (until && until(data)) return;
      } catch (error) {
        if (!alive) return;
        setState((s) => ({ ...s, error }));
      }
      if (interval) timer = setTimeout(tick, interval);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function useCountUp(target, duration = 1400) {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (target == null) return;
    const start = performance.now();
    const origin = from.current;
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = origin + (target - origin) * eased;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export const fmt = (n, digits = 0) =>
  n == null ? "—" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const crore = (inr) => (inr ? `₹${fmt(inr / 1e7)} cr` : "—");

export const DECISION = {
  recommended: { label: "Recommended for clearance", tone: "ember" },
  tor_granted: { label: "Study approved (ToR)", tone: "amber" },
  deferred: { label: "Deferred", tone: "amber" },
  returned: { label: "Returned to company", tone: "sky" },
  rejected: { label: "Rejected", tone: "signal" },
  unclear: { label: "Status unclear", tone: "muted" },
};

export const SEVERITY = {
  critical: { label: "Critical", tone: "ember" },
  high: { label: "High", tone: "ember-soft" },
  medium: { label: "Medium", tone: "amber" },
  low: { label: "Low", tone: "muted" },
};

export const TONE = {
  ember: "text-ember border-ember/40 bg-ember/10",
  "ember-soft": "text-ember-soft border-ember-soft/30 bg-ember-soft/10",
  amber: "text-amber border-amber/30 bg-amber/10",
  sky: "text-sky border-sky/30 bg-sky/10",
  signal: "text-signal border-signal/30 bg-signal/10",
  muted: "text-muted border-line bg-ink-3",
};

export const LANG_NAMES = { en: "English", hi: "हिंदी", or: "ଓଡ଼ିଆ", ta: "தமிழ்", ml: "മലയാളം", kn: "ಕನ್ನಡ", te: "తెలుగు", mr: "मराठी", gu: "ગુજરાતી", bn: "বাংলা", pa: "ਪੰਜਾਬੀ", as: "অসমীয়া" };

export function highlightRange(text, quote) {
  // Map a quote back onto raw PDF text even when line breaks split words.
  const norm = [];
  const index = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i].toLowerCase();
    if (/[a-z0-9]/.test(c)) {
      norm.push(c);
      index.push(i);
    }
  }
  const q = quote.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (q.length < 6) return null;
  const at = norm.join("").indexOf(q);
  if (at < 0) return null;
  return [index[at], index[at + q.length - 1] + 1];
}
