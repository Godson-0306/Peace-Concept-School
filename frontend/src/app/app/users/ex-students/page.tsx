"use client";

import UsersStudentsPanel from "@/components/UsersStudentsPanel";

export default function ExStudentsPage() {
  return (
    <UsersStudentsPanel
      title="Ex-Students"
      description="Graduated and inactive students no longer assigned to a class."
      query="is_active=false"
    />
  );
}
