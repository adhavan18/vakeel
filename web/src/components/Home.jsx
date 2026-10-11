import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { FileUp, ScanText, ShieldCheck, Languages, PenLine, ChevronRight } from "lucide-react";
import { api, uploadPdf } from "../api.js";
import { go, usePoll, fmt, crore } from "../lib.js";
import { Counter, DecisionBadge, Eyebrow, SeverityBadge } from "./ui.jsx";

const spring = { type: "spring", bounce: 0, duration: 0.6 };

function useFeed() {
  return usePoll(async () => {
    const { documents } = await api.documents();
    const ready = documents.filter((d) => d.status === "ready").slice(0, 3);
    return Promise.all(ready.map((d) => api.document(d.docId)));
  }, [], { interval: 0 });
}

function EvidenceStack({ href }) {
  return (
    <div className="relative mx-auto w-full max-w-[520px] pt-4">
      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -3 }}
        animate={{ opacity: 1, y: 0, rotate: -2.5 }}
        transition={{ ...spring, delay: 0.1 }}
        className="paper-letter rounded-2xl p-7"
      >
        <div className="flex items-center justify-between text-[12px] font-sans text-[#6e6e73]">
          <span>Expert Appraisal Committee (Thermal) minutes</span>
          <span>Page 18 of 246</span>
        </div>
        <p className="mt-5 text-[17px] leading-[1.6]">
          <b>26.1.15: Public Consultation:</b> Public hearing for the 2x660 MW (Phase - II){" "}
          <mark className="vk">is exempted</mark> as per S.O. 1247(E) dated 18.03.3021. However, the budget allocated for CER
          activities to address the public needs…
        </p>
      </motion.div>
      <motion.a
        href={href}
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0, rotate: 1.5 }}
        transition={{ ...spring, delay: 0.35 }}
        className="surface press relative -mt-6 ml-6 mr-[-8px] block rounded-2xl p-6 sm:ml-14"
      >
        <div className="flex items-center justify-between gap-3">
          <DecisionBadge outcome="recommended" />
          <span className="text-[12px] font-medium text-muted">Read by Vakeel in under a minute</span>
        </div>
        <p className="mt-3 text-[21px] font-semibold leading-snug tracking-tight">
          A 1,320 MW coal expansion, 2.2 km from a reserved forest, skipped its public hearing.
        </p>
        <p className="mt-2 text-[15px] text-muted" lang="hi">
          आरक्षित वन से 2.2 किमी दूर, 1,320 मेगावाट कोयला विस्तार की जन सुनवाई नहीं हुई।
        </p>
        <div className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-signal">
          <span className="rounded-full bg-signal/10 px-2 py-0.5">✓ Page 18</span>
          <span className="rounded-full bg-signal/10 px-2 py-0.5">✓ Page 13</span>
          <span className="rounded-full bg-signal/10 px-2 py-0.5">✓ Page 25</span>
          <span className="ml-auto inline-flex items-center text-action">
            Open <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </motion.a>
    </div>
  );
}

function Stats() {
  const { data } = usePoll(() => api.stats(), [], { interval: 6000 });
  const s = data || {};
  const items = [
    ["Pages read", s.pagesRead, (v) => fmt(v), ""],
    ["Claims verified against the source", s.claimsVerified, (v) => fmt(v), "text-signal"],
    ["AI claims rejected, never shown", s.claimsRejected, (v) => fmt(v), "text-amber"],
    ["Objections signed", s.objectionsSigned, (v) => fmt(v), ""],
    ["Climate damage contested, per year", s.damageContestedInr, (v) => (v ? `₹${fmt(v / 1e7)} cr` : "₹0"), "text-ember"],
  ];
  return (
    <section className="mx-auto max-w-6xl px-5">
      <div className="surface grid grid-cols-2 rounded-3xl sm:grid-cols-5">
        {items.map(([label, value, f, tone], i) => (
          <div key={label} className={`px-6 py-6 ${i ? "sm:border-l sm:border-line" : ""} ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
            <Counter value={value} format={f} className={`block text-[34px] font-semibold tracking-tight ${tone}`} />
            <p className="mt-1 text-[13px] leading-snug text-muted">{label}</p>
          </div>
        ))}
      </div>
    </section>
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
      className={`relative rounded-3xl border-2 border-dashed p-7 transition-colors ${drag ? "border-action bg-action/5" : "border-line bg-white"} ${busy ? "scan" : ""}`}
    >
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-action/10">
            <FileUp className="h-6 w-6 text-action" />
          </div>
          <div>
            <p className="text-[19px] font-semibold tracking-tight">{busy ? "Uploading and dispatching agents…" : "Drop a clearance filing here"}</p>
            <p className="mt-0.5 text-[15px] text-muted">
              EIA reports or committee minutes from{" "}
              <a className="text-action hover:underline" href="https://parivesh.nic.in" target="_blank" rel="noreferrer">
                PARIVESH
              </a>
              , up to 400 pages.
            </p>
          </div>
        </div>
        <button
          disabled={busy}
          onClick={() => input.current?.click()}
          className="press shrink-0 rounded-full bg-action px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#0077ed] disabled:opacity-50"
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
  [ScanText, "Read", "One Amazon Bedrock agent per project, all in parallel through AWS Step Functions. A 246-page filing takes under a minute."],
  [ShieldCheck, "Verify", "Every number needs a word-for-word quote and a page. Code checks it against the PDF and throws away anything it can't find."],
  [Languages, "Translate", "Plain words in English, Hindi and the state's language. Costs are computed by code from published factors, never by the AI."],
  [PenLine, "Object", "A formal objection built from the committee's own record. Nothing is filed until you read it and sign it yourself."],
];

function Feed({ data }) {
  const [q, setQ] = useState("");
  if (!data?.length) return null;
  const query = q.trim().toLowerCase();
  const match = (p) =>
    !query || [p.district, p.state, p.proponent, p.headline].filter(Boolean).some((v) => v.toLowerCase().includes(query));
  const groups = data.map((d) => ({ ...d, projects: d.projects.filter(match) })).filter((d) => d.projects.length);
  return (
    <section id="filings" className="mx-auto max-w-6xl scroll-mt-16 px-5 pt-24">
      <Eyebrow>On the record</Eyebrow>
      <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-[40px] font-semibold leading-tight tracking-[-0.03em]">What's being approved near you.</h2>
        <label className="relative w-full sm:w-80">
          <span className="sr-only">Search your district, state or company</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your district, e.g. Korba"
            className="w-full rounded-full border border-line bg-white px-5 py-3 text-[15px] outline-none transition focus:border-action focus:ring-4 focus:ring-action/15"
          />
        </label>
      </div>
      {groups.length === 0 && (
        <div className="surface mt-8 rounded-3xl p-8 text-center">
          <p className="text-[19px] font-semibold">Nothing read for “{q}” yet.</p>
          <p className="mt-1 text-muted">Find the filing for your area on PARIVESH and drop it in below. Vakeel will read it in under a minute.</p>
        </div>
      )}
      {groups.map(({ document, projects }) => (
        <div key={document.docId} className="mt-10">
          <a href={`#/doc/${document.docId}`} className="inline-flex items-center text-[15px] font-medium text-action hover:underline">
            {document.fileName.replace(/\.pdf$/i, "")} · {fmt(document.pages)} pages <ChevronRight className="h-4 w-4" />
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: i * 0.05 }}
      whileHover={{ y: -3 }}
      href={`#/doc/${docId}/p/${p.index}`}
      className="surface group flex flex-col justify-between rounded-3xl p-6"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <DecisionBadge outcome={p.decision} />
          {p.topSeverity && ["critical", "high"].includes(p.topSeverity) && <SeverityBadge severity={p.topSeverity} />}
        </div>
        <h3 className="mt-4 text-[21px] font-semibold leading-snug tracking-tight text-paper">{p.headline}</h3>
      </div>
      <div className="mt-6 flex items-end justify-between gap-4 text-[14px]">
        <div className="text-muted">
          <p className="font-medium text-paper">{p.proponent}</p>
          <p>{[p.district, p.state].filter(Boolean).join(", ")}</p>
        </div>
        <div className="text-right">
          {p.climateCostInr ? (
            <>
              <p className="text-[19px] font-semibold text-ember">{crore(p.climateCostInr)}</p>
              <p className="text-[11px] text-dim">climate damage / yr</p>
            </>
          ) : (
            <ChevronRight className="h-5 w-5 text-dim transition group-hover:translate-x-0.5 group-hover:text-action" />
          )}
        </div>
      </div>
    </motion.a>
  );
}

export default function Home({ focus }) {
  const { data } = useFeed();
  useEffect(() => {
    if (focus === "how" || (focus === "filings" && data)) setTimeout(() => document.getElementById(focus)?.scrollIntoView({ behavior: "smooth" }), 150);
  }, [focus, data]);
  const lead = data?.find((d) => /26th/.test(d.document.fileName)) || data?.[0];
  const leadHref = lead ? `#/doc/${lead.document.docId}/p/${lead.projects[0]?.index ?? 1}` : "#/filings";

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[15px] font-semibold text-ember-soft">
            For people living next to coal plants, mines and dams
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring}
            className="mt-3 text-[46px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[68px]"
          >
            Read the fine print before it's approved.
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-3 text-[22px] text-muted" lang="hi">
            मंज़ूरी से पहले, पूरी फ़ाइल पढ़िए।
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-6 max-w-xl text-[19px] leading-relaxed text-muted"
          >
            Every coal plant, mine and dam in India needs an environmental clearance, and the file runs to hundreds of pages.
            Vakeel reads it, proves every number against the page, and helps you object while it still counts.
          </motion.p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <button onClick={() => go("/filings")} className="press rounded-full bg-action px-6 py-3 text-[17px] font-medium text-white hover:bg-[#0077ed]">
              See what's being approved
            </button>
            <button onClick={() => go("/read")} className="inline-flex items-center text-[17px] text-action hover:underline">
              Read a new filing <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        <EvidenceStack href={leadHref} />
      </section>

      <Stats />

      <section className="mx-auto max-w-6xl px-5 pt-10">
        <Upload focus={focus} />
      </section>

      <Feed data={data} />

      <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-5 pt-24">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-1 max-w-3xl text-[40px] font-semibold leading-tight tracking-[-0.03em]">An AI that isn't allowed to make anything up.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {STEPS.map(([Icon, title, body]) => (
            <div key={title} className="surface rounded-3xl p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-action/10">
                <Icon className="h-5 w-5 text-action" />
              </div>
              <h3 className="mt-6 text-[22px] font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
