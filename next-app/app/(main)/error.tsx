"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/telemetry";

export default function MainSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    captureException(error, { digest: error.digest, boundary: "main" });
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          This page couldn’t be loaded. Try again, or go back to the home screen.
        </p>
        {process.env.NODE_ENV === "development" && error.message ? (
          <pre className="mx-auto mt-4 max-w-lg overflow-auto rounded-md border border-border bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/")}>
          Go to home
        </Button>
      </div>
    </div>
  );
}
