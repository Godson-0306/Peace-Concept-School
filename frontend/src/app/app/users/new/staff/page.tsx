"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";

type CreatedStaff = {
  id: number;
  full_name: string;
  username?: string;
  temporary_password?: string;
  user?: { username?: string; email?: string; account_type?: string };
};

export default function UsersNewStaffPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<CreatedStaff | null>(null);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (stored && stored.account_type !== "admin") {
      router.replace("/app/users");
    }
  }, [router]);

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (user?.account_type !== "admin") return;
    setPending(true);
    setMessage("");
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiJson<CreatedStaff>("/api/staff/", {
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
        result.username ?? result.user?.username ?? String(data.get("username"));
      setCreated({ ...result, username });
      setMessage(
        `Staff created — username: ${username}` +
          (result.temporary_password
            ? ` — temp password: ${result.temporary_password}`
            : ""),
      );
      event.currentTarget.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create staff");
    } finally {
      setPending(false);
    }
  }

  if (user && user.account_type !== "admin") {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Users · New User
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            Staff created
          </h1>
        </header>
        <div className="rounded-2xl border border-[var(--line)] bg-white/90 p-6">
          <p className="text-base text-[var(--ink)]">
            <span className="font-semibold">{created.full_name}</span> can sign in
            with their username (not email).
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Username
              </dt>
              <dd className="mt-1 font-display text-2xl text-[var(--brand-blue-deep)]">
                {created.username}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Temporary password
              </dt>
              <dd className="mt-1 font-display text-2xl text-[var(--brand-blue-deep)]">
                {created.temporary_password || "Set by admin"}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/app/users/staff"
              className="rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-bold text-white"
            >
              View Staff
            </Link>
            <button
              type="button"
              className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
              onClick={() => {
                setCreated(null);
                setMessage("");
              }}
            >
              Add another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Users · New User
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            New Staff
          </h1>
          <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
            Create a staff account. They will sign in with the username you set
            here — email cannot be used for login.
          </p>
        </div>
        <Link
          href="/app/users/staff"
          className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
        >
          View Staff
        </Link>
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

      <form
        onSubmit={createStaff}
        className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:grid-cols-2 sm:p-6"
      >
        <label className="field sm:col-span-2">
          <span>Full name</span>
          <input name="full_name" required className="field-input" />
        </label>
        <label className="field">
          <span>Username</span>
          <input
            name="username"
            required
            autoComplete="off"
            className="field-input"
            placeholder="e.g. teacher1"
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required className="field-input" />
        </label>
        <label className="field">
          <span>Role</span>
          <select name="account_type" className="field-input" defaultValue="teacher">
            <option value="teacher">Teacher</option>
            <option value="principal">Principal</option>
            <option value="accountant">Accountant</option>
            <option value="store_staff">Store / Sales</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="field">
          <span>Phone</span>
          <input name="phone_number" className="field-input" />
        </label>
        <label className="field">
          <span>Gender</span>
          <select name="gender" className="field-input" defaultValue="Female">
            <option>Female</option>
            <option>Male</option>
          </select>
        </label>
        <p className="text-sm text-[var(--muted)] sm:col-span-2">
          A temporary password is generated automatically if you leave password
          blank on the server.
        </p>
        <button type="submit" className="btn-primary sm:col-span-2" disabled={pending}>
          {pending ? "Creating…" : "Create staff account"}
        </button>
      </form>

      <style jsx global>{`
        .field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .field span {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--muted);
        }
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
