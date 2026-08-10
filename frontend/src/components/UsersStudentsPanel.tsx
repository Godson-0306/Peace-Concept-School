"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";

export type StudentRow = {
  id: number;
  student_id: string;
  full_name: string;
  gender: string;
  class_arm_label?: string;
  class_level_name?: string;
  guardian_phone: string;
  is_active: boolean;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

type UsersStudentsPanelProps = {
  title: string;
  description: string;
  query: string;
};

export default function UsersStudentsPanel({
  title,
  description,
  query,
}: UsersStudentsPanelProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const path = query ? `/api/students/?${query}` : "/api/students/";
      const data = await apiJson<{ results?: StudentRow[] } | StudentRow[]>(path);
      setStudents(unwrapList(data));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (
      stored &&
      stored.account_type !== "admin" &&
      stored.account_type !== "principal"
    ) {
      router.replace("/app");
      return;
    }
    load();
  }, [router, load]);

  if (user && user.account_type !== "admin" && user.account_type !== "principal") {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
          Users
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">{description}</p>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/90">
        {loading ? (
          <p className="px-5 py-8 text-sm text-[var(--muted)]">Loading students…</p>
        ) : students.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--muted)]">No students found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Student ID</th>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Class</th>
                  <th className="px-5 py-3 font-semibold">Gender</th>
                  <th className="px-5 py-3 font-semibold">Guardian phone</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="px-5 py-3.5 font-semibold">{student.student_id}</td>
                    <td className="px-5 py-3.5">{student.full_name}</td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {student.class_arm_label || student.class_level_name || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {student.gender || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {student.guardian_phone || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      {student.is_active ? (
                        <span className="font-semibold text-[var(--brand-blue)]">Active</span>
                      ) : (
                        <span className="font-semibold text-[var(--brand-pink)]">Ex-Student</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
