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
    <form onSubmit={onSubmit} className="space-y-8" encType="multipart/form-data">
      <section className="space-y-4">
        <h3 className="font-display text-xl font-semibold text-[var(--brand-blue-deep)]">
          Student information
        </h3>
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
            <label htmlFor="app-email">Email</label>
            <input id="app-email" name="email" type="email" />
          </div>
          <div className="field">
            <label htmlFor="app-gender">Gender</label>
            <select id="app-gender" name="gender" required defaultValue="">
              <option value="" disabled>
                Select gender
              </option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other / Prefer not to say</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="app-date_of_birth">Date of birth</label>
            <input id="app-date_of_birth" name="date_of_birth" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="app-applying_for_class">Applying for class</label>
            <select
              id="app-applying_for_class"
              name="applying_for_class"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select class
              </option>
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="app-previous_school">Previous school</label>
            <input id="app-previous_school" name="previous_school" />
          </div>
          <div className="field">
            <label htmlFor="app-state_of_origin">State of origin</label>
            <input id="app-state_of_origin" name="state_of_origin" />
          </div>
          <div className="field">
            <label htmlFor="app-blood_group">Blood group</label>
            <input id="app-blood_group" name="blood_group" placeholder="e.g. O+" />
          </div>
          <div className="field">
            <label htmlFor="app-genotype">Genotype</label>
            <input id="app-genotype" name="genotype" placeholder="e.g. AA" />
          </div>
          <div className="field">
            <label htmlFor="app-disability">Disability</label>
            <input id="app-disability" name="disability" placeholder="None if not applicable" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-xl font-semibold text-[var(--brand-blue-deep)]">
          Contact and address
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field sm:col-span-2">
            <label htmlFor="app-address">Home address</label>
            <textarea id="app-address" name="address" rows={3} required />
          </div>
          <div className="field">
            <label htmlFor="app-city_of_residence">City of residence</label>
            <input id="app-city_of_residence" name="city_of_residence" />
          </div>
          <div className="field">
            <label htmlFor="app-lga">LGA</label>
            <input id="app-lga" name="lga" />
          </div>
          <div className="field">
            <label htmlFor="app-phone">Phone number</label>
            <input id="app-phone" name="phone" type="tel" placeholder="+234..." />
          </div>
          <div className="field">
            <label htmlFor="app-whatsapp_phone">WhatsApp number</label>
            <input
              id="app-whatsapp_phone"
              name="whatsapp_phone"
              type="tel"
              placeholder="+234..."
            />
          </div>
          <div className="field">
            <label htmlFor="app-next_of_kin_name">Next of kin name</label>
            <input id="app-next_of_kin_name" name="next_of_kin_name" />
          </div>
          <div className="field">
            <label htmlFor="app-next_of_kin_relationship">Relationship</label>
            <input id="app-next_of_kin_relationship" name="next_of_kin_relationship" />
          </div>
          <div className="field sm:col-span-2">
            <label htmlFor="app-next_of_kin_address">Next of kin address</label>
            <textarea id="app-next_of_kin_address" name="next_of_kin_address" rows={2} />
          </div>
          <div className="field">
            <label htmlFor="app-next_of_kin_phone">Next of kin phone</label>
            <input id="app-next_of_kin_phone" name="next_of_kin_phone" type="tel" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-display text-xl font-semibold text-[var(--brand-blue-deep)]">
          Parents details
        </h3>
        <p className="text-sm text-[var(--muted)]">
          Provide at least one parent name and a phone or WhatsApp number.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="app-father_name">Father&apos;s name</label>
            <input id="app-father_name" name="father_name" />
          </div>
          <div className="field">
            <label htmlFor="app-mother_name">Mother&apos;s name</label>
            <input id="app-mother_name" name="mother_name" />
          </div>
          <div className="field">
            <label htmlFor="app-father_phone">Father&apos;s phone</label>
            <input id="app-father_phone" name="father_phone" type="tel" />
          </div>
          <div className="field">
            <label htmlFor="app-father_whatsapp">Father&apos;s WhatsApp</label>
            <input id="app-father_whatsapp" name="father_whatsapp" type="tel" />
          </div>
          <div className="field">
            <label htmlFor="app-mother_phone">Mother&apos;s phone</label>
            <input id="app-mother_phone" name="mother_phone" type="tel" />
          </div>
          <div className="field">
            <label htmlFor="app-mother_whatsapp">Mother&apos;s WhatsApp</label>
            <input id="app-mother_whatsapp" name="mother_whatsapp" type="tel" />
          </div>
          <div className="field">
            <label htmlFor="app-hometown">Hometown</label>
            <input id="app-hometown" name="hometown" />
          </div>
          <div className="field">
            <label htmlFor="app-guardian_email">Contact email</label>
            <input id="app-guardian_email" name="guardian_email" type="email" />
          </div>
          <div className="field sm:col-span-2">
            <label htmlFor="app-notes">Notes (optional)</label>
            <textarea id="app-notes" name="notes" rows={3} />
          </div>
        </div>
      </section>

      {status ? (
        <p className={`form-status ${status.type}`} role="status">
          {status.message}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}
