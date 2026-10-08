"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import "./account-menu.css";

export function AccountMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const name = session?.user.name?.trim() || session?.user.email || "Guest";
  const initial = name.charAt(0).toLocaleUpperCase();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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

  return <div className="account-menu" ref={menuRef}>
    <button className="account-avatar" type="button" aria-label={`Open account menu for ${name}`}
      aria-expanded={open} aria-haspopup="dialog" onClick={() => { setOpen((value) => !value); setError(""); }}>
      {initial}
    </button>
    {open && <section className="account-popover" role="dialog" aria-label="Account menu">
      <span className="account-popover-label">SIGNED IN AS</span>
      <strong title={name}>{name}</strong>
      {session.user.name && <span className="account-email">{session.user.email}</span>}
      <Link className="account-dashboard-link" href="/dashboard" onClick={() => setOpen(false)}>My dashboard</Link>
      {error && <p className="account-error" role="alert">{error}</p>}
      <button type="button" disabled={signOutBusy} onClick={() => void signOut()}>
        {signOutBusy ? "Signing out…" : "Sign out"}
      </button>
    </section>}
  </div>;
}
