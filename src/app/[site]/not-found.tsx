import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap" style={{ textAlign: "center", paddingBlock: "clamp(64px, 10cqw, 160px)" }}>
      <p className="kicker">Error 404</p>
      <h1 className="disp" style={{ marginTop: 12, fontSize: "calc(clamp(42px, 6cqw, 88px) * var(--dsz))" }}>
        We couldn&apos;t find that page.
      </h1>
      <p className="dek" style={{ marginTop: 16, fontSize: 18 }}>
        It may have moved or been taken down.
      </p>
      <Link href="/" className="btn btn-primary btn-lg" style={{ marginTop: 32 }}>
        Back to the homepage
      </Link>
    </div>
  );
}
