"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/auth";

export default function ResultsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (user?.account_type === "student") {
      router.replace("/app/student");
      return;
    }
    router.replace("/app/results/subject-results");
  }, [router]);

  return <p className="text-sm text-[var(--muted)]">Opening Results…</p>;
}
