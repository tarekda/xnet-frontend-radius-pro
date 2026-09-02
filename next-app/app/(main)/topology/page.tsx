"use client";

import React from 'react';
import NetworkTopology from '@/components/NetworkTopology';
import PageHeader from '@/components/PageHeader';
import { Network } from 'lucide-react';

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
