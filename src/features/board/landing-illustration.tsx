const sources = [
  { id: "a", title: "Shared study rooms", content: "Small rooms where students study together." },
  { id: "b", title: "Peer matching", content: "Match students by subject and availability." },
  { id: "c", title: "Progress check-ins", content: "A short weekly check-in keeps partners on track." },
];

// Each path runs from a source card to the merged card. The 125×100 view box matches the canvas's 5:4 shape, so card percentages map to x × 1.25 and y.
const ancestryPaths = [
  "M56.25 17 C66.25 17, 65 58, 72.5 66",
  "M95 28 C95 48, 100 50, 100 66",
  "M60 56 C77.5 56, 85 58, 85 66",
];

/** A looping, non-interactive picture of three ideas merging; it uses no live data or AI output. */
export function LandingIllustration() {
  return <figure className="landing-illustration">
    <div className="landing-canvas" role="img"
      aria-label="Illustration: three ideas on a shared canvas are selected and merged into one idea, with links back to each original.">
      <svg className="landing-ancestry" viewBox="0 0 125 100" aria-hidden="true">
        {ancestryPaths.map((path) => <path key={path} d={path} pathLength={1} />)}
      </svg>
      {sources.map((idea) => <div key={idea.id} className={`landing-idea landing-idea-${idea.id}`} aria-hidden="true">
        <strong>{idea.title}</strong>
        <span>{idea.content}</span>
      </div>)}
      <div className="landing-idea landing-idea-merged" aria-hidden="true">
        <strong><span className="landing-merged-mark">✦</span> Weekly study pods</strong>
        <span>Matched peers book a room and check in each week.</span>
        <small>Merged from 3 ideas</small>
      </div>
      <div className="landing-merge-bar" aria-hidden="true">3 selected <b>Merge</b></div>
      <div className="landing-cursor landing-cursor-one" aria-hidden="true"><i />Mai</div>
      <div className="landing-cursor landing-cursor-two" aria-hidden="true"><i />Leo</div>
    </div>
    <figcaption>Illustration</figcaption>
  </figure>;
}
