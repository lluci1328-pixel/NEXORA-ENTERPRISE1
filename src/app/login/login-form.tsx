"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { loginAction } from "@/lib/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full py-2.5 disabled:opacity-60">
      {pending ? "Signing in…" : "Sign in"}
      {!pending && <ArrowRight size={16} />}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-xs font-medium text-danger">
          <AlertCircle size={15} />
          {state.error}
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-secondary">Email address</label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue="owner@nexora.app"
            placeholder="you@company.com"
            className="input pl-10"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-text-secondary">Password</label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            defaultValue="Nexora@2026"
            placeholder="••••••••"
            className="input pl-10"
          />
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
