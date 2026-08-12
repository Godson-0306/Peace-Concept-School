import { redirect } from "next/navigation";

/** Legacy hub — use Results → Subject Results instead. */
export default function TeacherLegacyRedirect() {
  redirect("/app/results/subject-results");
}
