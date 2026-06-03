import {
  SourceListItem,
  ChatResponse,
  GraphResponse,
  NodeDetailsResponse
} from './types';
import {
  MOCK_SOURCES,
  MOCK_NODES,
  MOCK_LINKS,
  PRESET_QA
} from './mock-data';

const BASE_URL = 'http://localhost:8000/api';

// Simple in-memory storage for sources added during this session
let sessionSources: SourceListItem[] = [...MOCK_SOURCES];

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      return data.status === 'ok';
    }
    return false;
  } catch (e) {
    return false;
  }
}

export async function listSources(): Promise<SourceListItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/sources`);
    if (res.ok) {
      const data = await res.json();
      // If backend returns empty, we still merge or use mock for excellent demo
      if (data && data.length > 0) {
        return data;
      }
    }
    return sessionSources;
  } catch (e) {
    console.warn("Backend down. Falling back to local sources list.");
    return sessionSources;
  }
}

export async function addSource(type: 'url' | 'text', value: string): Promise<SourceListItem> {
  try {
    const res = await fetch(`${BASE_URL}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'demo', type, value })
    });
    if (res.ok) {
      const data = await res.json();
      return {
        id: data.source_id,
        name: data.name,
        type: data.type,
        status: data.status,
        entity_count: 0,
        chunk_count: 0
      };
    }
    throw new Error("Add source API failed");
  } catch (e) {
    console.warn("Backend down. Emulating source addition locally.");
    const trackId = Math.random().toString(36).substring(2, 8);
    const newSource: SourceListItem = {
      id: `src_${trackId}`,
      name: type === 'url' ? value : `Note-${trackId}`,
      type: type === 'url' ? 'url' : 'text',
      status: 'ready',
      entity_count: type === 'url' ? 3 : 2,
      chunk_count: type === 'url' ? 5 : 2
    };
    sessionSources = [newSource, ...sessionSources];
    return newSource;
  }
}

export async function uploadFile(file: File): Promise<SourceListItem> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/sources/upload`, {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      return {
        id: data.source_id,
        name: data.name,
        type: 'pdf',
        status: data.status,
        entity_count: 0,
        chunk_count: 0
      };
    }
    throw new Error("File upload API failed");
  } catch (e) {
    console.warn("Backend down. Emulating file upload locally.");
    const trackId = Math.random().toString(36).substring(2, 8);
    const newSource: SourceListItem = {
      id: `src_${trackId}`,
      name: file.name,
      type: 'pdf',
      status: 'ready',
      entity_count: 5,
      chunk_count: 12
    };
    sessionSources = [newSource, ...sessionSources];
    return newSource;
  }
}

export async function askChat(message: string): Promise<ChatResponse> {
  try {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: 'demo', message })
    });
    if (res.ok) {
      return await res.json();
    }
    throw new Error("Chat API failed");
  } catch (e) {
    console.warn("Backend down or error occurred. Emulating response with Insurance Preset QA.");

    const msgLower = message.trim().toLowerCase();

    // Find matching preset question
    let matchedKey = Object.keys(PRESET_QA).find(q => {
      if (msgLower.includes(q) || q.includes(msgLower)) return true;

      const qWords = q.split(/\s+/);
      const mWords = msgLower.split(/\s+/);
      const intersect = qWords.filter(w => mWords.includes(w));
      const union = new Set([...qWords, ...mWords]);
      return intersect.length / union.size > 0.3;
    });

    if (matchedKey) {
      return PRESET_QA[matchedKey];
    }

    // Default fallback answer for generic query
    return {
      answer: `I received your question: "${message}". Currently, I am running in fallback mode because the backend server is unreachable. Please click one of the 5 preset badges at the bottom to experience high-fidelity 3D knowledge graph traversal, citation cards, and retrieval steps tracing for our Insurance Domain!`,
      citations: [
        {
          source_id: "src_002",
          title: "https://example.com/insurance-terms",
          chunk_id: "chunk_999",
          text: "Disclaimer: This is a placeholder citation shown when the backend is down and a non-preset query is made.",
          score: 0.5
        }
      ],
      retrieval_steps: [
        "Identified backend status: UNREACHABLE",
        "Interpreted user input in frontend sandbox",
        "Recommended clicking on a preset question for interactive demo"
      ],
      graph_path: {
        node_ids: [],
        link_ids: []
      }
    };
  }
}

export async function getGraph(): Promise<GraphResponse> {
  try {
    const res = await fetch(`${BASE_URL}/graph?workspace_id=demo`);
    if (res.ok) {
      return await res.json();
    }
    throw new Error("Graph API failed");
  } catch (e) {
    console.warn("Backend down. Returning Insurance Demo Mock Graph.");
    return {
      nodes: [...MOCK_NODES],
      links: [...MOCK_LINKS]
    };
  }
}

export async function getNodeDetails(nodeId: string): Promise<NodeDetailsResponse> {
  try {
    const res = await fetch(`${BASE_URL}/graph/node/${nodeId}`);
    if (res.ok) {
      return await res.json();
    }
    throw new Error("Node details API failed");
  } catch (e) {
    console.warn("Backend down. Querying locally for node details.");
    const node = MOCK_NODES.find(n => n.id === nodeId);
    if (node) {
      return {
        id: node.id,
        label: node.label,
        type: node.type,
        properties: node.properties || {}
      };
    }
    return {
      id: nodeId,
      label: "Unknown Node",
      type: "Concept",
      properties: { description: "Node properties unavailable" }
    };
  }
}
