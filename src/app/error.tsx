"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Algo deu errado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente novamente ou volte para o dashboard.
            </p>
          </div>
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={reset}>
              Tentar novamente
            </Button>
            <Button className="flex-1" nativeButton={false} render={<Link href="/prospeccao" />}>
              Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
