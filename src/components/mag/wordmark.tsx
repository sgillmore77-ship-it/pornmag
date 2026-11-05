/** Fallback wordmark: publication name in the display face plus a brand full stop. */
export function Wordmark({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`wordmark ${className}`} style={style}>
      {name}
      <span className="dot">.</span>
    </span>
  );
}
