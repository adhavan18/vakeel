import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, AlertTriangle, ChevronDown, Ban, PenLine } from "lucide-react";
import { api } from "../api.js";
import { go, usePoll, fmt, crore, DECISION, LANG_NAMES } from "../lib.js";
import { Counter, DecisionBadge, Eyebrow, SeverityBadge, VerifiedTick } from "./ui.jsx";
import MapView from "./MapView.jsx";
import SourceDrawer from "./SourceDrawer.jsx";

const KIND_TONE = { river: "sky", reserved_forest: "signal", protected_forest: "signal", wildlife_area: "signal", settlement: "amber", school: "amber", hospital: "amber", other: "muted" };
const KIND_LABEL = { river: "River", reserved_forest: "Reserved forest", protected_forest: "Protected forest", wildlife_area: "Wildlife area", settlement: "Settlement", school: "School", hospital: "Hospital", other: "Nearby" };

function Metric({ m, factors, onSource, i }) {
  const [open, setOpen] = useState(false);
  const big = {
    climate_cost: [m.value / 1e7, (v) => `₹${fmt(v)} cr`, "climate damage, every year"],
    co2: [m.value / 1e6, (v) => `${fmt(v, 1)}M t`, "of CO₂ a year"],
    water: [m.value / 1e5, (v) => `${fmt(v, 1)} lakh`, "people's daily water"],
    coal: [m.value, (v) => fmt(v, 1), "coal trains burned a day"],
  }[m.id] || [m.value, (v) => fmt(v), m.unit];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex flex-col rounded-2xl border hairline bg-ink-2 p-5">
      <Counter value={big[0]} format={big[1]} className={`serif text-5xl leading-none ${m.id === "climate_cost" ? "text-ember" : "text-paper"}`} />
      <p className="mt-2 text-sm text-muted">{big[2]}</p>
      <button onClick={() => setOpen(!open)} className="mt-auto flex items-center gap-1 pt-5 text-left text-xs text-dim hover:text-paper">
        How we calculated this <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <p className="mono mt-3 text-[11px] text-paper/80">{m.formula}</p>
            {m.inputs.map((inp) => (
              <p key={inp.key} className="mt-2 text-[11px] text-muted">
                Input from the filing: “{inp.quote}” <VerifiedTick page={inp.page} onClick={() => onSource(inp)} />
              </p>
            ))}
            {m.factors.map((f) => (
              <p key={f} className="mt-2 text-[11px] text-dim">
                {factors[f].label}: {factors[f].value}. {factors[f].source}
              </p>
            ))}
            <p className="mt-2 text-[11px] text-dim">Computed by code, not by the AI.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ObjectStart({ docId, n, project, onClose }) {
  const [name, setName] = useState("");
  const [place, setPlace] = useState(project.location?.village || project.location?.district || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { objectionId } = await api.startObjection(docId, n, { name, place });
      go(`/objection/${objectionId}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <motion.div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-lg rounded-2xl border hairline bg-ink-2 p-7"
      >
        <Eyebrow>Your objection</Eyebrow>
        <h3 className="serif mt-2 text-3xl leading-tight">Vakeel will draft it from the record. You read it, then you decide.</h3>
        <label className="mt-6 block text-sm text-muted">
          Your full name
          <input autoFocus required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-lg border hairline bg-ink px-4 py-3 text-paper outline-none focus:border-action" />
        </label>
        <label className="mt-4 block text-sm text-muted">
          Where you live
          <input value={place} onChange={(e) => setPlace(e.target.value)} className="mt-2 w-full rounded-lg border hairline bg-ink px-4 py-3 text-paper outline-none focus:border-action" />
        </label>
        {error && <p className="mt-4 text-sm text-ember">{error}</p>}
        <div className="mt-7 flex items-center justify-between gap-4">
          <p className="text-xs text-dim">Nothing is sent anywhere until you sign.</p>
          <button disabled={busy} className="rounded-full press bg-action px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0077ed] disabled:opacity-50">
            {busy ? "Starting…" : "Draft my objection"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

export default function ProjectPage({ docId, n }) {
  const { data, error } = usePoll(() => api.project(docId, n), [docId, n], { interval: 0 });
  const [lang, setLang] = useState("en");
  const [source, setSource] = useState(null);
  const [objecting, setObjecting] = useState(false);
  const p = data?.project;

  const rings = useMemo(
    () => (p?.nearby || []).filter((x) => x.distanceKm <= 15).map((x) => ({ radiusKm: x.distanceKm, label: `${x.name} · ${x.distanceKm} km`, tone: KIND_TONE[x.kind] })),
    [p]
  );

  if (error) return <p className="mx-auto max-w-6xl px-5 py-24 text-ember">{error.message}</p>;
  if (!p) return <p className="mx-auto max-w-6xl px-5 py-24 text-muted">Loading…</p>;

  const t = lang === "en" ? { headline: p.headline, dek: p.dek } : p.translations.find((x) => x.lang === lang) || {};
  const loc = p.location || {};
  const decision = p.committeeDecision || {};
  // Records analysed before the coal-unit guard in impact.py can hold a "0.0 trains" metric.
  const metrics = p.impact.metrics.filter((m) => m.id !== "coal" || m.value >= 0.1);
  const open = (item) => setSource({ page: item.page, quote: item.quote });

  return (
    <div className="mx-auto max-w-6xl px-5 pb-32 pt-10">
      <a href={`#/doc/${docId}`} className="inline-flex items-center gap-2 text-sm text-muted hover:text-paper">
        <ArrowLeft className="h-4 w-4" /> {data.document.fileName.replace(/\.pdf$/i, "")}
      </a>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <DecisionBadge outcome={decision.outcome} />
          <span className="mono text-xs text-muted">{p.proposalType}</span>
          {p.proposalNo && <span className="mono text-xs text-dim">{p.proposalNo}</span>}
        </div>
        {p.translations?.length > 0 && (
          <div className="flex rounded-full border hairline p-1 text-sm">
            {["en", ...p.translations.map((x) => x.lang)].map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 transition ${lang === l ? "bg-paper text-ink" : "text-muted hover:text-paper"}`}>
                {LANG_NAMES[l] || l}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={lang} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <h1 className="mt-6 max-w-5xl text-[36px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[52px]">{t.headline}</h1>
          {t.dek && <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">{t.dek}</p>}
        </motion.div>
      </AnimatePresence>

      <p className="mt-6 text-sm text-muted">
        <span className="text-paper">{p.parentGroup || p.proponent}</span>
        {p.parentGroup && p.proponent && p.parentGroup !== p.proponent ? ` (${p.proponent})` : ""} ·{" "}
        {[loc.village, loc.district, loc.state].filter(Boolean).join(", ")}
      </p>

      {decision.summary && (
        <div className="mt-8 max-w-4xl rounded-2xl border border-ember/25 bg-ember/[0.05] p-5">
          <Eyebrow className="text-ember">What the Expert Appraisal Committee decided</Eyebrow>
          <p className="mt-2 text-lg">{decision.summary}</p>
          {decision.quote && (
            <p className="mt-2 text-sm text-muted">
              “{decision.quote}” {decision.verified && <VerifiedTick page={decision.page} onClick={() => open(decision)} />}
            </p>
          )}
        </div>
      )}

      {metrics.length > 0 && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <Metric key={m.id} m={m} i={i} factors={p.impact.factors} onSource={open} />
          ))}
        </div>
      )}

      {p.impact.airFlags.map((a) => (
        <div key={a.pollutant} className="mt-4 flex items-start gap-3 rounded-2xl border border-amber/25 bg-amber/[0.05] p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
          <p className="text-paper/90">
            {a.note} <VerifiedTick page={a.input.page} onClick={() => open(a.input)} />
          </p>
        </div>
      ))}

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.35fr_1fr]">
        <section>
          <Eyebrow>Why people nearby should care</Eyebrow>
          <div className="mt-5 space-y-4">
            {p.concerns.map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border hairline bg-ink-2 p-5">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="serif text-[28px] leading-tight">{c.title}</h3>
                  <SeverityBadge severity={c.severity} />
                </div>
                <p className="mt-2 text-paper/85">{c.explanation}</p>
                <blockquote className="mt-4 border-l-2 border-line pl-4 text-sm text-muted">
                  “{c.quote}” <VerifiedTick page={c.page} onClick={() => open(c)} />
                </blockquote>
              </motion.div>
            ))}
          </div>
        </section>

        <section>
          <Eyebrow>What's within reach</Eyebrow>
          <MapView className="mt-5" points={[{ lat: loc.latitude, lng: loc.longitude, label: p.parentGroup || p.proponent, tone: DECISION[decision.outcome]?.tone }]} rings={rings} height={320} />
          {!loc.latitude && <p className="mt-2 text-xs text-dim">The filing gives no site coordinates for this project.</p>}
          <ul className="mt-4 divide-y divide-line rounded-2xl border hairline bg-ink-2">
            {p.nearby
              .slice()
              .sort((a, b) => a.distanceKm - b.distanceKm)
              .map((x, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="text-paper/90">{x.name}</p>
                    <p className="text-xs text-dim">{KIND_LABEL[x.kind]}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="serif text-xl">{x.distanceKm} km</span>
                    <VerifiedTick page={x.page} onClick={() => open(x)} />
                  </div>
                </li>
              ))}
          </ul>
        </section>
      </div>

      <section className="mt-14">
        <Eyebrow>Every figure, checked against the filing</Eyebrow>
        <div className="mt-5 overflow-hidden rounded-2xl border hairline">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {p.facts.map((f, i) => (
                <tr key={i} className="bg-ink-2">
                  <td className="px-4 py-3 text-muted">{f.label}</td>
                  <td className="serif px-4 py-3 text-right text-xl">{fmt(f.value, f.value % 1 ? 2 : 0)}</td>
                  <td className="hidden px-4 py-3 text-xs text-dim md:table-cell">“{f.quote}”</td>
                  <td className="px-4 py-3 text-right">
                    <VerifiedTick page={f.page} onClick={() => open(f)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {p.rejected?.length > 0 && (
        <section className="mt-14 rounded-2xl border border-dashed hairline p-6">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-amber" />
            <Eyebrow className="text-amber">What Vakeel refused to tell you</Eyebrow>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            The AI proposed these, but they could not be matched word-for-word to the filing, so they were thrown away before you saw them.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {p.rejected.map((r, i) => (
              <li key={i} className="mono rounded-lg bg-ink-2 px-3 py-2 text-[11px] text-dim">
                <span className="text-muted line-through decoration-amber/60">{r.claim || r.kind}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t hairline bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <p className="hidden text-sm text-muted sm:block">
            {data.objections > 0 ? (
              <>
                <span className="text-paper">{data.objections}</span> {data.objections === 1 ? "person has" : "people have"} objected.
              </>
            ) : (
              "Residents can file objections with the committee before clearance is granted."
            )}
            {p.impact.climateCostInrPerYear > 0 && <> At stake: <span className="text-ember">{crore(p.impact.climateCostInrPerYear)}</span> a year.</>}
          </p>
          <button onClick={() => setObjecting(true)} className="ml-auto flex items-center gap-2 rounded-full press bg-action px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0077ed]">
            <PenLine className="h-4 w-4" /> Object to this proposal
          </button>
        </div>
      </div>

      <AnimatePresence>{objecting && <ObjectStart docId={docId} n={n} project={p} onClose={() => setObjecting(false)} />}</AnimatePresence>
      <SourceDrawer docId={docId} source={source} onClose={() => setSource(null)} />
    </div>
  );
}
