import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <div className="card" style={{ width: "min(420px, 100%)" }}>
        <h1 style={{ marginTop: 0 }}>Sign in</h1>
        <p style={{ color: "var(--text-muted)" }}>
          Enter your email to access the billing application. Development sign-in provisions a local user record.
        </p>
        <LoginForm nextPath={searchParams.next ?? "/overview"} />
      </div>
    </main>
  );
}
