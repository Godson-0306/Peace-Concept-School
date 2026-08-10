"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";

type Application = {
  id: number;
  student_full_name: string;
  applying_for_class: string;
  gender: string;
  date_of_birth: string | null;
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  father_name: string;
  mother_name: string;
  father_phone: string;
  mother_phone: string;
  father_whatsapp: string;
  mother_whatsapp: string;
  phone: string;
  whatsapp_phone: string;
  status: "new" | "reviewing" | "accepted" | "rejected";
  enrolled_student: number | null;
  enrolled_student_code: string;
  created_at: string;
};

type StatusFilter = "all" | Application["status"];

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function statusClasses(status: Application["status"]): string {
  switch (status) {
    case "accepted":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-[var(--brand-pink-wash)] text-[var(--brand-pink)]";
    case "reviewing":
      return "bg-amber-50 text-amber-800";
    default:
      return "bg-[var(--brand-blue-wash)] text-[var(--brand-blue)]";
  }
}

function contactFor(app: Application): string {
  return (
    app.father_whatsapp ||
    app.mother_whatsapp ||
    app.whatsapp_phone ||
    app.guardian_phone ||
    app.phone ||
    app.father_phone ||
    app.mother_phone ||
    "—"
  );
}

export default function AdmissionInboxPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const canAccess =
    user?.account_type === "admin" || user?.account_type === "principal";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{ results?: Application[] } | Application[]>(
        "/api/website/applications/",
      );
      setApplications(unwrapList(data));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
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
    }
  }, [router]);

  useEffect(() => {
    if (!canAccess) return;
    load();
  }, [canAccess, load]);

  const counts = useMemo(() => {
    const base = { all: applications.length, new: 0, reviewing: 0, accepted: 0, rejected: 0 };
    for (const app of applications) {
      base[app.status] += 1;
    }
    return base;
  }, [applications]);

  const visible = useMemo(
    () =>
      filter === "all"
        ? applications
        : applications.filter((app) => app.status === filter),
    [applications, filter],
  );

  async function markReviewing(id: number) {
    setPendingId(id);
    setMessage("");
    setError("");
    try {
      await apiJson(`/api/website/applications/${id}/review/`, { method: "POST" });
      setMessage("Marked as reviewing.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setPendingId(null);
    }
  }

  async function reject(id: number) {
    if (!confirm("Reject this admission application?")) return;
    setPendingId(id);
    setMessage("");
    setError("");
    try {
      await apiJson(`/api/website/applications/${id}/reject/`, { method: "POST" });
      setMessage("Application rejected.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reject application");
    } finally {
      setPendingId(null);
    }
  }

  if (user && !canAccess) {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Admission
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            Online admission requests
          </h1>
          <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
            Review applications from the public website. Accepting opens the official
            enrollment form with details prefilled.
          </p>
        </div>
        <Link
          href="/app/admission/enroll/new"
          className="rounded-lg bg-[var(--brand-blue)] px-4 py-2.5 text-sm font-bold text-white"
        >
          Manual enroll
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["new", "New"],
            ["reviewing", "Reviewing"],
            ["accepted", "Accepted"],
            ["rejected", "Rejected"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              filter === id
                ? "bg-[var(--brand-blue)] text-white"
                : "bg-[var(--mist)] text-[var(--ink)]"
            }`}
          >
            {label}
            <span className="ml-1 opacity-80">
              ({id === "all" ? counts.all : counts[id]})
            </span>
          </button>
        ))}
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--brand-blue-wash)] px-4 py-3 text-sm text-[var(--brand-blue)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/90">
        {loading ? (
          <p className="px-5 py-8 text-sm text-[var(--muted)]">Loading applications…</p>
        ) : visible.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--muted)]">No applications found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {visible.map((app) => (
                  <tr key={app.id} className="align-middle">
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--muted)]">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold">{app.student_full_name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {app.father_name || app.mother_name || app.guardian_name || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--muted)]">
                      {app.applying_for_class}
                    </td>
                    <td className="px-4 py-3.5 text-[var(--muted)]">
                      <p>{contactFor(app)}</p>
                      <p className="text-xs">{app.guardian_email || "—"}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${statusClasses(app.status)}`}
                      >
                        {app.status}
                      </span>
                      {app.enrolled_student_code ? (
                        <p className="mt-1 text-xs font-semibold text-[var(--brand-blue)]">
                          {app.enrolled_student_code}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        {app.status !== "accepted" ? (
                          <Link
                            href={`/app/admission/enroll/${app.id}`}
                            className="rounded-lg bg-[var(--brand-blue)] px-3 py-1.5 text-xs font-bold text-white"
                          >
                            Accept / Enroll
                          </Link>
                        ) : (
                          <Link
                            href={`/app/users`}
                            className="text-xs font-semibold text-[var(--brand-blue)] hover:underline"
                          >
                            View students
                          </Link>
                        )}
                        {app.status === "new" ? (
                          <button
                            type="button"
                            disabled={pendingId === app.id}
                            className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
                            onClick={() => markReviewing(app.id)}
                          >
                            Reviewing
                          </button>
                        ) : null}
                        {app.status !== "accepted" && app.status !== "rejected" ? (
                          <button
                            type="button"
                            disabled={pendingId === app.id}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--brand-pink)]"
                            onClick={() => reject(app.id)}
                          >
                            Reject
                          </button>
                        ) : null}
                      </div>
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
