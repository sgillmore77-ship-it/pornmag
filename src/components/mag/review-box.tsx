import type { ContentPage } from "@/data/content";

/** Pros, cons, price and the affiliate link, under a review's verdict. */
export function ReviewBox({ item }: { item: ContentPage }) {
  const r = item.reviewFull;
  if (!r) return null;
  const hasLists = r.pros.length > 0 || r.cons.length > 0;
  if (!hasLists && !r.pricing && !r.affiliateUrl) return null;
  const subjectName = r.subject?.name ?? item.title;
  return (
    <div className="review-box">
      {hasLists && (
        <div className="review-lists">
          {r.pros.length > 0 && (
            <div>
              <h2 className="label-mono">For</h2>
              <ul>
                {r.pros.map((p) => (
                  <li key={p}>
                    <span aria-hidden className="pc pc-pro">+</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.cons.length > 0 && (
            <div>
              <h2 className="label-mono">Against</h2>
              <ul>
                {r.cons.map((c) => (
                  <li key={c}>
                    <span aria-hidden className="pc pc-con">–</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {(r.pricing || r.affiliateUrl) && (
        <div className="review-cta">
          {r.pricing && (
            <span>
              <span className="meta" style={{ display: "block" }}>
                Price
              </span>
              <strong>{r.pricing}</strong>
            </span>
          )}
          {r.affiliateUrl && (
            <a href={r.affiliateUrl} className="btn btn-primary" target="_blank" rel="sponsored nofollow noopener">
              Visit {subjectName} ↗
            </a>
          )}
        </div>
      )}
      {r.affiliateUrl && <p className="meta" style={{ textTransform: "none", letterSpacing: "0.02em", marginTop: 10 }}>We may earn a commission if you sign up through this link. It never affects our scores.</p>}
    </div>
  );
}
