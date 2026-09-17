"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ nextPath }: { nextPath: string }) {
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
      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Continue"}
      </button>
    </form>
  );
}
