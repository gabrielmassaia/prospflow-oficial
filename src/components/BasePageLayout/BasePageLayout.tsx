import type { ReactNode } from "react";

interface BasePageLayoutProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function BasePageLayout({ title, description, actions, children }: BasePageLayoutProps) {
  return (
    <div className="flex flex-1 flex-col p-8">
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
