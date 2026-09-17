"use client";

import { useTransition } from "react";
import { logoutAction } from "@/server/actions/auth";

export function LogoutButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn btn-secondary"
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => logoutAction())}
    >
      {pending ? "Signing out..." : "Sign out"}
    </button>
  );
}
