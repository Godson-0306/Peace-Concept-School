import { redirect } from "next/navigation";

export default function SettingsTermsRedirectPage() {
  redirect("/app/settings/session");
}
