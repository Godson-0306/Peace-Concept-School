import { redirect } from "next/navigation";

/** Legacy hub — use Results and Settings → Session Term instead. */
export default function PrincipalLegacyRedirect() {
  redirect("/app/results/subject-results");
}
