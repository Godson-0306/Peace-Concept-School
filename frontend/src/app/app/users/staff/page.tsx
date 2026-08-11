"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";

type Staff = {
  id: number;
  full_name: string;
  gender?: string;
  user?: {
    email: string;
    username?: string;
    account_type: string;
  };
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function UsersStaffPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const data = await apiJson<{ results?: Staff[] } | Staff[]>(
      "/api/staff/?page_size=500",
    );
    setStaff(unwrapList(data));
  }, []);

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
    load().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load staff"),
    );
  }, [router, load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = [...staff].sort((a, b) =>
      a.full_name.localeCompare(b.full_name),
    );
    if (!q) return rows;
    return rows.filter(
      (member) =>
        member.full_name.toLowerCase().includes(q) ||
        (member.user?.username || "").toLowerCase().includes(q),
    );
  }, [staff, search]);

  if (user && user.account_type !== "admin" && user.account_type !== "principal") {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  const isAdmin = user?.account_type === "admin";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Users
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            Staff
          </h1>
          <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
            Staff directory. Open Edit to complete each profile.
          </p>
        </div>
        {isAdmin ? (
          <Link
            href="/app/users/new/staff"
            className="rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-bold text-white"
          >
            New Staff
          </Link>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">
          {visible.length} staff
          {search.trim() ? ` matching “${search.trim()}”` : ""}
        </p>
        <label className="flex items-center gap-2 text-sm">
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or username"
            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm outline-none focus:border-[var(--brand-blue)]"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/90">
        {visible.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--muted)]">No staff accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Username</th>
                  <th className="px-5 py-3 font-semibold">Gender</th>
                  {isAdmin ? (
                    <th className="px-5 py-3 font-semibold">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {visible.map((member) => (
                  <tr key={member.id}>
                    <td className="px-5 py-3.5 font-semibold">{member.full_name}</td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {member.user?.username || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {member.gender || "—"}
                    </td>
                    {isAdmin ? (
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/app/users/new/staff?id=${member.id}`}
                          className="text-sm font-semibold text-[var(--brand-blue)] hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    ) : null}
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
