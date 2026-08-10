"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, apiJson } from "@/lib/api";
import { AuthUser, getStoredUser } from "@/lib/auth";
import { CLASS_LEVELS } from "@/lib/brand";
import { mediaUrl } from "@/lib/media";
import PhotoCapture from "@/components/PhotoCapture";

type Application = {
  id: number;
  student_full_name: string;
  email: string;
  gender: string;
  date_of_birth: string | null;
  applying_for_class: string;
  previous_school: string;
  state_of_origin: string;
  blood_group: string;
  genotype: string;
  disability: string;
  passport_photo: string | null;
  address: string;
  city_of_residence: string;
  lga: string;
  phone: string;
  whatsapp_phone: string;
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  father_name: string;
  father_phone: string;
  father_whatsapp: string;
  mother_name: string;
  mother_phone: string;
  mother_whatsapp: string;
  hometown: string;
  next_of_kin_name: string;
  next_of_kin_relationship: string;
  next_of_kin_address: string;
  next_of_kin_phone: string;
  notes: string;
  status: string;
  enrolled_student: number | null;
  enrolled_student_code: string;
};

type ClassLevel = { id: number; name: string; order: number };
type ClassArm = {
  id: number;
  name: string;
  label: string;
  class_level: number;
};

type CreatedStudent = {
  id: number;
  student_id: string;
  full_name: string;
  temporary_password?: string;
};

type FormState = {
  full_name: string;
  email: string;
  gender: string;
  date_of_birth: string;
  state_of_origin: string;
  blood_group: string;
  genotype: string;
  disability: string;
  date_of_admission: string;
  class_level_id: string;
  class_arm_id: string;
  address: string;
  city_of_residence: string;
  lga: string;
  phone: string;
  whatsapp_phone: string;
  next_of_kin_name: string;
  next_of_kin_relationship: string;
  next_of_kin_address: string;
  next_of_kin_phone: string;
  father_name: string;
  father_phone: string;
  father_whatsapp: string;
  mother_name: string;
  mother_phone: string;
  mother_whatsapp: string;
  hometown: string;
  guardian_email: string;
  guardian_name: string;
  guardian_phone: string;
};

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    full_name: "",
    email: "",
    gender: "",
    date_of_birth: "",
    state_of_origin: "",
    blood_group: "",
    genotype: "",
    disability: "",
    date_of_admission: todayISO(),
    class_level_id: "",
    class_arm_id: "",
    address: "",
    city_of_residence: "",
    lga: "",
    phone: "",
    whatsapp_phone: "",
    next_of_kin_name: "",
    next_of_kin_relationship: "",
    next_of_kin_address: "",
    next_of_kin_phone: "",
    father_name: "",
    father_phone: "",
    father_whatsapp: "",
    mother_name: "",
    mother_phone: "",
    mother_whatsapp: "",
    hometown: "",
    guardian_email: "",
    guardian_name: "",
    guardian_phone: "",
  };
}

function formFromApplication(
  app: Application,
  levels: ClassLevel[],
  arms: ClassArm[],
): FormState {
  const level =
    levels.find(
      (item) => item.name.toLowerCase() === app.applying_for_class.toLowerCase(),
    ) ?? null;
  const levelArms = level
    ? arms.filter((arm) => arm.class_level === level.id)
    : [];
  const armA = levelArms.find((arm) => arm.name === "A") ?? levelArms[0] ?? null;
  return {
    full_name: app.student_full_name || "",
    email: app.email || app.guardian_email || "",
    gender: app.gender || "",
    date_of_birth: app.date_of_birth || "",
    state_of_origin: app.state_of_origin || "",
    blood_group: app.blood_group || "",
    genotype: app.genotype || "",
    disability: app.disability || "",
    date_of_admission: todayISO(),
    class_level_id: level ? String(level.id) : "",
    class_arm_id: armA ? String(armA.id) : "",
    address: app.address || "",
    city_of_residence: app.city_of_residence || "",
    lga: app.lga || "",
    phone: app.phone || "",
    whatsapp_phone: app.whatsapp_phone || "",
    next_of_kin_name: app.next_of_kin_name || "",
    next_of_kin_relationship: app.next_of_kin_relationship || "",
    next_of_kin_address: app.next_of_kin_address || "",
    next_of_kin_phone: app.next_of_kin_phone || "",
    father_name: app.father_name || "",
    father_phone: app.father_phone || "",
    father_whatsapp: app.father_whatsapp || "",
    mother_name: app.mother_name || "",
    mother_phone: app.mother_phone || "",
    mother_whatsapp: app.mother_whatsapp || "",
    hometown: app.hometown || "",
    guardian_email: app.guardian_email || app.email || "",
    guardian_name:
      app.guardian_name || app.father_name || app.mother_name || "",
    guardian_phone:
      app.guardian_phone ||
      app.father_whatsapp ||
      app.father_phone ||
      app.mother_whatsapp ||
      app.mother_phone ||
      app.whatsapp_phone ||
      app.phone ||
      "",
  };
}

export default function AdmissionEnrollPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = String(params.id || "");
  const isManual = rawId === "new";
  const applicationId = isManual ? null : Number(rawId);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [levels, setLevels] = useState<ClassLevel[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<CreatedStudent | null>(null);

  const canAccess =
    user?.account_type === "admin" || user?.account_type === "principal";

  const levelArms = useMemo(
    () =>
      form.class_level_id
        ? arms.filter((arm) => arm.class_level === Number(form.class_level_id))
        : [],
    [arms, form.class_level_id],
  );

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [levelData, armData] = await Promise.all([
          apiJson<{ results?: ClassLevel[] } | ClassLevel[]>("/api/class-levels/"),
          apiJson<{ results?: ClassArm[] } | ClassArm[]>("/api/class-arms/"),
        ]);
        if (cancelled) return;
        const levelList = unwrapList(levelData);
        const armList = unwrapList(armData);
        setLevels(levelList);
        setArms(armList);

        if (!isManual && applicationId) {
          const app = await apiJson<Application>(
            `/api/website/applications/${applicationId}/`,
          );
          if (cancelled) return;
          if (app.enrolled_student) {
            setError(
              `This application is already enrolled as ${app.enrolled_student_code || "a student"}.`,
            );
          }
          setApplication(app);
          setForm(formFromApplication(app, levelList, armList));
          setExistingPhoto(app.passport_photo);
        } else {
          setApplication(null);
          setForm(emptyForm());
          setExistingPhoto(null);
        }
        setError("");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load enrollment form");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canAccess, isManual, applicationId]);

  useEffect(() => {
    if (!form.class_level_id) return;
    if (
      form.class_arm_id &&
      levelArms.some((arm) => String(arm.id) === form.class_arm_id)
    ) {
      return;
    }
    const preferred =
      levelArms.find((arm) => arm.name === "A") ?? levelArms[0] ?? null;
    setField("class_arm_id", preferred ? String(preferred.id) : "");
  }, [form.class_level_id, form.class_arm_id, levelArms, setField]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.class_arm_id) {
      setError("Select the class and arm the student is admitted into.");
      return;
    }
    setPending(true);
    setMessage("");
    setError("");
    try {
      const admissionYear = Number(
        (form.date_of_admission || todayISO()).slice(0, 4),
      );
      const guardianName =
        form.guardian_name || form.father_name || form.mother_name;
      const guardianPhone =
        form.guardian_phone ||
        form.father_whatsapp ||
        form.father_phone ||
        form.mother_whatsapp ||
        form.mother_phone ||
        form.whatsapp_phone ||
        form.phone;

      const data = new FormData();
      data.set("full_name", form.full_name);
      data.set("email", form.email);
      data.set("gender", form.gender);
      if (form.date_of_birth) data.set("date_of_birth", form.date_of_birth);
      data.set("admission_year", String(admissionYear));
      if (form.date_of_admission) {
        data.set("date_of_admission", form.date_of_admission);
      }
      data.set("class_arm", form.class_arm_id);
      data.set("state_of_origin", form.state_of_origin);
      data.set("blood_group", form.blood_group);
      data.set("genotype", form.genotype);
      data.set("disability", form.disability);
      data.set("address", form.address);
      data.set("city_of_residence", form.city_of_residence);
      data.set("lga", form.lga);
      data.set("phone", form.phone);
      data.set("whatsapp_phone", form.whatsapp_phone);
      data.set("next_of_kin_name", form.next_of_kin_name);
      data.set("next_of_kin_relationship", form.next_of_kin_relationship);
      data.set("next_of_kin_address", form.next_of_kin_address);
      data.set("next_of_kin_phone", form.next_of_kin_phone);
      data.set("father_name", form.father_name);
      data.set("father_phone", form.father_phone);
      data.set("father_whatsapp", form.father_whatsapp);
      data.set("mother_name", form.mother_name);
      data.set("mother_phone", form.mother_phone);
      data.set("mother_whatsapp", form.mother_whatsapp);
      data.set("hometown", form.hometown);
      data.set("guardian_name", guardianName);
      data.set("guardian_email", form.guardian_email || form.email);
      data.set("guardian_phone", guardianPhone);
      data.set("password", "school");
      data.set("create_portal_account", "true");
      data.set("is_active", "true");
      data.set("promotion_status", "pending");
      if (photoFile) {
        data.set("passport_photo", photoFile);
      } else if (existingPhoto) {
        try {
          const photoRes = await fetch(mediaUrl(existingPhoto), {
            credentials: "include",
          });
          if (photoRes.ok) {
            const blob = await photoRes.blob();
            const ext = blob.type.includes("png") ? "png" : "jpg";
            data.set(
              "passport_photo",
              new File([blob], `passport.${ext}`, {
                type: blob.type || "image/jpeg",
              }),
            );
          }
        } catch {
          /* optional photo copy */
        }
      }

      const response = await apiFetch("/api/students/", {
        method: "POST",
        body: data,
      });
      const payload = (await response.json().catch(() => ({}))) as CreatedStudent & {
        detail?: string;
      };
      if (!response.ok) {
        throw new Error(
          typeof payload.detail === "string"
            ? payload.detail
            : JSON.stringify(payload) || "Could not create student",
        );
      }

      if (applicationId) {
        await apiJson(`/api/website/applications/${applicationId}/`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "accepted",
            enrolled_student: payload.id,
          }),
        });
      }

      setCreated({
        id: payload.id,
        student_id: payload.student_id,
        full_name: payload.full_name,
        temporary_password: payload.temporary_password || "school",
      });
      setMessage(
        `Enrolled ${payload.full_name} as ${payload.student_id}. Default password: school`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setPending(false);
    }
  }

  if (user && !canAccess) {
    return <p className="text-sm text-[var(--muted)]">Redirecting…</p>;
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading enrollment form…</p>;
  }

  if (created) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Admission
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            Student enrolled
          </h1>
        </header>
        <div className="rounded-2xl border border-[var(--line)] bg-white/90 p-6">
          <p className="text-base text-[var(--ink)]">
            <span className="font-semibold">{created.full_name}</span> is now on the
            portal.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Student ID
              </dt>
              <dd className="mt-1 font-display text-2xl text-[var(--brand-blue-deep)]">
                {created.student_id}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Default password
              </dt>
              <dd className="mt-1 font-display text-2xl text-[var(--brand-blue-deep)]">
                {created.temporary_password || "school"}
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/app/admission"
              className="rounded-lg bg-[var(--brand-blue)] px-4 py-2 text-sm font-bold text-white"
            >
              Back to admissions
            </Link>
            <Link
              href="/app/users"
              className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
            >
              Open Users
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-pink)]">
            Admission
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[var(--brand-blue-deep)]">
            {isManual ? "Manual enrollment" : "Enroll applicant"}
          </h1>
          <p className="mt-3 max-w-2xl text-base text-[var(--muted)]">
            {isManual
              ? "Add a student directly to the portal."
              : `Prefilling from online application${application ? ` for ${application.student_full_name}` : ""}.`}
          </p>
        </div>
        <Link
          href="/app/admission"
          className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold"
        >
          Back to inbox
        </Link>
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

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
            1. Student information
          </h2>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row">
            <div className="shrink-0 space-y-3">
              {existingPhoto && !photoFile ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(existingPhoto)}
                  alt=""
                  className="h-28 w-28 rounded-xl object-cover"
                />
              ) : null}
              <PhotoCapture onFile={setPhotoFile} />
              <p className="text-xs text-[var(--muted)]">
                Admission number is assigned automatically on save.
              </p>
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <label className="field sm:col-span-2">
                <span>Full name</span>
                <input
                  className="field-input"
                  required
                  value={form.full_name}
                  onChange={(e) => setField("full_name", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  className="field-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Gender</span>
                <select
                  className="field-input"
                  required
                  value={form.gender}
                  onChange={(e) => setField("gender", e.target.value)}
                >
                  <option value="">Select gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">
                <span>Date of birth</span>
                <input
                  className="field-input"
                  type="date"
                  required
                  value={form.date_of_birth}
                  onChange={(e) => setField("date_of_birth", e.target.value)}
                />
              </label>
              <label className="field">
                <span>State of origin</span>
                <input
                  className="field-input"
                  value={form.state_of_origin}
                  onChange={(e) => setField("state_of_origin", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Blood group</span>
                <input
                  className="field-input"
                  value={form.blood_group}
                  onChange={(e) => setField("blood_group", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Genotype</span>
                <input
                  className="field-input"
                  value={form.genotype}
                  onChange={(e) => setField("genotype", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Disability</span>
                <input
                  className="field-input"
                  value={form.disability}
                  onChange={(e) => setField("disability", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Date of admission</span>
                <input
                  className="field-input"
                  type="date"
                  required
                  value={form.date_of_admission}
                  onChange={(e) => setField("date_of_admission", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Class admitted into</span>
                <select
                  className="field-input"
                  required
                  value={form.class_level_id}
                  onChange={(e) => setField("class_level_id", e.target.value)}
                >
                  <option value="">Select class</option>
                  {levels
                    .slice()
                    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
                    .map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                <span>Arm</span>
                <select
                  className="field-input"
                  required
                  value={form.class_arm_id}
                  onChange={(e) => setField("class_arm_id", e.target.value)}
                >
                  <option value="">Select arm</option>
                  {levelArms.map((arm) => (
                    <option key={arm.id} value={arm.id}>
                      {arm.name}
                    </option>
                  ))}
                </select>
              </label>
              {!levels.length ? (
                <p className="text-sm text-[var(--muted)] sm:col-span-2">
                  Expected classes: {CLASS_LEVELS.join(", ")}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
            2. Contact and address
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="field sm:col-span-2">
              <span>Address</span>
              <textarea
                className="field-input"
                rows={3}
                required
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </label>
            <label className="field">
              <span>City of residence</span>
              <input
                className="field-input"
                value={form.city_of_residence}
                onChange={(e) => setField("city_of_residence", e.target.value)}
              />
            </label>
            <label className="field">
              <span>LGA</span>
              <input
                className="field-input"
                value={form.lga}
                onChange={(e) => setField("lga", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Phone number</span>
              <input
                className="field-input"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </label>
            <label className="field">
              <span>WhatsApp number</span>
              <input
                className="field-input"
                value={form.whatsapp_phone}
                onChange={(e) => setField("whatsapp_phone", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Next of kin name</span>
              <input
                className="field-input"
                value={form.next_of_kin_name}
                onChange={(e) => setField("next_of_kin_name", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Relationship</span>
              <input
                className="field-input"
                value={form.next_of_kin_relationship}
                onChange={(e) =>
                  setField("next_of_kin_relationship", e.target.value)
                }
              />
            </label>
            <label className="field sm:col-span-2">
              <span>Next of kin address</span>
              <textarea
                className="field-input"
                rows={2}
                value={form.next_of_kin_address}
                onChange={(e) => setField("next_of_kin_address", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Next of kin phone</span>
              <input
                className="field-input"
                value={form.next_of_kin_phone}
                onChange={(e) => setField("next_of_kin_phone", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white/90 p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold text-[var(--brand-blue-deep)]">
            3. Parents details
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="field">
              <span>Father&apos;s name</span>
              <input
                className="field-input"
                value={form.father_name}
                onChange={(e) => setField("father_name", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Mother&apos;s name</span>
              <input
                className="field-input"
                value={form.mother_name}
                onChange={(e) => setField("mother_name", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Father&apos;s phone</span>
              <input
                className="field-input"
                value={form.father_phone}
                onChange={(e) => setField("father_phone", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Father&apos;s WhatsApp</span>
              <input
                className="field-input"
                value={form.father_whatsapp}
                onChange={(e) => setField("father_whatsapp", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Mother&apos;s phone</span>
              <input
                className="field-input"
                value={form.mother_phone}
                onChange={(e) => setField("mother_phone", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Mother&apos;s WhatsApp</span>
              <input
                className="field-input"
                value={form.mother_whatsapp}
                onChange={(e) => setField("mother_whatsapp", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Hometown</span>
              <input
                className="field-input"
                value={form.hometown}
                onChange={(e) => setField("hometown", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Guardian / contact email</span>
              <input
                className="field-input"
                type="email"
                value={form.guardian_email}
                onChange={(e) => setField("guardian_email", e.target.value)}
              />
            </label>
          </div>
          <p className="mt-4 text-sm text-[var(--muted)]">
            Portal login password for the new student will be{" "}
            <span className="font-semibold text-[var(--ink)]">school</span>.
          </p>
        </section>

        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Enrolling…" : "Save and enroll student"}
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
