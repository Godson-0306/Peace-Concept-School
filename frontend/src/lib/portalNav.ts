import type { AccountType } from "@/lib/auth";

export type PortalNavItem = {
  href: string;
  label: string;
};

export const STAFF_PORTAL_NAV: PortalNavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/gallery", label: "Gallery" },
  { href: "/app/news", label: "News" },
  { href: "/app/users", label: "Users" },
  { href: "/app/admission", label: "Admission" },
  { href: "/app/assessments", label: "Assessments" },
  { href: "/app/results", label: "Results" },
  { href: "/app/accounts", label: "Accounts" },
  { href: "/app/inventory", label: "Inventory" },
  { href: "/app/attendance", label: "Attendance" },
  { href: "/app/reports", label: "Reports" },
];

const STUDENT_HREFS = new Set([
  "/app",
  "/app/results",
  "/app/attendance",
]);

const SETTINGS_ROLES = new Set<AccountType>(["admin", "principal"]);
const ADMIN_ONLY_HREFS = new Set(["/app/gallery", "/app/news"]);

export function portalNavFor(accountType: AccountType | null | undefined): PortalNavItem[] {
  if (accountType === "student") {
    return STAFF_PORTAL_NAV.filter((item) => STUDENT_HREFS.has(item.href));
  }

  let links = STAFF_PORTAL_NAV;
  if (!accountType || !SETTINGS_ROLES.has(accountType)) {
    links = links.filter((item) => item.href !== "/app/settings");
  }
  if (accountType !== "admin") {
    links = links.filter((item) => !ADMIN_ONLY_HREFS.has(item.href));
  }
  return links;
}

export function isPortalNavActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}
