import type { Metadata } from "next";

import { redirectIfAuthenticated } from "@/lib/tenant";

import { LoginForm } from "./_components/LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Entrar" };
}

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return <LoginForm />;
}
