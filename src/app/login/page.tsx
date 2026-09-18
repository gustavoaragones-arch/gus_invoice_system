import { LoginForm } from "@/components/auth/LoginForm";
import { getAuthProviderMode, type AuthProviderMode } from "@/server/config/runtime";

function resolveMode(): AuthProviderMode | null {
  try {
    return getAuthProviderMode();
  } catch {
    return null;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const mode = resolveMode();

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <div className="card" style={{ width: "min(420px, 100%)" }}>
        <h1 style={{ marginTop: 0 }}>Sign in</h1>
        {mode === null ? (
          <div className="alert alert-error" role="alert">
            Authentication is not configured. Contact the administrator.
          </div>
        ) : (
          <>
            <p style={{ color: "var(--text-muted)" }}>
              {mode === "supabase"
                ? "Sign in with your email and password."
                : "Development sign-in: enter an email to provision a local user. Not available in production."}
            </p>
            <LoginForm nextPath={typeof next === "string" ? next : "/overview"} requirePassword={mode === "supabase"} />
          </>
        )}
      </div>
    </main>
  );
}
