import Link from "next/link";
import { BusinessSelector } from "./BusinessSelector";
import { MobileNav } from "./MobileNav";
import { LogoutButton } from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview" },
  { href: "/clients", label: "Clients" },
  { href: "/services", label: "Services" },
  { href: "/invoices", label: "Invoices" },
  { href: "/reports", label: "Reports" },
  { href: "/calendar", label: "Calendar" },
];

export function AppShell({
  children,
  currentPath,
  businesses,
  selectedBusinessId,
  userEmail,
}: {
  children: React.ReactNode;
  currentPath: string;
  businesses: Array<{ id: string; name: string }>;
  selectedBusinessId: string | null;
  userEmail: string;
}) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Primary navigation">
        <div className="app-brand">Canadian Billing</div>
        <nav className="app-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={currentPath.startsWith(item.href) ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="stack" style={{ gap: "0.5rem" }}>
            <MobileNav currentPath={currentPath} />
            <BusinessSelector businesses={businesses} selectedBusinessId={selectedBusinessId} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>{userEmail}</span>
            <LogoutButton />
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
