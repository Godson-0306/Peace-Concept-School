"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import UsersStudentsPanel from "@/components/UsersStudentsPanel";
import { apiJson } from "@/lib/api";

type ClassLevel = { id: number; name: string };

function unwrapList<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

export default function UsersClassLevelPage() {
  const params = useParams<{ levelId: string }>();
  const levelId = params.levelId;
  const [levelName, setLevelName] = useState("Class");

  useEffect(() => {
    apiJson<{ results?: ClassLevel[] } | ClassLevel[]>("/api/class-levels/")
      .then((data) => {
        const match = unwrapList(data).find((level) => String(level.id) === String(levelId));
        if (match) setLevelName(match.name);
      })
      .catch(() => undefined);
  }, [levelId]);

  return (
    <UsersStudentsPanel
      title={levelName}
      description={`Active students in ${levelName} (all arms).`}
      query={`is_active=true&class_level=${levelId}`}
    />
  );
}
