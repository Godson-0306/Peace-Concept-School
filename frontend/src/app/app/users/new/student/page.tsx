"use client";

import StudentEnrollForm from "@/components/StudentEnrollForm";

export default function UsersNewStudentPage() {
  return (
    <StudentEnrollForm
      eyebrow="Users · New User"
      title="New Student"
      description="Create a student account and add them to the portal immediately. Default password is school."
      backHref="/app/users"
      backLabel="Back to Users"
      successPrimaryHref="/app/users"
      successPrimaryLabel="View All Students"
    />
  );
}
