"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";

type Status = { type: "success" | "error"; message: string } | null;

const classOptions = [
  "JSS1",
  "JSS2",
  "JSS3",
  "SSS1",
  "SSS2",
  "SSS3",
];

export default function ApplicationForm() {
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await apiFetch("/api/website/applications/", {
        method: "POST",
        body: JSON.stringify({
          student_full_name: data.get("student_full_name"),
          gender: data.get("gender"),
          date_of_birth: data.get("date_of_birth"),
          applying_for_class: data.get("applying_for_class"),
          previous_school: data.get("previous_school"),
          guardian_name: data.get("guardian_name"),
          guardian_email: data.get("guardian_email"),
          guardian_phone: data.get("guardian_phone"),
          address: data.get("address"),
          notes: data.get("notes"),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(
          err?.detail ||
            err?.message ||
            "Unable to submit application. Please try again.",
        );
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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
          <label htmlFor="app-guardian_name">Guardian name</label>
          <input id="app-guardian_name" name="guardian_name" required />
        </div>
        <div className="field">
          <label htmlFor="app-guardian_email">Guardian email</label>
          <input
            id="app-guardian_email"
            name="guardian_email"
            type="email"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="app-guardian_phone">Guardian phone</label>
          <input
            id="app-guardian_phone"
            name="guardian_phone"
            type="tel"
            required
            placeholder="+234..."
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="app-address">Address</label>
          <textarea id="app-address" name="address" rows={3} required />
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
        {pending ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}
