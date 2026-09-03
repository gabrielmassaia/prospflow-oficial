"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { loginAction } from "@/app/actions/auth/login";
import { signupAction } from "@/app/actions/auth/signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const companyName = String(form.get("companyName") ?? "");

    const result = await signupAction({ name, email, password, companyName });

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const loginResult = await loginAction({ email, password });

    setLoading(false);

    if (!loginResult.ok) {
      setError("Conta criada. Tente fazer login.");
      return;
    }

    router.push("/prospeccao");
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Comece a prospectar clientes hoje mesmo
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="border-destructive/25 bg-destructive/8 text-destructive rounded-lg border px-3.5 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="name">Seu nome</Label>
          <Input id="name" name="name" required placeholder="João Silva" className="h-10" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="companyName">Nome da agência</Label>
          <Input
            id="companyName"
            name="companyName"
            required
            placeholder="Acme Marketing"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="voce@empresa.com"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className="h-10 pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 hover:bg-transparent"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Button type="submit" className="h-10 w-full" disabled={loading}>
          {loading ? "Criando conta..." : "Criar conta grátis"}
        </Button>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Já tem conta?{" "}
        <Link
          href="/login"
          className="text-primary hover:text-primary/75 font-medium transition-colors"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
