export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <h1 className="mb-8 font-display text-4xl font-bold">{title}</h1>
      {children}
    </div>
  );
}
