import { mockCall } from "./mock.js";

export const MOCK = new URLSearchParams(window.location.search).has("mock");

let base = null;
async function apiBase() {
  if (base !== null) return base;
  try {
    const res = await fetch("/config.json", { cache: "no-store" });
    base = ((await res.json()).apiUrl || "").replace(/\/$/, "");
  } catch {
    base = "";
  }
  return base;
}

async function call(method, path, body) {
  if (MOCK) return mockCall(method, path, body);
  const res = await fetch((await apiBase()) + path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  stats: () => call("GET", "/stats"),
  documents: () => call("GET", "/documents"),
  document: (id) => call("GET", `/documents/${id}`),
  project: (id, n) => call("GET", `/documents/${id}/projects/${n}`),
  page: (id, p) => call("GET", `/documents/${id}/pages/${p}`),
  startObjection: (id, n, body) => call("POST", `/documents/${id}/projects/${n}/objections`, body),
  objection: (o) => call("GET", `/objections/${o}`),
  sign: (o, body) => call("POST", `/objections/${o}/sign`, body),
};

export async function uploadPdf(file) {
  const { docId, uploadUrl } = await call("POST", "/documents", { fileName: file.name, size: file.size });
  if (!MOCK) {
    const res = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": "application/pdf" }, body: file });
    if (!res.ok) throw new Error("Upload to S3 failed");
  }
  await call("POST", `/documents/${docId}/analyze`);
  return docId;
}
