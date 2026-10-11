import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { FileUp, ScanText, ShieldCheck, Languages, PenLine, ArrowRight } from "lucide-react";
import { api, uploadPdf } from "../api.js";
import { go, usePoll, fmt, crore } from "../lib.js";
import { Counter, DecisionBadge, Eyebrow, SeverityBadge } from "./ui.jsx";

function Stats() {
  const { data } = usePoll(() => api.stats(), [], { interval: 6000 });
  const s = data || {};
  const items = [
    ["Pages read", s.pagesRead, (v) => fmt(v)],
    ["Claims verified against source", s.claimsVerified, (v) => fmt(v)],
    ["AI claims rejected, never shown", s.claimsRejected, (v) => fmt(v)],
    ["Objections signed", s.objectionsSigned, (v) => fmt(v)],
    ["Climate damage contested / yr", s.damageContestedInr, (v) => (v ? `₹${fmt(v / 1e7)} cr` : "₹0")],
  ];
  return (
    <div className="grid grid-cols-2 border-y hairline sm:grid-cols-5">
      {items.map(([label, value, f], i) => (
        <div key={label} className={`px-5 py-6 ${i ? "sm:border-l hairline" : ""} ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
          <Counter value={value} format={f} className={`serif block text-4xl ${i === 2 ? "text-amber" : i === 4 ? "text-ember" : ""}`} />
          <p className="mt-1 text-xs text-muted">{label}</p>
        </div>
      ))}
    </div>
  );
}

function Upload({ focus }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef(null);
  const box = useRef(null);
  useEffect(() => {
    if (focus === "read") box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  const start = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) return setError("Please choose a PDF.");
    setBusy(true);
    setError("");
    try {
      go(`/doc/${await uploadPdf(file)}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div
      ref={box}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        start(e.dataTransfer.files[0]);
      }}
      className={`relative rounded-2xl border border-dashed p-8 transition ${drag ? "border-ember bg-ember/5" : "border-line bg-ink-2"} ${busy ? "scan" : ""}`}
    >
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl border hairline bg-ink-3 p-3">
            <FileUp className="h-6 w-6 text-ember" />
          </div>
          <div>
            <p className="text-lg font-medium">{busy ? "Uploading to S3 and dispatching agents…" : "Drop an environmental clearance PDF"}</p>
            <p className="mt-1 max-w-md text-sm text-muted">
              EIA reports or Expert Appraisal Committee minutes from{" "}
              <a className="underline decoration-line underline-offset-4 hover:text-paper" href="https://parivesh.nic.in" target="_blank" rel="noreferrer">
                PARIVESH
              </a>
              . Up to 400 pages. Read once, cached for everyone.
            </p>
          </div>
        </div>
        <button
          disabled={busy}
          onClick={() => input.current?.click()}
          className="shrink-0 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-ember-soft disabled:opacity-50"
        >
          Choose PDF
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-ember">{error}</p>}
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => start(e.target.files[0])} />
    </div>
  );
}

const STEPS = [
  [ScanText, "Read", "Step Functions fans out one Amazon Bedrock agent per project in the filing. A 246-page file is read in about a minute."],
  [ShieldCheck, "Verify", "Every number must come with a word-for-word quote and page. Code checks it against the PDF. Anything it can't find is thrown away."],
  [Languages, "Translate", "Plain-language headlines in English, Hindi and the state's language, with costs computed by code from published factors, never by the AI."],
  [PenLine, "Object", "A legal objection built from the record. Nothing is filed until a real person reads it and signs with an exact phrase; the letter is locked by SHA-256."],
];

function Feed() {
  const { data } = usePoll(async () => {
    const { documents } = await api.documents();
    const ready = documents.filter((d) => d.status === "ready").slice(0, 3);
    return Promise.all(ready.map((d) => api.document(d.docId)));
  }, [], { interval: 0 });
  if (!data?.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 pt-20">
      <div className="flex items-end justify-between">
        <div>
          <Eyebrow>On the record</Eyebrow>
          <h2 className="serif mt-2 text-4xl">What's being approved right now</h2>
        </div>
      </div>
      {data.map(({ document, projects }) => (
        <div key={document.docId} className="mt-8">
          <a href={`#/doc/${document.docId}`} className="mono text-xs text-muted hover:text-paper">
            {document.fileName} · {fmt(document.pages)} pages →
          </a>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <ProjectCard key={p.index} docId={document.docId} p={p} i={i} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function ProjectCard({ docId, p, i = 0 }) {
  return (
    <motion.a
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06 }}
      href={`#/doc/${docId}/p/${p.index}`}
      className="group flex flex-col justify-between rounded-2xl border hairline bg-ink-2 p-5 transition hover:border-muted/50 hover:bg-ink-3"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <DecisionBadge outcome={p.decision} />
          {p.topSeverity && ["critical", "high"].includes(p.topSeverity) && <SeverityBadge severity={p.topSeverity} />}
        </div>
        <h3 className="serif mt-4 text-[26px] leading-[1.1] text-paper">{p.headline}</h3>
      </div>
      <div className="mt-6 flex items-end justify-between gap-4 text-sm">
        <div className="text-muted">
          <p className="text-paper/90">{p.proponent}</p>
          <p>{[p.district, p.state].filter(Boolean).join(", ")}</p>
        </div>
        <div className="text-right">
          {p.climateCostInr ? (
            <>
              <p className="serif text-2xl text-ember">{crore(p.climateCostInr)}</p>
              <p className="text-[11px] text-dim">climate damage / yr</p>
            </>
          ) : (
            <ArrowRight className="h-5 w-5 text-dim transition group-hover:translate-x-1 group-hover:text-paper" />
          )}
        </div>
      </div>
    </motion.a>
  );
}

export default function Home({ focus }) {
  useEffect(() => {
    if (focus === "how") document.getElementById("how")?.scrollIntoView({ behavior: "smooth" });
  }, [focus]);
  return (
    <>
      <section className="mx-auto max-w-7xl px-5 pb-14 pt-16 sm:pt-24">
        <Eyebrow>India · environmental clearance, decoded</Eyebrow>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="serif mt-5 max-w-5xl text-[44px] leading-[1.02] sm:text-[76px]"
        >
          Every coal plant needs a clearance. The file is <span className="text-ember">246 pages</span> long.{" "}
          <span className="italic text-muted">The people who'll breathe it never read a word.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="mt-7 max-w-2xl text-lg leading-relaxed text-muted"
        >
          Vakeel reads it for them. AI agents read every page, check every number against the source, and tell the people
          next door what is about to be approved, in their own language. Then Vakeel helps them object, legally, before it is.
        </motion.p>
        <div className="mt-10">
          <Upload focus={focus} />
        </div>
      </section>
      <Stats />
      <Feed />
      <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-5 pt-24">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="serif mt-2 max-w-3xl text-4xl">An AI that is not allowed to make anything up.</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border hairline bg-line md:grid-cols-4">
          {STEPS.map(([Icon, title, body], i) => (
            <div key={title} className="bg-ink-2 p-6">
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-ember" />
                <span className="mono text-xs text-dim">0{i + 1}</span>
              </div>
              <h3 className="serif mt-8 text-3xl">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
