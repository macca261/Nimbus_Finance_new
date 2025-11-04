import { ReactNode } from "react";

export default function StatCard({ title, value, hint, icon }: {
  title: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode;
}) {
  return (
    <div className="panel stat">
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <h4>{title}</h4>
        {icon}
      </div>
      <div className="value">{value}</div>
      {hint && <div style={{marginTop:6, color:"var(--muted)", fontSize:13}}>{hint}</div>}
    </div>
  );
}

