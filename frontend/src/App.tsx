import { useState, useEffect, useRef } from "react";
import { SourcesPanel } from "./components/sources/SourcesPanel";
import { ChatPanel } from "./components/chat/ChatPanel";
import { KnowledgeGraphPanel } from "./components/graph/KnowledgeGraphPanel";
import {
  Trash2,
  Database,
  Layers,
  Cpu,
  Sparkles,
  HardDrive,
  Plus,
  Activity,
  BookOpen,
} from "lucide-react";
import {
  SourceListItem,
  ChatMessage,
  GraphResponse,
  GraphPath,
  Notebook,
  PipelineJobResponse,
} from "./lib/types";
import * as api from "./lib/api";

const sourceIdentityKey = (source: SourceListItem) =>
  `${source.type}:${(source.name || "").trim().toLowerCase()}`;

const sourcePriority = (source: SourceListItem) => {
  let priority = 0;
  if (!source.id.includes("_temp_")) priority += 1000;
  if (source.status === "ready") priority += 500;
  if (source.status === "processing") priority += 100;
  priority += (source.entity_count || 0) * 2;
  priority += source.chunk_count || 0;
  return priority;
};

const dedupeSources = (items: SourceListItem[]) => {
  const byId = new Map<string, SourceListItem>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing || sourcePriority(item) >= sourcePriority(existing)) {
      byId.set(item.id, item);
    }
  }

  const byIdentity = new Map<string, SourceListItem>();
  for (const item of byId.values()) {
    const key = sourceIdentityKey(item);
    const existing = byIdentity.get(key);
    if (!existing || sourcePriority(item) >= sourcePriority(existing)) {
      byIdentity.set(key, item);
    }
  }

  return Array.from(byIdentity.values());
};

export default function App() {
  // State definitions
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notebooksLoading, setNotebooksLoading] = useState(false);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [createInput, setCreateInput] = useState("");

  const [sources, setSources] = useState<SourceListItem[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [queryMode, setQueryMode] = useState<string>("mix");
  const [topK, setTopK] = useState<number>(60);
  const [chunkTopK, setChunkTopK] = useState<number>(20);
  const [enableRerank, setEnableRerank] = useState<boolean>(true);

  const [graphData, setGraphData] = useState<GraphResponse>({
    nodes: [],
    links: [],
  });
  const graphDataRef = useRef<GraphResponse>({ nodes: [], links: [] });
  const sourcesRef = useRef<SourceListItem[]>([]);
  const workspaceRefreshTimerRef = useRef<number | null>(null);
  const [highlightPath, setHighlightPath] = useState<GraphPath>({
    node_ids: [],
    link_ids: [],
  });

  const [backendOnline, setBackendOnline] = useState(false);

  const [pipelineJobs, setPipelineJobs] = useState<
    Record<string, PipelineJobResponse>
  >({});
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);

  const scheduleWorkspaceRefreshAfterIngest = (delayMs = 700) => {
    if (!activeNotebook) return;
    const notebookId = activeNotebook.id;
    if (workspaceRefreshTimerRef.current) {
      window.clearTimeout(workspaceRefreshTimerRef.current);
    }
    workspaceRefreshTimerRef.current = window.setTimeout(async () => {
      const [updatedSources, updatedGraph] = await Promise.all([
        api.listSources(notebookId),
        api.getGraph(notebookId),
      ]);
      const previousGraph = graphDataRef.current;
      const previousNodeIds = new Set(
        previousGraph.nodes.map((node) => node.id),
      );
      const previousLinkIds = new Set(
        previousGraph.links.map((link) => link.id),
      );
      const newNodeIds = updatedGraph.nodes
        .filter((node) => !previousNodeIds.has(node.id))
        .slice(0, 35)
        .map((node) => node.id);
      const newLinkIds = updatedGraph.links
        .filter((link) => !previousLinkIds.has(link.id))
        .slice(0, 60)
        .map((link) => link.id);

      const cleanSources = dedupeSources(updatedSources);
      setSources(cleanSources);
      setGraphData(updatedGraph);
      setNotebooks((prev) =>
        prev.map((nb) =>
          nb.id === notebookId
            ? {
                ...nb,
                source_count: cleanSources.length,
                status: cleanSources.length > 0 ? "ready" : "empty",
              }
            : nb,
        ),
      );
      if (newNodeIds.length > 0 || newLinkIds.length > 0) {
        setHighlightPath({
          node_ids: newNodeIds,
          link_ids: newLinkIds,
          mode: "ingest",
        });
      }
    }, delayMs);
  };

  // Responsive Layout States
  const [showSources, setShowSources] = useState(true);
  const [graphWidth, setGraphWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);

  // Drag Resize mouse movement effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const maxAllowedWidth = window.innerWidth - (showSources ? 320 : 0);

      if (newWidth < 50) {
        setGraphWidth(0);
      } else if (newWidth > maxAllowedWidth - 50) {
        setGraphWidth(maxAllowedWidth);
      } else {
        setGraphWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, showSources]);

  // Initial load
  useEffect(() => {
    const initApp = async () => {
      // 1. Check health
      const isOnline = await api.checkBackendHealth();
      setBackendOnline(isOnline);
      console.log(
        `Backend health check: ${isOnline ? "ONLINE" : "FALLBACK MODE"}`,
      );

      // 2. Load notebooks
      setNotebooksLoading(true);
      try {
        const list = await api.listNotebooks();
        setNotebooks(list);
      } catch (e) {
        console.error("Failed to load notebooks", e);
      } finally {
        setNotebooksLoading(false);
      }
    };

    initApp();
  }, []);

  const trackPipelineJob = (jobId?: string) => {
    if (!jobId) return;
    setActiveJobIds((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
  };

  useEffect(() => {
    graphDataRef.current = graphData;
  }, [graphData]);

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  const isPipelineTerminal = (status: PipelineJobResponse) => {
    const terminalStatus =
      status.status === "ready" || status.status === "failed";
    const terminalSteps =
      status.steps.length > 0 &&
      status.steps.every(
        (step) =>
          step.status === "done" || step.status === "failed_fallback_used",
      );
    const terminalPercent =
      (status.percent ?? status.progress_percentage ?? 0) >= 100;
    return terminalStatus || terminalSteps || terminalPercent;
  };

  // Poll active pipeline jobs. Gallery/graph refresh only happens on terminal state.
  useEffect(() => {
    if (activeJobIds.length === 0 || !activeNotebook) return;

    let cancelled = false;
    const pollActiveJobs = async () => {
      try {
        const results = await Promise.all(
          activeJobIds.map(async (jobId) => ({
            jobId,
            status: await api.getPipelineStatus(jobId),
          })),
        );

        let shouldRefreshWorkspace = false;
        const completedJobIds: string[] = [];

        setPipelineJobs((prev) => {
          const next = { ...prev };
          for (const { jobId, status } of results) {
            const matchingSrc = sourcesRef.current.find(
              (s) => s.pipeline_job_id === jobId || s.id === jobId,
            );
            const key = matchingSrc ? matchingSrc.id : jobId;
            const normalizedStatus: PipelineJobResponse = isPipelineTerminal(
              status,
            )
              ? {
                  ...status,
                  status: status.status === "failed" ? "failed" : "ready",
                }
              : status;
            next[key] = normalizedStatus;
            next[jobId] = normalizedStatus;

            if (
              isPipelineTerminal(normalizedStatus) &&
              status.extracted_nodes &&
              status.extracted_nodes.length > 0
            ) {
              const previousGraph = graphDataRef.current;
              const previousNodeIds = new Set(
                previousGraph.nodes.map((node) => node.id),
              );
              const previousLinkIds = new Set(
                previousGraph.links.map((link) => {
                  const s =
                    typeof link.source === "object"
                      ? (link.source as any).id
                      : link.source;
                  const t =
                    typeof link.target === "object"
                      ? (link.target as any).id
                      : link.target;
                  return `${s}->${t}`;
                }),
              );

              const nodeIds = status.extracted_nodes
                .map((n: any) => n.id)
                .filter((id: string) => !previousNodeIds.has(id));

              const linkKeyIds = (status.extracted_links || [])
                .map((l: any) => {
                  const s =
                    typeof l.source === "object"
                      ? (l.source as any).id
                      : l.source;
                  const t =
                    typeof l.target === "object"
                      ? (l.target as any).id
                      : l.target;
                  return `${s}->${t}`;
                })
                .filter((keyId: string) => !previousLinkIds.has(keyId));

              if (nodeIds.length > 0 || linkKeyIds.length > 0) {
                setHighlightPath({
                  node_ids: nodeIds,
                  link_ids: linkKeyIds,
                  mode: "ingest",
                });
              }
            }

            if (isPipelineTerminal(normalizedStatus)) {
              completedJobIds.push(jobId);
              shouldRefreshWorkspace = true;
            }
          }
          return next;
        });

        if (!cancelled && completedJobIds.length > 0) {
          setActiveJobIds((prev) =>
            prev.filter((jobId) => !completedJobIds.includes(jobId)),
          );
        }

        if (!cancelled && shouldRefreshWorkspace) {
          const [updatedSources, updatedGraph] = await Promise.all([
            api.listSources(activeNotebook.id),
            api.getGraph(activeNotebook.id),
          ]);
          const previousGraph = graphDataRef.current;
          const previousNodeIds = new Set(
            previousGraph.nodes.map((node) => node.id),
          );
          const previousLinkIds = new Set(
            previousGraph.links.map((link) => link.id),
          );
          const newNodeIds = updatedGraph.nodes
            .filter((node) => !previousNodeIds.has(node.id))
            .slice(0, 35)
            .map((node) => node.id);
          const newLinkIds = updatedGraph.links
            .filter((link) => !previousLinkIds.has(link.id))
            .slice(0, 60)
            .map((link) => link.id);

          setSources(dedupeSources(updatedSources));
          setGraphData(updatedGraph);
          setNotebooks((prev) =>
            prev.map((nb) =>
              nb.id === activeNotebook.id
                ? {
                    ...nb,
                    source_count: updatedSources.length,
                    status: updatedSources.length > 0 ? "ready" : "empty",
                  }
                : nb,
            ),
          );
          if (newNodeIds.length > 0 || newLinkIds.length > 0) {
            setHighlightPath({
              node_ids: newNodeIds,
              link_ids: newLinkIds,
              mode: "ingest",
            });
          }
        }
      } catch (e) {
        console.error("Failed to fetch pipeline status", e);
      }
    };

    void pollActiveJobs();
    const intervalId = setInterval(pollActiveJobs, 8000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [activeJobIds, activeNotebook]);

  // Handler: Select Notebook
  const handleSelectNotebook = (nb: Notebook) => {
    setActiveNotebook(nb);
  };

  // Load Notebook isolated data on selection
  useEffect(() => {
    if (!activeNotebook) {
      // Reset workspace states when going back to dashboard
      setSources([]);
      setGraphData({ nodes: [], links: [] });
      setMessages([]);
      setHighlightPath({ node_ids: [], link_ids: [] });
      setPipelineJobs({});
      setActiveJobIds([]);
      return;
    }

    const loadNotebookData = async () => {
      setSourcesLoading(true);
      try {
        const sourceList = await api.listSources(activeNotebook.id);
        setSources(dedupeSources(sourceList));

        const graph = await api.getGraph(activeNotebook.id);
        setGraphData(graph);

        // Load chat history from PostgreSQL (BE) with local storage fallback
        try {
          const pgHistory = await api.getChatHistory(activeNotebook.id);
          if (pgHistory && pgHistory.length > 0) {
            const mappedHistory: ChatMessage[] = pgHistory.map(
              (h: any, idx: number) => ({
                id: h.id || `msg_pg_${idx}_${Date.now()}`,
                role: h.role,
                content: h.content || h.user_prompt || h.answer,
                timestamp:
                  h.timestamp ||
                  new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                citations: h.citations,
                retrieval_steps: h.retrieval_steps,
                graph_path: h.graph_path,
              }),
            );
            setMessages(mappedHistory);
          } else {
            // Local storage fallback keyed to notebook ID
            const savedHistory = localStorage.getItem(
              `insightnote.${activeNotebook.id}.chat_history`,
            );
            if (savedHistory) {
              setMessages(JSON.parse(savedHistory));
            } else {
              setMessages([]);
            }
          }
        } catch (err) {
          console.warn(
            "Failed to retrieve PostgreSQL chat history, using local storage",
            err,
          );
          const savedHistory = localStorage.getItem(
            `insightnote.${activeNotebook.id}.chat_history`,
          );
          if (savedHistory) {
            setMessages(JSON.parse(savedHistory));
          } else {
            setMessages([]);
          }
        }
      } catch (e) {
        console.error(
          `Failed to load data for notebook ${activeNotebook.id}`,
          e,
        );
      } finally {
        setSourcesLoading(false);
      }
    };

    loadNotebookData();
  }, [activeNotebook]);

  // Persist chat history to localStorage key-isolated
  useEffect(() => {
    if (activeNotebook) {
      if (messages.length > 0) {
        localStorage.setItem(
          `insightnote.${activeNotebook.id}.chat_history`,
          JSON.stringify(messages),
        );
      } else {
        localStorage.removeItem(
          `insightnote.${activeNotebook.id}.chat_history`,
        );
      }
    }
  }, [messages, activeNotebook]);

  // Handler: Create Notebook
  const handleCreateNotebook = async (name: string) => {
    if (!name.trim()) return;
    const tempId = `notebook_temp_${Date.now()}`;
    const tempNb: Notebook = {
      id: tempId,
      name: name.trim(),
      source_count: 0,
      status: "empty",
    };

    // Optimistically add the temporary notebook to state and open it instantly
    setNotebooks((prev) => [...prev, tempNb]);
    setActiveNotebook(tempNb);

    try {
      const newNb = await api.createNotebook(name.trim());
      // Replace tempNb with the real newNb once backend resolves
      setNotebooks((prev) => prev.map((nb) => (nb.id === tempId ? newNb : nb)));
      setActiveNotebook(newNb);
    } catch (e) {
      console.error("Failed to create notebook, reverting", e);
      // Revert state on failure
      setNotebooks((prev) => prev.filter((nb) => nb.id !== tempId));
      setActiveNotebook(null);
    }
  };

  // Handler: Add URL source
  const handleAddUrl = async (url: string) => {
    if (!activeNotebook) return;
    const tempSourceId = `src_url_temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const pendingSource: SourceListItem = {
        id: tempSourceId,
        name: url,
        type: "url",
        status: "processing",
        entity_count: 0,
        chunk_count: 0,
      };
      setSources((prev) => dedupeSources([pendingSource, ...prev]));

      const response = await api.addUrlStream(
        activeNotebook.id,
        url,
        (progress) => {
          const sourceId = progress.source_id || tempSourceId;
          setPipelineJobs((prev) => ({
            ...prev,
            [tempSourceId]: progress,
            [sourceId]: progress,
          }));
          if (progress.source_id) {
            const progressedSource: SourceListItem = {
              id: progress.source_id,
              name: progress.name || url,
              type: progress.type || "url",
              status: progress.status,
              entity_count: 0,
              chunk_count: 0,
              pipeline_job_id: progress.job_id,
            };
            setSources((prev) =>
              dedupeSources([
                progressedSource,
                ...prev.filter(
                  (src) =>
                    src.id !== tempSourceId && src.id !== progress.source_id,
                ),
              ]),
            );
          }
        },
      );

      const finalSource: SourceListItem = {
        id: response.source_id,
        name: response.name,
        type: response.type,
        status: response.status,
        entity_count: 0,
        chunk_count: 0,
        pipeline_job_id: response.pipeline_job_id,
      };
      setSources((prev) =>
        dedupeSources([
          finalSource,
          ...prev.filter(
            (src) => src.id !== tempSourceId && src.id !== response.source_id,
          ),
        ]),
      );

      const [updatedSources, updatedGraph] = await Promise.all([
        api.listSources(activeNotebook.id),
        api.getGraph(activeNotebook.id),
      ]);
      const previousGraph = graphDataRef.current;
      const previousNodeIds = new Set(
        previousGraph.nodes.map((node) => node.id),
      );
      const previousLinkIds = new Set(
        previousGraph.links.map((link) => link.id),
      );
      const newNodeIds = updatedGraph.nodes
        .filter((node) => !previousNodeIds.has(node.id))
        .slice(0, 35)
        .map((node) => node.id);
      const newLinkIds = updatedGraph.links
        .filter((link) => !previousLinkIds.has(link.id))
        .slice(0, 60)
        .map((link) => link.id);
      setSources(dedupeSources(updatedSources));
      setGraphData(updatedGraph);
      if (newNodeIds.length > 0 || newLinkIds.length > 0) {
        setHighlightPath({
          node_ids: newNodeIds,
          link_ids: newLinkIds,
          mode: "ingest",
        });
      }
      setPipelineJobs((prev) => {
        const next = { ...prev };
        delete next[tempSourceId];
        delete next[response.source_id];
        if (response.pipeline_job_id) {
          delete next[response.pipeline_job_id];
        }
        return next;
      });
    } catch (e) {
      console.error("Failed to add URL source", e);
      setSources((prev) => prev.filter((src) => src.id !== tempSourceId));
    }
  };

  // Handler: Add plain-text note source
  const handleAddText = async (text: string) => {
    if (!activeNotebook) return;
    const tempSourceId = `src_note_temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      // Parse title and content
      let title = "Custom Note";
      let body = text;
      if (text.startsWith("Title: ")) {
        const lines = text.split("\n");
        title = lines[0].replace("Title: ", "").trim();
        body = lines.slice(1).join("\n").trim();
      }

      const pendingSource: SourceListItem = {
        id: tempSourceId,
        name: title,
        type: "text",
        status: "processing",
        entity_count: 0,
        chunk_count: 0,
      };
      setSources((prev) => dedupeSources([pendingSource, ...prev]));

      const response = await api.addNoteStream(
        activeNotebook.id,
        title,
        body,
        (progress) => {
          const sourceId = progress.source_id || tempSourceId;
          setPipelineJobs((prev) => ({
            ...prev,
            [tempSourceId]: progress,
            [sourceId]: progress,
          }));
          if (progress.source_id) {
            const progressedSource: SourceListItem = {
              id: progress.source_id,
              name: progress.name || title,
              type: progress.type || "text",
              status: progress.status,
              entity_count: 0,
              chunk_count: 0,
              pipeline_job_id: progress.job_id,
            };
            setSources((prev) =>
              dedupeSources([
                progressedSource,
                ...prev.filter(
                  (src) =>
                    src.id !== tempSourceId && src.id !== progress.source_id,
                ),
              ]),
            );
          }
        },
      );

      const finalSource: SourceListItem = {
        id: response.source_id,
        name: response.name,
        type: response.type,
        status: response.status,
        entity_count: 0,
        chunk_count: 0,
        pipeline_job_id: response.pipeline_job_id,
      };
      setSources((prev) =>
        dedupeSources([
          finalSource,
          ...prev.filter(
            (src) => src.id !== tempSourceId && src.id !== response.source_id,
          ),
        ]),
      );

      const [updatedSources, updatedGraph] = await Promise.all([
        api.listSources(activeNotebook.id),
        api.getGraph(activeNotebook.id),
      ]);
      const previousGraph = graphDataRef.current;
      const previousNodeIds = new Set(
        previousGraph.nodes.map((node) => node.id),
      );
      const previousLinkIds = new Set(
        previousGraph.links.map((link) => link.id),
      );
      const newNodeIds = updatedGraph.nodes
        .filter((node) => !previousNodeIds.has(node.id))
        .slice(0, 35)
        .map((node) => node.id);
      const newLinkIds = updatedGraph.links
        .filter((link) => !previousLinkIds.has(link.id))
        .slice(0, 60)
        .map((link) => link.id);
      setSources(dedupeSources(updatedSources));
      setGraphData(updatedGraph);
      if (newNodeIds.length > 0 || newLinkIds.length > 0) {
        setHighlightPath({
          node_ids: newNodeIds,
          link_ids: newLinkIds,
          mode: "ingest",
        });
      }
      setPipelineJobs((prev) => {
        const next = { ...prev };
        delete next[tempSourceId];
        delete next[response.source_id];
        if (response.pipeline_job_id) {
          delete next[response.pipeline_job_id];
        }
        return next;
      });
    } catch (e) {
      console.error("Failed to add custom text note", e);
      setSources((prev) => prev.filter((src) => src.id !== tempSourceId));
    }
  };

  // Handler: Load Example Resume file
  const handleLoadExample = async () => {
    if (!activeNotebook) return;
    try {
      const response = await api.loadExample(
        activeNotebook.id,
        "example/paper.pdf",
      );
      const pendingSource: SourceListItem = {
        id: response.source_id,
        name: response.name,
        type: response.type,
        status: response.status,
        entity_count: 0,
        chunk_count: 0,
        pipeline_job_id: response.pipeline_job_id,
      };
      setSources((prev) => dedupeSources([pendingSource, ...prev]));

      if (response.pipeline_job_id) {
        trackPipelineJob(response.pipeline_job_id);
        const initJobStatus = await api.getPipelineStatus(
          response.pipeline_job_id,
        );
        setPipelineJobs((prev) => ({
          ...prev,
          [response.source_id]: initJobStatus,
          [response.pipeline_job_id as string]: initJobStatus,
        }));
      }
    } catch (e) {
      console.error("Failed to load example source", e);
    }
  };

  // Handler: Upload File source
  const handleUploadFile = async (file: File) => {
    if (!activeNotebook) return;
    const tempSourceId = `src_temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const pendingSource: SourceListItem = {
        id: tempSourceId,
        name: file.name,
        type: file.name.endsWith(".pdf") ? "pdf" : "text",
        status: "processing",
        entity_count: 0,
        chunk_count: 0,
      };
      setSources((prev) => dedupeSources([pendingSource, ...prev]));

      const response = await api.uploadFileStream(
        activeNotebook.id,
        file,
        (progress) => {
          // Update the progress in pipelineJobs map keyed by tempSourceId
          setPipelineJobs((prev) => ({
            ...prev,
            [tempSourceId]: progress,
          }));
        },
      );

      // Replace temporary source with enqueued source
      setSources((prev) =>
        dedupeSources([
          {
            ...pendingSource,
            id: response.source_id,
            status: response.status,
          },
          ...prev.filter(
            (src) => src.id !== tempSourceId && src.id !== response.source_id,
          ),
        ]),
      );

      // Transfer progress mapping from tempSourceId to the real source_id
      setPipelineJobs((prev) => {
        const next = { ...prev };
        if (next[tempSourceId]) {
          next[response.source_id] = next[tempSourceId];
          delete next[tempSourceId];
        }
        return next;
      });

      // Debounced final sync. Multiple parallel uploads coalesce into one sources/graph refresh.
      scheduleWorkspaceRefreshAfterIngest(900);

      // Clear the job progress state after 3 seconds
      setTimeout(() => {
        setPipelineJobs((prev) => {
          const next = { ...prev };
          delete next[response.source_id];
          return next;
        });
      }, 3000);
    } catch (e) {
      console.error("Failed to upload file source", e);
      // Remove pending source in case of failure
      setSources((prev) => prev.filter((s) => s.id !== tempSourceId));
    }
  };

  // Handler: Send Chat message and capture reasoning path
  const handleSendMessage = async (text: string) => {
    if (!activeNotebook) return;
    // Clear previous graph highlight path when initiating a new message
    setHighlightPath({ node_ids: [], link_ids: [] });
    // 1. Create User Message
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    // Create an empty assistant message first
    const assistantMsgId = `msg_assistant_${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      citations: [],
      retrieval_steps: [],
      graph_path: { node_ids: [], link_ids: [] },
      isStreaming: true,
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    try {
      // Create chat history payload containing prior conversation + current query
      const chatHistory = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ];

      // 2. Call backend/mock response with history and streaming callbacks
      const response = await api.askChat(
        activeNotebook.id,
        text,
        chatHistory,
        // onChunk callback
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: m.content + chunk }
                : m,
            ),
          );
        },
        // onMetadata callback
        (meta) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    citations: meta.citations || [],
                    retrieval_steps: meta.retrieval_steps || [],
                    graph_path: meta.graph_path || {
                      node_ids: [],
                      link_ids: [],
                    },
                    suggested_questions: meta.suggested_questions || [],
                  }
                : m,
            ),
          );
          // Highlight path in 3D Graph (if path exists)
          if (
            meta.graph_path &&
            meta.graph_path.node_ids &&
            meta.graph_path.node_ids.length > 0
          ) {
            setHighlightPath(meta.graph_path);
          }
        },
        enableRerank,
        queryMode,
        topK,
        chunkTopK,
      );

      // Finally, set the final complete object just to be fully consistent
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: response.answer,
                citations: response.citations,
                retrieval_steps: response.retrieval_steps,
                graph_path: response.graph_path,
                suggested_questions: response.suggested_questions,
                isStreaming: false,
              }
            : m,
        ),
      );

      // 4. Highlight path in 3D Graph (if path exists)
      if (response.graph_path && response.graph_path.node_ids.length > 0) {
        setHighlightPath({ ...response.graph_path, mode: "query" });
      } else {
        // Clear highlight if query had no specific reasoning path
        setHighlightPath({ node_ids: [], link_ids: [] });
      }
    } catch (e) {
      console.error("Chat error", e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, isStreaming: false } : m,
        ),
      );
    } finally {
      setChatLoading(false);
    }
  };

  // Handler: Node details fetching
  const handleNodeClick = async (nodeId: string) => {
    if (!activeNotebook)
      return { id: nodeId, label: nodeId, type: "Concept", properties: {} };
    return await api.getNodeDetails(activeNotebook.id, nodeId);
  };

  // Handler: Delete Ingested Source Document
  const handleDeleteSource = async (sourceId: string) => {
    if (!activeNotebook) return;

    // Save current states for potential revert on failure
    const previousSources = [...sources];
    const previousGraphData = { ...graphData };
    const previousNotebooks = [...notebooks];
    const previousActiveNotebook = { ...activeNotebook };

    // Optimistically update states instantly
    setSources((prev) => prev.filter((src) => src.id !== sourceId));
    setHighlightPath({ node_ids: [], link_ids: [] });
    setActiveNotebook((prev) =>
      prev
        ? { ...prev, source_count: Math.max(0, prev.source_count - 1) }
        : null,
    );
    setNotebooks((prev) =>
      prev.map((n) =>
        n.id === activeNotebook.id
          ? { ...n, source_count: Math.max(0, n.source_count - 1) }
          : n,
      ),
    );

    try {
      await api.deleteSource(activeNotebook.id, sourceId);

      // Fetch actual background sync
      const updatedGraph = await api.getGraph(activeNotebook.id);
      setGraphData(updatedGraph);

      const list = await api.listNotebooks();
      setNotebooks(list);
      const updatedNb = list.find((n) => n.id === activeNotebook.id);
      if (updatedNb) {
        setActiveNotebook(updatedNb);
      }
    } catch (e) {
      console.error("Failed to delete source, reverting", e);
      // Revert all states on failure
      setSources(previousSources);
      setGraphData(previousGraphData);
      setNotebooks(previousNotebooks);
      setActiveNotebook(previousActiveNotebook);
    }
  };

  // Handler: Delete Notebook
  const handleDeleteNotebook = async (notebookId: string) => {
    // Save current states for potential revert on failure
    const previousNotebooks = [...notebooks];
    const previousActiveNotebook = activeNotebook;

    // Optimistically update states instantly
    setNotebooks((prev) => prev.filter((nb) => nb.id !== notebookId));
    if (activeNotebook && activeNotebook.id === notebookId) {
      setActiveNotebook(null);
    }

    try {
      await api.deleteNotebook(notebookId);
    } catch (e) {
      console.error("Failed to delete notebook, reverting", e);
      // Revert states on failure
      setNotebooks(previousNotebooks);
      if (previousActiveNotebook && previousActiveNotebook.id === notebookId) {
        setActiveNotebook(previousActiveNotebook);
      }
    }
  };

  // Handler: start resizing graph panel
  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  // --- RENDER DASHBOARD VIEW ---
  if (!activeNotebook) {
    const totalSourcesCount = notebooks.reduce(
      (acc, nb) => acc + (nb.source_count || 0),
      0,
    );

    return (
      <div className="h-screen w-screen bg-[#0a0a0b] text-slate-100 flex flex-col font-sans overflow-hidden">
        {/* Top Banner */}
        <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-900 flex justify-between items-center text-[11px] font-semibold text-slate-500 z-10">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${backendOnline ? "bg-emerald-500 shadow-emerald-500/50" : "bg-rose-500 shadow-rose-500/50"} animate-pulse`}
            />
            <span>
              System Status:{" "}
              {backendOnline
                ? "Production Backend Active"
                : "Sandbox Demo Fallback Active"}
            </span>
          </div>
          <div className="text-slate-600">
            Vite • React • 3D Force-Directed Graph WebGL
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 flex flex-col items-center p-6 md:p-12 overflow-y-auto space-y-8 bg-gradient-to-b from-[#0e0e11] via-[#0a0a0b] to-[#070709]">
          <div className="w-full max-w-4xl space-y-8">
            {/* Header / Logo */}
            <div className="text-center space-y-3">
              <div className="inline-flex p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 shadow-xl shadow-indigo-500/5 mb-1 animate-pulse">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-slate-100 to-indigo-200">
                InsightNote
              </h1>
              <p className="text-slate-450 max-w-md mx-auto text-xs sm:text-sm leading-relaxed">
                A multi-notebook GraphRAG knowledge workspace. Index documents
                into a 3D WebGL relation graph and chat with grounded citations.
              </p>
            </div>

            {/* System Overview Dashboard Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Metric 1 */}
              <div className="p-4 bg-slate-900/20 border border-slate-900/60 rounded-2xl backdrop-blur-md flex items-center gap-4 hover:border-slate-800 transition duration-200">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                    Research Hubs
                  </div>
                  <div className="text-xl font-black text-slate-100">
                    {notebooks.length} Active
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Isolated workspaces
                  </div>
                </div>
              </div>

              {/* Metric 2 */}
              <div className="p-4 bg-slate-900/20 border border-slate-900/60 rounded-2xl backdrop-blur-md flex items-center gap-4 hover:border-slate-800 transition duration-200">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <Database className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                    Knowledge Ingested
                  </div>
                  <div className="text-xl font-black text-slate-100">
                    {totalSourcesCount} Documents
                  </div>
                  <div className="text-[10px] text-slate-500">
                    PDFs, Notes, and URLs
                  </div>
                </div>
              </div>

              {/* Metric 3 */}
              <div className="p-4 bg-slate-900/20 border border-slate-900/60 rounded-2xl backdrop-blur-md flex items-center gap-4 hover:border-slate-800 transition duration-200">
                <div
                  className={`p-3 rounded-xl border ${backendOnline ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}
                >
                  <Cpu className="w-5 h-5" />
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                    GraphRAG Engine
                  </div>
                  <div
                    className={`text-xs font-bold uppercase truncate ${backendOnline ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {backendOnline ? "ZeRAG Live" : "Sandbox Simulation"}
                  </div>
                  <div className="text-[9px] text-slate-500 truncate">
                    {backendOnline
                      ? "Production Stack Connected"
                      : "Local Mock Storage Enabled"}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Section */}
            <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-8 bg-slate-900/30 border border-slate-900 rounded-3xl p-6 backdrop-blur-md">
              {/* Left Column: Create Notebook */}
              <div className="space-y-4 border-slate-900 md:border-r md:pr-8 flex flex-col justify-center">
                <div className="space-y-2">
                  <h3 className="text-base font-black text-slate-200 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-indigo-400" />
                    Create Notebook
                  </h3>
                  <p className="text-[11px] text-slate-450 leading-relaxed">
                    Set up an isolated workspace to index unique documents into
                    its own dedicated 3D Knowledge Graph.
                  </p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateNotebook(createInput);
                    setCreateInput("");
                  }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    required
                    placeholder="e.g. Contract Analysis"
                    value={createInput}
                    onChange={(e) => setCreateInput(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-850 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 rounded-xl px-4 py-3.5 text-xs placeholder-slate-650 outline-none text-slate-100 disabled:opacity-60 transition"
                  />
                  <button
                    type="submit"
                    disabled={!createInput.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-slate-950 font-bold py-3 rounded-xl transition duration-150 shadow-lg shadow-indigo-500/10 cursor-pointer flex items-center justify-center gap-1.5 text-xs text-slate-100"
                  >
                    <Plus className="w-4 h-4 text-slate-950" />
                    Create and Open Notebook
                  </button>
                </form>
              </div>

              {/* Right Column: Notebook List */}
              <div className="space-y-4 min-h-[220px] flex flex-col justify-center">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-black text-slate-200 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    Notebook Dashboard
                  </h3>
                  <span className="text-[10px] bg-slate-850 text-indigo-400 px-2 py-0.5 rounded-full font-bold border border-slate-800">
                    {notebooks.length} Notebook
                    {notebooks.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {notebooksLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 py-8">
                    <Activity className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-xs">Loading notebooks...</span>
                  </div>
                ) : notebooks.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-850 rounded-2xl bg-slate-950/10">
                    <p className="text-xs text-slate-500">
                      No notebooks available.
                    </p>
                    <p className="text-[10px] text-slate-650 mt-1">
                      Create one on the left to begin.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto max-h-[240px] pr-1 space-y-2.5">
                    {notebooks.map((nb) => (
                      <div
                        key={nb.id}
                        onClick={() => handleSelectNotebook(nb)}
                        className="p-4 bg-slate-950/40 border border-slate-850 hover:border-indigo-500/40 rounded-2xl transition duration-150 flex items-center justify-between cursor-pointer group hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-950/10"
                      >
                        <div className="space-y-1 min-w-0 flex-1 pr-4">
                          <h4 className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition truncate">
                            {nb.name}
                          </h4>
                          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-medium">
                            <span className="flex items-center gap-1">
                              <Database className="w-3.5 h-3.5 text-indigo-400" />
                              {nb.source_count} source
                              {nb.source_count !== 1 ? "s" : ""}
                            </span>
                            <span>•</span>
                            <span
                              className={`capitalize font-bold ${nb.status === "processing" ? "text-indigo-400 animate-pulse" : "text-slate-500"}`}
                            >
                              {nb.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <div className="flex items-center gap-0.5 text-[11px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition duration-150">
                            Open
                            <Plus className="w-3 h-3 rotate-45" />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Stop opening notebook on delete click!
                              handleDeleteNotebook(nb.id);
                            }}
                            title="Delete Notebook"
                            className="p-2 hover:bg-red-950/40 text-slate-500 hover:text-red-400 rounded-xl transition duration-150 cursor-pointer sm:opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER 3-COLUMN WORKSPACE VIEW ---
  return (
    <div className="h-screen w-screen bg-[#0a0a0b] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Top Banner */}
      <div className="px-4 py-1 bg-slate-950 border-b border-slate-900 flex justify-between items-center text-[11px] font-semibold text-slate-500">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${backendOnline ? "bg-emerald-500 shadow-emerald-500/50" : "bg-rose-500 shadow-rose-500/50"} animate-pulse`}
          />
          <span>
            System Status:{" "}
            {backendOnline
              ? "Production Backend Active"
              : "Sandbox Demo Fallback Active"}
          </span>
        </div>
        <div className="hidden sm:block text-slate-600">
          Vite • React • 3D Force-Directed Graph WebGL
        </div>
      </div>

      {/* 3-Column Responsive Workspace Layout */}
      <div className="flex-1 flex h-full overflow-hidden relative">
        {/* Left Panel: Sources */}
        {showSources && (
          <div className="w-[320px] h-full overflow-hidden border-slate-900 border-r flex-shrink-0 animate-fade-in">
            <SourcesPanel
              notebook={activeNotebook}
              sources={sources}
              loading={sourcesLoading}
              pipelineJobs={pipelineJobs}
              onAddUrl={handleAddUrl}
              onAddText={handleAddText}
              onUploadFile={handleUploadFile}
              onLoadExample={handleLoadExample}
              onDeleteSource={handleDeleteSource}
              onBackToDashboard={() => setActiveNotebook(null)}
            />
          </div>
        )}

        {/* Middle Panel: AI Copilot Chat */}
        <div
          style={{
            width:
              graphWidth >= window.innerWidth - (showSources ? 320 : 0)
                ? 0
                : "auto",
            display:
              graphWidth >= window.innerWidth - (showSources ? 320 : 0)
                ? "none"
                : "flex",
          }}
          className="flex-1 h-full overflow-hidden flex flex-col"
        >
          <ChatPanel
            messages={messages}
            isLoading={chatLoading}
            onSendMessage={handleSendMessage}
            isResume={
              activeNotebook.id.includes("resume") ||
              activeNotebook.name.toLowerCase().includes("resume")
            }
            showSources={showSources}
            onToggleSources={() => setShowSources(!showSources)}
            hasSources={sources.length > 0}
            queryMode={queryMode}
            setQueryMode={setQueryMode}
            topK={topK}
            setTopK={setTopK}
            chunkTopK={chunkTopK}
            setChunkTopK={setChunkTopK}
            enableRerank={enableRerank}
            setEnableRerank={setEnableRerank}
          />
        </div>

        {/* Resize Handle Divider */}
        <div
          onMouseDown={startResizing}
          className={`w-1 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors duration-150 relative z-10 flex-shrink-0 ${
            isResizing ? "bg-indigo-500" : "bg-slate-900"
          }`}
        >
          <div className="absolute inset-y-0 left-[1px] w-[2px] bg-slate-850/40 pointer-events-none" />
        </div>

        {/* Right Panel: WebGL 3D Graph */}
        <div
          style={{ width: graphWidth }}
          className="h-full overflow-hidden border-slate-900 border-l flex-shrink-0"
        >
          <KnowledgeGraphPanel
            graphData={graphData}
            highlightPath={highlightPath}
            onNodeClick={handleNodeClick}
            onClearHighlight={() =>
              setHighlightPath({ node_ids: [], link_ids: [] })
            }
          />
        </div>
      </div>
    </div>
  );
}
