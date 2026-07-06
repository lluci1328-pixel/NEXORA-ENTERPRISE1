import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { APP_NAME } from "@/lib/constants";
import { Sparkles, Bot, ShieldCheck, BarChart3, Workflow } from "lucide-react";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  const highlights = [
    { icon: Bot, title: "10 specialized AI agents", text: "Reception, Sales, Voice, Follow-up and more — working together." },
    { icon: Workflow, title: "Production workflows", text: "Omnichannel automation from first message to closed deal." },
    { icon: BarChart3, title: "Real-time analytics", text: "Revenue, conversions and AI performance at a glance." },
    { icon: ShieldCheck, title: "Enterprise isolation", text: "Every business fully segregated — data never crosses tenants." },
  ];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / value panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0b1f45] via-[#12336e] to-[#1d4ed8] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(600px 300px at 80% 10%, rgba(14,165,233,0.35), transparent 60%), radial-gradient(500px 260px at 10% 90%, rgba(124,58,237,0.25), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
            <Sparkles size={22} />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight text-white">{APP_NAME}</p>
            <p className="text-xs font-medium uppercase tracking-widest text-white/60">
              Enterprise AI Automation
            </p>
          </div>
        </div>

        <div className="relative">
          <h1 className="max-w-md text-3xl font-bold leading-tight text-white">
            Run every business on one intelligent platform.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
            AI agents that talk to customers, qualify leads, book appointments and keep your CRM
            perfect — across WhatsApp, web, voice and more.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {highlights.map((h) => (
              <div key={h.title} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <h.icon size={18} className="text-sky-300" />
                <p className="mt-2 text-sm font-semibold text-white">{h.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/60">{h.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} {APP_NAME}. Enterprise-grade multi-tenant platform.
        </p>
      </div>

      {/* Login form */}
      <div className="flex items-center justify-center bg-canvas px-6 py-12">
        <div className="w-full max-w-sm rise-in">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white">
              <Sparkles size={22} />
            </div>
            <p className="text-xl font-bold text-text">{APP_NAME}</p>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-text">Welcome back</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in to your command center to continue.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>

          <div className="mt-6 rounded-xl border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold text-text-secondary">Demo access</p>
            <p className="mt-1 text-xs text-text-muted">
              Platform owner:{" "}
              <span className="font-mono text-text">owner@nexora.app</span>
              <br />
              Password: <span className="font-mono text-text">Nexora@2026</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
