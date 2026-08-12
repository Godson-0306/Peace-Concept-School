import { redirect } from "next/navigation";

export default function StoreRedirectPage() {
  redirect("/app/inventory");
}
