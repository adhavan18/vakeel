import { DECISION, SEVERITY, TONE, useCountUp, fmt } from "../lib.js";

export function Badge({ tone = "muted", children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${TONE[tone]} ${className}`}>
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
  return <p className={`mono text-[11px] uppercase tracking-[0.2em] text-muted ${className}`}>{children}</p>;
}

export function VerifiedTick({ page, onClick }) {
  return (
    <button
      onClick={onClick}
      className="mono inline-flex items-center gap-1 rounded border border-signal/30 bg-signal/10 px-1.5 py-0.5 text-[10px] text-signal transition hover:bg-signal/20"
      title="This figure was found word-for-word in the source document"
    >
      ✓ p.{page || "?"}
    </button>
  );
}
