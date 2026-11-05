/**
 * Review scores. The numeral and stars are always shown together and the
 * pair carries one accessible label, e.g. "Rated 4.5 out of 5".
 * Half stars are a clipped filled star over an empty one.
 */
type Score = { score: number; scoreMax: number };

function toFive({ score, scoreMax }: Score) {
  return scoreMax === 5 ? score : (score / scoreMax) * 5;
}

export function Stars({ value, size }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-hidden style={size ? { fontSize: size } : undefined}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="star">
          ★<span style={{ width: `${Math.max(0, Math.min(1, value - (i - 1))) * 100}%` }}>★</span>
        </span>
      ))}
    </span>
  );
}

const label = (s: Score) => `Rated ${s.score.toFixed(1)} out of ${s.scoreMax}`;

/** L block: overlaid bottom-left on review images. */
export function ScoreBlock(s: Score) {
  return (
    <span className="score-block" role="img" aria-label={label(s)}>
      <span className="num">{s.score.toFixed(1)}</span>
      <Stars value={toFive(s)} />
    </span>
  );
}

/** Compact block: review lists. */
export function ScoreCompact(s: Score) {
  return (
    <span className="score-compact" role="img" aria-label={label(s)}>
      <span className="num">{s.score.toFixed(1)}</span>
      <Stars value={toFive(s)} />
    </span>
  );
}

/** XL ring: the lead review. */
export function ScoreRing(s: Score & { badge?: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }} role="img" aria-label={label(s)}>
      <div className="score-ring">
        <span className="num">{s.score.toFixed(1)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Stars value={toFive(s)} size={24} />
        {s.badge && <span className="kicker">● {s.badge}</span>}
      </div>
    </div>
  );
}

/** S inline: video cards. */
export function ScoreInline(s: Score) {
  return (
    <span className="score-inline" role="img" aria-label={label(s)}>
      <Stars value={toFive(s)} />
      {s.score.toFixed(1)}
    </span>
  );
}
