"use client";

import { useParams } from "next/navigation";
import StudentEnrollForm from "@/components/StudentEnrollForm";

export default function AdmissionEnrollPage() {
  const params = useParams();
  const rawId = String(params.id || "");
  const isManual = rawId === "new";
  const applicationId = isManual ? null : Number(rawId);

  return (
    <StudentEnrollForm
      applicationId={applicationId}
      eyebrow="Admission"
      title={isManual ? "Manual enrollment" : "Enroll applicant"}
      description={
        isManual
          ? "Add a student directly to the portal."
          : "Prefilling from the online application."
      }
      backHref="/app/admission"
      backLabel="Back to inbox"
      successPrimaryHref="/app/admission"
      successPrimaryLabel="Back to admissions"
    />
  );
}
