// Offline preview of the API, driven by a real analysis exported from the pipeline.
// Enabled with ?mock in the URL; the deployed app never uses this.

let data = null;
async function load() {
  if (!data) data = await (await fetch("/mock/analysis.json")).json();
  return data;
}

const META = {
  docId: "demo",
  fileName: "EAC (Thermal) 26th meeting minutes, 20 June 2025.pdf",
  pages: 246,
  chars: 621869,
  status: "ready",
  projectCount: 6,
  createdAt: "2026-10-11T04:00:00Z",
};

function summary(n, p) {
  return {
    index: +n,
    headline: p.headline,
    proponent: p.parentGroup || p.proponent,
    projectType: p.projectType,
    decision: p.committeeDecision?.outcome || "unclear",
    state: p.location?.state,
    district: p.location?.district,
    topConcern: p.concerns?.[0]?.title || "",
    topSeverity: p.concerns?.[0]?.severity || "",
    climateCostInr: p.impact.climateCostInrPerYear,
    objections: signed.filter((o) => o.projectIndex === +n).length,
    latitude: p.location?.latitude,
    longitude: p.location?.longitude,
    metrics: p.impact.metrics.slice(0, 4),
  };
}

let liveStart = null;
const objections = {};
const signed = [];

function liveTimeline(d) {
  const ev = [
    [0.2, "Queued for reading", "milestone"],
    [0.8, `Opened ${META.fileName}`, "info"],
    [2.0, "Extracted 246 pages and 621,869 characters of government text in 1.4s", "info"],
    [2.8, "Found 6 separate projects in this filing. Dispatching one Bedrock agent per project.", "milestone"],
  ];
  const done = {};
  Object.entries(d).forEach(([n, p], i) => {
    const start = 3.2 + (i % 3) * 0.4 + Math.floor(i / 3) * 7;
    const claimed = p.facts.length + p.nearby.length + p.concerns.length;
    const rej = p.rejected.filter((r) => ["fact", "nearby", "concern"].includes(r.kind)).length;
    ev.push([start, `Agent ${n} is reading: ${p.projectName}`, "agent"]);
    ev.push([start + 4.5, `Agent ${n}: Verified ${claimed} of ${claimed + rej} claims against the source; rejected ${rej}`, "agent"]);
    ev.push([start + 6.2, `Agent ${n}: Done. Headline: ${p.headline}`, "agent"]);
    done[n] = start + 6.2;
  });
  ev.push([Math.max(...Object.values(done)) + 0.8, "Finished. 6 projects translated for the people who live next to them.", "done"]);
  return { ev, done };
}

function mockLetter(p, name, place) {
  const grounds = p.concerns.map(
    (c, i) => `${i + 1}. ${c.title}. ${c.explanation} The record states: "${c.quote}" (source document, page ${c.page}).`
  );
  return [
    "To,\nThe Member Secretary,\nExpert Appraisal Committee (Thermal Power Projects),\nMinistry of Environment, Forest and Climate Change,\nIndira Paryavaran Bhawan, Jor Bagh Road,\nNew Delhi 110003",
    `Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`,
    `Subject: Objection to ${p.proposalType} for ${p.projectName} by ${p.proponent} (Proposal No. ${p.proposalNo})`,
    "Sir/Madam,",
    `I, ${name}${place ? ` of ${place}` : ""}, formally object to this proposal and ask that my objection be placed on record before any decision is taken.`,
    "GROUNDS OF OBJECTION\n\n" + grounds.join("\n\n"),
    "REQUESTS\n\n1. Hold a public hearing so that affected residents can be heard.\n2. Verify compliance with existing clearance conditions before any further clearance.\n3. Commission a cumulative impact study for the region.",
    `Yours faithfully,\n${name}${place ? `\n${place}` : ""}`,
  ].join("\n\n");
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function mockCall(method, path, body) {
  const d = await load();
  await new Promise((r) => setTimeout(r, 120));
  let m;

  if (path === "/stats") {
    const verified = Object.values(d).reduce((s, p) => s + p.facts.length + p.nearby.length + p.concerns.length, 0);
    const rejected = Object.values(d).reduce((s, p) => s + p.rejected.filter((r) => ["fact", "nearby", "concern"].includes(r.kind)).length, 0);
    return {
      documentsRead: 1, pagesRead: 246, projectsRead: 6, claimsVerified: verified, claimsRejected: rejected,
      objectionsSigned: signed.length,
      damageContestedInr: signed.reduce((s, o) => s + (d[o.projectIndex]?.impact.climateCostInrPerYear || 0), 0),
    };
  }
  if (path === "/documents" && method === "GET") return { documents: [META] };
  if (path === "/documents" && method === "POST") {
    liveStart = Date.now();
    return { docId: "live", uploadUrl: "" };
  }
  if ((m = path.match(/^\/documents\/(\w+)\/analyze$/))) return { docId: m[1], status: "queued" };
  if ((m = path.match(/^\/documents\/(\w+)$/))) {
    if (m[1] === "live" && liveStart) {
      const t = (Date.now() - liveStart) / 1000;
      const { ev, done } = liveTimeline(d);
      const logs = ev.filter((e) => e[0] <= t).map((e) => ({ at: new Date(liveStart + e[0] * 1000).toISOString(), message: e[1], kind: e[2] }));
      const finished = ev[ev.length - 1][0] <= t;
      return {
        document: { ...META, docId: "live", status: finished ? "ready" : t > 2.8 ? "analyzing" : "reading" },
        projects: Object.entries(d).filter(([n]) => done[n] <= t).map(([n, p]) => summary(n, p)),
        logs,
      };
    }
    return { document: META, projects: Object.entries(d).map(([n, p]) => summary(n, p)), logs: [] };
  }
  if ((m = path.match(/^\/documents\/(\w+)\/projects\/(\d+)$/))) {
    return { document: META, project: d[m[2]], objections: signed.filter((o) => o.projectIndex === +m[2]).length, index: +m[2] };
  }
  if ((m = path.match(/^\/documents\/(\w+)\/pages\/(\d+)$/))) {
    const n = +m[2];
    const quotes = Object.values(d).flatMap((p) => [...p.facts, ...p.nearby, ...p.concerns]).filter((x) => x.page === n).map((x) => x.quote);
    return { page: n, text: `[Offline preview: page text is served by the API]\n\n${quotes.join("\n\n")}`, pdfUrl: "" };
  }
  if ((m = path.match(/^\/documents\/(\w+)\/projects\/(\d+)\/objections$/))) {
    const id = Math.random().toString(16).slice(2, 10);
    const p = d[m[2]];
    const o = { objectionId: id, docId: m[1], projectIndex: +m[2], citizenName: body.name, citizenPlace: body.place, status: "drafting", createdAt: new Date().toISOString() };
    objections[id] = o;
    setTimeout(async () => {
      o.letter = mockLetter(p, body.name, body.place);
      o.letterHash = await sha256(o.letter);
      o.phrase = `I object to proposal ${p.proposalNo}`;
      o.subject = `Objection to ${p.proposalType} for ${p.projectName}`;
      o.status = "awaiting_signature";
    }, 2600);
    return { objectionId: id, status: "drafting" };
  }
  if ((m = path.match(/^\/objections\/(\w+)$/))) return { ...objections[m[1]] };
  if ((m = path.match(/^\/objections\/(\w+)\/sign$/))) {
    const o = objections[m[1]];
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9/ ]/g, " ").split(/\s+/).filter(Boolean).join(" ");
    if (norm(body.phrase) !== norm(o.phrase)) throw new Error(`Type exactly: ${o.phrase}`);
    o.status = "signing";
    setTimeout(async () => {
      o.status = "signed";
      o.signedAt = new Date().toISOString();
      o.receipt = await sha256(o.letterHash + o.citizenName + o.signedAt);
      signed.push(o);
    }, 900);
    return { objectionId: o.objectionId, status: "signing" };
  }
  throw new Error(`mock: no route ${method} ${path}`);
}
