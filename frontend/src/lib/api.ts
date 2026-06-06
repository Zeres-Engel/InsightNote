import {
  SourceListItem,
  ChatResponse,
  GraphResponse,
  NodeDetailsResponse,
  Notebook,
  PipelineJobResponse,
} from "./types";
import { MOCK_SOURCES, MOCK_NODES, MOCK_LINKS, PRESET_QA } from "./mock-data";

declare let process: any;

const API_BASE_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:8000";
const BASE_URL = `${API_BASE_URL.replace(/\/$/, "")}/api`;

// --- Sandbox Local Stores (for offline fallbacks) ---
let localNotebooks: Notebook[] = [
  {
    id: "default",
    name: "Default GraphRAG Workspace",
    source_count: 0,
    status: "empty",
  },
];

let localSources: Record<string, SourceListItem[]> = {
  default: [],
};

let localJobs: Record<
  string,
  { jobId: string; notebookId: string; createdAt: number; status: string }
> = {};

// Check backend health
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.status === "ok";
    }
    return false;
  } catch (e) {
    return false;
  }
}

// --- Notebook APIs ---

export async function listNotebooks(): Promise<Notebook[]> {
  try {
    const res = await fetch(`${BASE_URL}/notebooks`);
    if (res.ok) {
      return await res.json();
    }
    throw new Error();
  } catch (e) {
    console.warn("Backend down. Falling back to local notebooks.");
    return localNotebooks;
  }
}

export async function createNotebook(name: string): Promise<Notebook> {
  try {
    const res = await fetch(`${BASE_URL}/notebooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error();
  } catch (e) {
    console.warn("Backend down. Creating notebook locally in sandbox.");
    const nid =
      "notebook_" +
      name.trim().toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");
    const newNb: Notebook = {
      id: nid,
      name,
      source_count: 0,
      status: "empty",
    };
    localNotebooks = [...localNotebooks, newNb];
    localSources[nid] = [];
    return newNb;
  }
}

export async function getNotebook(notebookId: string): Promise<Notebook> {
  try {
    const res = await fetch(`${BASE_URL}/notebooks/${notebookId}`);
    if (res.ok) {
      return await res.json();
    }
    throw new Error();
  } catch (e) {
    const nb = localNotebooks.find((n) => n.id === notebookId);
    if (nb) return nb;
    throw new Error("Notebook not found");
  }
}

// --- Pipeline Progress Tracking ---

export async function getPipelineStatus(
  jobId: string,
): Promise<PipelineJobResponse> {
  try {
    const res = await fetch(`${BASE_URL}/pipeline/jobs/${jobId}`);
    if (res.ok) {
      return await res.json();
    }
    throw new Error();
  } catch (e) {
    // Sandbox simulated pipeline progress
    const job = localJobs[jobId];
    if (!job) {
      return {
        job_id: jobId,
        status: "ready",
        steps: [
          { name: "load_file", status: "done" },
          { name: "document_understanding", status: "done" },
          { name: "vector_graph_sync", status: "done" },
        ],
      };
    }

    const elapsed = (Date.now() - job.createdAt) / 1000;
    const step_definitions = [
      { name: "load_file", t: 0.0 },
      { name: "document_understanding", t: 1.5 },
      { name: "vector_graph_sync", t: 5.0 },
    ];

    const steps = step_definitions.map((step) => {
      if (elapsed >= step.t + 1.5) {
        return { name: step.name, status: "done" as const };
      } else if (elapsed >= step.t) {
        return { name: step.name, status: "processing" as const };
      } else {
        return { name: step.name, status: "pending" as const };
      }
    });

    const isDone = elapsed >= 10.5;
    if (isDone) {
      job.status = "ready";
      // Update local notebook status on compile
      const nb = localNotebooks.find((n) => n.id === job.notebookId);
      if (nb) {
        nb.status = "ready";
        nb.source_count = 1;
      }

      // Populate local notebook sources with resume
      if (job.notebookId.includes("resume")) {
        localSources[job.notebookId] = [
          {
            id: "src_resume_pdf",
            name: "Resume.pdf",
            type: "pdf",
            status: "ready",
            entity_count: 12,
            chunk_count: 25,
          },
        ];
      } else {
        localSources[job.notebookId] = [
          {
            id: "src_001",
            name: "Insurance Policy Demo",
            type: "demo",
            status: "ready",
            entity_count: 10,
            chunk_count: 24,
          },
        ];
      }
    }

    return {
      job_id: jobId,
      status: isDone ? "ready" : "processing",
      steps,
    };
  }
}

// --- Source Management ---

export async function listSources(
  notebookId: string,
): Promise<SourceListItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/notebooks/${notebookId}/sources`);
    if (res.ok) {
      return await res.json();
    }
    throw new Error();
  } catch (e) {
    return localSources[notebookId] || [];
  }
}

export async function addUrl(
  notebookId: string,
  url: string,
): Promise<{
  source_id: string;
  name: string;
  type: string;
  status: string;
  pipeline_job_id?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/notebooks/${notebookId}/sources/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        source_id: data.source_id,
        name: data.name,
        type: "url",
        status: data.status,
        pipeline_job_id: data.pipeline_job_id,
      };
    }
    throw new Error();
  } catch (e) {
    console.warn("Backend down. Emulating addUrl in sandbox.");
    const sourceId = `src_url_${Date.now()}`;
    return {
      source_id: sourceId,
      name: url,
      type: "url",
      status: "ready",
    };
  }
}

async function readSourceIngestStream(
  endpoint: string,
  body: unknown,
  onProgress: (
    progress: PipelineJobResponse & {
      source_id?: string;
      name?: string;
      type?: string;
    },
  ) => void,
): Promise<{
  source_id: string;
  name: string;
  type: string;
  status: string;
  pipeline_job_id?: string;
}> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Source stream failed: ${response.statusText}`);
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let lastPayload: any = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const data = JSON.parse(line);
      lastPayload = data;
      onProgress({
        job_id: data.job_id,
        status: data.status,
        steps: data.steps || [],
        message: data.message || data.latest_message,
        percent: data.percent ?? data.progress_percentage,
        progress_percentage: data.progress_percentage,
        latest_message: data.latest_message,
        graph_changed: data.graph_changed,
        graph_node_count: data.graph_node_count,
        graph_link_count: data.graph_link_count,
        new_node_ids: data.new_node_ids || [],
        new_link_ids: data.new_link_ids || [],
        source_id: data.source_id,
        name: data.name,
        type: data.type,
      });
      if (data.error) {
        throw new Error(data.message || data.error);
      }
    }
  }

  return {
    source_id:
      lastPayload.source_id ||
      `src_${(lastPayload.job_id || Math.random().toString(36)).replace(/^job_/, "")}`,
    name: lastPayload.name || "Source",
    type: lastPayload.type || "text",
    status: lastPayload.status || "processing",
    pipeline_job_id: lastPayload.job_id,
  };
}

export async function addUrlStream(
  notebookId: string,
  url: string,
  onProgress: Parameters<typeof readSourceIngestStream>[2],
) {
  try {
    return await readSourceIngestStream(
      `/notebooks/${notebookId}/sources/url/stream`,
      { url },
      onProgress,
    );
  } catch (e) {
    console.warn("URL stream unavailable. Falling back to non-stream add.", e);
    return addUrl(notebookId, url);
  }
}

export async function addNote(
  notebookId: string,
  title: string,
  content: string,
): Promise<{
  source_id: string;
  name: string;
  type: string;
  status: string;
  pipeline_job_id?: string;
}> {
  try {
    const res = await fetch(
      `${BASE_URL}/notebooks/${notebookId}/sources/note`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      return {
        source_id: data.source_id,
        name: data.name,
        type: "text",
        status: data.status,
        pipeline_job_id: data.pipeline_job_id,
      };
    }
    throw new Error();
  } catch (e) {
    console.warn("Backend down. Emulating addNote in sandbox.");
    const sourceId = `src_text_${Date.now()}`;
    return {
      source_id: sourceId,
      name: title,
      type: "text",
      status: "ready",
    };
  }
}

export async function loadExample(
  notebookId: string,
  path: string,
): Promise<{
  source_id: string;
  name: string;
  type: string;
  status: string;
  pipeline_job_id?: string;
}> {
  try {
    const res = await fetch(
      `${BASE_URL}/notebooks/${notebookId}/sources/load-example`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      return {
        source_id: data.source_id,
        name: data.name,
        type: data.type || "file",
        status: data.status,
        pipeline_job_id: data.pipeline_job_id,
      };
    }
    throw new Error();
  } catch (e) {
    console.warn("Backend down. Emulating load-example in sandbox.");
    const jobId = "job_resume_" + Math.random().toString(36).substring(2, 8);
    localJobs[jobId] = {
      jobId,
      notebookId,
      createdAt: Date.now(),
      status: "processing",
    };

    // Update local notebook status
    const nb = localNotebooks.find((n) => n.id === notebookId);
    if (nb) {
      nb.status = "processing";
    }

    return {
      source_id: "src_resume_pdf",
      name: "Resume.pdf",
      type: "pdf",
      status: "processing",
      pipeline_job_id: jobId,
    };
  }
}

export async function uploadFile(
  notebookId: string,
  file: File,
): Promise<{
  source_id: string;
  name: string;
  type: string;
  status: string;
  pipeline_job_id?: string;
}> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(
      `${BASE_URL}/notebooks/${notebookId}/sources/upload`,
      {
        method: "POST",
        body: formData,
      },
    );
    if (res.ok) {
      const data = await res.json();
      return {
        source_id: data.source_id,
        name: data.name,
        type: "pdf",
        status: data.status,
        pipeline_job_id: data.pipeline_job_id,
      };
    }
    throw new Error();
  } catch (e) {
    console.warn("Backend down. Emulating upload locally.");
    const jobId = "job_upload_" + Math.random().toString(36).substring(2, 8);
    localJobs[jobId] = {
      jobId,
      notebookId,
      createdAt: Date.now(),
      status: "processing",
    };

    const nb = localNotebooks.find((n) => n.id === notebookId);
    if (nb) {
      nb.status = "processing";
    }

    return {
      source_id: "src_" + Math.random().toString(36).substring(2, 8),
      name: file.name,
      type: file.name.split(".").pop()?.toLowerCase() || "file",
      status: "processing",
      pipeline_job_id: jobId,
    };
  }
}

export async function addNoteStream(
  notebookId: string,
  title: string,
  content: string,
  onProgress: Parameters<typeof readSourceIngestStream>[2],
) {
  try {
    return await readSourceIngestStream(
      `/notebooks/${notebookId}/sources/note/stream`,
      { title, content },
      onProgress,
    );
  } catch (e) {
    console.warn("Note stream unavailable. Falling back to non-stream add.", e);
    return addNote(notebookId, title, content);
  }
}

export async function uploadFileStream(
  notebookId: string,
  file: File,
  onProgress: (progress: PipelineJobResponse) => void,
): Promise<{ source_id: string; name: string; type: string; status: string }> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${BASE_URL}/documents/upload/stream?workspace=${notebookId}&multi_modal=true&graph_mode=true`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalStatus = "processing";
    let jobId = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.error) {
            throw new Error(data.error);
          }
          if (data.job_id) {
            jobId = data.job_id;
          }
          if (data.status) {
            finalStatus = data.status;
          }
          // Invoke callback to update the progress in UI
          onProgress({
            job_id: data.job_id || jobId,
            status: data.status,
            steps: data.steps || [],
            message: data.message,
            percent: data.percent,
            graph_changed: data.graph_changed,
            graph_node_count: data.graph_node_count,
            graph_link_count: data.graph_link_count,
            new_node_ids: data.new_node_ids || [],
            new_link_ids: data.new_link_ids || [],
          });
        } catch (e) {
          console.error("Failed to parse NDJSON line:", e);
        }
      }
    }

    return {
      source_id: `src_${jobId.replace("job_upload_", "") || Math.random().toString(36).substring(2, 8)}`,
      name: file.name,
      type: file.name.endsWith(".pdf") ? "pdf" : "text",
      status: finalStatus,
    };
  } catch (e) {
    console.warn("Backend down. Emulating upload streaming locally.", e);
    const jobId = "job_upload_" + Math.random().toString(36).substring(2, 8);

    // Simulate streaming updates locally
    const step_definitions = [
      "load_file",
      "document_understanding",
      "vector_graph_sync",
    ];

    const nb = localNotebooks.find((n) => n.id === notebookId);
    if (nb) {
      nb.status = "processing";
    }

    for (let i = 0; i <= step_definitions.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const steps = step_definitions.map((name, idx) => {
        if (idx < i) return { name, status: "done" as const };
        if (idx === i) return { name, status: "processing" as const };
        return { name, status: "pending" as const };
      });

      const isDone = i === step_definitions.length;
      onProgress({
        job_id: jobId,
        status: isDone ? "ready" : "processing",
        steps,
      });
    }

    if (nb) {
      nb.status = "ready";
      nb.source_count = (nb.source_count || 0) + 1;
    }

    // Populate local sources with simulated source
    if (!localSources[notebookId]) {
      localSources[notebookId] = [];
    }
    const newLocalSrc = {
      id: "src_" + Math.random().toString(36).substring(2, 8),
      name: file.name,
      type: file.name.endsWith(".pdf") ? "pdf" : "text",
      status: "ready",
      entity_count: 5,
      chunk_count: 8,
    };
    localSources[notebookId].push(newLocalSrc);

    return {
      source_id: newLocalSrc.id,
      name: file.name,
      type: newLocalSrc.type,
      status: "ready",
    };
  }
}

// --- Graph Retrieval ---

export async function getGraph(notebookId: string): Promise<GraphResponse> {
  try {
    const res = await fetch(`${BASE_URL}/notebooks/${notebookId}/graph`);
    if (res.ok) {
      return await res.json();
    }
    throw new Error();
  } catch (e) {
    // Determine which mock graph to load in sandbox
    const nb = localNotebooks.find((n) => n.id === notebookId);
    if (
      notebookId.includes("resume") ||
      (nb && nb.name.toLowerCase().includes("resume"))
    ) {
      // Import resume mock graph dynamically or import from local
      const resumeNodes = [
        {
          id: "person_nguyen_phuoc_thanh",
          label: "Nguyen Phuoc Thanh",
          type: "Person",
          group: "person",
          properties: { summary: "Senior AI & GraphRAG Engineer." },
        },
        {
          id: "role_ai_engineer",
          label: "AI Engineer",
          type: "Role",
          group: "role",
        },
        {
          id: "company_fpt_software",
          label: "FPT Software",
          type: "Company",
          group: "company",
        },
        {
          id: "company_rizlum",
          label: "Rizlum",
          type: "Company",
          group: "company",
        },
        {
          id: "skill_graphrag",
          label: "GraphRAG",
          type: "Skill",
          group: "skill",
        },
        {
          id: "tech_neo4j",
          label: "Neo4j",
          type: "Technology",
          group: "technology",
        },
        {
          id: "tech_qdrant",
          label: "Qdrant",
          type: "Technology",
          group: "technology",
        },
        {
          id: "tech_fastapi",
          label: "FastAPI",
          type: "Technology",
          group: "technology",
        },
      ];
      const resumeLinks = [
        {
          id: "edge_r01",
          source: "person_nguyen_phuoc_thanh",
          target: "role_ai_engineer",
          label: "HAS_ROLE",
        },
        {
          id: "edge_r02",
          source: "person_nguyen_phuoc_thanh",
          target: "company_fpt_software",
          label: "WORKED_AT",
        },
        {
          id: "edge_r03",
          source: "person_nguyen_phuoc_thanh",
          target: "company_rizlum",
          label: "WORKS_AT",
        },
        {
          id: "edge_r04",
          source: "person_nguyen_phuoc_thanh",
          target: "skill_graphrag",
          label: "HAS_SKILL",
        },
        {
          id: "edge_r05",
          source: "skill_graphrag",
          target: "tech_neo4j",
          label: "USES_TECH",
        },
        {
          id: "edge_r06",
          source: "skill_graphrag",
          target: "tech_qdrant",
          label: "USES_TECH",
        },
        {
          id: "edge_r07",
          source: "skill_graphrag",
          target: "tech_fastapi",
          label: "USES_TECH",
        },
      ];
      return { nodes: resumeNodes, links: resumeLinks };
    }
    if (notebookId === "notebook_insurance_demo" || notebookId === "default") {
      return {
        nodes: [...MOCK_NODES],
        links: [...MOCK_LINKS],
      };
    }
    return {
      nodes: [],
      links: [],
    };
  }
}

export async function getNodeDetails(
  notebookId: string,
  nodeId: string,
): Promise<NodeDetailsResponse> {
  try {
    const res = await fetch(
      `${BASE_URL}/notebooks/${notebookId}/graph/node/${nodeId}`,
    );
    if (res.ok) {
      return await res.json();
    }
    throw new Error();
  } catch (e) {
    const nb = localNotebooks.find((n) => n.id === notebookId);
    const isResume =
      notebookId.includes("resume") ||
      (nb && nb.name.toLowerCase().includes("resume"));

    if (isResume) {
      const resumeNodes = [
        {
          id: "person_nguyen_phuoc_thanh",
          label: "Nguyen Phuoc Thanh",
          type: "Person",
          properties: {
            fullName: "Nguyen Phuoc Thanh",
            role: "Senior AI & GraphRAG Engineer",
            email: "nguyenphuocthanh@example.com",
            summary: "Specializes in LLM, RAG and Knowledge Graphs.",
          },
        },
        {
          id: "role_ai_engineer",
          label: "AI Engineer",
          type: "Role",
          properties: {
            summary: "Design and productionize GraphRAG platforms.",
          },
        },
        {
          id: "company_rizlum",
          label: "Rizlum",
          type: "Company",
          properties: {
            industry: "InsurTech Solutions",
            summary: "Insurance technology automation specialist.",
          },
        },
        {
          id: "skill_graphrag",
          label: "GraphRAG",
          type: "Skill",
          properties: {
            confidence: 0.96,
            summary: "Multi-hop graph-based semantic search & retrieval.",
          },
        },
      ];
      const match = resumeNodes.find((n) => n.id === nodeId);
      if (match)
        return {
          id: match.id,
          label: match.label,
          type: match.type,
          properties: match.properties,
        };
    } else {
      const match = MOCK_NODES.find((n) => n.id === nodeId);
      if (match)
        return {
          id: match.id,
          label: match.label,
          type: match.type,
          properties: match.properties || {},
        };
    }

    return {
      id: nodeId,
      label: nodeId,
      type: "Concept",
      properties: {
        description: "Node detail resolved in fallback sandbox mode.",
      },
    };
  }
}

// --- Chat Workspace ---

// Fetch chat history from PostgreSQL (BE)
export async function getChatHistory(notebookId: string): Promise<any[]> {
  try {
    const res = await fetch(`${BASE_URL}/notebooks/${notebookId}/chat/history`);
    if (res.ok) {
      return await res.json();
    }
    throw new Error();
  } catch (e) {
    console.warn("Backend down. Falling back to local chat history.");
    return [];
  }
}

export async function askChat(
  notebookId: string,
  message: string,
  chatHistory: any[] = [],
  onChunk?: (chunk: string) => void,
  onMetadata?: (metadata: any) => void,
  rerank: boolean = true,
): Promise<ChatResponse> {
  try {
    const res = await fetch(`${BASE_URL}/notebooks/${notebookId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_prompt: message,
        conversation_history: chatHistory,
        stream: !!onChunk,
        rerank: rerank,
      }),
    });
    if (res.ok) {
      if (onChunk) {
        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not readable");
        }
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let finalResponse: ChatResponse = {
          answer: "",
          citations: [],
          retrieval_steps: [],
          graph_path: { node_ids: [], link_ids: [] },
          suggested_questions: [],
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            if (trimmedLine.startsWith("data: ")) {
              const dataStr = trimmedLine.slice(6).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === "metadata") {
                  finalResponse.citations = parsed.citations || [];
                  finalResponse.retrieval_steps = parsed.retrieval_steps || [];
                  finalResponse.graph_path = parsed.graph_path || {
                    node_ids: [],
                    link_ids: [],
                  };
                  finalResponse.nodes_metadata = parsed.nodes_metadata || [];
                  finalResponse.links_metadata = parsed.links_metadata || [];
                  finalResponse.suggested_questions =
                    parsed.suggested_questions || [];
                  if (onMetadata) {
                    onMetadata(parsed);
                  }
                } else if (parsed.type === "content") {
                  finalResponse.answer += parsed.content;
                  onChunk(parsed.content);
                } else if (parsed.type === "error") {
                  console.error(
                    "Stream error event from backend:",
                    parsed.message,
                  );
                }
              } catch (err) {
                console.error(
                  "Failed to parse SSE JSON:",
                  err,
                  "line:",
                  trimmedLine,
                );
              }
            }
          }
        }
        return finalResponse;
      } else {
        return await res.json();
      }
    }
    throw new Error();
  } catch (e) {
    console.warn("Backend down. Running chat sandbox emulation.");
    const msgLower = message.trim().toLowerCase();
    const nb = localNotebooks.find((n) => n.id === notebookId);
    const isResume =
      notebookId.includes("resume") ||
      (nb && nb.name.toLowerCase().includes("resume"));

    let presetResponse: ChatResponse;

    if (isResume) {
      // Find matching resume Q&A key
      const resumeQA: Record<string, ChatResponse> = {
        "candidate's strongest ai experience": {
          answer:
            "Nguyen Phuoc Thanh's strongest AI experience lies in designing, developing, and deploying production-grade RAG and hybrid GraphRAG systems, as well as optimizing computer vision algorithms (such as layout OCR parsing with MinerU, facial recognition, and action tracking models). At Rizlum, he engineered multi-hop reasoning over large insurance policy databases using Neo4j and Qdrant.",
          citations: [
            {
              source_id: "src_resume_pdf",
              title: "Resume.pdf",
              chunk_id: "chunk_res_001",
              text: "Summary: Senior AI & GraphRAG Engineer. Experienced in production systems with LangChain, LightRAG, Qdrant and Neo4j schemas.",
              score: 0.98,
            },
          ],
          retrieval_steps: [
            "Detected core query: strongest AI engineering experience",
            "Mapped node identifiers: 'Nguyen Phuoc Thanh', 'AI Engineer', 'GraphRAG'",
            "Traversed paths: Person -> HAS_ROLE -> AI Engineer -> HAS_SKILL -> GraphRAG",
            "Generated grounded recommendation with citations",
          ],
          graph_path: {
            node_ids: [
              "person_nguyen_phuoc_thanh",
              "role_ai_engineer",
              "skill_graphrag",
            ],
            link_ids: ["edge_r01", "edge_r04"],
          },
        },
        "graphrag-related experience": {
          answer:
            "The candidate has highly specialized GraphRAG experience at Rizlum, where he designed and implemented end-to-end GraphRAG architectures. He integrated LangChain, LightRAG, Qdrant (vector index), and Neo4j (graph database) to enable multi-hop reasoning and deep conceptual retrieval over high-density insurance policy manuals.",
          citations: [
            {
              source_id: "src_resume_pdf",
              title: "Resume.pdf",
              chunk_id: "chunk_res_002",
              text: "Rizlum platform: Designed hybrid vector-graph RAG system to traverse policy relationships in Neo4j and perform semantic search in Qdrant.",
              score: 0.95,
            },
          ],
          retrieval_steps: [
            "Detected keyword query: GraphRAG experiences",
            "Matched resume chunks containing: 'Neo4j', 'Qdrant', 'Rizlum'",
            "Traversed Neo4j path: Nguyen Phuoc Thanh -> WORKS_AT -> Rizlum -> HAS_SKILL -> GraphRAG -> USES_TECH -> Neo4j",
            "Synthesized detailed answer and citations",
          ],
          graph_path: {
            node_ids: [
              "person_nguyen_phuoc_thanh",
              "company_rizlum",
              "skill_graphrag",
              "tech_neo4j",
            ],
            link_ids: ["edge_r03", "edge_r05", "edge_r10"],
          },
        },
        "projects did this candidate work on at fpt software": {
          answer:
            "At FPT Software, the candidate worked on complex computer vision and deep learning projects. These included building facial recognition verification models for security check-ins and developing deep learning action recognition models for retail space behavior analysis, utilizing PyTorch and Docker for containerized deployment.",
          citations: [
            {
              source_id: "src_resume_pdf",
              title: "Resume.pdf",
              chunk_id: "chunk_res_003",
              text: "FPT Software - AI Division. Developed facial recognition algorithms and multi-object action tracking. Implemented on PyTorch & Docker.",
              score: 0.93,
            },
          ],
          retrieval_steps: [
            "Detected context query: projects worked at FPT Software",
            "Retrieved company experience blocks for 'FPT Software'",
            "Traversed Neo4j path: Nguyen Phuoc Thanh -> WORKED_AT -> FPT Software",
            "Generated grounded projects list",
          ],
          graph_path: {
            node_ids: ["person_nguyen_phuoc_thanh", "company_fpt_software"],
            link_ids: ["edge_r02"],
          },
        },
        "technologies are connected to rizlum": {
          answer:
            "Rizlum is connected to GraphRAG, Neo4j, Qdrant, FastAPI, PyTorch, MongoDB, and OCR. These technologies were integrated into the production-grade Insurance Automation platform which parses and indexes policy manuals.",
          citations: [
            {
              source_id: "src_resume_pdf",
              title: "Resume.pdf",
              chunk_id: "chunk_res_004",
              text: "Rizlum platform tech stack: FastAPI, Qdrant vector index, Neo4j graph storage, PyTorch, MinerU layout analysis, MongoDB.",
              score: 0.94,
            },
          ],
          retrieval_steps: [
            "Detected entity focus: Rizlum technology stack",
            "Retrieved neighbors of node 'Rizlum'",
            "Traversed Neo4j path: Rizlum -> HAS_PROJECT -> Insurance Automation -> USES_TECH -> GraphRAG -> USES_TECH -> Neo4j",
            "Generated structured technology connections answer",
          ],
          graph_path: {
            node_ids: ["company_rizlum", "skill_graphrag", "tech_neo4j"],
            link_ids: ["edge_r03", "edge_r05"],
          },
        },
        "suitable for an ai engineer role": {
          answer:
            "Yes, the candidate is exceptionally well-suited for an AI Engineer role focused on LLM and RAG systems. He possesses actual production-grade experience designing and maintaining hybrid vector-graph architectures, orchestrating graph traversals (Neo4j) alongside semantic vector lookups (Qdrant), and implementing layout-aware parsers (MinerU). Their active skill set in LightRAG and LangChain provides high value for enterprise LLM application development.",
          citations: [
            {
              source_id: "src_resume_pdf",
              title: "Resume.pdf",
              chunk_id: "chunk_res_001",
              text: "Summary: Senior AI & GraphRAG Engineer. Expert in production RAG systems with LangChain, LightRAG, Qdrant and Neo4j graph schemas.",
              score: 0.97,
            },
          ],
          retrieval_steps: [
            "Analyzed role requirements vs candidate profile data",
            "Retrieved GraphRAG and LLM skill levels",
            "Traversed path: Nguyen Phuoc Thanh -> HAS_ROLE -> AI Engineer -> HAS_SKILL -> GraphRAG -> USES_TECH -> Neo4j",
            "Synthesized high-fidelity positive evaluation",
          ],
          graph_path: {
            node_ids: [
              "person_nguyen_phuoc_thanh",
              "role_ai_engineer",
              "skill_graphrag",
              "tech_neo4j",
            ],
            link_ids: ["edge_r01", "edge_r04", "edge_r05"],
          },
        },
      };

      const matchedKey = Object.keys(resumeQA).find((q) =>
        msgLower.includes(q),
      );
      if (matchedKey) {
        presetResponse = resumeQA[matchedKey];
      } else {
        presetResponse = {
          answer: `Nguyen Phuoc Thanh is an AI Engineer who possesses solid production experience in building hybrid vector-graph databases and RAG pipelines (using Neo4j, Qdrant, LangChain, and LightRAG). Feel free to ask more specific questions about his FPT Software projects, Rizlum systems, or overall suitability!`,
          citations: [
            {
              source_id: "src_resume_pdf",
              title: "Resume.pdf",
              chunk_id: "chunk_res_fallback",
              text: "Expert AI Engineer. Built highly optimized GraphRAG indexing & layout-aware MinerU parsers.",
              score: 0.95,
            },
          ],
          retrieval_steps: [
            "Queried local sandbox database",
            "Retrieved overall candidate summary",
            "Generated responsive fallback answer",
          ],
          graph_path: {
            node_ids: [
              "person_nguyen_phuoc_thanh",
              "role_ai_engineer",
              "skill_graphrag",
            ],
            link_ids: ["edge_r01", "edge_r04"],
          },
        };
      }
    } else {
      // Insurance fallback
      const matchedKey = Object.keys(PRESET_QA).find(
        (q) => msgLower.includes(q) || q.includes(msgLower),
      );
      if (matchedKey) {
        presetResponse = PRESET_QA[matchedKey];
      } else {
        presetResponse = {
          answer: `You asked: "${message}". Currently, I am running in fallback sandbox mode because the backend server is unreachable. Please create a notebook named "Resume Analysis", load the "example/Resume.pdf" source, and ask resume-specific questions to witness candidate profile mapping!`,
          citations: [
            {
              source_id: "src_001",
              title: "Insurance Policy Demo",
              chunk_id: "chunk_ins_fallback",
              text: "Insurance terms and general policies.",
              score: 0.5,
            },
          ],
          retrieval_steps: [
            "Backend unreachable fallback activated",
            "Encouraged creating a notebook to demo the progressive resume indexer",
          ],
          graph_path: { node_ids: [], link_ids: [] },
        };
      }
    }

    if (onChunk) {
      if (onMetadata) {
        onMetadata({
          citations: presetResponse.citations,
          retrieval_steps: presetResponse.retrieval_steps,
          graph_path: presetResponse.graph_path,
          nodes_metadata: [],
          links_metadata: [],
          suggested_questions: presetResponse.suggested_questions || [],
        });
      }
      const words = presetResponse.answer.split(" ");
      let currentIdx = 0;
      return new Promise<ChatResponse>((resolve) => {
        const interval = setInterval(() => {
          if (currentIdx >= words.length) {
            clearInterval(interval);
            resolve(presetResponse);
            return;
          }
          const space = currentIdx > 0 ? " " : "";
          onChunk(space + words[currentIdx]);
          currentIdx++;
        }, 30);
      });
    } else {
      return presetResponse;
    }
  }
}

export async function deleteSource(
  notebookId: string,
  sourceId: string,
): Promise<void> {
  try {
    const res = await fetch(
      `${BASE_URL}/notebooks/${notebookId}/sources/${sourceId}`,
      {
        method: "DELETE",
      },
    );
    if (res.ok) return;
    throw new Error();
  } catch (e) {
    // Sandbox fallback
    if (localSources[notebookId]) {
      localSources[notebookId] = localSources[notebookId].filter(
        (src) => src.id !== sourceId,
      );
    }
    // Update source count in local notebooks
    const nb = localNotebooks.find((n) => n.id === notebookId);
    if (nb) {
      nb.source_count = localSources[notebookId]
        ? localSources[notebookId].length
        : 0;
    }
  }
}

export async function deleteNotebook(notebookId: string): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/notebooks/${notebookId}`, {
      method: "DELETE",
    });
    if (res.ok) return;
    throw new Error();
  } catch (e) {
    // Sandbox fallback
    localNotebooks = localNotebooks.filter((nb) => nb.id !== notebookId);
    if (localSources[notebookId]) {
      delete localSources[notebookId];
    }
  }
}
