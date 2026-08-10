"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";

type Staff = {
  id: number;
  full_name: string;
  phone_number?: string;
  username?: string;
  temporary_password?: string;
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const data = await apiJson<{ results?: Staff[] } | Staff[]>("/api/staff/");
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

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (user?.account_type !== "admin") return;
    setPending(true);
    setMessage("");
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const created = await apiJson<Staff>("/api/staff/", {
        method: "POST",
        body: JSON.stringify({
          full_name: data.get("full_name"),
          username: data.get("username"),
          email: data.get("email"),
          account_type: data.get("account_type"),
          gender: data.get("gender"),
          phone_number: data.get("phone_number"),
        }),
      });
      const username =
        created.username ?? created.user?.username ?? String(data.get("username"));
      setMessage(
        `Staff created — username: ${username}` +
          (created.temporary_password
            ? ` — temp password: ${created.temporary_password}`
            : ""),
      );
      event.currentTarget.reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create staff");
    } finally {
      setPending(false);
    }
  }

  if (user && user.account_type !== "admin" && user.account_type !== "principal") {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  const isAdmin = user?.account_type === "admin";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
          Users
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
          Staff
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
          Staff accounts for the management portal. Usernames are created at
          registration.
        </p>
      </header>

      {message ? (
        <p className="rounded-xl bg-[var(--brand-blue-wash)] px-4 py-3 text-sm text-[var(--brand-blue-deep)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <form
          onSubmit={createStaff}
          className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:grid-cols-2 sm:p-6"
        >
          <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)] sm:col-span-2">
            Create staff
          </h2>
          <input
            name="full_name"
            placeholder="Full name"
            required
            className="field-input"
          />
          <input
            name="username"
            placeholder="Username"
            required
            autoComplete="off"
            className="field-input"
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="field-input"
          />
          <select name="account_type" className="field-input" defaultValue="teacher">
            <option value="teacher">Teacher</option>
            <option value="principal">Principal</option>
            <option value="accountant">Accountant</option>
            <option value="store_staff">Store / Sales</option>
            <option value="admin">Admin</option>
          </select>
          <input name="phone_number" placeholder="Phone" className="field-input" />
          <select name="gender" className="field-input" defaultValue="Female">
            <option>Female</option>
            <option>Male</option>
          </select>
          <button
            type="submit"
            className="btn-primary sm:col-span-2"
            disabled={pending}
          >
            {pending ? "Creating…" : "Create staff account"}
          </button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/90">
        {staff.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--muted)]">No staff accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Username</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td className="px-5 py-3.5 font-semibold">{member.full_name}</td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {member.user?.username || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {member.user?.email || "—"}
                    </td>
                    <td className="px-5 py-3.5 capitalize text-[var(--muted)]">
                      {(member.user?.account_type || "").replace("_", " ")}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--muted)]">
                      {member.phone_number || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx global>{`
        .field-input {
          width: 100%;
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 0.65rem;
          padding: 0.65rem 0.75rem;
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  );
}
