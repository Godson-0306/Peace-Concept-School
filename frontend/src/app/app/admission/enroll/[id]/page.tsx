"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Legacy enroll URLs redirect to Users → New Student. */
export default function AdmissionEnrollRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = String(params.id || "");

  useEffect(() => {
    if (!rawId || rawId === "new") {
      router.replace("/app/users/new/student");
      return;
    }
    router.replace(`/app/users/new/student?application=${encodeURIComponent(rawId)}`);
  }, [rawId, router]);

  return <p className="text-sm text-[var(--muted)]">Opening New Student…</p>;
}
