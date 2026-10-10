import { CloudFrame } from "./cloud-frame";
import type { ObjectStyle } from "./personalization";

function CatEar({ side }: { side: string }) {
  return <svg className={`border-cat-ear border-${side}`} viewBox="0 0 52 44" focusable="false"><path d="M3 40 10 3Q12-2 17 2L49 40Z" /><path className="cat-inner-ear" d="m13 32 3-21 19 21Z" /></svg>;
}
function Paw({ side }: { side: string }) {
  return <svg className={`border-paw border-${side}`} viewBox="0 0 42 42" focusable="false"><ellipse cx="21" cy="29" rx="11" ry="9" /><ellipse cx="7" cy="18" rx="5" ry="6" /><ellipse cx="16" cy="10" rx="5" ry="6" /><ellipse cx="27" cy="10" rx="5" ry="6" /><ellipse cx="36" cy="19" rx="5" ry="6" /></svg>;
}
function Whiskers({ side }: { side: string }) {
  return <svg className={`border-whiskers border-${side}`} viewBox="0 0 52 40" focusable="false"><path d="m3 6 43 14M0 22h46M7 37l39-15" /></svg>;
}
function Constellation({ side }: { side: string }) {
  return <svg className={`border-constellation border-${side}`} viewBox="0 0 105 55" focusable="false"><path d="m7 40 27-22 30 16L95 9" /><circle cx="7" cy="40" r="3" /><circle cx="34" cy="18" r="4" /><circle cx="64" cy="34" r="3" /><circle cx="95" cy="9" r="4" /></svg>;
}
function Flower({ side }: { side: string }) {
  return <svg className={`border-flower border-${side}`} viewBox="0 0 64 64" focusable="false"><g>{Array.from({ length: 6 }, (_, index) => <ellipse key={index} cx="32" cy="17" rx="10" ry="15" transform={`rotate(${index * 60} 32 32)`} />)}</g><circle cx="32" cy="32" r="9" /></svg>;
}
function Leaves({ side }: { side: string }) {
  return <svg className={`border-leaves border-${side}`} viewBox="0 0 90 48" focusable="false"><path className="leaf-stem" d="M3 44Q36 13 86 8" /><path d="M19 32Q5 12 28 7Q37 22 19 32ZM40 19Q42-2 64 4Q65 22 40 19ZM46 19Q57 43 77 29Q70 13 46 19Z" /></svg>;
}

export function BorderDecorations({ border, size, cluster = false }: { border: ObjectStyle["border"]; size?: { width: number; height: number }; cluster?: boolean }) {
  if (border === "clouds") return <CloudFrame size={size} cluster={cluster} />;
  if (border === "plain") return null;
  return <div className="border-decorations" data-border={border} data-decoration-kind={cluster ? "cluster" : "note"} aria-hidden="true">
    {border === "cat" && <><CatEar side="left" /><CatEar side="right" /><Whiskers side="left" /><Whiskers side="right" /><Paw side="left" /><Paw side="right" /></>}
    {border === "rainbow" && <><span className="border-glint border-left">✦</span><span className="border-glint border-right">✧</span><span className="border-neon-dots" /></>}
    {border === "stars" && <><Constellation side="left" /><Constellation side="right" /><span className="border-star border-left">✦</span><span className="border-star border-right">★</span><span className="border-star border-bottom">✧</span></>}
    {border === "flowers" && <><Leaves side="left" /><Leaves side="right" /><Flower side="left" /><Flower side="right" /><Flower side="bottom" /></>}
    {border === "paper" && <><span className="border-tape border-left" /><span className="border-tape border-right" /><span className="border-paper-fold" /></>}
  </div>;
}
