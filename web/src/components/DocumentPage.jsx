import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../api.js";
import { go, usePoll, fmt, DECISION } from "../lib.js";
import { Eyebrow } from "./ui.jsx";
import { ProjectCard } from "./Home.jsx";
import MapView from "./MapView.jsx";

const DONE = ["ready", "failed", "duplicate"];

function parseLanes(logs) {
  const lanes = {};
  for (const l of logs) {
    const m = l.message.match(/^Agent (\d+)(?::| is reading:)\s*(.*)$/);
    if (!m) continue;
    const n = +m[1];
    const lane = (lanes[n] ||= { n, title: "", state: "reading", last: "", verified: "" });
    if (l.message.includes(" is reading: ")) lane.title = m[2];
    else if (m[2].startsWith("Verified")) {
      lane.state = "verified";
      lane.verified = m[2];
    } else if (m[2].startsWith("Done")) {
      lane.state = "done";
      lane.last = m[2].replace(/^Done\. Headline:\s*/, "");
    } else if (m[2].startsWith("stopped")) lane.state = "error";
  }
  return Object.values(lanes).sort((a, b) => a.n - b.n);
}

function elapsed(logs) {
  if (logs.length < 2) return 0;
  return (new Date(logs[logs.length - 1].at) - new Date(logs[0].at)) / 1000;
}

function AgentConsole({ logs, status }) {
  const lanes = parseLanes(logs);
  const feed = useRef(null);
  useEffect(() => {
    feed.current?.scrollTo({ top: feed.current.scrollHeight, behavior: "smooth" });
  }, [logs.length]);
  const t0 = logs[0] ? new Date(logs[0].at) : null;
  const live = !DONE.includes(status);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      <div className="rounded-2xl border hairline bg-ink-2 p-5">
        <div className="flex items-center justify-between">
          <Eyebrow>Parallel Bedrock agents</Eyebrow>
          <span className="mono text-xs text-muted">Step Functions · Map state</span>
        </div>
        <div className="mt-4 space-y-3">
          {lanes.length === 0 && (
            <div className="scan rounded-xl border hairline bg-ink-3 p-4 text-sm text-muted">Extracting text and finding the projects inside this filing…</div>
          )}
          <AnimatePresence>
            {lanes.map((lane) => (
              <motion.div
                key={lane.n}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`rounded-xl border p-4 ${lane.state === "done" ? "border-signal/25 bg-signal/[0.04]" : "hairline bg-ink-3"} ${lane.state === "reading" ? "scan" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="mono text-xs text-muted">AGENT {String(lane.n).padStart(2, "0")}</span>
                  <span className={`mono text-[11px] ${lane.state === "done" ? "text-signal" : lane.state === "error" ? "text-ember" : "text-amber"}`}>
                    {lane.state === "reading" ? "reading…" : lane.state === "verified" ? "verifying & writing…" : lane.state === "done" ? "done" : "stopped"}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-1 text-sm text-paper/90">{lane.title}</p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
                  <motion.div
                    className={`h-full ${lane.state === "done" ? "bg-signal" : "bg-ember"}`}
                    animate={{ width: lane.state === "reading" ? "38%" : lane.state === "verified" ? "78%" : "100%" }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                {lane.verified && <p className="mono mt-2 text-[11px] text-muted">{lane.verified}</p>}
                {lane.state === "done" && <p className="serif mt-2 text-lg leading-snug text-paper">{lane.last}</p>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex flex-col rounded-2xl border hairline bg-[#09090a] p-5">
        <div className="flex items-center justify-between">
          <Eyebrow>Live log</Eyebrow>
          {live && <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />}
        </div>
        <div ref={feed} className="mono mt-4 max-h-[540px] flex-1 space-y-2 overflow-y-auto pr-2 text-[12px] leading-relaxed">
          {logs.map((l, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <span className="shrink-0 text-dim">{t0 ? `+${((new Date(l.at) - t0) / 1000).toFixed(1)}s` : ""}</span>
              <span className={l.kind === "error" ? "text-ember" : l.kind === "done" ? "text-signal" : l.kind === "milestone" ? "text-paper" : /rejected [1-9]/.test(l.message) ? "text-amber" : "text-muted"}>
                {l.message}
              </span>
            </motion.div>
          ))}
          {live && <span className="blink text-ember">▍</span>}
        </div>
      </div>
    </div>
  );
}

export default function DocumentPage({ docId }) {
  const { data, error } = usePoll(() => api.document(docId), [docId], {
    interval: 1500,
    until: (d) => DONE.includes(d.document.status),
  });
  useEffect(() => {
    if (data?.document.status === "duplicate" && data.document.duplicateOf) go(`/doc/${data.document.duplicateOf}`);
  }, [data]);

  const points = useMemo(
    () =>
      (data?.projects || []).map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
        label: `${p.proponent} · ${DECISION[p.decision]?.label || ""}`,
        tone: DECISION[p.decision]?.tone,
        href: `/doc/${docId}/p/${p.index}`,
      })),
    [data, docId]
  );

  if (error && !data) return <p className="mx-auto max-w-7xl px-5 py-24 text-ember">{error.message}</p>;
  if (!data) return <p className="mx-auto max-w-7xl px-5 py-24 text-muted">Loading…</p>;
  const { document: doc, projects, logs } = data;
  const ready = doc.status === "ready";
  const secs = elapsed(logs);

  return (
    <div className="mx-auto max-w-7xl px-5 pt-12">
      <Eyebrow>{ready ? "Filing, decoded" : doc.status === "failed" ? "Could not finish" : "Reading filing"}</Eyebrow>
      <h1 className="serif mt-3 max-w-4xl text-4xl leading-tight sm:text-5xl">{doc.fileName}</h1>
      <div className="mono mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
        <span><span className="text-paper">{fmt(doc.pages)}</span> pages</span>
        <span><span className="text-paper">{fmt(doc.chars)}</span> characters</span>
        <span><span className="text-paper">{doc.projectCount ?? "…"}</span> projects</span>
        {secs > 0 && <span>read in <span className={ready ? "text-signal" : "text-paper"}>{fmt(secs, 0)}s</span></span>}
      </div>

      {(!ready || logs.length > 0) && (
        <div className="mt-10">
          <AgentConsole logs={logs} status={doc.status} />
        </div>
      )}

      {projects.length > 0 && (
        <section className="mt-16">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <Eyebrow>What this filing approves</Eyebrow>
              <h2 className="serif mt-2 text-4xl leading-tight">
                {projects.filter((p) => p.decision === "recommended").length} of {projects.length} projects were recommended.
              </h2>
              <p className="mt-4 text-muted">
                Each card is written from facts verified against the committee's own record. Open one to see the evidence, page by page.
              </p>
            </div>
            <MapView points={points} height={300} />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <ProjectCard key={p.index} docId={docId} p={p} i={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
