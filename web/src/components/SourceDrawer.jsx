import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ExternalLink } from "lucide-react";
import { api } from "../api.js";
import { highlightRange } from "../lib.js";
import { Eyebrow } from "./ui.jsx";

export default function SourceDrawer({ docId, source, onClose }) {
  const [page, setPage] = useState(null);
  const [error, setError] = useState("");
  const markRef = useRef(null);

  useEffect(() => {
    if (!source) return;
    setPage(null);
    setError("");
    api.page(docId, source.page).then(setPage).catch((e) => setError(e.message));
  }, [docId, source?.page, source?.quote]);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [page]);

  let body = null;
  if (page && source) {
    const range = source.quote ? highlightRange(page.text, source.quote) : null;
    body = range ? (
      <>
        {page.text.slice(0, range[0])}
        <mark ref={markRef} className="vk">{page.text.slice(range[0], range[1])}</mark>
        {page.text.slice(range[1])}
      </>
    ) : (
      page.text
    );
  }

  return (
    <AnimatePresence>
      {source && (
        <>
          <motion.div className="no-print fixed inset-0 z-50 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="no-print fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l hairline bg-ink-2"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
          >
            <div className="flex items-center justify-between border-b hairline px-6 py-4">
              <div>
                <Eyebrow>Source document</Eyebrow>
                <p className="serif mt-1 text-2xl">Page {source.page}</p>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-ink-3 hover:text-paper" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {source.quote && (
              <div className="border-b hairline bg-signal/[0.04] px-6 py-4 text-sm">
                <p className="mono text-[11px] uppercase tracking-wider text-signal">✓ Found word-for-word on this page</p>
                <p className="mt-2 text-paper/90">“{source.quote}”</p>
              </div>
            )}
            <div className="mono flex-1 overflow-y-auto whitespace-pre-wrap px-6 py-5 text-[12.5px] leading-relaxed text-muted">
              {error ? <span className="text-ember">{error}</span> : page ? body : "Loading page…"}
            </div>
            {page?.pdfUrl && (
              <a href={page.pdfUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 border-t hairline px-6 py-4 text-sm text-paper hover:bg-ink-3">
                Open the government's original PDF at page {source.page} <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
