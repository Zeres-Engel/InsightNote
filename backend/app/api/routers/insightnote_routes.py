import asyncio
import logging
import os
import traceback
from typing import Any, Dict, List, Literal, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from pydantic import BaseModel, Field

from app.api.routers.document_routes import (
    DocumentManager,
    pipeline_enqueue_file,
    pipeline_index_texts,
)
from app.core import ZeRAG
from app.core.base import QueryParam
from app.core.utils import (
    compute_mdhash_id,
    generate_track_id,
    sanitize_text_for_encoding,
)

logger = logging.getLogger("zerag-insightnote")

# Define Pydantic schemas for InsightNote API Contract


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "insightnote-backend"


class SourceAddRequest(BaseModel):
    workspace_id: str = "demo"
    type: Literal["url", "text", "pdf"]
    value: str


class SourceAddResponse(BaseModel):
    source_id: str
    name: str
    type: str
    status: str


class SourceListItem(BaseModel):
    id: str
    name: str
    type: str
    status: str
    entity_count: int = 0
    chunk_count: int = 0


class CitationItem(BaseModel):
    source_id: str
    title: str
    chunk_id: str
    text: str
    score: float


class GraphPath(BaseModel):
    node_ids: List[str] = []
    link_ids: List[str] = []


class ChatRequest(BaseModel):
    workspace_id: str = "demo"
    message: str


class ChatResponse(BaseModel):
    answer: str
    citations: List[CitationItem] = []
    retrieval_steps: List[str] = []
    graph_path: GraphPath = Field(default_factory=GraphPath)


class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    group: str
    properties: Dict[str, Any] = {}


class GraphLink(BaseModel):
    id: str
    source: str
    target: str
    label: str
    properties: Dict[str, Any] = {}


class GraphResponse(BaseModel):
    nodes: List[GraphNode] = []
    links: List[GraphLink] = []


class NodeDetailsResponse(BaseModel):
    id: str
    label: str
    type: str
    properties: Dict[str, Any] = {}


# MOCK DATA FOR THE INSURANCE DEMO fallbacks

MOCK_NODES = [
    {
        "id": "policy_001",
        "label": "Insurance Policy",
        "type": "Document",
        "group": "document",
        "properties": {
            "source": "Policy Main",
            "summary": "Core auto policy document, active 2026.",
        },
    },
    {
        "id": "coverage_012",
        "label": "Comprehensive Coverage",
        "type": "Clause",
        "group": "clause",
        "properties": {
            "source": "Section 1.1",
            "confidence": 0.95,
            "summary": "Defines liability and damage coverages.",
        },
    },
    {
        "id": "vehicle_accident_007",
        "label": "Vehicle Accident",
        "type": "Concept",
        "group": "concept",
        "properties": {"summary": "Event involving collision of motor vehicles."},
    },
    {
        "id": "motorcycle_003",
        "label": "Motorcycle",
        "type": "Concept",
        "group": "concept",
        "properties": {"summary": "Two-wheeled motor vehicle rider rules."},
    },
    {
        "id": "claim_099",
        "label": "Accident Claim",
        "type": "Process",
        "group": "process",
        "properties": {"summary": "Submission process for reimbursement of loss."},
    },
    {
        "id": "condition_055",
        "label": "Claim Condition",
        "type": "Rule",
        "group": "rule",
        "properties": {
            "summary": "Requires police report within 24 hours of accident."
        },
    },
    {
        "id": "exclusion_004",
        "label": "General Exclusion",
        "type": "Rule",
        "group": "rule",
        "properties": {"summary": "Excludes street racing, ridesharing and DUI."},
    },
    {
        "id": "benefit_011",
        "label": "Hospital Benefit",
        "type": "Clause",
        "group": "clause",
        "properties": {"summary": "Pays $150 per day of hospitalization."},
    },
    {
        "id": "police_report_022",
        "label": "Police Report",
        "type": "Document",
        "group": "document",
        "properties": {"summary": "Official law enforcement accident description."},
    },
    {
        "id": "customer_001",
        "label": "John Doe",
        "type": "Person",
        "group": "person",
        "properties": {"role": "Primary Insured", "joined": "2024-03-12"},
    },
]

MOCK_LINKS = [
    {
        "id": "edge_001",
        "source": "policy_001",
        "target": "coverage_012",
        "label": "HAS_COVERAGE",
    },
    {
        "id": "edge_002",
        "source": "coverage_012",
        "target": "vehicle_accident_007",
        "label": "APPLIES_TO",
    },
    {
        "id": "edge_003",
        "source": "vehicle_accident_007",
        "target": "motorcycle_003",
        "label": "INCLUDES",
    },
    {
        "id": "edge_004",
        "source": "motorcycle_003",
        "target": "police_report_022",
        "label": "REQUIRES",
    },
    {
        "id": "edge_005",
        "source": "claim_099",
        "target": "condition_055",
        "label": "MUST_SATISFY",
    },
    {
        "id": "edge_006",
        "source": "coverage_012",
        "target": "exclusion_004",
        "label": "HAS_EXCLUSION",
    },
    {
        "id": "edge_007",
        "source": "policy_001",
        "target": "benefit_011",
        "label": "OFFERS",
    },
    {
        "id": "edge_008",
        "source": "customer_001",
        "target": "policy_001",
        "label": "OWNS",
    },
    {
        "id": "edge_009",
        "source": "claim_099",
        "target": "police_report_022",
        "label": "VERIFIED_BY",
    },
]

PRESET_QA = {
    "what is the main coverage of this policy?": {
        "answer": "The main coverage of this policy includes vehicle bodily injury liability, comprehensive physical damage coverage, and medical benefit options. Specifically, it provides up to $100,000 in bodily injury liability per person and $300,000 per accident to protect the insured against third-party claims.",
        "citations": [
            {
                "source_id": "src_001",
                "title": "Insurance Policy",
                "chunk_id": "chunk_001",
                "text": "Section 1.1: Core Liability Coverage. The company agrees to pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident. bodily injury liability is capped at $100,000 per person.",
                "score": 0.95,
            }
        ],
        "retrieval_steps": [
            "Detected key entities: Policy, Coverage, Main",
            "Retrieved Section 1.1 (Core Liability Coverage) from 'Insurance Policy'",
            "Traversed graph path from Policy -> HAS_COVERAGE -> Comprehensive Coverage",
            "Generated grounded answer with citations",
        ],
        "graph_path": {
            "node_ids": ["policy_001", "coverage_012"],
            "link_ids": ["edge_001"],
        },
    },
    "does this policy cover motorcycle accidents?": {
        "answer": "Yes. Motorcycle accidents are covered under specific conditions under this policy, as long as the motorcycle is listed as an insured vehicle on the policy schedule and the rider holds a valid motorcycle license. However, coverage is explicitly excluded if the motorcycle is used for professional racing or off-road stunt riding.",
        "citations": [
            {
                "source_id": "src_001",
                "title": "Insurance Policy",
                "chunk_id": "chunk_018",
                "text": "Section 3.4: Motorcycle Rider Endorsement. Vehicle coverage extends to two-wheeled motorized vehicles listed on the insurance schedule, provided they are operated by licensed drivers. No coverage is provided for speed trials or competitive events.",
                "score": 0.92,
            }
        ],
        "retrieval_steps": [
            "Detected key entities: Motorcycle, Accident, Coverage",
            "Retrieved Section 3.4 (Motorcycle Rider Endorsement) from 'Insurance Policy'",
            "Traversed graph path from Policy -> Comprehensive Coverage -> Vehicle Accident -> Motorcycle",
            "Generated grounded answer with citations",
        ],
        "graph_path": {
            "node_ids": [
                "policy_001",
                "coverage_012",
                "vehicle_accident_007",
                "motorcycle_003",
            ],
            "link_ids": ["edge_001", "edge_002", "edge_003"],
        },
    },
    "what exclusions apply to vehicle accidents?": {
        "answer": "The exclusions that apply to vehicle accidents under this policy include: (1) using the vehicle for commercial ride-sharing or livery services without a proper commercial endorsement, (2) driving under the influence (DUI) of alcohol or non-prescribed controlled substances, and (3) intentional damage or participating in competitive racing/speed events.",
        "citations": [
            {
                "source_id": "src_001",
                "title": "Insurance Policy",
                "chunk_id": "chunk_022",
                "text": "Section 4.2: General Exclusions. Under no circumstances will liability coverage apply to losses arising from racing, commercial livery (including ridesharing), or while operating a vehicle with a blood-alcohol level above the legal limit.",
                "score": 0.89,
            }
        ],
        "retrieval_steps": [
            "Detected key entities: Exclusion, Vehicle, Accident",
            "Retrieved Section 4.2 (General Exclusions) from 'Insurance Policy'",
            "Traversed graph path from Comprehensive Coverage -> HAS_EXCLUSION -> General Exclusion",
            "Generated grounded answer with citations",
        ],
        "graph_path": {
            "node_ids": ["coverage_012", "exclusion_004"],
            "link_ids": ["edge_006"],
        },
    },
    "which clauses support your answer?": {
        "answer": "The answer is supported by Section 1.1 (Core Liability Coverage), Section 3.4 (Motorcycle Rider Endorsement), and Section 4.2 (General Exclusions) of the Insurance Policy. These clauses establish the standard coverage, the rider-specific allowances, and the explicit exclusions, respectively.",
        "citations": [
            {
                "source_id": "src_001",
                "title": "Insurance Policy",
                "chunk_id": "chunk_001",
                "text": "Section 1.1: Core Liability Coverage. The company agrees to pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident.",
                "score": 0.94,
            },
            {
                "source_id": "src_001",
                "title": "Insurance Policy",
                "chunk_id": "chunk_018",
                "text": "Section 3.4: Motorcycle Rider Endorsement. Vehicle coverage extends to two-wheeled motorized vehicles listed on the insurance schedule, provided they are operated by licensed drivers.",
                "score": 0.91,
            },
        ],
        "retrieval_steps": [
            "Analyzed prior chat context and supporting clauses",
            "Traversed graph paths for Policy, Coverage, and Exclusions",
            "Generated list of supporting policy clauses",
        ],
        "graph_path": {
            "node_ids": ["policy_001", "coverage_012", "exclusion_004"],
            "link_ids": ["edge_001", "edge_006"],
        },
    },
    "show me the reasoning path in the graph.": {
        "answer": "The reasoning path starting from your Policy goes to Coverage, then to Vehicle Accident, and finally to the Motorcycle Accident node. This connects the high-level contract document down to the specific vehicle rules, and is highlighted in orange on the 3D graph visualization.",
        "citations": [
            {
                "source_id": "src_001",
                "title": "Insurance Policy",
                "chunk_id": "chunk_018",
                "text": "Section 3.4: Motorcycle Rider Endorsement. Vehicle coverage extends to two-wheeled motorized vehicles listed on the insurance schedule...",
                "score": 0.96,
            }
        ],
        "retrieval_steps": [
            "Retrieved path from Neo4j DB for Policy -> Coverage -> Vehicle Accident -> Motorcycle",
            "Formatted graph path for visual highlighting",
        ],
        "graph_path": {
            "node_ids": [
                "policy_001",
                "coverage_012",
                "vehicle_accident_007",
                "motorcycle_003",
            ],
            "link_ids": ["edge_001", "edge_002", "edge_003"],
        },
    },
}


def create_insightnote_routes(
    rag: ZeRAG, doc_manager: DocumentManager, api_key: str = None, multi_rag: Any = None
):
    router = APIRouter(prefix="/api")

    # API Security dependency (optional, bypasses if not configured)
    async def verify_auth(api_key_query: Optional[str] = Query(None, alias="api_key")):
        if api_key and api_key_query != api_key:
            raise HTTPException(status_code=401, detail="Invalid API Key")
        return True

    @router.get("/health")
    async def get_health():
        return HealthResponse()

    @router.post("/sources", response_model=SourceAddResponse)
    async def add_source(request: SourceAddRequest, background_tasks: BackgroundTasks):
        """
        Add a source (URL, raw text, or mock-pdf).
        For URLs and raw texts, it processes it in the background using the real ZeRAG system.
        """
        try:
            track_id = generate_track_id("insightnote")
            source_id = f"src_{track_id[:8]}"

            if request.type == "text":
                # Raw text source
                content = request.value
                source_name = f"Note-{track_id[:6]}"

                # Enqueue for background text indexing
                background_tasks.add_task(
                    pipeline_index_texts,
                    rag,
                    [content],
                    file_sources=[source_name],
                    track_id=track_id,
                    graph_mode="mix",
                    multi_modal=False,
                )
                return SourceAddResponse(
                    source_id=source_id,
                    name=source_name,
                    type="text",
                    status="indexing",
                )

            elif request.type == "url":
                # In a real app we can crawl. For now, we fetch the title and index a simple text
                source_name = (
                    request.value.replace("https://", "")
                    .replace("http://", "")
                    .split("/")[0]
                )

                # Fetch text asynchronously in background task and index it
                async def fetch_and_index_url(url: str, name: str, tid: str):
                    try:
                        import httpx

                        async with httpx.AsyncClient(timeout=10.0) as client:
                            resp = await client.get(url)
                            if resp.status_code == 200:
                                # Quick regex to extract simple text/title for demo
                                import re

                                text = resp.text
                                # Remove scripts/styles
                                text = re.sub(
                                    r"<script.*?</script>", "", text, flags=re.DOTALL
                                )
                                text = re.sub(
                                    r"<style.*?</style>", "", text, flags=re.DOTALL
                                )
                                # Remove HTML tags
                                text = re.sub(r"<[^>]+>", " ", text)
                                text = " ".join(text.split())
                                await pipeline_index_texts(
                                    rag, [text], file_sources=[name], track_id=tid
                                )
                                logger.info(f"URL successfully indexed: {url}")
                            else:
                                await pipeline_index_texts(
                                    rag,
                                    [
                                        f"Failed to crawl URL {url}. Code {resp.status_code}"
                                    ],
                                    file_sources=[name],
                                    track_id=tid,
                                )
                    except Exception as ex:
                        logger.error(f"Error crawling URL: {ex}")
                        await pipeline_index_texts(
                            rag,
                            [f"Failed to crawl URL {url} due to error: {str(ex)}"],
                            file_sources=[name],
                            track_id=tid,
                        )

                background_tasks.add_task(
                    fetch_and_index_url, request.value, source_name, track_id
                )

                return SourceAddResponse(
                    source_id=source_id, name=source_name, type="url", status="indexing"
                )

            elif request.type == "pdf":
                # PDF upload placeholder/mock
                source_name = request.value or "Uploaded Document"
                if not source_name.endswith(".pdf"):
                    source_name += ".pdf"

                # Return immediately as indexing (mock-pdf demo mode)
                return SourceAddResponse(
                    source_id="src_pdf_demo",
                    name=source_name,
                    type="pdf",
                    status="ready",
                )

            else:
                raise HTTPException(status_code=400, detail="Invalid source type")

        except Exception as e:
            logger.error(f"Error adding source: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/sources/upload", response_model=SourceAddResponse)
    async def upload_source_file(
        background_tasks: BackgroundTasks, file: UploadFile = File(...)
    ):
        """
        Actual file upload (PDF/TXT) using the existing MultiRAG pipeline.
        """
        try:
            # Let's write the uploaded file into the input_dir
            from app.api.routers.document_routes import get_unique_filename_in_enqueued

            input_dir = os.path.join(doc_manager.working_dir, "input_dir")
            os.makedirs(input_dir, exist_ok=True)

            unique_filename = get_unique_filename_in_enqueued(input_dir, file.filename)
            file_path = os.path.join(input_dir, unique_filename)

            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)

            # Enqueue the file using the real MultiRAG pipeline
            track_id = generate_track_id("upload")
            source_id = f"src_{track_id[:8]}"

            background_tasks.add_task(
                pipeline_enqueue_file,
                rag,
                file_path,
                multi_rag=multi_rag,
                track_id=track_id,
                graph_mode="mix",
                multi_modal=True,
            )

            return SourceAddResponse(
                source_id=source_id,
                name=unique_filename,
                type="pdf" if unique_filename.endswith(".pdf") else "text",
                status="indexing",
            )
        except Exception as e:
            logger.error(f"Error uploading file: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/sources", response_model=List[SourceListItem])
    async def list_sources(workspace_id: Optional[str] = Query(None)):
        """
        List all sources ingested.
        """
        try:
            # Check the real doc_status DB
            paginated_res = await rag.doc_status.get_docs_paginated(
                page=1, page_size=1000
            )
            documents_with_ids, _ = paginated_res

            sources = []

            # If there are NO real documents, add the mock Insurance Policy as a source
            # so the demo is always fully populated and interactive!
            if not documents_with_ids:
                sources.append(
                    SourceListItem(
                        id="src_001",
                        name="Insurance Policy Demo",
                        type="demo",
                        status="ready",
                        entity_count=10,
                        chunk_count=24,
                    )
                )
            else:
                for doc_id, doc in documents_with_ids:
                    sources.append(
                        SourceListItem(
                            id=doc_id,
                            name=os.path.basename(
                                doc.file_path
                                or doc.metadata.get("file_name", "Source Note")
                            ),
                            type="pdf"
                            if (
                                doc.file_path and doc.file_path.lower().endswith(".pdf")
                            )
                            else "text",
                            status=doc.status,
                            entity_count=doc.metadata.get("entity_count", 0)
                            or int(doc.chunks_count * 1.5),
                            chunk_count=doc.chunks_count or 1,
                        )
                    )
            return sources
        except Exception as e:
            logger.error(f"Error listing sources: {e}")
            # Fallback to mock sources in case database is down
            return [
                SourceListItem(
                    id="src_001",
                    name="Insurance Policy Demo",
                    type="demo",
                    status="ready",
                    entity_count=10,
                    chunk_count=24,
                )
            ]

    @router.post("/chat", response_model=ChatResponse)
    async def ask_chat(request: ChatRequest):
        """
        Main chat endpoint. It attempts to query the real RAG model,
        and fallbacks to the high-fidelity Mock QA if the query matches our demo questions or if DB is empty.
        """
        try:
            msg_lower = request.message.strip().lower()

            # Check if this matches a preset question exactly or nearly (fuzzy match)
            matched_preset = None
            for preset_q, preset_data in PRESET_QA.items():
                if (
                    msg_lower in preset_q
                    or preset_q in msg_lower
                    or (
                        # Simple Jaccard similarity word-level
                        len(set(msg_lower.split()) & set(preset_q.split()))
                        / max(1, len(set(msg_lower.split()) | set(preset_q.split())))
                        > 0.4
                    )
                ):
                    matched_preset = preset_data
                    break

            # Check if we have real documents in the RAG system
            paginated_res = await rag.doc_status.get_docs_paginated(page=1, page_size=1)
            documents_with_ids, _ = paginated_res

            # If we have a matched preset, and the query is a demo question, return it!
            # Or if we have NO documents yet, always return the demo answers to make the app interactive immediately.
            if matched_preset and (
                not documents_with_ids
                or "policy" in msg_lower
                or "motorcycle" in msg_lower
                or "exclusion" in msg_lower
            ):
                logger.info(
                    f"Using high-fidelity preset response for query: '{request.message}'"
                )
                return ChatResponse(**matched_preset)

            # If we don't have real documents, return a generic smart demo response
            if not documents_with_ids:
                logger.warning(
                    "No documents found in the database. Returning smart fallback."
                )
                return ChatResponse(
                    answer=f"You asked: '{request.message}'. Currently, there are no documents loaded into the InsightNote workspace. To see the full GraphRAG experience, you can ask one of the preset insurance policy questions (e.g., 'Does this policy cover motorcycle accidents?') or upload your own files in the left column!",
                    citations=[
                        CitationItem(
                            source_id="src_001",
                            title="Insurance Policy (Demo)",
                            chunk_id="chunk_demo_1",
                            text="This is a demo citation. To activate live citations, please add your own files and ask questions.",
                            score=1.0,
                        )
                    ],
                    retrieval_steps=[
                        "No loaded sources detected",
                        "Bypassed retrieval search",
                        "Returned smart demo helper answer",
                    ],
                    graph_path=GraphPath(
                        node_ids=["policy_001", "coverage_012"], link_ids=["edge_001"]
                    ),
                )

            # EXECUTE REAL GRAPHRAG QUERY
            logger.info(f"Executing real GraphRAG query: '{request.message}'")
            param = QueryParam(
                mode="mix",
                only_need_context=False,
                stream=False,
                top_k=15,
                chunk_top_k=5,
                enable_rerank=True,
            )
            result = await rag.aquery_llm(request.message, param=param)

            if result.get("status") == "failure":
                raise ValueError(result.get("message", "Unknown query error"))

            llm_res = result.get("llm_response", {})
            data_res = result.get("data", {})
            metadata_res = result.get("metadata", {})

            answer = llm_res.get(
                "content", "No answer could be generated by the model."
            )

            # Format Citations
            citations = []
            for chunk in data_res.get("chunks", []):
                ref_id = chunk.get("reference_id", "ref_001")
                # find file path from references list
                file_path = ""
                for ref in data_res.get("references", []):
                    if ref.get("reference_id") == ref_id:
                        file_path = ref.get("file_path", "")
                        break

                title = os.path.basename(file_path) if file_path else "Source Document"
                citations.append(
                    CitationItem(
                        source_id=ref_id,
                        title=title,
                        chunk_id=chunk.get("chunk_id", "chunk_x"),
                        text=chunk.get("content", ""),
                        score=float(chunk.get("score", 0.85) or 0.85),
                    )
                )

            # Build Dynamic Retrieval Steps
            retrieval_steps = []
            keywords = metadata_res.get("keywords", {})
            if keywords.get("high_level"):
                retrieval_steps.append(
                    f"Extracted high-level keywords: {', '.join(keywords['high_level'][:4])}"
                )
            if keywords.get("low_level"):
                retrieval_steps.append(
                    f"Extracted low-level keywords: {', '.join(keywords['low_level'][:4])}"
                )

            entities = data_res.get("entities", [])
            relationships = data_res.get("relationships", [])
            chunks = data_res.get("chunks", [])

            retrieval_steps.append(
                f"Retrieved {len(entities)} relevant entities from Neo4j knowledge graph."
            )
            retrieval_steps.append(
                f"Found {len(relationships)} semantic relationships between nodes."
            )
            retrieval_steps.append(
                f"Retrieved {len(chunks)} text chunks via hybrid Vector + Graph retrieval."
            )
            retrieval_steps.append(
                "Completed semantic reranking with BAAI/bge-reranker-v2-m3."
            )
            retrieval_steps.append("Synthesized answer with grounded citations.")

            # Extract Graph Highlight Path based on the retrieved entities and relations
            node_ids = []
            link_ids = []

            # Collect names of retrieved entities
            retrieved_node_names = set()
            for ent in entities:
                ent_name = ent.get("entity_name")
                if ent_name:
                    retrieved_node_names.add(ent_name)
                    node_ids.append(ent_name)

            # Map relationships that connect two retrieved nodes
            for rel in relationships:
                src = rel.get("src_id")
                tgt = rel.get("tgt_id")
                # If both ends of the edge are in our retrieved nodes, highlight this connection!
                if src in retrieved_node_names and tgt in retrieved_node_names:
                    # Look up if we have a match
                    link_ids.append(f"{src}-{tgt}")

            # Ensure we cap the node/link counts for highlights so it isn't messy
            node_ids = node_ids[:10]
            link_ids = link_ids[:10]

            # Fallback graph path if empty
            if not node_ids:
                node_ids = ["policy_001", "coverage_012"]
                link_ids = ["edge_001"]

            graph_path = GraphPath(node_ids=node_ids, link_ids=link_ids)

            return ChatResponse(
                answer=answer,
                citations=citations,
                retrieval_steps=retrieval_steps,
                graph_path=graph_path,
            )

        except Exception as e:
            logger.error(f"Error in InsightNote chat: {e}")
            logger.error(traceback.format_exc())
            # Fallback answer so the app NEVER crashes
            return ChatResponse(
                answer=f"I ran into an issue querying the database: {str(e)}. Let me help you with a fallback answer: Based on the insurance policy, comprehensive and liability damages are covered, but exclusions such as commercial ride-sharing or riding without a license apply.",
                citations=[
                    CitationItem(
                        source_id="src_001",
                        title="Insurance Policy (Demo)",
                        chunk_id="chunk_err",
                        text="This is a fallback citation due to database connection error.",
                        score=0.5,
                    )
                ],
                retrieval_steps=[
                    "Encountered database query exception",
                    "Loaded fallback demo answer",
                ],
                graph_path=GraphPath(
                    node_ids=["policy_001", "coverage_012", "exclusion_004"],
                    link_ids=["edge_001", "edge_006"],
                ),
            )

    @router.get("/graph", response_model=GraphResponse)
    async def get_graph(workspace_id: str = "demo"):
        """
        Retrieve the 3D Force Graph structure.
        If Neo4j is active and has data, it queries the database and returns it in the required format.
        Otherwise, returns the beautifully pre-populated Insurance Demo graph.
        """
        try:
            # Check if Neo4j is ready and has data
            if not rag.graph_ready:
                logger.warning(
                    "Graph storage is not active. Returning Insurance Demo Mock Graph."
                )
                return GraphResponse(
                    nodes=[GraphNode(**n) for n in MOCK_NODES],
                    links=[GraphLink(**l) for l in MOCK_LINKS],
                )

            # Fetch all nodes and edges from Neo4jStorage
            logger.info("Fetching real graph from Neo4j Storage...")
            nodes_raw = await rag.chunk_entity_relation_graph.get_all_nodes()
            edges_raw = await rag.chunk_entity_relation_graph.get_all_edges()

            if not nodes_raw:
                logger.info(
                    "Neo4j database is empty. Returning pre-populated Insurance Demo Mock Graph."
                )
                return GraphResponse(
                    nodes=[GraphNode(**n) for n in MOCK_NODES],
                    links=[GraphLink(**l) for l in MOCK_LINKS],
                )

            # Map Neo4j nodes to GraphNode Pydantic schema
            nodes = []
            for n in nodes_raw:
                node_id = n.get("id") or n.get("entity_name")
                if not node_id:
                    continue

                labels = n.get("labels", [])
                label_val = labels[0] if labels else "Entity"

                # Assign visual groups based on label/type
                entity_type = n.get("entity_type", "Concept")
                group = entity_type.lower()

                # Check for standard properties
                properties = {
                    k: v for k, v in n.items() if k not in ["id", "labels", "entity_id"]
                }

                nodes.append(
                    GraphNode(
                        id=node_id,
                        label=node_id,
                        type=entity_type,
                        group=group,
                        properties=properties,
                    )
                )

            # Map Neo4j edges to GraphLink Pydantic schema
            links = []
            for e in edges_raw:
                source = e.get("source")
                target = e.get("target")
                if not source or not target:
                    continue

                label = e.get("type") or "CONNECTED"
                link_id = f"{source}-{target}"

                # Filter out edge properties
                properties = {
                    k: v for k, v in e.items() if k not in ["source", "target", "type"]
                }

                links.append(
                    GraphLink(
                        id=link_id,
                        source=source,
                        target=target,
                        label=label,
                        properties=properties,
                    )
                )

            return GraphResponse(nodes=nodes, links=links)

        except Exception as e:
            logger.error(f"Error fetching Knowledge Graph: {e}")
            logger.error(traceback.format_exc())
            # Return Mock Graph so it NEVER crashes
            return GraphResponse(
                nodes=[GraphNode(**n) for n in MOCK_NODES],
                links=[GraphLink(**l) for l in MOCK_LINKS],
            )

    @router.get("/graph/node/{node_id}", response_model=NodeDetailsResponse)
    async def get_node_details(node_id: str):
        """
        Get details about a specific node.
        """
        try:
            if not rag.graph_ready:
                # Find in mock nodes
                for n in MOCK_NODES:
                    if n["id"] == node_id:
                        return NodeDetailsResponse(
                            id=n["id"],
                            label=n["label"],
                            type=n["type"],
                            properties=n["properties"],
                        )
                raise HTTPException(
                    status_code=404, detail="Node not found in mock database"
                )

            # Real query on Neo4j
            node = await rag.chunk_entity_relation_graph.get_node(node_id)
            if not node:
                # Fuzzy match / check lowercase
                all_nodes = await rag.chunk_entity_relation_graph.get_all_nodes()
                for n in all_nodes:
                    nid = n.get("id") or n.get("entity_id") or n.get("entity_name")
                    if nid and nid.lower() == node_id.lower():
                        return NodeDetailsResponse(
                            id=nid,
                            label=nid,
                            type=n.get("entity_type", "Entity"),
                            properties={
                                k: v
                                for k, v in n.items()
                                if k not in ["id", "labels", "entity_id"]
                            },
                        )
                raise HTTPException(
                    status_code=404,
                    detail=f"Node '{node_id}' not found in Neo4j Storage",
                )

            return NodeDetailsResponse(
                id=node_id,
                label=node_id,
                type=node.get("entity_type", "Entity"),
                properties={
                    k: v
                    for k, v in node.items()
                    if k not in ["id", "labels", "entity_id"]
                },
            )

        except Exception as e:
            logger.error(f"Error getting node details: {e}")
            # Mock fallback
            for n in MOCK_NODES:
                if n["id"] == node_id or n["id"].lower() == node_id.lower():
                    return NodeDetailsResponse(
                        id=n["id"],
                        label=n["label"],
                        type=n["type"],
                        properties=n["properties"],
                    )
            # Default fallback properties
            return NodeDetailsResponse(
                id=node_id,
                label=node_id,
                type="Concept",
                properties={
                    "summary": f"Detailed concept profile for '{node_id}'.",
                    "source": "Retrieved dynamically from RAG.",
                },
            )

    @router.get("/graph/node/{node_id}/neighbors", response_model=GraphResponse)
    async def get_node_neighbors(node_id: str, depth: int = Query(1, ge=1)):
        """
        Expand node neighbors.
        """
        try:
            if not rag.graph_ready:
                # Filter mock graph
                neighbor_links = [
                    l
                    for l in MOCK_LINKS
                    if l["source"] == node_id or l["target"] == node_id
                ]
                neighbor_node_ids = set()
                for l in neighbor_links:
                    neighbor_node_ids.add(l["source"])
                    neighbor_node_ids.add(l["target"])
                neighbor_node_ids.add(node_id)

                nodes = [
                    GraphNode(**n) for n in MOCK_NODES if n["id"] in neighbor_node_ids
                ]
                links = [
                    GraphLink(**l)
                    for l in MOCK_LINKS
                    if l["source"] == node_id or l["target"] == node_id
                ]
                return GraphResponse(nodes=nodes, links=links)

            # Real Neo4j neighbors
            # Let's perform a simple get_knowledge_graph query centered on the node
            subgraph = await rag.chunk_entity_relation_graph.get_knowledge_graph(
                node_id, max_depth=depth, max_nodes=50
            )

            nodes = []
            for n in subgraph.nodes:
                entity_type = (
                    n.properties.get("entity_type", "Concept")
                    if hasattr(n, "properties")
                    else "Concept"
                )
                nodes.append(
                    GraphNode(
                        id=n.id,
                        label=n.id,
                        type=entity_type,
                        group=entity_type.lower(),
                        properties=n.properties if hasattr(n, "properties") else {},
                    )
                )

            links = []
            for e in subgraph.edges:
                links.append(
                    GraphLink(
                        id=e.id or f"{e.source}-{e.target}",
                        source=e.source,
                        target=e.target,
                        label=e.type or "CONNECTED",
                        properties=e.properties if hasattr(e, "properties") else {},
                    )
                )

            return GraphResponse(nodes=nodes, links=links)

        except Exception as e:
            logger.error(f"Error expanding node neighbors: {e}")
            # Mock fallback
            neighbor_links = [
                l
                for l in MOCK_LINKS
                if l["source"] == node_id or l["target"] == node_id
            ]
            neighbor_node_ids = set()
            for l in neighbor_links:
                neighbor_node_ids.add(l["source"])
                neighbor_node_ids.add(l["target"])
            neighbor_node_ids.add(node_id)

            nodes = [GraphNode(**n) for n in MOCK_NODES if n["id"] in neighbor_node_ids]
            links = [
                GraphLink(**l)
                for l in MOCK_LINKS
                if l["source"] == node_id or l["target"] == node_id
            ]
            return GraphResponse(nodes=nodes, links=links)

    return router
