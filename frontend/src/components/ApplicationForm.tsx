"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import { CLASS_LEVELS } from "@/lib/brand";

type Status = { type: "success" | "error"; message: string } | null;

const classOptions = [...CLASS_LEVELS];

function errorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Unable to submit application.";
  const data = err as Record<string, unknown>;
  if (typeof data.detail === "string") return data.detail;
  if (typeof data.non_field_errors === "object" && Array.isArray(data.non_field_errors)) {
    return String(data.non_field_errors[0] || "Unable to submit application.");
  }
  const first = Object.values(data).find(
    (value) => Array.isArray(value) && typeof value[0] === "string",
  );
  if (Array.isArray(first)) return String(first[0]);
  return "Unable to submit application. Please try again.";
}

export default function ApplicationForm() {
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const photo = data.get("passport_photo");
    if (!(photo instanceof File) || photo.size === 0) {
      data.delete("passport_photo");
    }

    // Mirror guardian email onto student email when useful for later enroll.
    const guardianEmail = String(data.get("guardian_email") ?? "").trim();
    if (guardianEmail && !String(data.get("email") ?? "").trim()) {
      data.set("email", guardianEmail);
    }

    try {
      const response = await apiFetch("/api/website/applications/", {
        method: "POST",
        body: data,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(errorMessage(payload));
      }

      form.reset();
      setStatus({
        type: "success",
        message:
          "Application submitted successfully. The admissions office will contact you.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit application. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" encType="multipart/form-data">
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        Share the essentials for your child&apos;s application. The school will
        complete full enrollment details after acceptance.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor="app-passport_photo">Passport photo (optional)</label>
          <input
            id="app-passport_photo"
            name="passport_photo"
            type="file"
            accept="image/*"
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="app-student_full_name">Student full name</label>
          <input id="app-student_full_name" name="student_full_name" required />
        </div>
        <div className="field">
          <label htmlFor="app-gender">Gender</label>
          <select id="app-gender" name="gender" required defaultValue="">
            <option value="" disabled>
              Select gender
            </option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="app-date_of_birth">Date of birth</label>
          <input id="app-date_of_birth" name="date_of_birth" type="date" required />
        </div>
        <div className="field">
          <label htmlFor="app-applying_for_class">Class applying for</label>
          <select
            id="app-applying_for_class"
            name="applying_for_class"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select class
            </option>
            {classOptions.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="app-previous_school">Previous school (optional)</label>
          <input id="app-previous_school" name="previous_school" />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="app-address">Home address</label>
          <textarea id="app-address" name="address" rows={3} required />
        </div>
        <div className="field">
          <label htmlFor="app-guardian_name">Parent / guardian name</label>
          <input id="app-guardian_name" name="guardian_name" required />
        </div>
        <div className="field">
          <label htmlFor="app-guardian_phone">Parent / guardian phone</label>
          <input id="app-guardian_phone" name="guardian_phone" required />
        </div>
        <div className="field">
          <label htmlFor="app-whatsapp_phone">WhatsApp (optional)</label>
          <input id="app-whatsapp_phone" name="whatsapp_phone" />
        </div>
        <div className="field">
          <label htmlFor="app-guardian_email">Email (optional)</label>
          <input id="app-guardian_email" name="guardian_email" type="email" />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="app-notes">Notes (optional)</label>
          <textarea id="app-notes" name="notes" rows={3} />
        </div>
      </div>

      {status ? (
        <p className={`form-status ${status.type}`} role="status">
          {status.message}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
