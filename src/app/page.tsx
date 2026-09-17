import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/server/auth/session";

export default async function HomePage() {
  try {
    await getServerAuthContext();
    redirect("/overview");
  } catch {
    redirect("/login");
  }
}
