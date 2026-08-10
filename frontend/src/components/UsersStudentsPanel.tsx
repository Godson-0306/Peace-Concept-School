"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import PhotoCapture from "@/components/PhotoCapture";

export type StudentRow = {
  id: number;
  student_id: string;
  full_name: string;
  gender: string;
  date_of_birth?: string | null;
  admission_year?: number;
  class_arm?: number | null;
  class_arm_label?: string;
  section?: string;
  class_level?: number | null;
  class_level_name?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone: string;
  address?: string;
  passport_photo?: string | null;
  is_active: boolean;
  promotion_status?: "pending" | "promoted" | "retained" | "graduated";
  session_attendance_days?: number;
  total_attendance_days?: number;
};

type ClassArm = {
  id: number;
  name: string;
  label: string;
  class_level: number;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function statusLabel(student: StudentRow): string {
  if (!student.is_active || student.promotion_status === "graduated") {
    return "GRADUATED";
  }
  switch (student.promotion_status) {
    case "promoted":
      return "PROMOTED";
    case "retained":
      return "RETAINED";
    default:
      return "PENDING";
  }
}

function statusClasses(label: string): string {
  switch (label) {
    case "PROMOTED":
      return "bg-emerald-50 text-emerald-700";
    case "RETAINED":
      return "bg-amber-50 text-amber-800";
    case "GRADUATED":
      return "bg-[var(--brand-pink-wash)] text-[var(--brand-pink)]";
    default:
      return "bg-[var(--mist)] text-[var(--muted)]";
  }
}

function IconButton({
  label,
  className,
  onClick,
  href,
  children,
}: {
  label: string;
  className: string;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const classes = `inline-flex h-9 w-9 items-center justify-center rounded-lg ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes} title={label} aria-label={label}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
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
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const [photoStudent, setPhotoStudent] = useState<StudentRow | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [editStudent, setEditStudent] = useState<StudentRow | null>(null);
  const [promoteStudent, setPromoteStudent] = useState<StudentRow | null>(null);

  const canManage = user?.account_type === "admin" || user?.account_type === "principal";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const path = query ? `/api/students/?${query}` : "/api/students/";
      const [studentData, armData] = await Promise.all([
        apiJson<{ results?: StudentRow[] } | StudentRow[]>(path),
        apiJson<{ results?: ClassArm[] } | ClassArm[]>("/api/class-arms/"),
      ]);
      setStudents(unwrapList(studentData));
      setArms(unwrapList(armData));
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

  async function savePhoto() {
    if (!photoStudent || !photoFile) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const data = new FormData();
      data.append("passport_photo", photoFile);
      const response = await apiFetch(`/api/students/${photoStudent.id}/`, {
        method: "PATCH",
        body: data,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.detail === "string"
            ? payload.detail
            : JSON.stringify(payload) || "Photo upload failed",
        );
      }
      setMessage(`Photo saved for ${photoStudent.full_name}.`);
      setPhotoStudent(null);
      setPhotoFile(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save photo");
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editStudent) return;
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const classArmRaw = String(form.get("class_arm") || "");
    const payload = {
      full_name: String(form.get("full_name") || ""),
      gender: String(form.get("gender") || ""),
      date_of_birth: String(form.get("date_of_birth") || "") || null,
      guardian_name: String(form.get("guardian_name") || ""),
      guardian_email: String(form.get("guardian_email") || ""),
      guardian_phone: String(form.get("guardian_phone") || ""),
      address: String(form.get("address") || ""),
      class_arm: classArmRaw ? Number(classArmRaw) : null,
      promotion_status: String(form.get("promotion_status") || editStudent.promotion_status),
      is_active: form.get("is_active") === "on",
    };
    try {
      await apiJson(`/api/students/${editStudent.id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setMessage(`Updated ${editStudent.full_name}.`);
      setEditStudent(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update student");
    } finally {
      setPending(false);
    }
  }

  async function savePromote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!promoteStudent) return;
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const classArmRaw = String(form.get("class_arm") || "");
    const status = String(form.get("promotion_status") || "pending");
    const markEx = form.get("mark_ex") === "on";
    try {
      await apiJson(`/api/students/${promoteStudent.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          class_arm: markEx ? null : classArmRaw ? Number(classArmRaw) : null,
          promotion_status: markEx ? "graduated" : status,
          is_active: !markEx,
        }),
      });
      setMessage(`Class / promotion updated for ${promoteStudent.full_name}.`);
      setPromoteStudent(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update class");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(student: StudentRow) {
    if (!confirm(`Delete ${student.full_name} (${student.student_id})? This cannot be undone.`)) {
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(`/api/students/${student.id}/`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 204) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload.detail === "string" ? payload.detail : "Delete failed",
        );
      }
      setMessage(`Deleted ${student.full_name}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete student");
    } finally {
      setPending(false);
    }
  }

  if (user && user.account_type !== "admin" && user.account_type !== "principal") {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
          Users
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">{description}</p>
      </header>

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
          <p className="px-5 py-8 text-sm text-[var(--muted)]">Loading students…</p>
        ) : students.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--muted)]">No students found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--mist)] text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Student ID</th>
                  <th className="px-4 py-3 font-semibold">Section</th>
                  <th className="px-4 py-3 font-semibold">Gender</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canManage ? (
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {students.map((student, index) => {
                  const badge = statusLabel(student);
                  const photo = mediaUrl(student.passport_photo);
                  return (
                    <tr key={student.id} className="align-top">
                      <td className="px-4 py-3.5 text-[var(--muted)]">{index + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-3">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt=""
                              className="h-11 w-11 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-blue-wash)] text-xs font-bold text-[var(--brand-blue)]">
                              {initials(student.full_name)}
                            </span>
                          )}
                          <span>
                            <span className="block font-semibold text-[var(--ink)]">
                              {student.full_name}
                            </span>
                            <span className="mt-0.5 block text-xs text-[var(--muted)]">
                              Total Attendance: {student.total_attendance_days ?? 0} Days
                            </span>
                            <span className="block text-xs text-[var(--muted)]">
                              Session Attendance: {student.session_attendance_days ?? 0} Days
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold">{student.student_id}</td>
                      <td className="px-4 py-3.5 text-[var(--muted)]">
                        {student.section || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-[var(--muted)]">
                        {student.gender || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-bold tracking-wide ${statusClasses(badge)}`}
                        >
                          {badge}
                        </span>
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <IconButton
                              label="Class / promotion"
                              className="bg-teal-50 text-teal-700"
                              onClick={() => setPromoteStudent(student)}
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm0 13.5L3.74 11.5 12 7l8.26 4.5L12 16.5z" />
                              </svg>
                            </IconButton>
                            <IconButton
                              label="Report card / results"
                              className="bg-violet-700 text-white"
                              href={`/app/users/students/${student.id}/report`}
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h4.5L14 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z" />
                              </svg>
                            </IconButton>
                            <IconButton
                              label="Performance"
                              className="bg-sky-50 text-sky-700"
                              href={`/app/users/students/${student.id}/performance`}
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <path d="M3 3h2v18H3V3zm4 10h2v8H7v-8zm4-6h2v14h-2V7zm4 4h2v10h-2V11zm4-8h2v18h-2V3z" />
                              </svg>
                            </IconButton>
                            <button
                              type="button"
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 text-xs font-semibold text-orange-800"
                              onClick={() => {
                                setPhotoFile(null);
                                setPhotoStudent(student);
                              }}
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <path d="M9 3h6l1.5 2H20a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3.5L9 3zm3 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
                              </svg>
                              Snap photo
                            </button>
                            <IconButton
                              label="Edit student"
                              className="bg-[var(--mist)] text-[var(--ink)]"
                              onClick={() => setEditStudent(student)}
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                              </svg>
                            </IconButton>
                            <IconButton
                              label="Delete student"
                              className="bg-orange-50 text-orange-700"
                              onClick={() => onDelete(student)}
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <path d="M6 7h12v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7zm3-4h6l1 1h4v2H4V4h4l1-1z" />
                              </svg>
                            </IconButton>
                            <IconButton
                              label="ID card"
                              className="bg-slate-100 text-slate-800"
                              onClick={() =>
                                window.open(
                                  `/api/identity/id-card/${student.id}/?format=pdf`,
                                  "_blank",
                                )
                              }
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zm4 7h5v2H6v-2zm0-4h8v2H6V9zm10 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
                              </svg>
                            </IconButton>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {photoStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,47,109,0.4)] p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="font-display text-2xl text-[var(--brand-blue-deep)]">
              Snap photo
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{photoStudent.full_name}</p>
            <div className="mt-4">
              <PhotoCapture onFile={setPhotoFile} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                onClick={() => {
                  setPhotoStudent(null);
                  setPhotoFile(null);
                }}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!photoFile || pending}
                onClick={savePhoto}
              >
                {pending ? "Saving…" : "Save photo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,47,109,0.4)] p-4">
          <form
            onSubmit={saveEdit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 className="font-display text-2xl text-[var(--brand-blue-deep)]">
              Edit student
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{editStudent.student_id}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-[var(--muted)]">Full name</span>
                <input
                  name="full_name"
                  required
                  defaultValue={editStudent.full_name}
                  className="field-input w-full"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Gender</span>
                <input
                  name="gender"
                  defaultValue={editStudent.gender || ""}
                  className="field-input w-full"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Date of birth</span>
                <input
                  type="date"
                  name="date_of_birth"
                  defaultValue={editStudent.date_of_birth || ""}
                  className="field-input w-full"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-[var(--muted)]">Class arm</span>
                <select
                  name="class_arm"
                  defaultValue={editStudent.class_arm ?? ""}
                  className="field-input w-full"
                >
                  <option value="">— None —</option>
                  {arms.map((arm) => (
                    <option key={arm.id} value={arm.id}>
                      {arm.label || `${arm.name}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Promotion status</span>
                <select
                  name="promotion_status"
                  defaultValue={editStudent.promotion_status || "pending"}
                  className="field-input w-full"
                >
                  <option value="pending">Pending</option>
                  <option value="promoted">Promoted</option>
                  <option value="retained">Retained</option>
                  <option value="graduated">Graduated</option>
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={editStudent.is_active}
                />
                <span>Active student</span>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-[var(--muted)]">Guardian name</span>
                <input
                  name="guardian_name"
                  defaultValue={editStudent.guardian_name || ""}
                  className="field-input w-full"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Guardian email</span>
                <input
                  type="email"
                  name="guardian_email"
                  defaultValue={editStudent.guardian_email || ""}
                  className="field-input w-full"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Guardian phone</span>
                <input
                  name="guardian_phone"
                  defaultValue={editStudent.guardian_phone || ""}
                  className="field-input w-full"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-[var(--muted)]">Address</span>
                <textarea
                  name="address"
                  rows={2}
                  defaultValue={editStudent.address || ""}
                  className="field-input w-full"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                onClick={() => setEditStudent(null)}
                disabled={pending}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {promoteStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(12,47,109,0.4)] p-4">
          <form
            onSubmit={savePromote}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 className="font-display text-2xl text-[var(--brand-blue-deep)]">
              Class / promotion
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {promoteStudent.full_name} · {promoteStudent.class_arm_label || "No class"}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Move to class arm</span>
                <select
                  name="class_arm"
                  defaultValue={promoteStudent.class_arm ?? ""}
                  className="field-input w-full"
                >
                  <option value="">— None —</option>
                  {arms.map((arm) => (
                    <option key={arm.id} value={arm.id}>
                      {arm.label || arm.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--muted)]">Promotion status</span>
                <select
                  name="promotion_status"
                  defaultValue={promoteStudent.promotion_status || "pending"}
                  className="field-input w-full"
                >
                  <option value="pending">Pending</option>
                  <option value="promoted">Promoted</option>
                  <option value="retained">Retained</option>
                  <option value="graduated">Graduated</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="mark_ex" />
                <span>Mark as Ex-Student (graduate / leave)</span>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                onClick={() => setPromoteStudent(null)}
                disabled={pending}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? "Saving…" : "Update"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <style jsx global>{`
        .field-input {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 0.65rem;
          padding: 0.55rem 0.7rem;
        }
      `}</style>
    </div>
  );
}
