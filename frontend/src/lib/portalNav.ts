import type { AccountType } from "@/lib/auth";

export type PortalNavItem = {
  href: string;
  label: string;
  children?: PortalNavItem[];
};

const NEW_USER_NAV: PortalNavItem = {
  href: "/app/users/new",
  label: "New User",
  children: [
    { href: "/app/users/new/student", label: "New Student" },
    { href: "/app/users/new/staff", label: "New Staff" },
  ],
};

export const STAFF_PORTAL_NAV: PortalNavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/password", label: "Password" },
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
      NEW_USER_NAV,
      { href: "/app/users", label: "All Students" },
      { href: "/app/users/ex-students", label: "Ex-Students" },
      // Class levels injected at runtime between Ex-Students and Staff
      { href: "/app/users/staff", label: "Staff" },
    ],
  },
  { href: "/app/admission", label: "Admission" },
  { href: "/app/assessments", label: "Assessments" },
  {
    href: "/app/results",
    label: "Results",
    children: [
      { href: "/app/results/subject-results", label: "Subject Results" },
      { href: "/app/results/form-class", label: "Form Class" },
      { href: "/app/results/general-report-sheet", label: "General Report Sheet" },
    ],
  },
  { href: "/app/accounts", label: "Accounts" },
  { href: "/app/inventory", label: "Inventory" },
  { href: "/app/attendance", label: "Attendance" },
  { href: "/app/reports", label: "Reports" },
];

const STUDENT_HREFS = new Set([
  "/app",
  "/app/results",
  "/app/attendance",
  "/app/assessments",
]);

const PARENT_NAV: PortalNavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/parent", label: "My Children" },
  { href: "/app/assessments", label: "Assessments" },
  { href: "/app/password", label: "Password" },
];

const SETTINGS_ROLES = new Set<AccountType>(["admin", "principal"]);
const ADMIN_ONLY_HREFS = new Set(["/app/gallery", "/app/news"]);
const USERS_ROLES = new Set<AccountType>(["admin", "principal"]);
const ADMISSION_ROLES = new Set<AccountType>(["admin", "principal"]);
const ACCOUNTS_ROLES = new Set<AccountType>(["admin", "accountant"]);
const INVENTORY_ROLES = new Set<AccountType>(["admin", "accountant", "store", "store_staff"]);
const REPORTS_ROLES = new Set<AccountType>(["admin", "principal"]);
const RESULTS_STAFF_ROLES = new Set<AccountType>(["admin", "principal", "teacher"]);
export const GENERAL_REPORT_ROLES = new Set<AccountType>(["admin", "principal"]);
const ASSESSMENTS_ROLES = new Set<AccountType>([
  "admin",
  "principal",
  "teacher",
  "student",
  "parent",
]);

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

function newUserNavFor(accountType: AccountType | null | undefined): PortalNavItem {
  const children =
    accountType === "admin"
      ? NEW_USER_NAV.children
      : (NEW_USER_NAV.children ?? []).filter(
          (child) => child.href !== "/app/users/new/staff",
        );
  return { ...NEW_USER_NAV, children };
}

export function withUsersClassLevels(
  links: PortalNavItem[],
  levels: ClassLevelNav[],
  accountType?: AccountType | null,
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
        newUserNavFor(accountType),
        { href: "/app/users", label: "All Students" },
        { href: "/app/users/ex-students", label: "Ex-Students" },
        ...classChildren,
        { href: "/app/users/staff", label: "Staff" },
      ],
    };
  });
}

export function portalNavFor(
  accountType: AccountType | null | undefined,
  options?: { isFormTeacher?: boolean },
): PortalNavItem[] {
  if (accountType === "student") {
    // Students see a flat Results link (their fee-gated view), not staff tools.
    return STAFF_PORTAL_NAV.filter((item) => STUDENT_HREFS.has(item.href)).map(
      (item) =>
        item.href === "/app/results"
          ? { href: "/app/results", label: "Results" }
          : item,
    );
  }

  if (accountType === "parent") {
    return PARENT_NAV;
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
  if (!accountType || !ACCOUNTS_ROLES.has(accountType)) {
    links = links.filter((item) => item.href !== "/app/accounts");
  }
  if (!accountType || !INVENTORY_ROLES.has(accountType)) {
    links = links.filter((item) => item.href !== "/app/inventory");
  }
  if (!accountType || !REPORTS_ROLES.has(accountType)) {
    links = links.filter((item) => item.href !== "/app/reports");
  }
  if (!accountType || !RESULTS_STAFF_ROLES.has(accountType)) {
    links = links.filter((item) => item.href !== "/app/results");
  } else if (!GENERAL_REPORT_ROLES.has(accountType)) {
    links = links.map((item) =>
      item.href === "/app/results" && item.children
        ? {
            ...item,
            children: item.children.filter(
              (child) => child.href !== "/app/results/general-report-sheet",
            ),
          }
        : item,
    );
  }
  const canSeeAttendance =
    accountType === "admin" ||
    accountType === "principal" ||
    accountType === "student" ||
    (accountType === "teacher" && Boolean(options?.isFormTeacher));
  if (!canSeeAttendance) {
    links = links.filter((item) => item.href !== "/app/attendance");
  }
  if (!accountType || !ASSESSMENTS_ROLES.has(accountType)) {
    links = links.filter((item) => item.href !== "/app/assessments");
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
    label: "Basic",
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
  if (href === "/app/users/new") {
    return pathname === "/app/users/new" || pathname.startsWith("/app/users/new/");
  }
  if (href === "/app/settings") {
    return pathname === "/app/settings" || pathname.startsWith("/app/settings/");
  }
  if (href === "/app/results") {
    return pathname === "/app/results" || pathname.startsWith("/app/results/");
  }
  if (href === "/app/parent") {
    return pathname === "/app/parent" || pathname.startsWith("/app/parent/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isExactPortalNavActive(pathname: string, href: string): boolean {
  if (href === "/app/users") return pathname === "/app/users";
  if (href === "/app/users/new") {
    return pathname === "/app/users/new" || pathname.startsWith("/app/users/new/");
  }
  if (href === "/app/settings") return pathname === "/app/settings";
  if (href === "/app/results") return pathname === "/app/results";
  if (href === "/app/results/subject-results") {
    return (
      pathname === href || pathname.startsWith("/app/results/subject-results/")
    );
  }
  if (href === "/app/attendance") {
    return pathname === href || pathname.startsWith("/app/attendance/");
  }
  if (href === "/app/results/general-report-sheet") {
    return (
      pathname === href || pathname.startsWith("/app/results/general-report-sheet/")
    );
  }
  return pathname === href;
}

/** Open parent groups (and nested groups) whose path matches the current route. */
export function collectOpenNavGroups(
  links: PortalNavItem[],
  pathname: string,
): Record<string, boolean> {
  const open: Record<string, boolean> = {};
  for (const link of links) {
    if (!link.children?.length) continue;
    if (isPortalNavActive(pathname, link.href)) {
      open[link.href] = true;
    }
    for (const child of link.children) {
      if (child.children?.length && isPortalNavActive(pathname, child.href)) {
        open[child.href] = true;
      }
    }
  }
  return open;
}
