import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Check, Mail, Printer } from "lucide-react";
import { api } from "../api.js";
import { usePoll } from "../lib.js";
import { Eyebrow } from "./ui.jsx";

const FINAL = ["signed", "expired"];

function Steps({ status }) {
  const steps = [
    ["Drafted from the record", ["drafting"].includes(status) ? "active" : "done"],
    ["You read and sign", status === "awaiting_signature" ? "active" : ["signing", "signed"].includes(status) ? "done" : "todo"],
    ["Locked and ready to file", status === "signed" ? "done" : status === "signing" ? "active" : "todo"],
  ];
  return (
    <ol className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
      {steps.map(([label, s], i) => (
        <li key={label} className={`flex items-center gap-2 ${s === "todo" ? "text-dim" : s === "active" ? "text-paper" : "text-signal"}`}>
          <span className={`mono flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${s === "done" ? "border-signal/40 bg-signal/10" : s === "active" ? "border-ember text-ember" : "border-line"}`}>
            {s === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function Letter({ text, drafting }) {
  if (drafting) {
    return (
      <div className="paper-letter scan min-h-[520px] rounded-sm p-10">
        <p className="text-sm text-[#6b6257]">Drafting from the verified record…</p>
        {[80, 95, 70, 88, 60, 92, 76].map((w, i) => (
          <div key={i} className="mt-4 h-3 rounded bg-[#e2dccf]" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="paper-letter whitespace-pre-wrap rounded-sm p-8 text-[15px] leading-relaxed sm:p-12">
      {text}
    </motion.div>
  );
}

export default function ObjectionPage({ objectionId }) {
  const { data: o, error } = usePoll(() => api.objection(objectionId), [objectionId], {
    interval: 1200,
    until: (d) => FINAL.includes(d.status),
  });
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [signError, setSignError] = useState("");

  if (error && !o) return <p className="mx-auto max-w-7xl px-5 py-24 text-ember">{error.message}</p>;
  if (!o) return <p className="mx-auto max-w-7xl px-5 py-24 text-muted">Loading…</p>;

  const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9/ ]/g, " ").split(/\s+/).filter(Boolean).join(" ");
  const matches = o.phrase && norm(phrase) === norm(o.phrase);
  const sign = async () => {
    setBusy(true);
    setSignError("");
    try {
      await api.sign(objectionId, { phrase, letterHash: o.letterHash });
    } catch (e) {
      setSignError(e.message);
    }
    setBusy(false);
  };
  const mailto = o.letter
    ? `mailto:?subject=${encodeURIComponent(o.subject || "Objection")}&body=${encodeURIComponent(o.letter + (o.receipt ? `\n\nVakeel verification: ${o.receipt}` : ""))}`
    : "#";

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24 pt-10">
      <a href={`#/doc/${o.docId}/p/${o.projectIndex}`} className="no-print text-sm text-muted hover:text-paper">← Back to the project</a>
      <div className="no-print mt-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Objection by {o.citizenName}</Eyebrow>
          <h1 className="serif mt-2 text-5xl">{o.status === "signed" ? "Signed. Your voice is on the record." : "Read it. Then decide."}</h1>
        </div>
        <Steps status={o.status} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <Letter text={o.letter} drafting={o.status === "drafting"} />

        <aside className="no-print space-y-5 lg:sticky lg:top-24 lg:self-start">
          <AnimatePresence mode="wait">
            {o.status === "awaiting_signature" && (
              <motion.div key="sign" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border hairline bg-ink-2 p-6">
                <div className="flex items-center gap-2 text-ember">
                  <Lock className="h-4 w-4" />
                  <Eyebrow className="text-ember">Human signature required</Eyebrow>
                </div>
                <p className="mt-3 text-sm text-muted">
                  Vakeel never files anything on its own. To sign, type this sentence exactly:
                </p>
                <p className="serif mt-3 rounded-lg border border-dashed border-ember/40 bg-ember/5 px-4 py-3 text-xl">{o.phrase}</p>
                <input
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder="Type the sentence above"
                  className={`mt-4 w-full rounded-lg border bg-ink px-4 py-3 outline-none ${matches ? "border-signal" : "hairline focus:border-ember"}`}
                />
                <p className="mono mt-4 break-all text-[10px] text-dim">
                  You are signing letter sha256:{o.letterHash}
                </p>
                {signError && <p className="mt-3 text-sm text-ember">{signError}</p>}
                <button
                  disabled={!matches || busy}
                  onClick={sign}
                  className="mt-5 w-full rounded-full bg-ember py-3 text-sm font-semibold text-ink transition hover:bg-ember-soft disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {busy ? "Signing…" : "Sign this objection"}
                </button>
              </motion.div>
            )}
            {(o.status === "drafting" || o.status === "drafted") && (
              <motion.div key="drafting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border hairline bg-ink-2 p-6 text-sm text-muted">
                Bedrock is writing the opening and requests. The grounds, quotes and page numbers are assembled by code from verified facts only.
              </motion.div>
            )}
            {o.status === "signing" && (
              <motion.div key="signing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="scan rounded-2xl border hairline bg-ink-2 p-6 text-sm text-muted">
                Step Functions received your signature. Locking the letter…
              </motion.div>
            )}
            {o.status === "signed" && (
              <motion.div key="signed" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-signal/30 bg-signal/[0.05] p-6">
                <div className="flex items-center gap-2 text-signal">
                  <Check className="h-5 w-5" />
                  <Eyebrow className="text-signal">Signed {new Date(o.signedAt).toLocaleString("en-IN")}</Eyebrow>
                </div>
                <p className="mt-3 text-sm text-paper/90">
                  The letter is locked. Send it from your own email so it carries your identity, or print and post it to the committee.
                </p>
                <p className="mono mt-4 break-all text-[10px] text-dim">Verification receipt {o.receipt}</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <a href={mailto} className="flex items-center justify-center gap-2 rounded-full bg-paper py-2.5 text-sm font-medium text-ink hover:bg-white">
                    <Mail className="h-4 w-4" /> Email it
                  </a>
                  <button onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-full border hairline py-2.5 text-sm hover:bg-ink-3">
                    <Printer className="h-4 w-4" /> Print / PDF
                  </button>
                </div>
              </motion.div>
            )}
            {o.status === "expired" && (
              <div className="rounded-2xl border hairline bg-ink-2 p-6 text-sm text-muted">This draft expired without a signature. Nothing was filed.</div>
            )}
          </AnimatePresence>
          <p className="text-xs leading-relaxed text-dim">
            The grounds quote the committee's own record with page numbers. Any climate-cost figure is Vakeel's estimate from published factors and is labelled as such in the letter.
          </p>
        </aside>
      </div>
    </div>
  );
}
