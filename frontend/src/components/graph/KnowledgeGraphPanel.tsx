import React, { useState, useRef, useEffect, useMemo } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";
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
  Network,
} from "lucide-react";
import {
  GraphNode,
  GraphLink,
  GraphPath,
  NodeDetailsResponse,
} from "../../lib/types";

interface KnowledgeGraphPanelProps {
  graphData: { nodes: GraphNode[]; links: GraphLink[] };
  highlightPath: GraphPath;
  onNodeClick: (nodeId: string) => Promise<NodeDetailsResponse>;
  onClearHighlight?: () => void;
}

export const KnowledgeGraphPanel: React.FC<KnowledgeGraphPanelProps> = ({
  graphData,
  highlightPath,
  onNodeClick,
  onClearHighlight,
}) => {
  const fgRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 480, height: 600 });
  const [selectedNode, setSelectedNode] = useState<NodeDetailsResponse | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Auto slow rotate camera for extremely cool, living presentation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fgRef.current) {
        const controls = fgRef.current.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.5; // slow, gentle, buttery-smooth rotation
        }
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const [newlyIngestedNodeIds, setNewlyIngestedNodeIds] = useState<string[]>(
    [],
  );
  const prevNodeIdsRef = useRef<string[]>([]);

  // Group node colors
  const groupColors: Record<string, string> = {
    document: "#10b981", // emerald
    clause: "#3b82f6", // blue
    concept: "#a855f7", // purple
    process: "#eab308", // yellow
    rule: "#ef4444", // red
    person: "#ec4899", // pink
    organization: "#22d3ee",
    location: "#f9a8d4",
    artifact: "#f5deb3",
    content: "#38bdf8",
    data: "#facc15",
    notebook: "#c4b5fd",
    event: "#bae6fd",
    method: "#c084fc",
  };
  const brightFallbackColors = [
    "#fca5a5",
    "#fdba74",
    "#fde047",
    "#86efac",
    "#67e8f9",
    "#93c5fd",
    "#c4b5fd",
    "#f0abfc",
  ];
  const colorForGroup = (group: string) => {
    if (groupColors[group]) return groupColors[group];
    const index =
      [...group].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
      brightFallbackColors.length;
    return brightFallbackColors[index];
  };

  const nodeGroupStats = useMemo(() => {
    const counts = new Map<string, number>();
    graphData.nodes.forEach((node) => {
      const group = (node.group || node.type || "concept").toLowerCase();
      counts.set(group, (counts.get(group) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [graphData.nodes]);

  // Node Click handler
  const handleNodeClick = async (node: any) => {
    setIsLoadingDetails(true);
    try {
      const details = await onNodeClick(node.id);
      setSelectedNode(details);

      // Synchronize to the search bar
      setSearchQuery(node.label || node.id);

      // Auto-focus camera on clicked node
      if (fgRef.current && node.x !== undefined) {
        const distance = 80;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        fgRef.current.cameraPosition(
          {
            x: node.x * distRatio,
            y: node.y * distRatio,
            z: node.z * distRatio,
          },
          node, // lookAt
          2000, // transition ms
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
      (n) =>
        n.label.toLowerCase().includes(query) ||
        n.type.toLowerCase().includes(query),
    );
  }, [graphData.nodes, searchQuery]);

  // Adjust nodes/links for the render engine based on highlighting path
  const processedData = useMemo(() => {
    const hasPathHighlight = highlightPath.node_ids.length > 0;
    const hasIngestHighlight = newlyIngestedNodeIds.length > 0;
    const selectedNodeId = selectedNode?.id;
    const hasSelectHighlight = !!selectedNodeId;
    const search = searchQuery.trim().toLowerCase();
    const hasSearchHighlight = !!search;

    const hasActiveHighlight =
      hasPathHighlight ||
      hasIngestHighlight ||
      hasSelectHighlight ||
      hasSearchHighlight;

    const activeNodeIds = new Set(highlightPath.node_ids);
    const activeLinkIds = new Set(highlightPath.link_ids);

    // Identify which nodes match search
    const searchedNodeIds = new Set(
      hasSearchHighlight
        ? graphData.nodes
            .filter(
              (n) =>
                n.label.toLowerCase().includes(search) ||
                n.type.toLowerCase().includes(search),
            )
            .map((n) => n.id)
        : [],
    );

    const nodes = graphData.nodes.map((node) => {
      const isReasoningHighlighted = activeNodeIds.has(node.id);
      const isIngestedHighlighted = newlyIngestedNodeIds.includes(node.id);
      const isSelected = selectedNodeId === node.id;
      const isSearchMatched = searchedNodeIds.has(node.id);

      // A node is also considered highlighted if it's connected to the selected node,
      // so that clicking a node shows its immediate neighborhood clearly.
      const isNeighborOfSelected =
        hasSelectHighlight &&
        graphData.links.some((l) => {
          const s =
            typeof l.source === "object" ? (l.source as any).id : l.source;
          const t =
            typeof l.target === "object" ? (l.target as any).id : l.target;
          return (
            (s === selectedNodeId && t === node.id) ||
            (t === selectedNodeId && s === node.id)
          );
        });

      const isHighlighted =
        isReasoningHighlighted ||
        isIngestedHighlighted ||
        isSelected ||
        isSearchMatched ||
        isNeighborOfSelected;

      // Compute color
      const group = (node.group || node.type || "concept").toLowerCase();
      let color = colorForGroup(group);
      let val = 1.5; // default size value

      if (hasActiveHighlight) {
        if (isHighlighted) {
          color = colorForGroup(group); // Keep its beautiful original category color
          val = isSelected ? 3.0 : isReasoningHighlighted || isIngestedHighlighted ? 2.5 : 2.0;
        } else {
          // Dim non-highlighted nodes softly
          color = "rgba(71, 85, 105, 0.15)";
          val = 0.9;
        }
      }

      return {
        ...node,
        color,
        val,
      };
    });

    const links = graphData.links.map((link) => {
      // link.source/target can be objects if react-force-graph has processed them, or strings
      const sourceId =
        typeof link.source === "object" ? (link.source as any).id : link.source;
      const targetId =
        typeof link.target === "object" ? (link.target as any).id : link.target;

      const isPathLink =
        activeLinkIds.has(link.id) ||
        activeLinkIds.has(`${sourceId}->${targetId}`) ||
        activeLinkIds.has(`${targetId}->${sourceId}`) ||
        (activeNodeIds.has(String(sourceId)) &&
          activeNodeIds.has(String(targetId)));

      const isIngestLink =
        newlyIngestedNodeIds.includes(String(sourceId)) ||
        newlyIngestedNodeIds.includes(String(targetId));

      const isSelectedLink =
        hasSelectHighlight &&
        (String(sourceId) === selectedNodeId ||
          String(targetId) === selectedNodeId);

      const isSearchLink =
        hasSearchHighlight &&
        (searchedNodeIds.has(String(sourceId)) ||
          searchedNodeIds.has(String(targetId)));

      const isHighlighted =
        (hasPathHighlight && isPathLink) ||
        (hasIngestHighlight && isIngestLink) ||
        isSelectedLink ||
        isSearchLink;

      let color = "#475569"; // default slate-600
      let width = 1.0;

      if (hasActiveHighlight) {
        if (isHighlighted) {
          // Colors:
          // Ingestion: Green (#10b981)
          // Path highlight: Sky blue (#38bdf8)
          // Selected node link: Indigo (#6366f1)
          // Search result link: Sky blue (#38bdf8)
          if (hasIngestHighlight && isIngestLink) {
            color = "#10b981";
          } else if (hasPathHighlight && isPathLink) {
            color = "#38bdf8";
          } else if (isSelectedLink) {
            color = "#6366f1";
          } else {
            color = "#38bdf8";
          }
          width = 2.2; // Elegant width
        } else {
          color = "rgba(30, 41, 59, 0.08)";
          width = 0.5;
        }
      }

      return {
        ...link,
        color,
        width,
      };
    });

    return { nodes, links };
  }, [
    graphData,
    highlightPath,
    newlyIngestedNodeIds,
    searchQuery,
    selectedNode,
  ]);

  // Automatically track newly added nodes on ingestion and pan/glow them
  useEffect(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return;

    const currentNodeIds = graphData.nodes.map((n: any) => n.id);
    const prevNodeIds = prevNodeIdsRef.current;

    if (prevNodeIds.length > 0) {
      const addedNodeIds = currentNodeIds.filter(
        (id) => !prevNodeIds.includes(id),
      );

      if (addedNodeIds.length > 0) {
        prevNodeIdsRef.current = currentNodeIds;
        setNewlyIngestedNodeIds(addedNodeIds);

        // Auto-focus camera on the center of newly added nodes after short render delay
        setTimeout(() => {
          if (!fgRef.current) return;
          const newlyAddedNodes = processedData.nodes.filter((n: any) =>
            addedNodeIds.includes(n.id),
          );

          if (newlyAddedNodes.length > 0) {
            let sumX = 0,
              sumY = 0,
              sumZ = 0;
            newlyAddedNodes.forEach((n: any) => {
              sumX += n.x || 0;
              sumY += n.y || 0;
              sumZ += n.z || 0;
            });
            const avgX = sumX / newlyAddedNodes.length;
            const avgY = sumY / newlyAddedNodes.length;
            const avgZ = sumZ / newlyAddedNodes.length;

            if (addedNodeIds.length <= 12) {
              fgRef.current.cameraPosition(
                { x: avgX, y: avgY, z: avgZ + 120 },
                { x: avgX, y: avgY, z: avgZ },
                1400,
              );
            }
          }
        }, 800);

        // Fades out glowing aura after 8 seconds
        const timeoutId = setTimeout(() => {
          setNewlyIngestedNodeIds([]);
        }, 8000);

        return () => clearTimeout(timeoutId);
      }
    }

    prevNodeIdsRef.current = currentNodeIds;
  }, [graphData.nodes, processedData.nodes]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Find first matching node
    const match = graphData.nodes.find((n) =>
      n.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    if (match && fgRef.current) {
      // Find rendered node in forcegraph to get coordinates
      const renderedNode = processedData.nodes.find(
        (n: any) => n.id === match.id,
      );
      if (renderedNode) {
        handleNodeClick(renderedNode);
      }
    }
  };

  // Navigation Camera helpers
  const zoomIn = () => {
    if (!fgRef.current) return;
    const { x, y, z } = fgRef.current.cameraPosition();
    fgRef.current.cameraPosition(
      { x: x * 0.8, y: y * 0.8, z: z * 0.8 },
      null,
      500,
    );
  };

  const zoomOut = () => {
    if (!fgRef.current) return;
    const { x, y, z } = fgRef.current.cameraPosition();
    fgRef.current.cameraPosition(
      { x: x * 1.25, y: y * 1.25, z: z * 1.25 },
      null,
      500,
    );
  };

  const resetCamera = () => {
    if (!fgRef.current) return;
    fgRef.current.cameraPosition(
      { x: 0, y: 0, z: 250 },
      { x: 0, y: 0, z: 0 },
      1000,
    );
    setSelectedNode(null);
    setSearchQuery(""); // Clear search bar
    if (onClearHighlight) {
      onClearHighlight(); // Notify parent to reset highlightPath state!
    }
  };

  // Explicitly force react-force-graph to re-render lines and particles when highlights change
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.refresh();
    }
  }, [highlightPath, newlyIngestedNodeIds]);

  // Auto zoom-to-fit on reasoning path changes
  useEffect(() => {
    if (highlightPath.node_ids.length > 0 && fgRef.current) {
      // Find coordinates of nodes in path
      setTimeout(() => {
        const renderedNodes = processedData.nodes.filter((n: any) =>
          highlightPath.node_ids.includes(n.id),
        );

        if (renderedNodes.length > 0) {
          // Sync search box to first node in highlighted path
          setSearchQuery(renderedNodes[0].label || renderedNodes[0].id);

          // Compute bounding box or average center
          let sumX = 0,
            sumY = 0,
            sumZ = 0;
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
            1800,
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
        <form
          onSubmit={handleSearchSubmit}
          className="relative max-w-[200px] flex-1"
        >
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
      <div ref={containerRef} className="flex-1 w-full bg-slate-950 relative">
        <ForceGraph3D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={processedData}
          backgroundColor="#0a0a0b"
          showNavInfo={false}
          // Nodes
          nodeLabel={(node: any) => `
            <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 8px 12px; font-family: sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
              <div style="font-weight: bold; font-size: 13px; color: #f8fafc; margin-bottom: 2px;">${node.label}</div>
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #6366f1;">${node.type}</div>
              ${node.properties?.summary ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px; max-width: 200px; white-space: normal; line-height: 1.4;">${node.properties.summary}</div>` : ""}
            </div>
          `}
          nodeColor={(node: any) => node.color}
          nodeVal={(node: any) => node.val}
          nodeThreeObjectExtend={true}
          nodeThreeObject={(node: any) => {
            const isReasoningHighlight = highlightPath.node_ids.includes(
              node.id,
            );
            const isSelectedHighlight =
              selectedNode && selectedNode.id === node.id;
            const isIngestedHighlight = newlyIngestedNodeIds.includes(node.id);
            const isSearchHighlight =
              !!searchQuery.trim() &&
              ((node.label || "")
                .toLowerCase()
                .includes(searchQuery.trim().toLowerCase()) ||
                (node.type || "")
                  .toLowerCase()
                  .includes(searchQuery.trim().toLowerCase()));

            if (
              isReasoningHighlight ||
              isSelectedHighlight ||
              isIngestedHighlight ||
              isSearchHighlight
            ) {
              // Choose color and sizing based on highlight type
              let glowColor = "#a855f7"; // purple for manual selection
              let scaleSize = 2.0;
              let opacity = 0.25;

              if (isReasoningHighlight) {
                glowColor = "#38bdf8"; // stunning neon sky-blue / cyan
                scaleSize = 1.6;
                opacity = 0.18;
              } else if (isIngestedHighlight) {
                glowColor = "#10b981"; // emerald green for newly ingested nodes
                scaleSize = 2.1;
              } else if (isSearchHighlight) {
                glowColor = "#38bdf8"; // cyan for local search focus
                scaleSize = 1.9;
              }

              // Create a semi-transparent glowing halo sphere using AdditiveBlending
              const size = (node.val || 4) * scaleSize;
              const geometry = new THREE.SphereGeometry(size, 16, 16);
              const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(glowColor),
                transparent: true,
                opacity,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
              });

              return new THREE.Mesh(geometry, material);
            }
            return new THREE.Object3D();
          }}
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
          linkCurvature={0.15}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowColor={(link: any) => link.color}
          linkDirectionalArrowRelPos={1.0}
          // Highlighting particles! pulsing directional dots moving on paths
          linkDirectionalParticles={(link: any) => (link.width > 1.5 ? 5 : 0)}
          linkDirectionalParticleWidth={(link: any) =>
            link.width > 1.5 ? 3.0 : 0
          }
          linkDirectionalParticleSpeed={(link: any) => 0.015}
          linkDirectionalParticleColor={(link: any) => link.color} // Pulsing light follows link color (blue/green)
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
            className="p-1.5 hover:bg-slate-800 hover:text-indigo-400 rounded transition text-slate-400 cursor-pointer border-b border-slate-800/80 pb-2 mb-1"
          >
            <RotateCcw className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => setShowHelp(!showHelp)}
            title="3D Navigation Guide"
            className={`p-1.5 hover:bg-slate-800 hover:text-indigo-400 rounded transition cursor-pointer ${showHelp ? "text-indigo-400 bg-slate-800/50 font-bold" : "text-slate-400"}`}
          >
            <HelpCircle className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Navigation Guide Modal */}
        {showHelp && (
          <div className="absolute right-16 top-4 z-20 bg-slate-900/95 border border-slate-800 rounded-xl p-4 shadow-2xl backdrop-blur-md max-w-[240px] space-y-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                3D Navigation Guide
              </span>
              <button
                onClick={() => setShowHelp(false)}
                className="text-slate-500 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2 text-[11px] text-slate-400">
              <div className="flex justify-between gap-2 border-b border-slate-950 pb-1">
                <span className="font-bold text-slate-300">
                  Left-Click + Drag:
                </span>
                <span className="text-right">Rotate camera</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-950 pb-1">
                <span className="font-bold text-slate-300">
                  Right-Click + Drag:
                </span>
                <span className="text-right">Pan (move canvas)</span>
              </div>
              <div className="flex justify-between gap-2 border-b border-slate-950 pb-1">
                <span className="font-bold text-slate-300">Scroll Wheel:</span>
                <span className="text-right">Zoom in / out</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-300">Click Node:</span>
                <span className="text-right">Focus & center node</span>
              </div>
            </div>
            <div className="text-[9px] bg-indigo-950/40 border border-indigo-900/30 rounded p-1.5 text-indigo-300 leading-relaxed font-medium">
              💡 The graph also rotates slowly automatically. Drag anywhere to
              take control!
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute left-4 bottom-4 z-10 bg-slate-950/90 border border-slate-900 rounded-xl p-3 backdrop-blur-sm max-w-[160px] space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
            Node Legend
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400 font-semibold">
            {nodeGroupStats.map(([group, count]) => (
              <div key={group} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorForGroup(group) }}
                />
                <span className="capitalize truncate">
                  {group} ({count})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Active highlight indicator */}
        {highlightPath.node_ids.length > 0 && (
          <div className="absolute right-4 bottom-4 z-10 bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 rounded-xl p-2.5 backdrop-blur-sm text-[10px] font-medium flex items-center gap-1.5 max-w-[200px]">
            <GitCommit className="w-4 h-4 text-indigo-400 animate-pulse-fast flex-shrink-0" />
            <span>
              Path highlighted! Dimensions auto-focused. Click Reset View to
              clear.
            </span>
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
            {selectedNode.properties &&
            Object.keys(selectedNode.properties).length > 0 ? (
              Object.entries(selectedNode.properties).map(([key, value]) => (
                <div
                  key={key}
                  className="flex flex-col gap-0.5 bg-slate-950/40 p-2 rounded border border-slate-950"
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    {key.replace(/_/g, " ")}
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
