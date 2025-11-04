export default function ProgressPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="badge" style={{background: ok ? "rgba(34,197,94,.18)" : "rgba(239,68,68,.18)"}}>
      <span style={{width:8, height:8, borderRadius:999, background: ok ? "var(--positive)" : "var(--negative)"}}/>
      {label}
    </span>
  );
}

