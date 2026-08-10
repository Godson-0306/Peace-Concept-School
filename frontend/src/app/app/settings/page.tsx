"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/settings/subjects");
  }, [router]);

  return <p className="text-sm text-[var(--muted)]">Opening Settings…</p>;
}
