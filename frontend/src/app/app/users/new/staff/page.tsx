"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";
import { NIGERIAN_STATES } from "@/lib/brand";
import { mediaUrl } from "@/lib/media";
import { sortClassLevelsForUsers } from "@/lib/portalNav";
import PhotoCapture from "@/components/PhotoCapture";
import SignaturePad from "@/components/SignaturePad";

type PositionRow = {
  id: number;
  position: string;
  class_arm: number | null;
  is_active: boolean;
};

type StaffRecord = {
  id: number;
  full_name: string;
  username?: string;
  temporary_password?: string;
  phone_number?: string;
  gender?: string;
  state_of_origin?: string;
  passport_photo?: string | null;
  signature?: string | null;
  positions?: PositionRow[];
  user?: { username?: string; email?: string; account_type?: string };
};

type ClassLevel = { id: number; name: string; order: number };
type ClassArm = {
  id: number;
  name: string;
  label: string;
  class_level: number;
};
type Subject = {
  id: number;
  name: string;
  class_level: number;
  is_active?: boolean;
};
type Session = { id: number; name: string; is_active: boolean };
type TeacherAssignmentRow = {
  id: number;
  staff: number;
  class_arm: number;
  subject: number;
  session: number;
  is_active: boolean;
  class_arm_label?: string;
  subject_name?: string;
};

type AssignmentDraft = {
  key: string;
  classLevelId: string;
  classArmId: string;
  subjectId: string;
  existingId?: number;
};

type RoleUi = "teacher" | "form_teacher" | "principal" | "accountant" | "store_staff" | "admin";

const MAX_SUBJECTS = 20;
const TEACHING_ROLES: RoleUi[] = ["teacher", "form_teacher", "principal"];

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | null = path;
  while (next) {
    const data: { results?: T[]; next?: string | null } | T[] = await apiJson(next);
    if (Array.isArray(data)) return data;
    items.push(...(data.results || []));
    const nextUrl = data.next;
    if (!nextUrl) break;
    try {
      const url: URL = new URL(nextUrl, "http://local");
      const pathWithQuery = `${url.pathname}${url.search}`;
      next = url.pathname.startsWith("/api/") ? pathWithQuery : null;
    } catch {
      next = null;
    }
  }
  return items;
}

function newAssignmentRow(): AssignmentDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    classLevelId: "",
    classArmId: "",
    subjectId: "",
  };
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

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
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<StaffRecord | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [roleUi, setRoleUi] = useState<RoleUi>("teacher");
  const [formClassArmId, setFormClassArmId] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("Female");
  const [stateOfOrigin, setStateOfOrigin] = useState("");
  const [password, setPassword] = useState("school");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [existingSignature, setExistingSignature] = useState<string | null>(null);
  const [existingFormTeacherPositions, setExistingFormTeacherPositions] = useState<
    PositionRow[]
  >([]);
  const [existingAssignments, setExistingAssignments] = useState<TeacherAssignmentRow[]>(
    [],
  );
  const [assignments, setAssignments] = useState<AssignmentDraft[]>([]);

  const [levels, setLevels] = useState<ClassLevel[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);

  const showTeaching = TEACHING_ROLES.includes(roleUi);
  const showFormClass = roleUi === "form_teacher";

  const distinctSubjectCount = useMemo(() => {
    const ids = new Set(
      assignments.map((a) => a.subjectId).filter((id) => id && id !== ""),
    );
    return ids.size;
  }, [assignments]);

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    if (stored && stored.account_type !== "admin") {
      router.replace("/app/users");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [levelsData, armsData, subjectsData, sessionsData] = await Promise.all([
          fetchAllPages<ClassLevel>("/api/class-levels/?page_size=200"),
          fetchAllPages<ClassArm>("/api/class-arms/?page_size=500"),
          fetchAllPages<Subject>("/api/subjects/?page_size=500"),
          fetchAllPages<Session>("/api/sessions/?page_size=100"),
        ]);
        if (cancelled) return;
        setLevels(sortClassLevelsForUsers(levelsData));
        setArms(armsData);
        setSubjects(subjectsData.filter((s) => s.is_active !== false));
        const sessions = sessionsData;
        const active = sessions.find((s) => s.is_active) || sessions[0] || null;
        setSessionId(active?.id ?? null);

        if (isEdit && staffId) {
          const staff = await apiJson<StaffRecord>(`/api/staff/${staffId}/`);
          if (cancelled) return;
          setFullName(staff.full_name || "");
          setUsername(staff.user?.username || staff.username || "");
          setEmail(staff.user?.email || "");
          setPhone(staff.phone_number || "");
          setGender(staff.gender || "Female");
          setStateOfOrigin(staff.state_of_origin || "");
          setPassword("school");
          setExistingPhoto(staff.passport_photo || null);
          setExistingSignature(staff.signature || null);

          const formTeacher = (staff.positions || []).find(
            (p) => p.position === "form_teacher" && p.is_active,
          );
          setExistingFormTeacherPositions(
            (staff.positions || []).filter((p) => p.position === "form_teacher"),
          );
          if (formTeacher) {
            setRoleUi("form_teacher");
            setFormClassArmId(formTeacher.class_arm ? String(formTeacher.class_arm) : "");
          } else {
            setRoleUi((staff.user?.account_type as RoleUi) || "teacher");
            setFormClassArmId("");
          }

          if (active?.id) {
            const rows = await fetchAllPages<TeacherAssignmentRow>(
              `/api/teacher-assignments/?staff=${staffId}&session=${active.id}&is_active=true`,
            );
            if (cancelled) return;
            setExistingAssignments(rows);
            const armById = new Map(armsData.map((a) => [a.id, a]));
            setAssignments(
              rows.map((row) => {
                const arm = armById.get(row.class_arm);
                return {
                  key: `existing-${row.id}`,
                  classLevelId: arm ? String(arm.class_level) : "",
                  classArmId: String(row.class_arm),
                  subjectId: String(row.subject),
                  existingId: row.id,
                };
              }),
            );
          }
        } else {
          setAssignments([]);
        }
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load form data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, staffId]);

  function accountTypeForSubmit(): string {
    if (roleUi === "form_teacher") return "teacher";
    return roleUi;
  }

  function updateAssignment(key: string, patch: Partial<AssignmentDraft>) {
    setAssignments((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.classLevelId !== undefined) {
          next.classArmId = "";
          next.subjectId = "";
        } else if (patch.classArmId !== undefined) {
          // keep subject if still valid for level
        }
        return next;
      }),
    );
  }

  function addAssignmentRow() {
    if (distinctSubjectCount >= MAX_SUBJECTS) {
      setError(`A teacher may take at most ${MAX_SUBJECTS} different subjects.`);
      return;
    }
    setAssignments((rows) => [...rows, newAssignmentRow()]);
  }

  function removeAssignmentRow(key: string) {
    setAssignments((rows) => rows.filter((r) => r.key !== key));
  }

  async function syncPositions(savedStaffId: number) {
    if (roleUi === "form_teacher") {
      if (!formClassArmId) {
        throw new Error("Form Class is required for Form Teacher.");
      }
      const classArm = Number(formClassArmId);
      const existing = existingFormTeacherPositions.find(
        (p) => p.class_arm === classArm,
      );
      if (existing) {
        if (!existing.is_active) {
          await apiJson(`/api/positions/${existing.id}/`, {
            method: "PATCH",
            body: JSON.stringify({ is_active: true, class_arm: classArm }),
          });
        } else if (existing.class_arm !== classArm) {
          await apiJson(`/api/positions/${existing.id}/`, {
            method: "PATCH",
            body: JSON.stringify({ class_arm: classArm, is_active: true }),
          });
        }
      } else {
        const sameActive = existingFormTeacherPositions.find((p) => p.is_active);
        if (sameActive) {
          await apiJson(`/api/positions/${sameActive.id}/`, {
            method: "PATCH",
            body: JSON.stringify({ class_arm: classArm, is_active: true }),
          });
        } else {
          await apiJson("/api/positions/", {
            method: "POST",
            body: JSON.stringify({
              staff: savedStaffId,
              position: "form_teacher",
              class_arm: classArm,
              is_active: true,
            }),
          });
        }
      }
      // Deactivate other form-teacher positions for this staff
      for (const pos of existingFormTeacherPositions) {
        if (pos.is_active && pos.class_arm !== classArm) {
          await apiJson(`/api/positions/${pos.id}/`, {
            method: "PATCH",
            body: JSON.stringify({ is_active: false }),
          });
        }
      }
      return;
    }

    for (const pos of existingFormTeacherPositions) {
      if (pos.is_active) {
        await apiJson(`/api/positions/${pos.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: false }),
        });
      }
    }
  }

  async function syncAssignments(savedStaffId: number) {
    if (!showTeaching) {
      for (const row of existingAssignments) {
        await apiJson(`/api/teacher-assignments/${row.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: false }),
        });
      }
      return;
    }
    if (!sessionId) {
      throw new Error("No active academic session. Create a session before assigning subjects.");
    }

    const desired = assignments.filter(
      (a) => a.classArmId && a.subjectId,
    );
    const subjectIds = new Set(desired.map((a) => a.subjectId));
    if (subjectIds.size > MAX_SUBJECTS) {
      throw new Error(`A teacher may take at most ${MAX_SUBJECTS} different subjects.`);
    }

    const desiredKeys = new Set(
      desired.map((a) => `${a.classArmId}:${a.subjectId}`),
    );

    for (const row of existingAssignments) {
      const key = `${row.class_arm}:${row.subject}`;
      if (!desiredKeys.has(key)) {
        await apiJson(`/api/teacher-assignments/${row.id}/`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: false }),
        });
      }
    }

    const existingActiveKeys = new Set(
      existingAssignments
        .filter((r) =>
          desiredKeys.has(`${r.class_arm}:${r.subject}`),
        )
        .map((r) => `${r.class_arm}:${r.subject}`),
    );

    for (const draft of desired) {
      const key = `${draft.classArmId}:${draft.subjectId}`;
      if (existingActiveKeys.has(key)) continue;
      await apiJson("/api/teacher-assignments/", {
        method: "POST",
        body: JSON.stringify({
          staff: savedStaffId,
          class_arm: Number(draft.classArmId),
          subject: Number(draft.subjectId),
          session: sessionId,
          is_active: true,
        }),
      });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (user?.account_type !== "admin") return;
    setPending(true);
    setMessage("");
    setError("");
    try {
      if (roleUi === "form_teacher" && !formClassArmId) {
        throw new Error("Form Class is required for Form Teacher.");
      }
      if (showTeaching && distinctSubjectCount > MAX_SUBJECTS) {
        throw new Error(`A teacher may take at most ${MAX_SUBJECTS} different subjects.`);
      }

      const data = new FormData();
      data.set("full_name", fullName);
      data.set("email", email);
      data.set("account_type", accountTypeForSubmit());
      data.set("gender", gender);
      data.set("phone_number", phone);
      data.set("state_of_origin", stateOfOrigin);
      if (!isEdit) {
        data.set("username", username);
        data.set("password", password.trim() || "school");
      } else if (password.trim()) {
        data.set("password", password.trim());
      }
      if (photoFile) {
        data.set("passport_photo", photoFile);
      }
      if (signatureDataUrl) {
        data.set(
          "signature",
          await dataUrlToFile(signatureDataUrl, "signature.png"),
        );
      }

      const result = await apiJson<StaffRecord>(
        isEdit ? `/api/staff/${staffId}/` : "/api/staff/",
        {
          method: isEdit ? "PATCH" : "POST",
          body: data,
        },
      );

      await syncPositions(result.id);
      await syncAssignments(result.id);

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

  function resetForm() {
    setCreated(null);
    setFullName("");
    setUsername("");
    setEmail("");
    setRoleUi("teacher");
    setFormClassArmId("");
    setPhone("");
    setGender("Female");
    setStateOfOrigin("");
    setPassword("school");
    setPhotoFile(null);
    setExistingPhoto(null);
    setSignatureDataUrl(null);
    setExistingSignature(null);
    setExistingFormTeacherPositions([]);
    setExistingAssignments([]);
    setAssignments([]);
    setMessage("");
    setError("");
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
                onClick={resetForm}
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
            value={roleUi}
            onChange={(e) => {
              const next = e.target.value as RoleUi;
              setRoleUi(next);
              if (next !== "form_teacher") setFormClassArmId("");
              if (!TEACHING_ROLES.includes(next)) setAssignments([]);
            }}
          >
            <option value="teacher">Teacher</option>
            <option value="form_teacher">Form Teacher</option>
            <option value="principal">Principal</option>
            <option value="accountant">Accountant</option>
            <option value="store_staff">Store / Sales</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {showFormClass ? (
          <label className="field">
            <span>Form Class</span>
            <select
              required
              className="field-input"
              value={formClassArmId}
              onChange={(e) => setFormClassArmId(e.target.value)}
            >
              <option value="">Select form class…</option>
              {arms.map((arm) => (
                <option key={arm.id} value={arm.id}>
                  {arm.label || `${arm.name}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
        <label className="field">
          <span>State of origin</span>
          <select
            className="field-input"
            value={stateOfOrigin}
            onChange={(e) => setStateOfOrigin(e.target.value)}
          >
            <option value="">Select state</option>
            {NIGERIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
            {stateOfOrigin &&
            !(NIGERIAN_STATES as readonly string[]).includes(stateOfOrigin) ? (
              <option value={stateOfOrigin}>{stateOfOrigin}</option>
            ) : null}
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

        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-semibold text-[var(--muted)]">Passport photo</p>
          {existingPhoto && !photoFile ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(existingPhoto)}
              alt="Current passport"
              className="mb-3 h-24 w-24 rounded-full object-cover"
            />
          ) : null}
          <PhotoCapture onFile={setPhotoFile} />
        </div>

        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-semibold text-[var(--muted)]">Signature</p>
          {existingSignature && !signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(existingSignature)}
              alt="Current signature"
              className="mb-3 h-20 max-w-xs border border-[var(--line)] bg-white object-contain p-2"
            />
          ) : null}
          <SignaturePad onChange={setSignatureDataUrl} />
          <p className="mt-1 text-xs text-[var(--muted)]">
            {isEdit
              ? "Draw a new signature to replace the current one. Clear to leave unchanged."
              : "Optional. Draw the staff signature above."}
          </p>
        </div>

        {showTeaching ? (
          <div className="space-y-3 sm:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-2 border-t border-[var(--line)] pt-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-[var(--brand-blue-deep)]">
                  Class / ARM / Subject
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  Assign teaching load for the current session
                  {sessionId ? "" : " (no active session found)"}. At most{" "}
                  {MAX_SUBJECTS} different subjects ({distinctSubjectCount}/{MAX_SUBJECTS}
                  ).
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold"
                onClick={addAssignmentRow}
              >
                Add assignment
              </button>
            </div>

            {assignments.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No assignments yet.</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((row) => {
                  const levelArms = arms.filter(
                    (a) => String(a.class_level) === row.classLevelId,
                  );
                  const levelSubjects = subjects.filter(
                    (s) => String(s.class_level) === row.classLevelId,
                  );
                  return (
                    <div
                      key={row.key}
                      className="grid gap-2 rounded-xl border border-[var(--line)] p-3 sm:grid-cols-4"
                    >
                      <label className="field">
                        <span>Class</span>
                        <select
                          className="field-input"
                          value={row.classLevelId}
                          onChange={(e) =>
                            updateAssignment(row.key, { classLevelId: e.target.value })
                          }
                        >
                          <option value="">Select…</option>
                          {levels.map((level) => (
                            <option key={level.id} value={level.id}>
                              {level.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>ARM</span>
                        <select
                          className="field-input"
                          value={row.classArmId}
                          onChange={(e) =>
                            updateAssignment(row.key, { classArmId: e.target.value })
                          }
                          disabled={!row.classLevelId}
                        >
                          <option value="">Select…</option>
                          {levelArms.map((arm) => (
                            <option key={arm.id} value={arm.id}>
                              {arm.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Subject</span>
                        <select
                          className="field-input"
                          value={row.subjectId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            const others = new Set(
                              assignments
                                .filter((a) => a.key !== row.key && a.subjectId)
                                .map((a) => a.subjectId),
                            );
                            if (nextId && others.has(nextId) === false) {
                              const projected = new Set(others);
                              if (nextId) projected.add(nextId);
                              if (projected.size > MAX_SUBJECTS) {
                                setError(
                                  `A teacher may take at most ${MAX_SUBJECTS} different subjects.`,
                                );
                                return;
                              }
                            } else if (nextId) {
                              const projected = new Set(
                                assignments
                                  .filter((a) => a.key !== row.key)
                                  .map((a) => a.subjectId)
                                  .filter(Boolean),
                              );
                              projected.add(nextId);
                              if (projected.size > MAX_SUBJECTS) {
                                setError(
                                  `A teacher may take at most ${MAX_SUBJECTS} different subjects.`,
                                );
                                return;
                              }
                            }
                            setError("");
                            updateAssignment(row.key, { subjectId: nextId });
                          }}
                          disabled={!row.classLevelId}
                        >
                          <option value="">Select…</option>
                          {levelSubjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-end">
                        <button
                          type="button"
                          className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm text-red-700"
                          onClick={() => removeAssignmentRow(row.key)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

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
