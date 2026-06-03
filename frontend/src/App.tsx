import { useState, useEffect } from 'react';
import { SourcesPanel } from './components/sources/SourcesPanel';
import { ChatPanel } from './components/chat/ChatPanel';
import { KnowledgeGraphPanel } from './components/graph/KnowledgeGraphPanel';
import { SourceListItem, ChatMessage, GraphResponse, GraphPath, Notebook, PipelineJobResponse } from './lib/types';
import * as api from './lib/api';

export default function App() {
  // State definitions
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notebooksLoading, setNotebooksLoading] = useState(false);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [createInput, setCreateInput] = useState('');

  const [sources, setSources] = useState<SourceListItem[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [graphData, setGraphData] = useState<GraphResponse>({ nodes: [], links: [] });
  const [highlightPath, setHighlightPath] = useState<GraphPath>({ node_ids: [], link_ids: [] });

  const [backendOnline, setBackendOnline] = useState(false);

  const [pipelineJob, setPipelineJob] = useState<PipelineJobResponse | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    const initApp = async () => {
      // 1. Check health
      const isOnline = await api.checkBackendHealth();
      setBackendOnline(isOnline);
      console.log(`Backend health check: ${isOnline ? 'ONLINE' : 'FALLBACK MODE'}`);

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

  // Poll pipeline job status if one is active
  useEffect(() => {
    if (!activeJobId || !activeNotebook) return;

    const intervalId = setInterval(async () => {
      try {
        const jobStatus = await api.getPipelineStatus(activeJobId);
        setPipelineJob(jobStatus);

        if (jobStatus.status === 'ready' || jobStatus.status === 'failed') {
          setActiveJobId(null);
          // Refresh sources & graph
          const updatedSources = await api.listSources(activeNotebook.id);
          setSources(updatedSources);

          const updatedGraph = await api.getGraph(activeNotebook.id);
          setGraphData(updatedGraph);

          // Update active notebook metadata
          const updatedNb = await api.getNotebook(activeNotebook.id);
          setActiveNotebook(updatedNb);

          // Refresh the notebooks list
          const list = await api.listNotebooks();
          setNotebooks(list);
        }
      } catch (e) {
        console.error("Failed to fetch pipeline status", e);
      }
    }, 1500);

    return () => clearInterval(intervalId);
  }, [activeJobId, activeNotebook]);

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
      setPipelineJob(null);
      setActiveJobId(null);
      return;
    }

    const loadNotebookData = async () => {
      setSourcesLoading(true);
      try {
        const sourceList = await api.listSources(activeNotebook.id);
        setSources(sourceList);

        const graph = await api.getGraph(activeNotebook.id);
        setGraphData(graph);
      } catch (e) {
        console.error(`Failed to load data for notebook ${activeNotebook.id}`, e);
      } finally {
        setSourcesLoading(false);
      }
    };

    loadNotebookData();
  }, [activeNotebook]);

  // Handler: Create Notebook
  const handleCreateNotebook = async (name: string) => {
    if (!name.trim()) return;
    try {
      const newNb = await api.createNotebook(name.trim());
      setNotebooks(prev => [...prev, newNb]);
      setActiveNotebook(newNb); // Auto-open after creating
    } catch (e) {
      console.error("Failed to create notebook", e);
    }
  };

  // Handler: Add URL source
  const handleAddUrl = async (url: string) => {
    if (!activeNotebook) return;
    const newSrc: SourceListItem = {
      id: `src_url_${Date.now()}`,
      name: url,
      type: 'url',
      status: 'ready',
      entity_count: 3,
      chunk_count: 5
    };
    setSources(prev => [newSrc, ...prev]);
  };

  // Handler: Add plain-text note source
  const handleAddText = async (text: string) => {
    if (!activeNotebook) return;
    const newSrc: SourceListItem = {
      id: `src_text_${Date.now()}`,
      name: text.split('\n')[0] || "Custom Note",
      type: 'text',
      status: 'ready',
      entity_count: 2,
      chunk_count: 3
    };
    setSources(prev => [newSrc, ...prev]);
  };

  // Handler: Load Example Resume file
  const handleLoadExample = async () => {
    if (!activeNotebook) return;
    try {
      const response = await api.loadExample(activeNotebook.id, "example/Resume.pdf");
      const pendingSource: SourceListItem = {
        id: response.source_id,
        name: response.name,
        type: response.type,
        status: response.status,
        entity_count: 0,
        chunk_count: 0
      };
      setSources(prev => [pendingSource, ...prev]);

      if (response.pipeline_job_id) {
        setActiveJobId(response.pipeline_job_id);
        const initJobStatus = await api.getPipelineStatus(response.pipeline_job_id);
        setPipelineJob(initJobStatus);
      }
    } catch (e) {
      console.error("Failed to load example source", e);
    }
  };

  // Handler: Upload File source
  const handleUploadFile = async (file: File) => {
    if (!activeNotebook) return;
    try {
      const response = await api.uploadFile(activeNotebook.id, file);
      const pendingSource: SourceListItem = {
        id: response.source_id,
        name: response.name,
        type: response.type,
        status: response.status,
        entity_count: 0,
        chunk_count: 0
      };
      setSources(prev => [pendingSource, ...prev]);

      if (response.pipeline_job_id) {
        setActiveJobId(response.pipeline_job_id);
        const initJobStatus = await api.getPipelineStatus(response.pipeline_job_id);
        setPipelineJob(initJobStatus);
      }
    } catch (e) {
      console.error("Failed to upload file source", e);
    }
  };

  // Handler: Send Chat message and capture reasoning path
  const handleSendMessage = async (text: string) => {
    if (!activeNotebook) return;
    // 1. Create User Message
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      // 2. Call backend/mock response
      const response = await api.askChat(activeNotebook.id, text);

      // 3. Create Assistant Message
      const assistantMsg: ChatMessage = {
        id: `msg_assistant_${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: response.citations,
        retrieval_steps: response.retrieval_steps,
        graph_path: response.graph_path
      };

      setMessages(prev => [...prev, assistantMsg]);

      // 4. Highlight path in 3D Graph (if path exists)
      if (response.graph_path && response.graph_path.node_ids.length > 0) {
        setHighlightPath(response.graph_path);
      } else {
        // Clear highlight if query had no specific reasoning path
        setHighlightPath({ node_ids: [], link_ids: [] });
      }
    } catch (e) {
      console.error("Chat error", e);
    } finally {
      setChatLoading(false);
    }
  };

  // Handler: Node details fetching
  const handleNodeClick = async (nodeId: string) => {
    if (!activeNotebook) return { id: nodeId, label: nodeId, type: 'Concept', properties: {} };
    return await api.getNodeDetails(activeNotebook.id, nodeId);
  };

  // --- RENDER DASHBOARD VIEW ---
  if (!activeNotebook) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0b] text-slate-100 flex flex-col font-sans overflow-hidden">
        {/* Top Banner */}
        <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-900 flex justify-between items-center text-[11px] font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-amber-500 shadow-amber-500/50'} animate-pulse`} />
            <span>System Status: {backendOnline ? 'Production Backend Active' : 'Sandbox Demo Fallback Active'}</span>
          </div>
          <div className="text-slate-600">
            Vite • React • 3D Force-Directed Graph WebGL • Neo4j-Ready
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-4xl space-y-8">
            {/* Header / Logo */}
            <div className="text-center space-y-3">
              <div className="inline-flex p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 shadow-xl shadow-indigo-500/5 mb-2">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-slate-100 to-indigo-200">
                InsightNote
              </h1>
              <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
                A multi-notebook GraphRAG knowledge workspace. Index documents into a 3D WebGL relation graph and chat with grounded citations.
              </p>
            </div>

            {/* Main Section */}
            <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-8 bg-slate-900/30 border border-slate-900 rounded-3xl p-6 backdrop-blur-md">
              
              {/* Left Column: Create Notebook */}
              <div className="space-y-4 border-slate-900 md:border-r md:pr-8 flex flex-col justify-center">
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-200">Create Notebook</h3>
                  <p className="text-xs text-slate-450 leading-relaxed">
                    Set up an isolated workspace for a specific topic, document library, or research campaign.
                  </p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateNotebook(createInput);
                    setCreateInput('');
                  }}
                  className="space-y-3"
                >
                  <input
                    type="text"
                    required
                    placeholder="e.g. Resume Analysis"
                    value={createInput}
                    onChange={(e) => setCreateInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 rounded-xl px-4 py-3 text-sm placeholder-slate-650 outline-none text-slate-100 disabled:opacity-60 transition"
                  />
                  <button
                    type="submit"
                    disabled={!createInput.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-slate-950 font-bold py-3 rounded-xl transition duration-150 shadow-lg shadow-indigo-500/10 cursor-pointer flex items-center justify-center gap-1.5 text-xs text-slate-100"
                  >
                    <svg className="w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Create and Open Notebook
                  </button>
                </form>
              </div>

              {/* Right Column: Notebook List */}
              <div className="space-y-4 min-h-[220px] flex flex-col justify-center">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-slate-200">Notebook Dashboard</h3>
                  <span className="text-[10px] bg-slate-850 text-indigo-400 px-2 py-0.5 rounded-full font-bold border border-slate-800">
                    {notebooks.length} Notebook{notebooks.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {notebooksLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 py-8">
                    <svg className="w-6 h-6 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-xs">Loading notebooks...</span>
                  </div>
                ) : notebooks.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-850 rounded-2xl bg-slate-950/10">
                    <p className="text-xs text-slate-500">No notebooks available.</p>
                    <p className="text-[10px] text-slate-650 mt-1">Create one on the left to begin.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto max-h-[240px] pr-1 space-y-2.5">
                    {notebooks.map((nb) => (
                      <div
                        key={nb.id}
                        onClick={() => handleSelectNotebook(nb)}
                        className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl hover:border-indigo-500/40 transition duration-150 flex items-center justify-between cursor-pointer group"
                      >
                        <div className="space-y-1 min-w-0 flex-1 pr-4">
                          <h4 className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition truncate">
                            {nb.name}
                          </h4>
                          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-medium">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              {nb.source_count} source{nb.source_count !== 1 ? 's' : ''}
                            </span>
                            <span>•</span>
                            <span className="capitalize">{nb.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition duration-150 flex-shrink-0">
                          Open
                          <svg className="w-3.5 h-3.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
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
          <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-amber-500 shadow-amber-500/50'} animate-pulse`} />
          <span>System Status: {backendOnline ? 'Production Backend Active' : 'Sandbox Demo Fallback Active'}</span>
        </div>
        <div className="hidden sm:block text-slate-600">
          Vite • React • 3D Force-Directed Graph WebGL • Neo4j-Ready
        </div>
      </div>

      {/* 3-Column Responsive Workspace Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_minmax(520px,1fr)_480px] h-full overflow-hidden">
        {/* Left Panel: Sources */}
        <div className="h-full overflow-hidden border-slate-900 lg:border-r">
          <SourcesPanel
            notebook={activeNotebook}
            sources={sources}
            loading={sourcesLoading}
            pipelineJob={pipelineJob}
            onAddUrl={handleAddUrl}
            onAddText={handleAddText}
            onUploadFile={handleUploadFile}
            onLoadExample={handleLoadExample}
            onBackToDashboard={() => setActiveNotebook(null)}
          />
        </div>

        {/* Middle Panel: AI Copilot Chat */}
        <div className="h-full overflow-hidden flex flex-col">
          <ChatPanel
            messages={messages}
            isLoading={chatLoading}
            onSendMessage={handleSendMessage}
            isResume={activeNotebook.id.includes('resume') || activeNotebook.name.toLowerCase().includes('resume')}
          />
        </div>

        {/* Right Panel: WebGL 3D Graph */}
        <div className="h-full overflow-hidden border-slate-900 lg:border-l">
          <KnowledgeGraphPanel
            graphData={graphData}
            highlightPath={highlightPath}
            onNodeClick={handleNodeClick}
          />
        </div>
      </div>
    </div>
  );
}
