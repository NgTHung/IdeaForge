"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOthers, useSelf } from "@/lib/liveblocks";
import "./active-members.css";

type ActiveMember = {
  connectionId: number;
  name: string;
  canWrite: boolean;
  isSelf: boolean;
};

export function ActiveMembers() {
  const others = useOthers();
  const self = useSelf();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const members = useMemo<ActiveMember[]>(() => [
    ...(self ? [{
      connectionId: self.connectionId,
      name: self.info?.name?.trim() || "Guest",
      canWrite: self.canWrite,
      isSelf: true,
    }] : []),
    ...others.map((other) => ({
      connectionId: other.connectionId,
      name: other.info?.name?.trim() || "Guest",
      canWrite: other.canWrite,
      isSelf: false,
    })),
  ], [others, self]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!self) return null;

  return <div className="active-members" ref={rootRef}>
    <button ref={triggerRef} className="active-members-trigger" type="button"
      aria-label={`${members.length} active ${members.length === 1 ? "member" : "members"}. View member list.`}
      aria-expanded={open} aria-controls="active-members-popover" title="Active board members"
      onClick={() => setOpen((current) => !current)}>
      <span className="active-members-avatars" aria-hidden="true">
        {members.slice(0, 3).map((member, index) => <span key={member.connectionId}
          className={`active-member-avatar active-member-avatar-${index % 3}`}>
          {member.name.charAt(0).toLocaleUpperCase() || "?"}
        </span>)}
      </span>
      <span className="active-members-count">{members.length}</span>
    </button>
    {open && <section id="active-members-popover" className="active-members-popover" aria-label="Active board members">
      <header className="active-members-popover-header">
        <strong>Active now</strong>
        <span>{members.length}</span>
      </header>
      <ul>
        {members.map((member, index) => <li key={member.connectionId}>
          <span className={`active-member-avatar active-member-avatar-${index % 3}`} aria-hidden="true">
            {member.name.charAt(0).toLocaleUpperCase() || "?"}
          </span>
          <span className="active-member-details">
            <strong>{member.name}{member.isSelf && <span className="active-member-you">You</span>}</strong>
            <small>{member.canWrite ? "Editor" : "Viewer"}</small>
          </span>
        </li>)}
      </ul>
    </section>}
  </div>;
}
