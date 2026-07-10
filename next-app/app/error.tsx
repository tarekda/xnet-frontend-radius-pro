"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/telemetry";

/** Fallback for errors in routes not covered by a nested `error.tsx` (still wrapped by root layout). */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
    captureException(error, { digest: error.digest, boundary: "root" });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-background px-4 py-12 text-foreground">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The application hit an unexpected error. You can retry or return to the login page.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/login")}>
          Go to login
        </Button>
      </div>
    </div>
  );
}
