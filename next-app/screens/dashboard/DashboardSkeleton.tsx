import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Full-page loading placeholder shown while the dashboard boots. */
const DashboardSkeleton = () => (
  <>
    {/* Stats Grid Skeleton */}
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3.5 pb-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-8 w-[60px] mb-2" />
                <Skeleton className="h-3 w-[80px]" />
              </div>
              <Skeleton className="h-6 w-[60px]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    {/* System Health Skeleton */}
    <div className="grid w-full min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-7">
      <Card className="md:col-span-4">
        <CardHeader className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-[120px] mb-2" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-[60px]" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Activity Skeleton */}
      <Card className="md:col-span-3">
        <CardHeader className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-[120px] mb-2" />
              <Skeleton className="h-4 w-[180px]" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-[80px]" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-md border border-border p-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[120px]" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  </>
);

export default DashboardSkeleton;
