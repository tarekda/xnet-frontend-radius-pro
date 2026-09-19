"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import PageHeader from '@/components/PageHeader';
import { Network } from 'lucide-react';

// Lazily load the React Flow based topology viewer so its bundle isn't part of the route's initial JS.
const NetworkTopology = dynamic(() => import('@/components/NetworkTopology'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
      Loading topology…
    </div>
  ),
});

export default function TopologyPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Network Topology"
        subtitle="Interactive visualization of your Mikrotik infrastructure and active client sectors."
        icon={Network}
      />
      <div className="glass-panel p-1 rounded-2xl">
        <NetworkTopology />
      </div>
    </div>
  );
}
