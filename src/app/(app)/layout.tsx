import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BUSINESS_COOKIE } from "@/server/auth/session";
import { getServerAuthContext } from "@/server/auth/session";
import { listBusinesses } from "@/server/application/businessContext";
import { cookies } from "next/headers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let auth;
  try {
    auth = await getServerAuthContext();
  } catch {
    redirect("/login");
  }

  const businesses = await listBusinesses(auth);
  const cookieStore = await cookies();
  const headerStore = await headers();
  const selectedBusinessId = cookieStore.get(BUSINESS_COOKIE)?.value ?? businesses[0]?.id ?? null;
  const currentPath = headerStore.get("x-pathname") ?? "/overview";

  return (
    <AppShell
      currentPath={currentPath}
      businesses={businesses}
      selectedBusinessId={selectedBusinessId ?? businesses[0]?.id ?? null}
      userEmail={auth.email}
    >
      {children}
    </AppShell>
  );
}
