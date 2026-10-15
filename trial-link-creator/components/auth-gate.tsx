"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError, getToken, setToken } from "@/lib/api";
import { apiBaseUrl, googleClientId } from "@/lib/config";
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (r: { credential: string }) => void }): void;
          renderButton(el: HTMLElement, options: Record<string, unknown>): void;
        };
      };
    };
  }
}
type Me = { email: string; isAdmin: boolean };
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google sign-in."));
    document.head.append(script);
  });
}
// Everything in this tool is admin-only. Sign-in is the app's own Google
// sign-in; the API decides who is an admin (users.is_admin).
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"checking" | "signed-out" | "ready">("checking");
  const [error, setError] = useState("");
  const slot = useRef<HTMLDivElement>(null);
  const accept = (user: Me) => {
    if (!user.isAdmin) {
      setToken("");
      setError(`${user.email} is not an admin.`);
      setState("signed-out");
      return;
    }
    setMe(user);
    setState("ready");
  };
  useEffect(() => {
    if (!getToken()) return setState("signed-out");
    api<Me>("/v1/me")
      .then(accept)
      .catch((e: ApiError) => {
        if (e.status === 401) setToken("");
        else setError(e.message);
        setState("signed-out");
      });
  }, []);
  useEffect(() => {
    if (state !== "signed-out" || !slot.current || !googleClientId) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !slot.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: ({ credential }) => {
            setError("");
            api<{ token: string; user: Me }>("/v1/auth/google", { method: "POST", body: { idToken: credential } })
              .then(({ token, user }) => {
                setToken(token);
                accept(user);
              })
              .catch((e: Error) => setError(e.message));
          },
        });
        window.google.accounts.id.renderButton(slot.current, { theme: "outline", size: "large", text: "continue_with" });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [state]);
  if (!apiBaseUrl || !googleClientId)
    return (
      <main className="page narrow">
        <h1>Not configured</h1>
        <p className="muted">
          Copy <code>.env.example</code> to <code>.env.local</code>, fill it in and restart.
        </p>
      </main>
    );
  if (state === "checking") return <main className="page narrow muted">Loading…</main>;
  if (state === "signed-out")
    return (
      <main className="page narrow">
        <h1>Trial links</h1>
        <p className="muted">Internal tool. Sign in with a ShortMonk admin account.</p>
        <div ref={slot} className="google-slot" />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </main>
    );
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">
          Trial links
        </Link>
        <span className="muted">{me?.email}</span>
        <button
          className="ghost"
          onClick={() => {
            void api("/v1/logout", { method: "POST" }).catch(() => {});
            setToken("");
            setMe(null);
            setState("signed-out");
          }}
        >
          Sign out
        </button>
      </header>
      {children}
    </>
  );
}
