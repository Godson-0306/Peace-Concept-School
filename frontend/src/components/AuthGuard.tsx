"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiJson, prefetchCsrfToken } from "@/lib/api";
import { clearUser, getStoredUser, storeUser, type AuthUser } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(() =>
    typeof window === "undefined" ? null : getStoredUser(),
  );

  useEffect(() => {
    let cancelled = false;
    const existing = getStoredUser();
    if (existing) setUser(existing);
    prefetchCsrfToken().catch(() => undefined);
    apiJson<AuthUser>("/api/auth/me/")
      .then((me) => {
        if (cancelled) return;
        storeUser(me);
        setUser(me);
      })
      .catch(() => {
        if (cancelled) return;
        clearUser();
        setUser(null);
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      });
    return () => {
      cancelled = true;
    };
    // Authenticate once per layout mount — not on every /app route change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!user) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-[var(--muted)]">
        Checking session...
      </div>
    );
  }

  return <>{children}</>;
}
