export type AccountType =
  | "admin"
  | "principal"
  | "teacher"
  | "accountant"
  | "student"
  | "parent"
  | "store"
  | "store_staff";

export type AuthUser = {
  id?: number | string;
  email: string;
  full_name?: string;
  account_type: AccountType;
};

export function normalizeAccountType(value: unknown): AccountType {
  if (value === "store_staff") return "store";
  const allowed: AccountType[] = [
    "admin",
    "principal",
    "teacher",
    "accountant",
    "student",
    "parent",
    "store",
  ];
  if (typeof value === "string" && allowed.includes(value as AccountType)) {
    return value as AccountType;
  }
  // Least privilege — never elevate unknown types to admin.
  return "teacher";
}

const USER_KEY = "pcs_user";
export const AUTH_COOKIE = "pcs_session";
export const USER_COOKIE = "pcs_user";

function readUserCookie(): AuthUser | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${USER_COOKIE}=`));
  if (!match) return null;
  const raw = decodeURIComponent(match.slice(USER_COOKIE.length + 1));
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw) as AuthUser;
  } catch {
    /* fall through to cookie */
  }
  const fromCookie = readUserCookie();
  if (fromCookie) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(fromCookie));
    } catch {
      /* ignore quota / private mode */
    }
  }
  return fromCookie;
}

export function storeUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  document.cookie = `${USER_COOKIE}=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${USER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function dashboardPathFor(_accountType?: AccountType): string {
  return "/app";
}
