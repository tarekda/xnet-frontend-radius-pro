import React from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users as UsersIcon } from "lucide-react";

export const UsersPageSkeleton = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="w-full space-y-6 py-6">
    <PageHeader
      title={title}
      subtitle={subtitle}
      icon={UsersIcon}
      rightContent={<Skeleton className="h-10 w-full md:w-[260px]" />}
      actions={
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      }
    />

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {[1, 2, 3].map((i) => (
        <div key={i} className="lg:col-span-4">
          <Card className="border bg-card/60">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-20" />
              <Skeleton className="mt-2 h-3 w-28" />
            </CardContent>
          </Card>
        </div>
      ))}
      <Card className="lg:col-span-12">
        <CardContent className="p-4">
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="mt-3 h-8 w-full" />
        </CardContent>
      </Card>
    </div>

    <Card className="border-none shadow-none">
      <CardContent className="px-0">
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </CardContent>
    </Card>
  </div>
);
