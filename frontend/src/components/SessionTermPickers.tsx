"use client";

import { termsForOneSession, type PortalSession, type PortalTerm } from "@/lib/terms";

type Props = {
  sessions: PortalSession[];
  terms: PortalTerm[];
  sessionId: number | "";
  termId: number | "";
  onSessionChange: (sessionId: number | "") => void;
  onTermChange: (termId: number | "") => void;
  disabled?: boolean;
};

export default function SessionTermPickers({
  sessions,
  terms,
  sessionId,
  termId,
  onSessionChange,
  onTermChange,
  disabled,
}: Props) {
  const sessionTerms = termsForOneSession(terms, sessionId || null);

  return (
    <>
      <select
        className="field-input"
        value={sessionId}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value ? Number(event.target.value) : "";
          onSessionChange(next);
          if (!next) {
            onTermChange("");
            return;
          }
          const inSession = termsForOneSession(terms, next);
          const preferred =
            inSession.find((term) => term.is_active) ??
            inSession.find((term) => term.number === 1) ??
            inSession[0];
          onTermChange(preferred?.id ?? "");
        }}
      >
        <option value="">Select session</option>
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {session.name}
            {session.is_active ? " (active)" : ""}
          </option>
        ))}
      </select>
      <select
        className="field-input"
        value={termId}
        disabled={disabled || !sessionId}
        onChange={(event) =>
          onTermChange(event.target.value ? Number(event.target.value) : "")
        }
      >
        <option value="">Select term</option>
        {sessionTerms.map((term) => (
          <option key={term.id} value={term.id}>
            {term.name}
            {term.is_active ? " (active)" : ""}
          </option>
        ))}
      </select>
    </>
  );
}
