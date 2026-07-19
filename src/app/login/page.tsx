import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Σύνδεση" };

export default async function LoginPage() {
  if (await getSessionUserId()) redirect("/dashboard");
  return <LoginForm />;
}
