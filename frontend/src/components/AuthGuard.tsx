"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { clearUser, storeUser, type AuthUser } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiJson<AuthUser>("/api/auth/me/")
      .then((me) => {
        if (cancelled) return;
        storeUser(me);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        clearUser();
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-[var(--muted)]">
        Checking session...
      </div>
    );
  }

  return <>{children}</>;
}
