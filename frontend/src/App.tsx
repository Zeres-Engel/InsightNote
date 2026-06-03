import { useState, useEffect } from 'react';
import { SourcesPanel } from './components/sources/SourcesPanel';
import { ChatPanel } from './components/chat/ChatPanel';
import { KnowledgeGraphPanel } from './components/graph/KnowledgeGraphPanel';
import { SourceListItem, ChatMessage, GraphResponse, GraphPath } from './lib/types';
import * as api from './lib/api';

export default function App() {
  // State definitions
  const [sources, setSources] = useState<SourceListItem[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [graphData, setGraphData] = useState<GraphResponse>({ nodes: [], links: [] });
  const [highlightPath, setHighlightPath] = useState<GraphPath>({ node_ids: [], link_ids: [] });

  const [backendOnline, setBackendOnline] = useState(false);

  // Initial load
  useEffect(() => {
    const initApp = async () => {
      // 1. Check health
      const isOnline = await api.checkBackendHealth();
      setBackendOnline(isOnline);
      console.log(`Backend health check: ${isOnline ? 'ONLINE' : 'FALLBACK MODE'}`);

      // 2. Load sources
      setSourcesLoading(true);
      try {
        const sourceList = await api.listSources();
        setSources(sourceList);
      } catch (e) {
        console.error("Failed to load sources", e);
      } finally {
        setSourcesLoading(false);
      }

      // 3. Load 3D graph
      try {
        const initialGraph = await api.getGraph();
        setGraphData(initialGraph);
      } catch (e) {
        console.error("Failed to load initial graph", e);
      }
    };

    initApp();
  }, []);

  // Handler: Add URL source
  const handleAddUrl = async (url: string) => {
    try {
      const newSource = await api.addSource('url', url);
      setSources(prev => [newSource, ...prev]);
    } catch (e) {
      console.error(e);
    }
  };

  // Handler: Add plain-text note source
  const handleAddText = async (text: string) => {
    try {
      const newSource = await api.addSource('text', text);
      setSources(prev => [newSource, ...prev]);
    } catch (e) {
      console.error(e);
    }
  };

  // Handler: Upload File source
  const handleUploadFile = async (file: File) => {
    try {
      const newSource = await api.uploadFile(file);
      setSources(prev => [newSource, ...prev]);
    } catch (e) {
      console.error(e);
    }
  };

  // Handler: Send Chat message and capture reasoning path
  const handleSendMessage = async (text: string) => {
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
      const response = await api.askChat(text);

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
    return await api.getNodeDetails(nodeId);
  };

  return (
    <div className="h-screen w-screen bg-[#0a0a0b] text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Top Banner indicating backend/sandbox status */}
      <div className="px-4 py-1 bg-slate-950 border-b border-slate-900 flex justify-between items-center text-[11px] font-semibold text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-amber-500 shadow-amber-500/50'} animate-pulse`} />
          <span>System Status: {backendOnline ? 'Production Backend Active' : 'Sandbox Demo Fallback Active'}</span>
        </div>
        <div className="hidden sm:block text-slate-600">
          Vite • React • 3D Force-Directed Graph WebGL • Neo4j-Ready
        </div>
      </div>

      {/* 3-Column Responsive Dashboard Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_minmax(520px,1fr)_480px] h-full overflow-hidden">
        {/* Left Panel: Sources */}
        <div className="h-full overflow-hidden border-slate-900 lg:border-r">
          <SourcesPanel
            sources={sources}
            loading={sourcesLoading}
            onAddUrl={handleAddUrl}
            onAddText={handleAddText}
            onUploadFile={handleUploadFile}
          />
        </div>

        {/* Middle Panel: AI Copilot Chat */}
        <div className="h-full overflow-hidden flex flex-col">
          <ChatPanel
            messages={messages}
            isLoading={chatLoading}
            onSendMessage={handleSendMessage}
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
