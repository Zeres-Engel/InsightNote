import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  User,
  Compass,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  BrainCircuit,
  Terminal,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "../../lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  isResume: boolean;
  showSources?: boolean;
  onToggleSources?: () => void;
  hasSources: boolean;
  queryMode: string;
  setQueryMode: (mode: string) => void;
  topK: number;
  setTopK: (k: number) => void;
  chunkTopK: number;
  setChunkTopK: (k: number) => void;
  enableRerank: boolean;
  setEnableRerank: (r: boolean) => void;
}

const PRESET_BADGES_DOCUMENT = [
  "Summarize the key facts in these documents.",
  "What entities are most important in this workspace?",
  "Which documents support your answer?",
  "What are the strongest relationships in the graph?",
  "Show me the reasoning path in the graph.",
];

const PRESET_BADGES_RESUME = [
  "What is this candidate's strongest AI experience?",
  "What GraphRAG-related experience does this resume show?",
  "What projects did this candidate work on at FPT Software?",
  "What technologies are connected to Rizlum?",
  "Is this candidate suitable for an AI Engineer role focused on LLM/RAG systems?",
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  isResume,
  showSources,
  onToggleSources,
  hasSources,
  queryMode,
  setQueryMode,
  topK,
  setTopK,
  chunkTopK,
  setChunkTopK,
  enableRerank,
  setEnableRerank,
}) => {
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestAssistantSuggestions =
    [...messages]
      .reverse()
      .find(
        (msg) =>
          msg.role === "assistant" &&
          msg.suggested_questions &&
          msg.suggested_questions.length > 0,
      )?.suggested_questions || [];
  const activeBadges =
    latestAssistantSuggestions.length > 0
      ? latestAssistantSuggestions
      : isResume
        ? PRESET_BADGES_RESUME
        : PRESET_BADGES_DOCUMENT;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleBadgeClick = (question: string) => {
    if (isLoading) return;
    onSendMessage(question);
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-900 bg-slate-900/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onToggleSources && (
            <button
              onClick={onToggleSources}
              title={showSources ? "Hide Sidebar" : "Show Sidebar"}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition duration-150 cursor-pointer mr-1"
            >
              {showSources ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
              )}
            </button>
          )}
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold tracking-tight text-slate-200">
            AI Copilot & Reasoning
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 font-medium hidden sm:flex items-center gap-1.5">
            <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
            Powered by ZeRAG
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Query Engine Settings"
            className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition duration-150 cursor-pointer ${showSettings ? "text-indigo-400 bg-slate-900/50" : ""}`}
          >
            <Settings className="w-4 h-4 animate-spin-slow" />
          </button>
        </div>
      </div>

      {/* Dynamic Slide-Down Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-slate-900 bg-slate-950/60 backdrop-blur-md"
          >
            <div className="p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-900/40 pb-2">
                <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-indigo-400 animate-spin-slow" />
                  RAG Query Engine Settings
                </span>
                <span className="text-[10px] bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded font-bold border border-indigo-900/40">
                  ZeRAG v1.1.0 Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Query Mode Dropdown */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-450 block uppercase tracking-wide text-[9px]">
                    Retrieval Mode
                  </label>
                  <select
                    value={queryMode}
                    onChange={(e) => setQueryMode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-2 outline-none text-slate-200 cursor-pointer transition text-xs"
                  >
                    <option value="mix">Mix (Unified Vector + Graph)</option>
                    <option value="hybrid">
                      Hybrid (Multi-Hop Relational)
                    </option>
                    <option value="local">Local (Deep Entity Focus)</option>
                    <option value="global">
                      Global (Thematic Communities)
                    </option>
                    <option value="naive">Naive (Pure Qdrant Vector)</option>
                  </select>
                </div>

                {/* Enable Reranking Toggle */}
                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="font-bold text-slate-450 block uppercase tracking-wide text-[9px] mb-1">
                    Reranking Filtration
                  </label>
                  <label className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 cursor-pointer select-none text-slate-350 hover:text-slate-100 hover:border-slate-700/50 transition">
                    <input
                      type="checkbox"
                      checked={enableRerank}
                      onChange={(e) => setEnableRerank(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500/30 bg-slate-950 cursor-pointer"
                    />
                    <span className="font-semibold">
                      Enable BGE-Reranker-M3
                    </span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Slider for Top K */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-450 uppercase tracking-wide text-[9px]">
                      Retrieve Entities Limit (Top K)
                    </label>
                    <span className="text-[10px] font-bold text-indigo-400">
                      {topK} items
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={150}
                    step={5}
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer bg-slate-900 h-1 rounded-lg outline-none"
                  />
                </div>

                {/* Slider for Chunk Top K */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-450 uppercase tracking-wide text-[9px]">
                      LLM Chunk Budget (Chunk Top K)
                    </label>
                    <span className="text-[10px] font-bold text-indigo-400">
                      {chunkTopK} chunks
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={1}
                    value={chunkTopK}
                    onChange={(e) => setChunkTopK(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer bg-slate-900 h-1 rounded-lg outline-none"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/5">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-200">
                {isResume
                  ? "Start a Resume Inquiry"
                  : "Start an Insurance Inquiry"}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isResume
                  ? "Ask anything about the candidate's skills, experience, projects, or suitability. The AI will query the 3D Knowledge Graph and retrieve grounded citations."
                  : "Ask anything about the active policies, coverage clauses, or exclusions. The AI will query the 3D Knowledge Graph and retrieve grounded citations."}
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            return <MessageBubble key={msg.id} message={msg} />;
          })
        )}

        {isLoading &&
          (!messages.length ||
            messages[messages.length - 1].role !== "assistant") && (
            <LoadingSkeleton />
          )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer Controls / Input */}
      <div className="p-4 border-t border-slate-900 bg-slate-900/30">
        {/* Preset Badges */}
        {hasSources && activeBadges.length > 0 && (
          <div className="mb-3.5 animate-fade-in">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
              {latestAssistantSuggestions.length > 0
                ? "Suggested Follow-Up Questions"
                : `${isResume ? "Resume" : "Insurance"} Domain Preset Inquiries (Click to run)`}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeBadges.map((badge, idx) => (
                <button
                  key={idx}
                  onClick={() => handleBadgeClick(badge)}
                  disabled={isLoading}
                  className={`text-[11px] font-medium border px-3 py-1.5 rounded-full transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    latestAssistantSuggestions.length > 0
                      ? "bg-emerald-950/25 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/40 border-emerald-900/40 text-emerald-300"
                      : "bg-slate-900/80 hover:bg-indigo-500/10 hover:text-indigo-300 hover:border-indigo-500/40 border-slate-800 text-slate-400"
                  }`}
                >
                  {badge}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2 relative">
          <input
            type="text"
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={
              isResume
                ? "Type your question (e.g. What GraphRAG experience does this resume show?)..."
                : "Type your question (e.g. Does John Doe cover motorcycles?)..."
            }
            className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 rounded-xl px-4 py-3 text-sm placeholder-slate-600 outline-none text-slate-100 disabled:opacity-60 transition"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-slate-950 font-bold px-4 rounded-xl flex items-center justify-center transition duration-150 shadow-lg shadow-indigo-500/15 cursor-pointer h-[44px] w-[44px]"
          >
            <Send className="w-4 h-4 text-slate-100" />
          </button>
        </form>
      </div>
    </div>
  );
};

const RenderXRightArrow: React.FC<{ label: string }> = ({ label }) => {
  return (
    <span
      className="inline-flex flex-col items-center justify-center mx-1.5 relative select-none animate-fade-in"
      style={{ verticalAlign: "middle" }}
    >
      <span className="text-[10px] text-indigo-300 font-semibold pb-0.5 leading-none">
        {label}
      </span>
      <span className="flex items-center w-full leading-none text-indigo-500">
        <span className="h-[1.5px] bg-indigo-500 flex-1 min-w-[32px]"></span>
        <span className="text-[10px] -ml-[3px]">➔</span>
      </span>
    </span>
  );
};

const renderMathAndText = (text: string): React.ReactNode => {
  if (!text) return "";

  // Match \xrightarrow{\text{label}} or \xrightarrow{label}
  const xArrowRegex = /\\xrightarrow(?:\\{\\text)?\\{([^}]+)\\}(?:\})?/g;

  const segments = text.split(xArrowRegex);
  if (segments.length <= 1) {
    return text;
  }

  return segments.map((seg, idx) => {
    if (idx % 2 === 1) {
      return <RenderXRightArrow key={idx} label={seg} />;
    }
    return seg;
  });
};

/* Helper to parse custom markdown (bolding, lists, code, file highlights) */
const renderBoldText = (text: string) => {
  if (!text) return "";

  // Standardize math/LaTeX arrow notations into clean Unicode arrows and strip math-mode dollars
  let cleanText = text
    .replace(/\$\\rightarrow\$/g, " → ")
    .replace(/\\rightarrow/g, " → ")
    .replace(/\$\\Rightarrow\$/g, " ⇒ ")
    .replace(/\\Rightarrow/g, " ⇒ ")
    .replace(/\$\\leftrightarrow\$/g, " ↔ ")
    .replace(/\\leftrightarrow/g, " ↔ ")
    .replace(/\$\\Leftrightarrow\$/g, " ⇔ ")
    .replace(/\\Leftrightarrow/g, " ⇔ ")
    .replace(/\$/g, "");

  // Split by bold patterns **bold**
  const parts = cleanText.split(/\*\*([^*]+)\*\*/g);

  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      const lowerPart = part.toLowerCase();
      // Highlight document-related references beautifully
      if (
        lowerPart.includes(".pdf") ||
        lowerPart.includes("resume") ||
        lowerPart.includes("bằng") ||
        lowerPart.includes("degree") ||
        lowerPart.includes("diploma")
      ) {
        return (
          <strong
            key={idx}
            className="font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/50 shadow-sm inline-flex items-center gap-0.5"
          >
            {renderMathAndText(part)}
          </strong>
        );
      }
      return (
        <strong
          key={idx}
          className="font-bold text-indigo-400 bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-900/40"
        >
          {renderMathAndText(part)}
        </strong>
      );
    }

    // Parse inline code: `code`
    const subParts = part.split(/`([^`]+)`/g);
    if (subParts.length > 1) {
      return subParts.map((subPart, subIdx) => {
        if (subIdx % 2 === 1) {
          return (
            <code
              key={subIdx}
              className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[11px] border border-slate-800/80"
            >
              {subPart}
            </code>
          );
        }
        return renderMathAndText(subPart);
      });
    }

    return renderMathAndText(part);
  });
};

/* Custom Markdown Rendering Component */
const Cursor = () => (
  <span className="inline-block w-1.5 h-3.5 ml-1 bg-indigo-400 animate-pulse rounded-sm align-middle" />
);

const MarkdownRenderer: React.FC<{
  content: string;
  isStreaming?: boolean;
}> = ({ content, isStreaming }) => {
  // Strip raw references and citations lists to prevent visual duplication with the beautiful Grounded Citations UI panel below
  let cleanContent = content || "";
  const refsHeaderIndex = cleanContent.search(
    /(###?\s*(References|Citations|REFERENCES|CITATIONS))|(\b(References|Citations):\b)/i,
  );
  if (refsHeaderIndex !== -1) {
    cleanContent = cleanContent.substring(0, refsHeaderIndex).trim();
  }

  const lines = cleanContent.split("\n");
  const lastLineIndex = lines.length - 1;

  return (
    <div className="space-y-2">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        const isLastLine = lineIdx === lastLineIndex && isStreaming;

        // Title markers
        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={lineIdx}
              className="text-xs font-bold text-indigo-300 uppercase tracking-wide mt-3.5 mb-1.5 flex items-center gap-1.5 border-b border-slate-850 pb-1"
            >
              <span className="w-1.5 h-3 bg-indigo-500 rounded-full animate-pulse"></span>
              {renderBoldText(trimmed.slice(4))}
              {isLastLine && <Cursor />}
            </h4>
          );
        }
        if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
          const cleanText = trimmed.startsWith("## ")
            ? trimmed.slice(3)
            : trimmed.slice(2);
          return (
            <h3
              key={lineIdx}
              className="text-sm font-black text-slate-100 mt-4 mb-2 flex items-center gap-2"
            >
              <span className="w-2 h-3.5 bg-emerald-500 rounded-full"></span>
              {renderBoldText(cleanText)}
              {isLastLine && <Cursor />}
            </h3>
          );
        }

        // List item markers
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
              <span className="text-slate-350 text-[12.5px] leading-relaxed">
                {renderBoldText(trimmed.slice(2))}
                {isLastLine && <Cursor />}
              </span>
            </div>
          );
        }

        // Numbered list item
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          const num = numMatch[1];
          const text = numMatch[2];
          return (
            <div key={lineIdx} className="flex items-start gap-2.5 pl-1 py-0.5">
              <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-950/60 border border-indigo-900/30 w-4.5 h-4.5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                {num}
              </span>
              <span className="text-slate-350 text-[12.5px] leading-relaxed flex-1">
                {renderBoldText(text)}
                {isLastLine && <Cursor />}
              </span>
            </div>
          );
        }

        // Empty lines
        if (!trimmed) {
          return <div key={lineIdx} className="h-2"></div>;
        }

        // Ordinary paragraph
        return (
          <p
            key={lineIdx}
            className="text-slate-300 text-[12.5px] leading-relaxed"
          >
            {renderBoldText(line)}
            {isLastLine && <Cursor />}
          </p>
        );
      })}
    </div>
  );
};

/* Individual Message Bubble Helper with expandable Steps */
const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isAssistant = message.role === "assistant";
  // Default expanded to true during thinking/retrieval phase so user sees reasoning steps in real-time!
  const [stepsExpanded, setStepsExpanded] = useState(
    isAssistant && !message.content,
  );

  return (
    <div
      className={`flex gap-3.5 ${isAssistant ? "justify-start" : "justify-end"} animate-fade-in`}
    >
      {isAssistant && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-500 p-[1px] flex-shrink-0 shadow-lg shadow-indigo-500/5">
          <div className="w-full h-full rounded-[7px] bg-slate-950 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
        </div>
      )}

      <div className="max-w-[85%] flex flex-col gap-2.5">
        {/* Actual Content Bubble */}
        <div
          className={`p-4 rounded-2xl border transition-all duration-200 ${
            isAssistant
              ? "bg-slate-900/40 border-slate-950/20 text-slate-100 shadow-xl shadow-slate-950/20 backdrop-blur-md hover:border-slate-900/60"
              : "bg-gradient-to-r from-indigo-600 to-indigo-700 border-transparent text-white font-medium rounded-tr-none shadow-lg shadow-indigo-600/10"
          }`}
        >
          {isAssistant ? (
            message.content ? (
              <MarkdownRenderer
                content={message.content}
                isStreaming={message.isStreaming}
              />
            ) : (
              <div className="flex items-center gap-1.5 py-1 min-w-[56px]">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
              </div>
            )
          ) : (
            <p className="text-[12.5px] leading-relaxed">{message.content}</p>
          )}
        </div>

        {/* Collapsible Retrieval steps (Assistant only) */}
        {isAssistant &&
          message.retrieval_steps &&
          message.retrieval_steps.length > 0 && (
            <div className="border border-slate-950/40 bg-slate-950/30 rounded-xl overflow-hidden shadow-md">
              <button
                onClick={() => setStepsExpanded(!stepsExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition bg-slate-900/30"
              >
                <span className="flex items-center gap-1.5 uppercase tracking-wider">
                  <Terminal className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  Retrieval & Reasoning Steps ({message.retrieval_steps.length})
                </span>
                {stepsExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              {stepsExpanded && (
                <div className="p-3 border-t border-slate-950 space-y-2 text-[10.5px] font-mono text-slate-450 bg-slate-950/90 leading-relaxed max-h-[160px] overflow-y-auto">
                  {message.retrieval_steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold select-none">{`>`}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        {/* Citation Cards (Assistant only) */}
        {isAssistant && message.citations && message.citations.length > 0 && (
          <div className="space-y-1.5 mt-0.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 pl-1">
              <BookOpen className="w-3 h-3 text-emerald-500" />
              Grounded Citations
            </div>
            <div className="grid grid-cols-1 gap-2">
              {message.citations.map((cite, idx) => {
                const title =
                  (cite.title || "").trim() ||
                  (cite.source_id?.startsWith("http") ? cite.source_id : "") ||
                  "Source Document";
                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900/20 border border-slate-950/40 hover:border-slate-850 rounded-xl hover:bg-slate-900/40 transition-all duration-200 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-350 flex items-center gap-1 truncate">
                        {title}
                      </span>
                      <span className="text-[9px] bg-emerald-950/60 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900/40 font-bold flex-shrink-0">
                        {cite.score > 0
                          ? `Match: ${Math.round(cite.score * 100)}%`
                          : "Retrieved"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed italic border-l border-slate-800 pl-2">
                      "{cite.text}"
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {!isAssistant && (
        <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-900/55 flex items-center justify-center text-indigo-300 flex-shrink-0 shadow-lg shadow-indigo-950/20">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};

/* Chat Skeletons */
const LoadingSkeleton = () => {
  return (
    <div className="flex gap-3.5 justify-start animate-fade-in">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-500 p-[1px] flex-shrink-0 shadow-lg shadow-indigo-500/5">
        <div className="w-full h-full rounded-[7px] bg-slate-950 flex items-center justify-center text-indigo-400">
          <Sparkles className="w-4.5 h-4.5 animate-pulse" />
        </div>
      </div>
      <div className="max-w-[70%]">
        <div className="p-3 bg-slate-900/40 border border-slate-950/20 rounded-2xl rounded-tl-none shadow-xl backdrop-blur-md flex items-center gap-1.5 h-[42px] px-4">
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
        </div>
      </div>
    </div>
  );
};
