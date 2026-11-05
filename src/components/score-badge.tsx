/** Review score. Shown as "8.4" with the scale available to screen readers. */
export function ScoreBadge({ score, max, size = "sm" }: { score: number; max: number; size?: "sm" | "lg" }) {
  const big = size === "lg";
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 bg-[var(--brand)] font-display font-bold text-[var(--brand-contrast)] ${
        big ? "px-4 py-2 text-5xl" : "px-2 py-1 text-lg"
      }`}
    >
      {score.toFixed(1)}
      <span className="sr-only"> out of {max}</span>
    </span>
  );
}
