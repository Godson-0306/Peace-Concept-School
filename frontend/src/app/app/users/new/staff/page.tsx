"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";

type StaffRecord = {
  id: number;
  full_name: string;
  username?: string;
  temporary_password?: string;
  phone_number?: string;
  gender?: string;
  user?: { username?: string; email?: string; account_type?: string };
};

function UsersNewStaffInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffRaw = searchParams.get("id");
  const staffId = staffRaw ? Number(staffRaw) : null;
  const isEdit = Boolean(staffId && !Number.isNaN(staffId));

  const [user, setUser] = useState<AuthUser | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [created, setCreated] = useState<StaffRecord | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState("teacher");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("Female");
  const [password, setPassword] = useState("school");

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (stored && stored.account_type !== "admin") {
      router.replace("/app/users");
    }
  }, [router]);

  useEffect(() => {
    if (!isEdit || !staffId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const staff = await apiJson<StaffRecord>(`/api/staff/${staffId}/`);
        if (cancelled) return;
        setFullName(staff.full_name || "");
        setUsername(staff.user?.username || staff.username || "");
        setEmail(staff.user?.email || "");
        setAccountType(staff.user?.account_type || "teacher");
        setPhone(staff.phone_number || "");
        setGender(staff.gender || "Female");
        setPassword("school");
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load staff");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, staffId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (user?.account_type !== "admin") return;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const body: Record<string, string> = {
        full_name: fullName,
        email,
        account_type: accountType,
        gender,
        phone_number: phone,
      };
      if (!isEdit) {
        body.username = username;
        body.password = password.trim() || "school";
      } else if (password.trim()) {
        body.password = password.trim();
      }

      const result = await apiJson<StaffRecord>(
        isEdit ? `/api/staff/${staffId}/` : "/api/staff/",
        {
          method: isEdit ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      const savedUsername =
        result.username ?? result.user?.username ?? username;
      setCreated({ ...result, username: savedUsername });
      setMessage(
        isEdit
          ? `Updated ${result.full_name}.`
          : `Staff created — username: ${savedUsername}` +
              (result.temporary_password
                ? ` — password: ${result.temporary_password}`
                : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save staff");
    } finally {
      setPending(false);
    }
  }

  if (user && user.account_type !== "admin") {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading staff form…</p>;
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Users · {isEdit ? "Edit" : "New User"}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            {isEdit ? "Staff updated" : "Staff created"}
          </h1>
        </header>
        <div className="rounded-2xl border border-[var(--line)] bg-white/90 p-6">
          <p className="text-base text-[var(--ink)]">
            <span className="font-semibold">{created.full_name}</span>{" "}
            {isEdit ? "was saved." : "can sign in with their username (not email)."}
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
            {created.temporary_password ? (
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                  Portal password
                </dt>
                <dd className="mt-1 font-display text-2xl text-[var(--brand-blue-deep)]">
                  {created.temporary_password}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/app/users/staff"
              className="rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-bold text-white"
            >
              View Staff
            </Link>
            {!isEdit ? (
              <button
                type="button"
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                onClick={() => {
                  setCreated(null);
                  setFullName("");
                  setUsername("");
                  setEmail("");
                  setAccountType("teacher");
                  setPhone("");
                  setGender("Female");
                  setPassword("school");
                  setMessage("");
                }}
              >
                Add another
              </button>
            ) : null}
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
            Users · {isEdit ? "Edit" : "New User"}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            {isEdit ? "Edit Staff" : "New Staff"}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
            {isEdit
              ? "Update staff details. Username cannot be changed."
              : "Create a staff account. They sign in with username — email cannot be used for login."}
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
        onSubmit={onSubmit}
        className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:grid-cols-2 sm:p-6"
      >
        <label className="field sm:col-span-2">
          <span>Full name</span>
          <input
            required
            className="field-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Username</span>
          <input
            required={!isEdit}
            readOnly={isEdit}
            autoComplete="off"
            className={`field-input ${isEdit ? "bg-[var(--mist)]" : ""}`}
            placeholder="e.g. teacher1"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Role</span>
          <select
            className="field-input"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
          >
            <option value="teacher">Teacher</option>
            <option value="principal">Principal</option>
            <option value="accountant">Accountant</option>
            <option value="store_staff">Store / Sales</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="field">
          <span>Phone</span>
          <input
            className="field-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Gender</span>
          <select
            className="field-input"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option>Female</option>
            <option>Male</option>
          </select>
        </label>
        <label className="field sm:col-span-2">
          <span>{isEdit ? "Reset portal password" : "Portal password"}</span>
          <input
            className="field-input"
            type="text"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? "Clear to keep current password" : "school"}
          />
        </label>
        <p className="text-sm text-[var(--muted)] sm:col-span-2">
          {isEdit
            ? "Prefilled with school. Clear the field to leave the current password unchanged."
            : "Defaults to school. Change it before saving if needed."}
        </p>
        <button type="submit" className="btn-primary sm:col-span-2" disabled={pending}>
          {pending
            ? "Saving…"
            : isEdit
              ? "Save staff changes"
              : "Create staff account"}
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

export default function UsersNewStaffPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <UsersNewStaffInner />
    </Suspense>
  );
}
