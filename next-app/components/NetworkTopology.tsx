"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Activity, Server, Users, Zap, Router as RouterIcon, Network, Info } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { apiClient } from '@/api/client';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Custom Node for MikroTik Router
const RouterNode = ({ data }: any) => {
  const isHighCpu = data.cpu > 80;
  return (
    <div className={`glass-card p-3 rounded-xl border shadow-[0_0_15px_rgba(99,102,241,0.3)] w-[200px] transition-colors ${isHighCpu ? 'border-red-500/80 bg-red-500/10' : 'border-indigo-500/50'}`}>
      <div className="flex items-center gap-2 mb-2 border-b border-border/50 pb-2">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isHighCpu ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
          <RouterIcon className="h-4 w-4" />
        </div>
        <div className="overflow-hidden text-ellipsis">
          <div className="font-bold text-sm text-foreground truncate">{data.label}</div>
          <div className="text-[10px] text-muted-foreground truncate">{data.ip} - {data.board}</div>
        </div>
      </div>
      <div className="flex justify-between items-center text-[10px]">
        <div className={`flex items-center gap-1 ${isHighCpu ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
          <Activity className="h-3 w-3" /> {data.cpu || '0'}% CPU
        </div>
        <div className="flex items-center gap-1 text-sky-400">
          <Zap className="h-3 w-3" /> {data.traffic || '0'} Mbps
        </div>
      </div>
    </div>
  );
};

// Custom Node for OLT
const OltNode = ({ data }: any) => {
  return (
    <div className="glass-card p-3 rounded-xl border border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)] w-[200px]">
      <div className="flex items-center gap-2 mb-2 border-b border-border/50 pb-2">
        <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400">
          <Server className="h-4 w-4" />
        </div>
        <div className="overflow-hidden text-ellipsis">
          <div className="font-bold text-sm text-foreground truncate">{data.label}</div>
          <div className="text-[10px] text-muted-foreground truncate">{data.ip} - {data.platform}</div>
        </div>
      </div>
      <div className="flex justify-between items-center text-[10px]">
        <div className="flex items-center gap-1 text-emerald-400">
          <Activity className="h-3 w-3" /> PON Active
        </div>
        <div className="flex items-center gap-1 text-sky-400">
          <Zap className="h-3 w-3" /> {data.traffic || '0'} Mbps
        </div>
      </div>
    </div>
  );
};

const ClientNode = ({ data }: any) => {
  return (
    <div className="glass-card p-2 rounded-lg border border-emerald-500/30 shadow-xs w-[140px] text-center">
      <div className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-1">
        <Users className="h-3 w-3" />
      </div>
      <div className="font-semibold text-xs text-foreground truncate">{data.label}</div>
      <div className="text-[10px] text-muted-foreground">{data.status}</div>
    </div>
  );
};

const nodeTypes = {
  router: RouterNode,
  olt: OltNode,
  client: ClientNode,
};

export default function NetworkTopology() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTopology() {
      try {
        if (nodes.length === 0) setIsLoading(true);

        const [neighborsRes, metricsRes] = await Promise.all([
          apiClient.get('/bandwidth/neighbors'),
          apiClient.get('/bandwidth/metrics').catch(() => null)
        ]);

        const neighbors = neighborsRes.data?.data || [];
        const metrics = metricsRes?.data?.data;
        
        let coreCpu = 0;
        let totalTx = 0;
        if (metrics) {
            coreCpu = parseFloat(metrics.system?.cpuLoad) || 0;
            totalTx = metrics.bandwidth?.total?.rate || 0;
        }

        const initialNodes: Node[] = [
          { 
            id: 'core-1', 
            type: 'router', 
            position: { x: 400, y: 50 }, 
            data: { label: 'Core Router (CCR)', ip: '172.9.16.2', cpu: coreCpu, traffic: totalTx.toFixed(1), board: 'CCR', isCore: true } 
          }
        ];
        const initialEdges: Edge[] = [];

        let xOffset = 50;
        let yOffset = 250;

        neighbors.forEach((n: any, idx: number) => {
          const isOlt = String(n.identity || '').toUpperCase().includes('OLT') || String(n.platform || '').toUpperCase().includes('ZTE') || String(n.platform || '').toUpperCase().includes('HUAWEI');
          
          const nodeId = `neighbor-${idx}`;
          
          let linkTraffic = 0;
          if (metrics && Array.isArray(metrics.interfaces)) {
              const ifaceMetric = metrics.interfaces.find((i: any) => i.interface === n.interface);
              if (ifaceMetric) {
                  linkTraffic = Math.max(ifaceMetric.txRate, ifaceMetric.rxRate); 
              }
          }

          const isCongested = linkTraffic > 500; 

          initialNodes.push({
            id: nodeId,
            type: isOlt ? 'olt' : 'router',
            position: { x: xOffset, y: yOffset },
            data: {
              label: n.identity || 'Unknown Device',
              ip: n['ipv4-address'] || n['mac-address'] || 'Unknown IP',
              platform: n.platform || 'Unknown',
              board: n['board-name'] || '',
              interface: n.interface,
              cpu: 0,
              traffic: linkTraffic.toFixed(1),
              sysDesc: n['system-description']
            }
          });

          initialEdges.push({
            id: `edge-core-${nodeId}`,
            source: 'core-1',
            target: nodeId,
            animated: linkTraffic > 10,
            style: { 
                stroke: isCongested ? '#ef4444' : (isOlt ? '#f97316' : '#38bdf8'), 
                strokeWidth: isCongested ? 4 : 2 
            }
          });

          xOffset += 250;
          if (xOffset > 800) {
            xOffset = 50;
            yOffset += 200;
          }
        });

        if (mounted) {
          setNodes((prevNodes) => {
            if (prevNodes.length === 0) return initialNodes;
            return prevNodes.map(n => {
                const nextNode = initialNodes.find(inNode => inNode.id === n.id);
                return nextNode ? { ...n, data: { ...n.data, ...nextNode.data } } : n;
            });
          });
          setEdges(initialEdges);
        }
      } catch (err) {
        console.error('Failed to load topology data', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadTopology();
    
    const interval = setInterval(loadTopology, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  return (
    <>
      <Card className="w-full h-[600px] p-0 overflow-hidden relative">
        {isLoading && nodes.length === 0 && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="animate-pulse flex items-center gap-2">
              <Network className="w-5 h-5 text-primary animate-spin" />
              <span className="text-sm font-medium">Discovering network topology...</span>
            </div>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-grid-pattern dark:bg-grid-pattern"
        >
          <Controls className="bg-surface/80 backdrop-blur border-border" />
          <MiniMap 
            nodeColor={(node) => {
              switch (node.type) {
                case 'router': return '#6366f1';
                case 'olt': return '#f97316';
                case 'client': return '#10b981';
                default: return '#eee';
              }
            }}
            className="bg-surface border-border rounded-lg"
            maskColor="rgba(0,0,0,0.2)"
          />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="rgba(150, 150, 150, 0.2)" />
        </ReactFlow>
        
        {/* Legend Overlay */}
        <div className="absolute top-4 right-4 glass-panel p-3 rounded-lg text-xs space-y-2 border border-border/50 z-10 bg-card/80 backdrop-blur-sm">
          <div className="font-semibold mb-2">Network Legend</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-indigo-500"></div>
            <span>MikroTik Router</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-500"></div>
            <span>OLT Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-sky-400"></div>
            <span>Active Uplink</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-red-500"></div>
            <span>Congested Link (&gt;500M)</span>
          </div>
        </div>
      </Card>

      <Sheet open={Boolean(selectedNode)} onOpenChange={(open) => !open && setSelectedNode(null)}>
        <SheetContent className="w-full sm:max-w-md border-border bg-card overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Device Details
            </SheetTitle>
            <SheetDescription>Real-time metrics and device information</SheetDescription>
          </SheetHeader>
          
          {selectedNode && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedNode.data.label as string}</h3>
                  <p className="text-sm text-muted-foreground">{selectedNode.data.ip as string}</p>
                </div>
                <Badge variant="outline" className={selectedNode.type === 'olt' ? 'border-orange-500/50 text-orange-500' : 'border-indigo-500/50 text-indigo-500'}>
                   {selectedNode.type === 'olt' ? 'OLT' : 'Router'}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 shadow-none border-border/50 bg-muted/20">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3 w-3" /> CPU Load
                    </span>
                    <span className={`text-xl font-bold ${Number(selectedNode.data.cpu) > 80 ? 'text-red-500' : 'text-foreground'}`}>
                      {selectedNode.data.cpu as string}%
                    </span>
                  </div>
                </Card>
                <Card className="p-4 shadow-none border-border/50 bg-muted/20">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Zap className="h-3 w-3" /> Interface Traffic
                    </span>
                    <span className="text-xl font-bold text-foreground">
                      {selectedNode.data.traffic as string} <span className="text-sm font-normal text-muted-foreground">Mbps</span>
                    </span>
                  </div>
                </Card>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold">System Information</h4>
                <div className="space-y-2 text-sm border border-border/50 rounded-lg p-3 bg-muted/10">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform</span>
                    <span className="font-medium text-right">{selectedNode.data.platform as string || (selectedNode.data.isCore ? 'RouterOS' : '—')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Board Name</span>
                    <span className="font-medium text-right">{selectedNode.data.board as string || '—'}</span>
                  </div>
                  {(selectedNode.data.interface as string) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Connected via</span>
                      <span className="font-medium text-right font-mono">{selectedNode.data.interface as string}</span>
                    </div>
                  )}
                  {(selectedNode.data.sysDesc as string) && (
                    <div className="flex flex-col pt-2 mt-2 border-t border-border/50 gap-1">
                      <span className="text-muted-foreground">Description</span>
                      <span className="text-xs text-muted-foreground">{selectedNode.data.sysDesc as string}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
