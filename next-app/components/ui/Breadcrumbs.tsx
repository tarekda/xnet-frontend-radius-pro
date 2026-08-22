import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import TopBarActions from "@/components/ui/TopBarActions";

function formatSegment(segment: string): string {
  const decoded = decodeURIComponent(segment);
  if (/^\d+$/.test(decoded)) return decoded;
  return decoded.replace(/-/g, " ");
}

/** Map section crumbs to real list/index routes (pathname segments alone are often invalid). */
const BREADCRUMB_SECTION_ROOTS: Record<string, string> = {
  users: "/users/list",
  profiles: "/profiles/list",
};

const USERS_STATIC_SEGMENTS = new Set(["list", "new"]);

function resolveBreadcrumbHref(pathnames: string[], index: number): string {
  const segment = pathnames[index];
  const usersIndex = pathnames.indexOf("users");

  const sectionRoot = BREADCRUMB_SECTION_ROOTS[segment];
  if (sectionRoot) return sectionRoot;

  if (usersIndex >= 0 && index === usersIndex + 1 && !USERS_STATIC_SEGMENTS.has(segment)) {
    return `/users/${encodeURIComponent(segment)}`;
  }

  return `/${pathnames.slice(0, index + 1).join("/")}`;
}

const Breadcrumb: React.FC = () => {
  const pathname = usePathname();
  const pathnames = pathname.split("/").filter(Boolean);

  return (
    <div className="sticky top-2 z-30 mb-5 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-2.5 backdrop-blur-xl shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-md">
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 pl-10 text-sm md:pl-0">
        <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
          <li className="flex items-center gap-1 min-w-0">
            <Link
              href="/"
              aria-label="Home"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
                "bg-secondary/40 text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-primary active:scale-95"
              )}
            >
              <Home className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </li>
          {pathnames.map((value: string, index: number) => {
            const routeTo = resolveBreadcrumbHref(pathnames, index);
            const isLast = index === pathnames.length - 1;
            const label = formatSegment(value);

            return (
              <li key={`${routeTo}-${index}`} className="flex items-center gap-1.5 min-w-0">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" aria-hidden />
                {isLast ? (
                  <span
                    className="max-w-[min(100%,14rem)] truncate rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary sm:max-w-[20rem]"
                    aria-current="page"
                  >
                    {label}
                  </span>
                ) : (
                  <Link
                    href={routeTo}
                    className={cn(
                      "max-w-[10rem] truncate rounded-lg px-2.5 py-1 text-xs font-medium sm:max-w-xs",
                      "text-muted-foreground transition-all duration-200 hover:bg-secondary/70 hover:text-foreground active:scale-95"
                    )}
                  >
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <TopBarActions />
    </div>
  );
};

export default Breadcrumb;
