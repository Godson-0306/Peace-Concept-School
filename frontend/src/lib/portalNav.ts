import type { AccountType } from "@/lib/auth";

export type PortalNavItem = {
  href: string;
  label: string;
  children?: PortalNavItem[];
};

export const STAFF_PORTAL_NAV: PortalNavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/gallery", label: "Gallery" },
  { href: "/app/news", label: "News" },
  {
    href: "/app/users",
    label: "Users",
    children: [
      { href: "/app/users", label: "All Students" },
      { href: "/app/users/ex-students", label: "Ex-Students" },
      // Class levels injected at runtime between Ex-Students and Staff
      { href: "/app/users/staff", label: "Staff" },
    ],
  },
  { href: "/app/admission", label: "Admission" },
  { href: "/app/assessments", label: "Assessments" },
  { href: "/app/results", label: "Results" },
  { href: "/app/accounts", label: "Accounts" },
  { href: "/app/inventory", label: "Inventory" },
  { href: "/app/attendance", label: "Attendance" },
  { href: "/app/reports", label: "Reports" },
];

const STUDENT_HREFS = new Set(["/app", "/app/results", "/app/attendance"]);

const SETTINGS_ROLES = new Set<AccountType>(["admin", "principal"]);
const ADMIN_ONLY_HREFS = new Set(["/app/gallery", "/app/news"]);
const USERS_ROLES = new Set<AccountType>(["admin", "principal"]);

export type ClassLevelNav = { id: number; name: string; order: number };

export function withUsersClassLevels(
  links: PortalNavItem[],
  levels: ClassLevelNav[],
): PortalNavItem[] {
  return links.map((link) => {
    if (link.href !== "/app/users" || !link.children) return link;
    const classChildren = levels.map((level) => ({
      href: `/app/users/classes/${level.id}`,
      label: level.name,
    }));
    const head = link.children.filter(
      (child) =>
        child.href === "/app/users" || child.href === "/app/users/ex-students",
    );
    const staff = link.children.filter((child) => child.href === "/app/users/staff");
    return {
      ...link,
      children: [...head, ...classChildren, ...staff],
    };
  });
}

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
  if (!accountType || !USERS_ROLES.has(accountType)) {
    links = links.filter((item) => item.href !== "/app/users");
  }
  return links;
}

export function isPortalNavActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  if (href === "/app/users") {
    return pathname === "/app/users" || pathname.startsWith("/app/users/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isExactPortalNavActive(pathname: string, href: string): boolean {
  if (href === "/app/users") return pathname === "/app/users";
  return pathname === href;
}
