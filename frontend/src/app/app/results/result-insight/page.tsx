import { redirect } from "next/navigation";

/** Result Insight is not ready — keep the route but hide from nav. */
export default function ResultInsightPage() {
  redirect("/app/results/subject-results");
}
