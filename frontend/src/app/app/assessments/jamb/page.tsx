import { redirect } from "next/navigation";

/** JAMB CBT integration is pending — hide until the external engine is wired. */
export default function JambCbtPage() {
  redirect("/app/assessments/normal");
}
