"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Card } from './ui/card';

let Globe: any = null;

// Dynamic import with noSSR is usually needed for react-globe.gl in Next.js, 
// but we handle it via lazy loading inside the component to prevent hydration errors.
export default function GlobalTrafficMap() {
  const [isClient, setIsClient] = useState(false);
  const globeEl = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setIsClient(true);
    // Load Globe dynamically to avoid SSR issues with Three.js
    import('react-globe.gl').then((mod) => {
      Globe = mod.default;
    });

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || 500
        });
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate some mock active PPPoE connection arcs and pulses
  const N = 40;
  const arcsData = useMemo(() => {
    return [...Array(N).keys()].map(() => ({
      startLat: (Math.random() - 0.5) * 180,
      startLng: (Math.random() - 0.5) * 360,
      endLat: 33.8938, // Central hub (e.g., Beirut, Lebanon)
      endLng: 35.5018,
      color: ['#10b981', '#38bdf8', '#6366f1'][Math.floor(Math.random() * 3)]
    }));
  }, []);

  const ringsData = useMemo(() => {
    return [
      { lat: 33.8938, lng: 35.5018, maxR: 20, propagationSpeed: 2, repeatPeriod: 1000 }
    ];
  }, []);

  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.5;
      globeEl.current.pointOfView({ lat: 25, lng: 35, altitude: 2 });
    }
  }, [globeEl.current]);

  if (!isClient || !Globe) {
    return (
      <Card className="w-full h-[500px] flex items-center justify-center bg-surface/50">
        <div className="animate-pulse text-muted-foreground text-sm">Initializing 3D Telemetry Map...</div>
      </Card>
    );
  }

  return (
    <Card className="w-full h-[500px] p-0 overflow-hidden relative border-border/50 shadow-2xl glass-panel" ref={containerRef}>
      <Globe
        ref={globeEl}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        arcsData={arcsData}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashInitialGap={() => Math.random()}
        arcDashAnimateTime={2500}
        ringsData={ringsData}
        ringColor={() => '#6366f1'}
        ringMaxRadius="maxR"
        ringPropagationSpeed="propagationSpeed"
        ringRepeatPeriod="repeatPeriod"
        backgroundColor="rgba(0,0,0,0)"
      />
      <div className="absolute top-4 left-4 glass-panel p-3 rounded-lg text-xs space-y-1 border border-border/50">
        <div className="font-semibold text-emerald-400">● Live Connection Streams</div>
        <div className="text-muted-foreground">{N} active Netflow streams</div>
      </div>
    </Card>
  );
}
