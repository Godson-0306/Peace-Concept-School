"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";

type Status = { type: "success" | "error"; message: string } | null;

export default function EnquiryForm() {
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await apiFetch("/api/website/enquiries/", {
        method: "POST",
        body: JSON.stringify({
          full_name: data.get("full_name"),
          email: data.get("email"),
          phone: data.get("phone"),
          subject: data.get("subject"),
          message: data.get("message"),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(
          err?.detail || err?.message || "Unable to send enquiry. Please try again.",
        );
      }

      form.reset();
      setStatus({
        type: "success",
        message: "Thank you. Your enquiry has been received. We will respond shortly.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to send enquiry. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label htmlFor="enquiry-full_name">Full name</label>
          <input id="enquiry-full_name" name="full_name" required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="enquiry-email">Email</label>
          <input
            id="enquiry-email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="enquiry-phone">Phone</label>
          <input
            id="enquiry-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="+234..."
          />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="enquiry-subject">Subject</label>
          <input id="enquiry-subject" name="subject" required />
        </div>
        <div className="field sm:col-span-2">
          <label htmlFor="enquiry-message">Message</label>
          <textarea id="enquiry-message" name="message" rows={5} required />
        </div>
      </div>

      {status ? (
        <p className={`form-status ${status.type}`} role="status">
          {status.message}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Sending..." : "Send enquiry"}
      </button>
    </form>
  );
}
