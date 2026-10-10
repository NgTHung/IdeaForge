"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { authClient } from "@/lib/auth-client";
import "./account-menu.css";

export function AccountMenu({ showName = false }: { showName?: boolean }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const name = session?.user.name?.trim() || session?.user.email || "Guest";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase())
    .join("");

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
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

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLElement>("[role='menuitem']:not(:disabled)")
      ?.focus();
  }, [open]);

  function moveMenuFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not(:disabled)") ?? [])];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : current < 0
          ? (event.key === "ArrowDown" ? 0 : items.length - 1)
          : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  async function signOut() {
    setSignOutBusy(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      setOpen(false);
      router.replace("/");
      router.refresh();
    } catch {
      setError("Sign out failed. Please try again.");
      setSignOutBusy(false);
    }
  }

  if (isPending) return <span className="account-loading" aria-label="Checking sign-in status" />;
  if (!session) return <Link className="account-signin" href="/login">Sign in</Link>;

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        ref={triggerRef}
        className={`account-avatar ${showName ? "has-name" : ""}`}
        type="button"
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="account-menu-dropdown"
        onClick={() => {
          setOpen((value) => !value);
          setError("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="account-avatar-initials" aria-hidden="true">{initials}</span>
        {showName && <span className="account-avatar-name">{name}</span>}
      </button>

      <div
        id="account-menu-dropdown"
        className="account-popover"
        role="menu"
        aria-label="Account menu"
        hidden={!open}
        onKeyDown={moveMenuFocus}
      >
        <div className="account-menu-summary" role="none">
          <strong title={name}>{name}</strong>
          {session.user.email && <span className="account-email">{session.user.email}</span>}
        </div>
        <Link role="menuitem" className="account-dashboard-link" href="/dashboard" onClick={() => setOpen(false)}>
          My dashboard
        </Link>
        {error && <p className="account-error" role="alert">{error}</p>}
        <button role="menuitem" type="button" disabled={signOutBusy} onClick={() => void signOut()}>
          {signOutBusy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
