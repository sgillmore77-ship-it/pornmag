import Link from "next/link";

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="adm-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="toolbar">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{status}</span>;
}

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
export function When({ d, tz }: { d: Date | null | undefined; tz?: string }) {
  if (!d) return <span style={{ color: "var(--muted)" }}>—</span>;
  const f = tz ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz }) : fmt;
  return <time dateTime={d.toISOString()}>{f.format(d)}</time>;
}

export function Empty({ children, action }: { children: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="panel panel-pad" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
      <p>{children}</p>
      {action && (
        <Link href={action.href} className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
