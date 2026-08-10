import type { AccountType } from "@/lib/auth";

export type PortalNavItem = {
  href: string;
  label: string;
  children?: PortalNavItem[];
};

export const STAFF_PORTAL_NAV: PortalNavItem[] = [
  { href: "/app", label: "Dashboard" },
  {
    href: "/app/settings",
    label: "Settings",
    children: [
      { href: "/app/settings/subjects", label: "Subjects Settings" },
      { href: "/app/settings/session", label: "Session" },
      { href: "/app/settings/terms", label: "Session Term" },
    ],
  },
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
const ADMISSION_ROLES = new Set<AccountType>(["admin", "principal"]);

export type ClassLevelNav = { id: number; name: string; order: number };

/** Canonical Users hierarchy class order (Day Care → SS3). */
export const CLASS_LEVEL_ORDER = [
  "Day Care",
  "Nursery 1",
  "Nursery 2",
  "Basic 1",
  "Basic 2",
  "Basic 3",
  "Basic 4",
  "Basic 5",
  "JSS1",
  "JSS2",
  "JSS3",
  "SS1",
  "SS2",
  "SS3",
] as const;

const CLASS_LEVEL_ALIASES: Record<string, string> = {
  SSS1: "SS1",
  SSS2: "SS2",
  SSS3: "SS3",
  "JSS 1": "JSS1",
  "JSS 2": "JSS2",
  "JSS 3": "JSS3",
  "SS 1": "SS1",
  "SS 2": "SS2",
  "SS 3": "SS3",
};

function normalizeLevelName(name: string): string {
  const trimmed = name.trim();
  return CLASS_LEVEL_ALIASES[trimmed] ?? trimmed;
}

export function sortClassLevelsForUsers(levels: ClassLevelNav[]): ClassLevelNav[] {
  const preferred = new Map<string, ClassLevelNav>();
  for (const level of levels) {
    const key = normalizeLevelName(level.name);
    const existing = preferred.get(key);
    // Prefer canonical names (SS1 over SSS1) when duplicates exist.
    if (!existing || level.name === key) {
      preferred.set(key, { ...level, name: key });
    }
  }

  const ordered: ClassLevelNav[] = [];
  for (const name of CLASS_LEVEL_ORDER) {
    const match = preferred.get(name);
    if (match) {
      ordered.push(match);
      preferred.delete(name);
    }
  }
  // Any unexpected levels last, by API order then name.
  const extras = [...preferred.values()].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
  return [...ordered, ...extras];
}

export function withUsersClassLevels(
  links: PortalNavItem[],
  levels: ClassLevelNav[],
): PortalNavItem[] {
  return links.map((link) => {
    if (link.href !== "/app/users" || !link.children) return link;
    const classChildren = sortClassLevelsForUsers(levels).map((level) => ({
      href: `/app/users/classes/${level.id}`,
      label: level.name,
    }));
    return {
      ...link,
      children: [
        { href: "/app/users", label: "All Students" },
        { href: "/app/users/ex-students", label: "Ex-Students" },
        ...classChildren,
        { href: "/app/users/staff", label: "Staff" },
      ],
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
  if (!accountType || !ADMISSION_ROLES.has(accountType)) {
    links = links.filter((item) => item.href !== "/app/admission");
  }
  return links;
}

/** Subject settings bands mapped to class-level names. */
export const SUBJECT_LEVEL_BANDS = [
  {
    id: "nursery",
    label: "Nursery",
    levels: ["Day Care", "Nursery 1", "Nursery 2"],
  },
  {
    id: "primary",
    label: "Primary",
    levels: ["Basic 1", "Basic 2", "Basic 3", "Basic 4", "Basic 5"],
  },
  {
    id: "junior",
    label: "Junior Secondary",
    levels: ["JSS1", "JSS2", "JSS3"],
  },
  {
    id: "senior",
    label: "Senior Secondary",
    levels: ["SS1", "SS2", "SS3"],
  },
] as const;

export function isPortalNavActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  if (href === "/app/users") {
    return pathname === "/app/users" || pathname.startsWith("/app/users/");
  }
  if (href === "/app/settings") {
    return pathname === "/app/settings" || pathname.startsWith("/app/settings/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isExactPortalNavActive(pathname: string, href: string): boolean {
  if (href === "/app/users") return pathname === "/app/users";
  if (href === "/app/settings") return pathname === "/app/settings";
  return pathname === href;
}
