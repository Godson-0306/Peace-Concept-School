import { redirect } from "next/navigation";

/** Legacy hub — modern Users / Admission / Gallery modules supersede this. */
export default function AdminLegacyRedirect() {
  redirect("/app/users");
}
