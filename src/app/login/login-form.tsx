"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { safeReturnPath } from "@/lib/board-directory";
import { signupPasswordError, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

type Mode = "signin" | "signup";

function getReturnPath() {
  return safeReturnPath(new URLSearchParams(window.location.search).get("returnTo"), "/dashboard");
}

export function LoginForm() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (session) router.replace(getReturnPath());
  }, [router, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "signup") {
      const passwordError = signupPasswordError(password);
      if (passwordError) { setError(passwordError); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    }
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "signup") {
        const verifyCallback = new URL("/login", window.location.origin);
        verifyCallback.searchParams.set("verified", "1");
        verifyCallback.searchParams.set("returnTo", getReturnPath());
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: verifyCallback.toString(),
        });
        if (result.error) throw new Error(result.error.message);
        setMessage("Check your email for a verification link, then sign in.");
      } else {
        const result = await authClient.signIn.email({ email: email.trim(), password });
        if (result.error) throw new Error(result.error.message);
        router.replace(getReturnPath());
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't reach the account service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "google", callbackURL: new URL(getReturnPath(), window.location.origin).toString(),
      });
      if (result.error) throw new Error(result.error.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in is unavailable. Try again.");
      setBusy(false);
    }
  }

  if (isPending || session) return <main className="auth-page" aria-busy="true"><p>Loading your account…</p></main>;

  return <main className="auth-page">
    <section className="auth-card" aria-labelledby="auth-title">
      <Link className="auth-brand" href="/" aria-label="IdeaForge home"><span aria-hidden="true">✳</span> IdeaForge</Link>
      <h1 id="auth-title">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
      <p className="auth-intro">{mode === "signin" ? "Sign in to continue to your workspace." : "Create an account to start a board. We’ll email you a verification link."}</p>

      {message && <p className="auth-message" role="status">{message}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}

      <button className="auth-google" type="button" disabled={busy} onClick={() => void signInWithGoogle()}>
        <GoogleMark /> Continue with Google
      </button>
      <div className="auth-divider"><span>or use email</span></div>

      <form onSubmit={(event) => void submit(event)}>
        {mode === "signup" && <label htmlFor="auth-name">Name<input id="auth-name" name="name" autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>}
        <label htmlFor="auth-email">Email<input id="auth-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label htmlFor="auth-password">Password<input id="auth-password" name="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : undefined} maxLength={PASSWORD_MAX_LENGTH} required value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} aria-describedby={mode === "signup" ? "auth-password-help" : undefined} /></label>
        {mode === "signup" && <small id="auth-password-help" className="auth-field-help">At least 8 characters, with a letter and a number.</small>}
        {mode === "signup" && <label htmlFor="auth-confirm-password">Confirm password<input id="auth-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }} /></label>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? mode === "signin" ? "Signing in…" : "Creating account…" : mode === "signin" ? "Sign in" : "Create account"}</button>
      </form>

      <p className="auth-switch">{mode === "signin" ? "New to IdeaForge?" : "Already have an account?"} <button type="button" disabled={busy} onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setConfirmPassword(""); setError(""); setMessage(""); }}>{mode === "signin" ? "Create account" : "Sign in"}</button></p>
      <Link className="auth-back" href="/">Back to home</Link>
    </section>
  </main>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18"><path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.24-.16-1.82H9v3.44h4.84a4.14 4.14 0 0 1-1.8 2.72v2.23h2.92c1.71-1.58 2.68-3.9 2.68-6.57Z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.23c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.3A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.97 10.76a5.4 5.4 0 0 1 0-3.52v-2.3H.96a9 9 0 0 0 0 8.12l3.01-2.3Z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.43 1.36L15 2.37A8.6 8.6 0 0 0 9 0 9 9 0 0 0 .96 4.94l3.01 2.3C4.68 5.12 6.66 3.58 9 3.58Z"/></svg>;
}
