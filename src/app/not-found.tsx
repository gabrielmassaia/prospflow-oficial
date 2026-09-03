import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Compass className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Página não encontrada</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O endereço acessado não existe ou foi movido.
            </p>
          </div>
          <Button nativeButton={false} render={<Link href="/prospeccao" />}>
            Voltar para o dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
