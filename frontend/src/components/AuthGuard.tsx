"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth";

function hasPortalSession(): boolean {
  if (typeof window === "undefined") return false;
  const user = getStoredUser();
  const hasCookie = document.cookie
    .split(";")
    .some((part) => part.trim().startsWith("pcs_session="));
  return Boolean(user || hasCookie);
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Sync check avoids a full "Checking session..." paint on every /app load.
  const [ready, setReady] = useState(hasPortalSession);

  useEffect(() => {
    if (!hasPortalSession()) {
      setReady(false);
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReady(true);
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
