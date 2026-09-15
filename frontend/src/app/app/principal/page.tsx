import { redirect } from "next/navigation";

/** Legacy hub — use Results and Settings → Session and terms instead. */
export default function PrincipalLegacyRedirect() {
  redirect("/app/results/subject-results");
}
