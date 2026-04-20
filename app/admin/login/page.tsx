"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2, LogIn } from "lucide-react";
import { toast } from "react-hot-toast";
import { createScopedLogger } from "@/lib/logger";
import { fetchAdminSession } from "@/lib/admin-client";

const logger = createScopedLogger("admin-login");

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const session = await fetchAdminSession();
        if (!cancelled && session.authenticated) {
          router.replace("/admin/dashboard");
          return;
        }
      } catch (error) {
        logger.warn("Admin session check failed:", error);
      } finally {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, remember }),
      });

      const data = await response.json().catch(() => ({ error: "Invalid server response" }));

      if (!response.ok) {
        toast.error(data.error || "Login failed");
        return;
      }

      toast.success(`Welcome back, ${data.user?.username || "admin"}`);
      router.replace("/admin/dashboard");
    } catch (error) {
      logger.error("Admin login failed:", error);
      toast.error("Unable to sign in right now");
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin" />
          Checking admin session...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 border border-cyan-400/20">
            <Shield className="w-6 h-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Admin Login</h1>
            <p className="text-sm text-slate-400">Secure access to AnimeVerse operations</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none focus:border-cyan-400/50"
              placeholder="Enter admin username"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none focus:border-cyan-400/50"
              placeholder="Enter admin password"
              required
            />
          </label>

          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-slate-950"
            />
            Keep me signed in for 7 days
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-cyan-500 text-slate-950 font-semibold px-4 py-3 hover:bg-cyan-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {submitting ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
