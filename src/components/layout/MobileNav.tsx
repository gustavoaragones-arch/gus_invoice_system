"use client";

import Link from "next/link";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview" },
  { href: "/clients", label: "Clients" },
  { href: "/services", label: "Services" },
  { href: "/invoices", label: "Invoices" },
];

export function MobileNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="mobile-only app-nav" aria-label="Mobile navigation">
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={currentPath.startsWith(item.href) ? "active" : ""}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
