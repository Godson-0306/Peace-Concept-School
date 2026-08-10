"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import StudentEnrollForm from "@/components/StudentEnrollForm";

function NewStudentInner() {
  const searchParams = useSearchParams();
  const applicationRaw = searchParams.get("application");
  const studentRaw = searchParams.get("id");
  const applicationId = applicationRaw ? Number(applicationRaw) : null;
  const studentId = studentRaw ? Number(studentRaw) : null;
  const validApplicationId =
    applicationId && !Number.isNaN(applicationId) ? applicationId : null;
  const validStudentId =
    studentId && !Number.isNaN(studentId) ? studentId : null;

  const fromApplication = Boolean(validApplicationId) && !validStudentId;
  const isEdit = Boolean(validStudentId);

  return (
    <StudentEnrollForm
      applicationId={fromApplication ? validApplicationId : null}
      studentId={validStudentId}
      eyebrow={
        isEdit
          ? "Users · Edit"
          : fromApplication
            ? "Admission · Accept"
            : "Users · New User"
      }
      title={isEdit ? "Edit Student" : "New Student"}
      description={
        isEdit
          ? "Update student details. Student ID and admission year cannot be changed."
          : fromApplication
            ? "Application details are prefilled. Complete the remaining fields and save to enroll."
            : "Create a student account and add them to the portal immediately."
      }
      backHref={fromApplication ? "/app/admission" : "/app/users"}
      backLabel={fromApplication ? "Back to admissions" : "Back to Users"}
      successPrimaryHref={fromApplication ? "/app/admission" : "/app/users"}
      successPrimaryLabel={
        fromApplication ? "Back to admissions" : "View All Students"
      }
    />
  );
}

export default function UsersNewStudentPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
      <NewStudentInner />
    </Suspense>
  );
}
