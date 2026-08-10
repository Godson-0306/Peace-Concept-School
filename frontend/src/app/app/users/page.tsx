"use client";

import UsersStudentsPanel from "@/components/UsersStudentsPanel";

export default function UsersAllStudentsPage() {
  return (
    <UsersStudentsPanel
      title="All Students"
      description="Active students across every class level."
      query="is_active=true"
    />
  );
}
