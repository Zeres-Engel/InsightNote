import React, { useState, useRef, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import {
  Maximize2,
  Search,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Info,
  GitCommit,
  X,
  HelpCircle,
  Network
} from 'lucide-react';
import { GraphNode, GraphLink, GraphPath, NodeDetailsResponse } from '../../lib/types';

interface KnowledgeGraphPanelProps {
  graphData: { nodes: GraphNode[]; links: GraphLink[] };
  highlightPath: GraphPath;
  onNodeClick: (nodeId: string) => Promise<NodeDetailsResponse>;
}

export const KnowledgeGraphPanel: React.FC<KnowledgeGraphPanelProps> = ({
  graphData,
  highlightPath,
  onNodeClick,
}) => {
  const fgRef = useRef<any>();
  const [selectedNode, setSelectedNode] = useState<NodeDetailsResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Group node colors
  const groupColors: Record<string, string> = {
    document: '#10b981', // emerald
    clause: '#3b82f6',    // blue
    concept: '#a855f7',   // purple
    process: '#eab308',   // yellow
    rule: '#ef4444',      // red
    person: '#ec4899',    // pink
  };

  // Node Click handler
  const handleNodeClick = async (node: any) => {
    setIsLoadingDetails(true);
    try {
      const details = await onNodeClick(node.id);
      setSelectedNode(details);

      // Auto-focus camera on clicked node
      if (fgRef.current && node.x !== undefined) {
        const distance = 80;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        fgRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          node, // lookAt
          2000  // transition ms
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return graphData.nodes;
    const query = searchQuery.toLowerCase();
    return graphData.nodes.filter(
      n => n.label.toLowerCase().includes(query) || n.type.toLowerCase().includes(query)
    );
  }, [graphData.nodes, searchQuery]);

  // Adjust nodes/links for the render engine based on highlighting path
  const processedData = useMemo(() => {
    const hasActiveHighlight = highlightPath.node_ids.length > 0;

    const nodes = graphData.nodes.map(node => {
      const isHighlighted = highlightPath.node_ids.includes(node.id);

      // Compute color
      let color = groupColors[node.group] || '#94a3b8';
      let val = 1.5; // default size value

      if (hasActiveHighlight) {
        if (isHighlighted) {
          color = '#fbbf24'; // Gold / Orange highlight color
          val = 3.5;         // Grow node
        } else {
          // Dim non-highlighted nodes
          color = 'rgba(51, 65, 85, 0.25)';
          val = 1.0;
        }
      }

      return {
        ...node,
        color,
        val
      };
    });

    const links = graphData.links.map(link => {
      // link.source/target can be objects if react-force-graph has processed them, or strings
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      const isHighlighted = highlightPath.link_ids.includes(link.id);

      let color = '#475569'; // default slate-600
      let width = 1.0;

      if (hasActiveHighlight) {
        if (isHighlighted) {
          color = '#f59e0b'; // amber
          width = 3.5;
        } else {
          color = 'rgba(30, 41, 59, 0.1)';
          width = 0.5;
        }
      }

      return {
        ...link,
        color,
        width
      };
    });

    return { nodes, links };
  }, [graphData, highlightPath]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Find first matching node
    const match = graphData.nodes.find(
      n => n.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (match && fgRef.current) {
      // Find rendered node in forcegraph to get coordinates
      const renderedNode = fgRef.current.graphData().nodes.find((n: any) => n.id === match.id);
      if (renderedNode) {
        handleNodeClick(renderedNode);
      }
    }
  };

  // Navigation Camera helpers
  const zoomIn = () => {
    if (!fgRef.current) return;
    const { x, y, z } = fgRef.current.cameraPosition();
    fgRef.current.cameraPosition({ x: x * 0.8, y: y * 0.8, z: z * 0.8 }, null, 500);
  };

  const zoomOut = () => {
    if (!fgRef.current) return;
    const { x, y, z } = fgRef.current.cameraPosition();
    fgRef.current.cameraPosition({ x: x * 1.25, y: y * 1.25, z: z * 1.25 }, null, 500);
  };

  const resetCamera = () => {
    if (!fgRef.current) return;
    fgRef.current.cameraPosition({ x: 0, y: 0, z: 250 }, { x: 0, y: 0, z: 0 }, 1000);
    setSelectedNode(null);
  };

  // Auto zoom-to-fit on reasoning path changes
  useEffect(() => {
    if (highlightPath.node_ids.length > 0 && fgRef.current) {
      // Find coordinates of nodes in path
      setTimeout(() => {
        const renderedNodes = fgRef.current.graphData().nodes.filter((n: any) =>
          highlightPath.node_ids.includes(n.id)
        );

        if (renderedNodes.length > 0) {
          // Compute bounding box or average center
          let sumX = 0, sumY = 0, sumZ = 0;
          renderedNodes.forEach((n: any) => {
            sumX += n.x || 0;
            sumY += n.y || 0;
            sumZ += n.z || 0;
          });
          const avgX = sumX / renderedNodes.length;
          const avgY = sumY / renderedNodes.length;
          const avgZ = sumZ / renderedNodes.length;

          fgRef.current.cameraPosition(
            { x: avgX, y: avgY, z: avgZ + 120 },
            { x: avgX, y: avgY, z: avgZ },
            1800
          );
        }
      }, 400);
    }
  }, [highlightPath]);

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-900 text-slate-100 select-none relative overflow-hidden">
      {/* Header with Search */}
      <div className="p-4 border-b border-slate-900 bg-slate-900/40 z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold tracking-tight text-slate-200">
            3D Knowledge Graph
          </h2>
        </div>

        {/* Node Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500/50 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none transition"
          />
        </form>
      </div>

      {/* Main Graph Area */}
      <div className="flex-1 w-full bg-slate-950 relative">
        <ForceGraph3D
          ref={fgRef}
          graphData={processedData}
          backgroundColor="#0a0a0b"
          showNavInfo={false}

          // Nodes
          nodeLabel={(node: any) => `
            <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 8px 12px; font-family: sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
              <div style="font-weight: bold; font-size: 13px; color: #f8fafc; margin-bottom: 2px;">${node.label}</div>
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #6366f1;">${node.type}</div>
              ${node.properties?.summary ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px; max-width: 200px; white-space: normal; line-height: 1.4;">${node.properties.summary}</div>` : ''}
            </div>
          `}
          nodeColor={(node: any) => node.color}
          nodeVal={(node: any) => node.val}
          onNodeClick={handleNodeClick}
          onNodeDragEnd={(node: any) => {
            // keep coords on drag end
            node.fx = node.x;
            node.fy = node.y;
            node.fz = node.z;
          }}

          // Links
          linkLabel={(link: any) => `
            <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid #475569; border-radius: 4px; padding: 4px 8px; font-size: 10px; font-weight: bold; color: #94a3b8; font-family: sans-serif;">
              ${link.label}
            </div>
          `}
          linkColor={(link: any) => link.color}
          linkWidth={(link: any) => link.width}

          // Highlighting particles! pulsing directional dots moving on paths
          linkDirectionalParticles={(link: any) => highlightPath.link_ids.includes(link.id) ? 5 : 0}
          linkDirectionalParticleWidth={(link: any) => highlightPath.link_ids.includes(link.id) ? 3.0 : 0}
          linkDirectionalParticleSpeed={(link: any) => 0.015}
          linkDirectionalParticleColor={() => '#fbbf24'} // Gold light pulses
        />

        {/* Reset / Camera Controls Overlay Toolbar */}
        <div className="absolute right-4 top-4 flex flex-col gap-2 z-10 bg-slate-900/80 border border-slate-800 rounded-lg p-1.5 backdrop-blur-sm">
          <button
            onClick={zoomIn}
            title="Zoom In"
            className="p-1.5 hover:bg-slate-800 hover:text-indigo-400 rounded transition text-slate-400 cursor-pointer"
          >
            <ZoomIn className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={zoomOut}
            title="Zoom Out"
            className="p-1.5 hover:bg-slate-800 hover:text-indigo-400 rounded transition text-slate-400 cursor-pointer"
          >
            <ZoomOut className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={resetCamera}
            title="Reset View"
            className="p-1.5 hover:bg-slate-800 hover:text-indigo-400 rounded transition text-slate-400 cursor-pointer border-t border-slate-800/80 mt-1 pt-2"
          >
            <RotateCcw className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute left-4 bottom-4 z-10 bg-slate-950/90 border border-slate-900 rounded-xl p-3 backdrop-blur-sm max-w-[160px] space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Node Legend</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400 font-semibold">
            {Object.entries(groupColors).map(([group, color]) => (
              <div key={group} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="capitalize truncate">{group}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active highlight indicator */}
        {highlightPath.node_ids.length > 0 && (
          <div className="absolute right-4 bottom-4 z-10 bg-amber-950/40 border border-amber-900/50 text-amber-300 rounded-xl p-2.5 backdrop-blur-sm text-[10px] font-medium flex items-center gap-1.5 max-w-[200px]">
            <GitCommit className="w-4 h-4 text-amber-500 animate-pulse-fast flex-shrink-0" />
            <span>Path highlighted! Dimensions auto-focused. Click Reset View to clear.</span>
          </div>
        )}
      </div>

      {/* Node Details Card (Footer Panel inside right column) */}
      {selectedNode && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-slate-900 border-t border-slate-800 shadow-2xl p-4 animate-slide-up max-h-[35%] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-2 mb-3">
            <div className="min-w-0">
              <span className="text-[9px] bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-900 font-bold uppercase tracking-wide">
                {selectedNode.type}
              </span>
              <h3 className="text-sm font-bold text-slate-100 mt-1.5 truncate">
                {selectedNode.label}
              </h3>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 ? (
              Object.entries(selectedNode.properties).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-0.5 bg-slate-950/40 p-2 rounded border border-slate-950">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-300 leading-relaxed font-medium">
                    {String(value)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-center py-2 flex items-center justify-center gap-1.5">
                <Info className="w-4 h-4 text-slate-600" />
                No additional properties for this node.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
