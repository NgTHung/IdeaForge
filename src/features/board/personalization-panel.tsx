"use client";

import { useEffect, useRef, useState } from "react";
import { borderSchema, clusterStyleSchema, defaultClusterStyle, defaultObjectStyle, defaultPreferences, defaultRelationshipStyle, effectLabels, palette, type Personalization, type ObjectStyle, type ClusterStyle, type RelationshipStyle } from "./personalization";
import type { Board } from "./model";
import { BorderDecorations } from "./border-decorations";

function Choice({ label, value, choices, onChange, disabled = false }: { label: string; value: string; choices: readonly string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="personalization-choice"><span>{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
    {choices.map((choice) => <option key={choice} value={choice}>{choice === "rainbow" ? "RGB" : choice[0].toUpperCase() + choice.slice(1)}</option>)}
  </select></label>;
}
const colors = ["default", ...Object.keys(palette)];
export function PersonalizationPanel({ preferences, update, reducedMotion, board, selectedIdeaId, selectedLinkId, canWrite, onStyle, onFocusGroup }: {
  preferences: Personalization; update: (patch: Partial<Personalization>) => void; reducedMotion: boolean; board: Board;
  selectedIdeaId?: string; selectedLinkId?: string; canWrite: boolean;
  onStyle: (kind: "idea" | "relationship" | "cluster", id: string, style: ObjectStyle | ClusterStyle | RelationshipStyle) => void;
  onFocusGroup: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const idea = board.ideas.find((item) => item.id === selectedIdeaId);
  const link = board.relationships.find((item) => item.id === selectedLinkId);
  const groups = board.clusterSnapshot?.result.groups ?? [];
  const selectedGroup = groups.find((group) => group.id === selectedGroupId);
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
    <div className="personalization-preview" data-border={style.border} style={{ "--style-color": style.color === "default" ? "#32856a" : palette[style.color] } as React.CSSProperties}><BorderDecorations border={style.border} />{kind === "cluster" ? "Group preview" : "Idea preview"}</div>
    <Choice label="Color" value={style.color} choices={colors} disabled={!canWrite} onChange={(color) => onStyle(kind, id, { ...style, color: color as ObjectStyle["color"] })} />
    <Choice label="Border" value={style.border} choices={kind === "cluster" ? clusterStyleSchema.shape.border.options : borderSchema.options} disabled={!canWrite} onChange={(border) => onStyle(kind, id, kind === "cluster" ? { ...style as ClusterStyle, border: border as ClusterStyle["border"] } : { ...style as ObjectStyle, border: border as ObjectStyle["border"] })} />
    {kind === "cluster" && <label className="personalization-check"><input type="checkbox" checked={(style as ClusterStyle).boundary} disabled={!canWrite} onChange={(event) => onStyle(kind, id, { ...style, boundary: event.target.checked })} />Show group boundary</label>}
    <button type="button" disabled={!canWrite} onClick={() => onStyle(kind, id, kind === "cluster" ? defaultClusterStyle : defaultObjectStyle)}>Reset {kind === "cluster" ? "group" : "idea"} style</button>
  </div>;
  return <div ref={root} className="personalization-control">
    <button ref={trigger} type="button" className="personalization-trigger" aria-label="Style" title="Style" aria-expanded={open} aria-controls="personalization-panel" onClick={() => setOpen((value) => !value)}><span aria-hidden="true">✿</span></button>
    {open && <aside ref={panel} id="personalization-panel" className="personalization-panel" role="dialog" aria-modal="false" aria-label="Personalization settings">
      <header><div><h2>Style & display</h2><p>Choose how your board looks and feels.</p></div><button type="button" aria-label="Close personalization" onClick={() => { setOpen(false); trigger.current?.focus(); }}>×</button></header>
      <section><h3>Motion & reactions</h3>
        <label className="personalization-check personalization-animation-toggle"><input type="checkbox" checked={preferences.animations} onChange={(event) => update({ animations: event.target.checked })} />Enable animations</label>
        {reducedMotion && <p>Your device requests reduced motion.</p>}
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
        <div className="personalization-cursor-preview" style={{ color: preferences.cursor.color === "default" ? "#32856a" : palette[preferences.cursor.color] }} aria-label="Cursor preview"><span aria-hidden="true">{preferences.cursor.shape === "cat" ? "/ᐠ｡ꞈ｡ᐟ\\" : preferences.cursor.shape === "arrow" ? "➤" : "●"}</span> You</div>
        <button type="button" onClick={() => update(defaultPreferences)}>Reset personal preferences</button>
      </section>
      <section><h3>Selected idea or link</h3><p>{canWrite ? "Changes are shared with everyone on this board." : "You can preview styles. Only editors can change them."}</p>
        {idea && objectControls("idea", idea.id, idea.appearance ?? defaultObjectStyle, idea.title)}
        {link && <div className="personalization-object"><Choice label="Link color" value={link.appearance?.color ?? "default"} choices={colors} disabled={!canWrite} onChange={(color) => onStyle("relationship", link.id, { ...link.appearance ?? defaultRelationshipStyle, color: color as RelationshipStyle["color"] })} />
          <Choice label="Link stroke" value={link.appearance?.stroke ?? "solid"} choices={["solid", "dashed", "dotted"]} disabled={!canWrite} onChange={(stroke) => onStyle("relationship", link.id, { ...link.appearance ?? defaultRelationshipStyle, stroke: stroke as RelationshipStyle["stroke"] })} />
          <svg className="personalization-line-preview" viewBox="0 0 220 30" role="img" aria-label="Link style preview"><path d="M10 15H210" stroke={link.appearance?.color && link.appearance.color !== "default" ? palette[link.appearance.color] : "#32856a"} strokeWidth="3" strokeDasharray={link.appearance?.stroke === "dashed" ? "8 5" : link.appearance?.stroke === "dotted" ? "1 6" : undefined} /></svg>
          <button type="button" disabled={!canWrite} onClick={() => onStyle("relationship", link.id, defaultRelationshipStyle)}>Reset link style</button></div>}
        {!idea && !link && <p>Select an idea or link to style it.</p>}
      </section>
      <section><h3>Groups</h3>{groups.length > 0 ? <>
        <p>Choose a group to focus it on the canvas and edit its style.</p>
        <label className="personalization-choice personalization-group-choice"><span>Group</span><select aria-label="Choose group to style" value={selectedGroupId} onChange={(event) => {
          const groupId = event.target.value;
          setSelectedGroupId(groupId);
          if (groupId) onFocusGroup(groupId);
        }}>
          <option value="">Select a group…</option>
          {groups.map((group, index) => <option key={group.id} value={group.id}>{group.label.trim() || `Group ${index + 1}`} · {group.noteIds.length} ideas</option>)}
        </select></label>
        {selectedGroup && objectControls("cluster", selectedGroup.id, selectedGroup.appearance ?? defaultClusterStyle,
          selectedGroup.label.trim() || `Group ${groups.indexOf(selectedGroup) + 1}`)}
      </> : <p>Organize your ideas to create groups.</p>}</section>
    </aside>}
  </div>;
}
