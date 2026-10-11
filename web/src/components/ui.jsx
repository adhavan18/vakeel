import { DECISION, SEVERITY, TONE, useCountUp, fmt } from "../lib.js";

export function Badge({ tone = "muted", children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-none ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function DecisionBadge({ outcome }) {
  const d = DECISION[outcome] || DECISION.unclear;
  return (
    <Badge tone={d.tone}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {d.label}
    </Badge>
  );
}

export function SeverityBadge({ severity }) {
  const s = SEVERITY[severity] || SEVERITY.low;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function Counter({ value, format = (v) => fmt(v), className = "" }) {
  const v = useCountUp(value ?? 0);
  return <span className={className}>{format(v)}</span>;
}

export function Eyebrow({ children, className = "" }) {
  return <p className={`text-[15px] font-semibold text-muted ${className}`}>{children}</p>;
}

export function VerifiedTick({ page, onClick }) {
  return (
    <button
      onClick={onClick}
      className="press inline-flex items-center gap-1 rounded-full bg-signal/10 px-2 py-0.5 align-middle text-[11px] font-semibold text-signal hover:bg-signal/20"
      title="This figure was found word-for-word in the source document"
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
        <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Page {page || "?"}
    </button>
  );
}
