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
} from "lucide-react";
import { ChatMessage } from "../../lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  isResume: boolean;
  showSources?: boolean;
  onToggleSources?: () => void;
}

const PRESET_BADGES_INSURANCE = [
  "What is the main coverage of this policy?",
  "Does this policy cover motorcycle accidents?",
  "What exclusions apply to vehicle accidents?",
  "Which clauses support your answer?",
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
}) => {
  const [input, setInput] = useState("");
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
        : PRESET_BADGES_INSURANCE;

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
        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
          Powered by ZeRAG & Neo4j
        </div>
      </div>

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
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {isLoading && <LoadingSkeleton />}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer Controls / Input */}
      <div className="p-4 border-t border-slate-900 bg-slate-900/30">
        {/* Preset Badges */}
        <div className="mb-3.5">
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
            {part}
          </strong>
        );
      }
      return (
        <strong
          key={idx}
          className="font-bold text-indigo-400 bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-900/40"
        >
          {part}
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
        return subPart;
      });
    }

    return part;
  });
};

/* Custom Markdown Rendering Component */
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  // Strip raw references and citations lists to prevent visual duplication with the beautiful Grounded Citations UI panel below
  let cleanContent = content || "";
  const refsHeaderIndex = cleanContent.search(
    /(###?\s*(References|Citations|REFERENCES|CITATIONS))|(\b(References|Citations):\b)/i,
  );
  if (refsHeaderIndex !== -1) {
    cleanContent = cleanContent.substring(0, refsHeaderIndex).trim();
  }

  const lines = cleanContent.split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Title markers
        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={lineIdx}
              className="text-xs font-bold text-indigo-300 uppercase tracking-wide mt-3.5 mb-1.5 flex items-center gap-1.5 border-b border-slate-850 pb-1"
            >
              <span className="w-1.5 h-3 bg-indigo-500 rounded-full animate-pulse"></span>
              {renderBoldText(trimmed.slice(4))}
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
          </p>
        );
      })}
    </div>
  );
};

/* Individual Message Bubble Helper with expandable Steps */
const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isAssistant = message.role === "assistant";
  const [stepsExpanded, setStepsExpanded] = useState(false);

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
            <MarkdownRenderer content={message.content} />
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
              {message.citations.map((cite, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-900/20 border border-slate-950/40 hover:border-slate-850 rounded-xl hover:bg-slate-900/40 transition-all duration-200 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-350 flex items-center gap-1 truncate">
                      {cite.title}
                    </span>
                    <span className="text-[9px] bg-emerald-950/60 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900/40 font-bold flex-shrink-0">
                      Match: {Math.round(cite.score * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed italic border-l border-slate-800 pl-2">
                    "{cite.text}"
                  </p>
                </div>
              ))}
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
    <div className="flex gap-3.5 justify-start">
      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
        <Sparkles className="w-4.5 h-4.5 animate-pulse" />
      </div>
      <div className="max-w-[70%] w-full flex flex-col gap-2">
        <div className="p-3.5 bg-slate-900 border border-slate-800/60 rounded-2xl space-y-2.5 animate-pulse">
          <div className="h-3 bg-slate-800 rounded w-[95%]"></div>
          <div className="h-3 bg-slate-800 rounded w-[85%]"></div>
          <div className="h-3 bg-slate-800 rounded w-[50%]"></div>
        </div>
      </div>
    </div>
  );
};
