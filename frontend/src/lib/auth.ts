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
  return "admin";
}

const USER_KEY = "pcs_user";
export const AUTH_COOKIE = "pcs_session";

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function dashboardPathFor(_accountType?: AccountType): string {
  return "/app";
}
