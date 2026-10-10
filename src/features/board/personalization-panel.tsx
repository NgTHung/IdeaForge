"use client";

import { useEffect, useRef, useState } from "react";
import { defaultClusterStyle, defaultObjectStyle, defaultPreferences, defaultRelationshipStyle, effectLabels, palette, type Personalization, type ObjectStyle, type ClusterStyle, type RelationshipStyle } from "./personalization";
import type { Board } from "./model";

function Choice({ label, value, choices, onChange, disabled = false }: { label: string; value: string; choices: readonly string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="personalization-choice"><span>{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
    {choices.map((choice) => <option key={choice} value={choice}>{choice === "rainbow" ? "RGB" : choice[0].toUpperCase() + choice.slice(1)}</option>)}
  </select></label>;
}
const colors = ["default", ...Object.keys(palette)];
export function PersonalizationPanel({ preferences, update, reducedMotion, board, selectedIdeaId, selectedLinkId, canWrite, onStyle }: {
  preferences: Personalization; update: (patch: Partial<Personalization>) => void; reducedMotion: boolean; board: Board;
  selectedIdeaId?: string; selectedLinkId?: string; canWrite: boolean;
  onStyle: (kind: "idea" | "relationship" | "cluster", id: string, style: ObjectStyle | ClusterStyle | RelationshipStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const idea = board.ideas.find((item) => item.id === selectedIdeaId);
  const link = board.relationships.find((item) => item.id === selectedLinkId);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    const pointerDown = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("keydown", keyDown);
    document.addEventListener("pointerdown", pointerDown);
    return () => { document.removeEventListener("keydown", keyDown); document.removeEventListener("pointerdown", pointerDown); };
  }, [open]);
  const objectControls = (kind: "idea" | "cluster", id: string, style: ObjectStyle | ClusterStyle, label: string) => <div className="personalization-object" key={id}>
    <h4>{label}</h4>
    <div className="personalization-preview" data-border={style.border} style={{ "--style-color": style.color === "default" ? "#32856a" : palette[style.color] } as React.CSSProperties}>{label || "Your note"}<span>{style.border === "cat" ? " /ᐠ｡ꞈ｡ᐟ\\" : style.border === "rainbow" ? " RGB" : ""}</span></div>
    <Choice label={`${label} color`} value={style.color} choices={colors} disabled={!canWrite} onChange={(color) => onStyle(kind, id, { ...style, color: color as ObjectStyle["color"] })} />
    <Choice label={`${label} border`} value={style.border} choices={kind === "cluster" ? ["plain", "cat", "rainbow", "clouds", "stars", "flowers", "paper"] : ["plain", "cat", "rainbow"]} disabled={!canWrite} onChange={(border) => onStyle(kind, id, kind === "cluster" ? { ...style as ClusterStyle, border: border as ClusterStyle["border"] } : { ...style as ObjectStyle, border: border as ObjectStyle["border"] })} />
    {kind === "cluster" && <label className="personalization-check"><input type="checkbox" checked={(style as ClusterStyle).boundary} disabled={!canWrite} onChange={(event) => onStyle(kind, id, { ...style, boundary: event.target.checked })} />Show cluster boundary</label>}
    <button type="button" disabled={!canWrite} onClick={() => onStyle(kind, id, kind === "cluster" ? defaultClusterStyle : defaultObjectStyle)}>Reset {kind} style</button>
  </div>;
  return <div ref={root} className="personalization-control">
    <button ref={trigger} type="button" className="personalization-trigger" aria-label="Personalization" aria-expanded={open} aria-controls="personalization-panel" onClick={() => setOpen((value) => !value)}><span aria-hidden="true">✿</span><span>Style</span></button>
    {open && <aside ref={panel} id="personalization-panel" className="personalization-panel" role="dialog" aria-modal="false" aria-label="Personalization settings">
      <header><div><span className="personalization-eyebrow">MAKE IT YOURS</span><h2>Personalization</h2></div><button type="button" aria-label="Close personalization" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button></header>
      <section><h3>Motion & reactions</h3>
        <label className="personalization-check personalization-animation-toggle"><input type="checkbox" checked={preferences.animations} onChange={(event) => update({ animations: event.target.checked })} />Enable animations</label>
        <p>{preferences.animations ? reducedMotion ? "Your device requests reduced motion. Effects use static feedback." : "Brief celebrations, with room to keep working." : "Animations are off. Status messages and earned stickers stay available."}</p>
        <details><summary>Choose effects</summary>{Object.entries(effectLabels).map(([kind, label]) => <label className="personalization-check" key={kind}><input type="checkbox" checked={preferences.effects[kind as keyof typeof effectLabels]} onChange={(event) => update({ effects: { ...preferences.effects, [kind]: event.target.checked } })} />{label}</label>)}</details>
        <Choice label="Upvote reaction" value={preferences.reaction} choices={["heart", "cat", "frog"]} onChange={(reaction) => update({ reaction: reaction as Personalization["reaction"] })} />
        <Choice label="AI thinking style" value={preferences.thinking} choices={["hamster", "cat", "cauldron"]} onChange={(thinking) => update({ thinking: thinking as Personalization["thinking"] })} />
        <Choice label="Milestone celebration" value={preferences.milestone} choices={["confetti", "ducks"]} onChange={(milestone) => update({ milestone: milestone as Personalization["milestone"] })} />
      </section>
      <section><h3>Your workspace</h3><Choice label="Theme" value={preferences.theme} choices={["light", "dark"]} onChange={(theme) => update({ theme: theme as Personalization["theme"] })} />
        <Choice label="Accent" value={preferences.accent} choices={colors} onChange={(accent) => update({ accent: accent as Personalization["accent"] })} />
        <Choice label="Canvas background" value={preferences.background} choices={["plain", "dots", "grid", "clouds"]} onChange={(background) => update({ background: background as Personalization["background"] })} />
        <Choice label="Cursor shape" value={preferences.cursor.shape} choices={["dot", "arrow", "cat"]} onChange={(shape) => update({ cursor: { ...preferences.cursor, shape: shape as Personalization["cursor"]["shape"] } })} />
        <Choice label="Cursor color" value={preferences.cursor.color} choices={colors} onChange={(color) => update({ cursor: { ...preferences.cursor, color: color as Personalization["cursor"]["color"] } })} />
        <p>Other people on this board see your cursor while you point at the canvas. Yours stays as the normal pointer.</p>
        <div className="personalization-cursor-preview" style={{ color: preferences.cursor.color === "default" ? "#32856a" : palette[preferences.cursor.color] }} aria-label="Cursor preview"><span aria-hidden="true">{preferences.cursor.shape === "cat" ? "/ᐠ｡ꞈ｡ᐟ\\" : preferences.cursor.shape === "arrow" ? "➤" : "●"}</span> You</div>
        <button type="button" onClick={() => update(defaultPreferences)}>Reset personal preferences</button>
      </section>
      <section><h3>Selected note or relationship</h3><p>{canWrite ? "Shared styles are visible to everyone on this board." : "You can preview shared styles. Only editors can change them."}</p>
        {idea && objectControls("idea", idea.id, idea.appearance ?? defaultObjectStyle, idea.title)}
        {link && <div className="personalization-object"><Choice label="Relationship color" value={link.appearance?.color ?? "default"} choices={colors} disabled={!canWrite} onChange={(color) => onStyle("relationship", link.id, { ...link.appearance ?? defaultRelationshipStyle, color: color as RelationshipStyle["color"] })} />
          <Choice label="Relationship stroke" value={link.appearance?.stroke ?? "solid"} choices={["solid", "dashed", "dotted"]} disabled={!canWrite} onChange={(stroke) => onStyle("relationship", link.id, { ...link.appearance ?? defaultRelationshipStyle, stroke: stroke as RelationshipStyle["stroke"] })} />
          <svg className="personalization-line-preview" viewBox="0 0 220 30" role="img" aria-label="Relationship style preview"><path d="M10 15H210" stroke={link.appearance?.color && link.appearance.color !== "default" ? palette[link.appearance.color] : "#32856a"} strokeWidth="3" strokeDasharray={link.appearance?.stroke === "dashed" ? "8 5" : link.appearance?.stroke === "dotted" ? "1 6" : undefined} /></svg>
          <button type="button" disabled={!canWrite} onClick={() => onStyle("relationship", link.id, defaultRelationshipStyle)}>Reset relationship style</button></div>}
        {!idea && !link && <p>Select a note or relationship on the canvas, then open Style.</p>}
      </section>
      <section><h3>Clusters</h3>{board.clusterSnapshot?.result.groups.map((group, index) => objectControls("cluster", group.id, group.appearance ?? defaultClusterStyle, group.label.trim() || `Group ${index + 1}`)) ?? <p>Organize your notes to name and decorate clusters.</p>}</section>
    </aside>}
  </div>;
}
