"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ nextPath, requirePassword }: { nextPath: string; requirePassword: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await loginAction(formData);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="next" value={nextPath} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      {requirePassword ? (
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
      ) : null}
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Signing in..." : requirePassword ? "Sign in" : "Continue"}
      </button>
    </form>
  );
}
