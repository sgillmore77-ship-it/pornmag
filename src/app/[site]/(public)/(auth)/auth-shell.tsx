export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="wrap" style={{ maxWidth: 520, marginInline: "auto", paddingBlock: "clamp(40px, 6cqw, 96px)" }}>
      <h1 className="disp" style={{ fontSize: "calc(clamp(40px, 4.4cqw, 56px) * var(--dsz))", marginBottom: 32, borderTop: "2px solid var(--ink)", paddingTop: 16 }}>
        {title}
      </h1>
      {children}
    </div>
  );
}
