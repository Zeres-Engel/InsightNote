export interface SourceListItem {
  id: string;
  name: string;
  type: string; // 'url' | 'text' | 'pdf'
  status: string; // 'processing' | 'ready' | 'failed'
  entity_count?: number;
  chunk_count?: number;
}

export interface CitationItem {
  source_id: string;
  title: string;
  chunk_id: string;
  text: string;
  score: number;
}

export interface GraphPath {
  node_ids: string[];
  link_ids: string[];
}

export interface ChatRequest {
  workspace_id?: string;
  message: string;
}

export interface ChatResponse {
  answer: string;
  citations: CitationItem[];
  retrieval_steps: string[];
  graph_path: GraphPath;
  nodes_metadata?: any[];
  links_metadata?: any[];
  suggested_questions?: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  group: string;
  properties?: Record<string, any>;
  x?: number;
  y?: number;
  z?: number;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  properties?: Record<string, any>;
}

export interface GraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface NodeDetailsResponse {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  citations?: CitationItem[];
  retrieval_steps?: string[];
  graph_path?: GraphPath;
  suggested_questions?: string[];
}

export interface Notebook {
  id: string;
  name: string;
  source_count: number;
  status: string;
}

export interface PipelineStep {
  name: string;
  status: "pending" | "processing" | "done" | "failed_fallback_used";
}

export interface PipelineJobResponse {
  job_id: string;
  status: "processing" | "ready" | "failed";
  steps: PipelineStep[];
  message?: string;
  percent?: number;
  graph_changed?: boolean;
  graph_node_count?: number;
  graph_link_count?: number;
  new_node_ids?: string[];
  new_link_ids?: string[];
}

export interface SourceAddResponse {
  source_id: string;
  name: string;
  type: string;
  status: string;
  pipeline_job_id?: string;
}
