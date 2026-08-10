"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

type Student = {
  id: number;
  student_id: string;
  full_name: string;
  class_arm_label?: string;
  temporary_password?: string;
};

type Staff = {
  id: number;
  full_name: string;
  username?: string;
  user?: { email: string; username?: string; account_type: string };
  temporary_password?: string;
};

type Lead = {
  id: number;
  full_name?: string;
  student_full_name?: string;
  email?: string;
  guardian_email?: string;
  status: string;
  created_at: string;
};

type ClassArm = { id: number; label: string };

function Panel({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-sm border border-[var(--line)] bg-white/80 p-5 shadow-sm"
    >
      <h2 className="font-display text-2xl text-[var(--brand-green)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AdminPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [enquiries, setEnquiries] = useState<Lead[]>([]);
  const [applications, setApplications] = useState<Lead[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [st, sf, en, ap, ar] = await Promise.all([
        apiJson<{ results?: Student[] } | Student[]>("/api/students/"),
        apiJson<{ results?: Staff[] } | Staff[]>("/api/staff/"),
        apiJson<{ results?: Lead[] } | Lead[]>("/api/website/enquiries/"),
        apiJson<{ results?: Lead[] } | Lead[]>("/api/website/applications/"),
        apiJson<{ results?: ClassArm[] } | ClassArm[]>("/api/class-arms/"),
      ]);
      setStudents(Array.isArray(st) ? st : st.results ?? []);
      setStaff(Array.isArray(sf) ? sf : sf.results ?? []);
      setEnquiries(Array.isArray(en) ? en : en.results ?? []);
      setApplications(Array.isArray(ap) ? ap : ap.results ?? []);
      setArms(Array.isArray(ar) ? ar : ar.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load admin data");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const created = await apiJson<Student>("/api/students/", {
        method: "POST",
        body: JSON.stringify({
          full_name: data.get("full_name"),
          gender: data.get("gender"),
          admission_year: Number(data.get("admission_year")),
          class_arm: Number(data.get("class_arm")),
          guardian_name: data.get("guardian_name"),
          guardian_email: data.get("guardian_email"),
          guardian_phone: data.get("guardian_phone"),
          email: data.get("email") || undefined,
          create_portal_account: true,
        }),
      });
      setMessage(
        `Student created — Student ID: ${created.student_id}` +
          (created.temporary_password
            ? ` — temp password: ${created.temporary_password}`
            : ""),
      );
      event.currentTarget.reset();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create student");
    }
  }

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const role = String(data.get("account_type") || "teacher");
      const isFormTeacher = role === "form_teacher";
      const created = await apiJson<Staff>("/api/staff/", {
        method: "POST",
        body: JSON.stringify({
          full_name: data.get("full_name"),
          username: data.get("username"),
          email: data.get("email"),
          account_type: isFormTeacher ? "teacher" : role,
          gender: data.get("gender"),
          phone_number: data.get("phone_number"),
        }),
      });
      const username = created.username ?? created.user?.username ?? String(data.get("username"));
      setMessage(
        `Staff created — username: ${username}` +
          (created.temporary_password
            ? ` — temp password: ${created.temporary_password}`
            : "") +
          (isFormTeacher
            ? " — use Users → New Staff to assign Form Class and subjects."
            : ""),
      );
      event.currentTarget.reset();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create staff");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          Admin
        </p>
        <h1 className="font-display text-4xl text-[var(--brand-green)]">
          School administration
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-soft)]">
          Create staff and student accounts, review admission leads, and manage
          day-to-day operations. Portal accounts are provisioned here only — no
          public signup.
        </p>
      </header>

      {message ? (
        <p className="rounded-sm bg-[rgba(20,80,163,0.08)] px-4 py-3 text-sm text-[var(--brand-green)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-sm bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Panel id="students" title="Create student">
        <form
          onSubmit={createStudent}
          className="grid gap-3 md:grid-cols-2"
        >
          <input name="full_name" placeholder="Full name" required className="field-input" />
          <select name="gender" className="field-input" defaultValue="Female">
            <option>Female</option>
            <option>Male</option>
          </select>
          <input
            name="admission_year"
            type="number"
            defaultValue={2025}
            required
            className="field-input"
          />
          <select name="class_arm" required className="field-input" defaultValue="">
            <option value="" disabled>
              Class / Arm
            </option>
            {arms.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          <input name="guardian_name" placeholder="Guardian name" className="field-input" />
          <input
            name="guardian_email"
            type="email"
            placeholder="Guardian email"
            className="field-input"
          />
          <input name="guardian_phone" placeholder="Guardian phone" className="field-input" />
          <input
            name="email"
            type="email"
            placeholder="Student portal email (optional)"
            className="field-input"
          />
          <button type="submit" className="btn-primary md:col-span-2">
            Create student account
          </button>
        </form>
        <ul className="mt-5 divide-y divide-[var(--line)] text-sm">
          {students.slice(0, 8).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {s.full_name}{" "}
                <span className="text-[var(--muted)]">({s.student_id})</span>
              </span>
              <span className="flex items-center gap-3 text-[var(--muted)]">
                <span>{s.class_arm_label}</span>
                <a
                  className="text-[var(--brand-green)] underline-offset-2 hover:underline"
                  href={`/api/identity/id-card/${s.id}/?format=pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  ID card PDF
                </a>
                <a
                  className="text-[var(--brand-green)] underline-offset-2 hover:underline"
                  href={`/api/identity/report-card/${s.id}/`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Report PDF
                </a>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="staff" title="Create staff">
        <form onSubmit={createStaff} className="grid gap-3 md:grid-cols-2">
          <input name="full_name" placeholder="Full name" required className="field-input" />
          <input
            name="username"
            placeholder="Username (for portal login)"
            required
            autoComplete="off"
            className="field-input"
          />
          <input name="email" type="email" placeholder="Email" required className="field-input" />
          <select name="account_type" className="field-input" defaultValue="teacher">
            <option value="teacher">Teacher</option>
            <option value="form_teacher">Form Teacher</option>
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
          <button type="submit" className="btn-primary md:col-span-2">
            Create staff account
          </button>
        </form>
        <ul className="mt-5 divide-y divide-[var(--line)] text-sm">
          {staff.slice(0, 8).map((s) => (
            <li key={s.id} className="flex justify-between gap-2 py-2">
              <span>
                {s.full_name}
                {s.user?.username ? (
                  <span className="text-[var(--muted)]"> ({s.user.username})</span>
                ) : null}
              </span>
              <span className="capitalize text-[var(--muted)]">
                {s.user?.account_type}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="leads" title="Enquiries & applications">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Enquiries
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              {enquiries.length === 0 ? (
                <li className="text-[var(--muted)]">No enquiries yet.</li>
              ) : (
                enquiries.slice(0, 6).map((e) => (
                  <li key={e.id} className="border-b border-[var(--line)] pb-2">
                    <strong>{e.full_name}</strong> — {e.email}
                    <div className="text-xs text-[var(--muted)]">{e.status}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Applications
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              {applications.length === 0 ? (
                <li className="text-[var(--muted)]">No applications yet.</li>
              ) : (
                applications.slice(0, 6).map((a) => (
                  <li key={a.id} className="border-b border-[var(--line)] pb-2">
                    <strong>{a.student_full_name}</strong> — {a.guardian_email}
                    <div className="text-xs text-[var(--muted)]">{a.status}</div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </Panel>

      <style jsx global>{`
        .field-input {
          width: 100%;
          border: 1px solid var(--line);
          background: #fff;
          padding: 0.65rem 0.75rem;
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  );
}
