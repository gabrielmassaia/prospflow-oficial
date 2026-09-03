import type { Metadata } from "next";

import { redirectIfAuthenticated } from "@/lib/tenant";

import { RegisterForm } from "./_components/RegisterForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Criar conta" };
}

export default async function RegisterPage() {
  await redirectIfAuthenticated();

  return <RegisterForm />;
}
