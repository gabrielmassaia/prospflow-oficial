import { Skeleton } from "@/components/ui/skeleton";

interface LoadingContentProps {
  title?: string;
  withHeader?: boolean;
  rows?: number;
}

export function LoadingContent({ title, withHeader = true, rows = 4 }: LoadingContentProps) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      {withHeader && (
        <div className="space-y-2">
          {title && <p className="text-sm text-muted-foreground">{title}</p>}
          <Skeleton className="h-8 w-64" />
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
