"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Always start false so server HTML and the client's first paint match.
  // Session checks run only after mount (avoids hydration mismatches).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    const hasCookie = document.cookie
      .split(";")
      .some((part) => part.trim().startsWith("pcs_session="));

    if (!user && !hasCookie) {
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
