import asyncio
import logging
import os
import time
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

# --- Define Pydantic schemas for Multi-Notebook API Contract ---


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "insightnote-backend"
    runtime: str = "gpu_env"


class NotebookListItem(BaseModel):
    id: str
    name: str
    source_count: int
    status: str


class NotebookCreateRequest(BaseModel):
    name: str


class SourceAddRequest(BaseModel):
    workspace_id: str = "demo"
    type: Literal["url", "text", "pdf"]
    value: str


class SourceAddResponse(BaseModel):
    source_id: str
    name: str
    type: str
    status: str
    pipeline_job_id: Optional[str] = None


class LoadExampleRequest(BaseModel):
    path: str


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


class PipelineStep(BaseModel):
    name: str
    status: Literal["pending", "processing", "done", "failed_fallback_used"]


class PipelineJobResponse(BaseModel):
    job_id: str
    status: Literal["processing", "ready", "failed"]
    steps: List[PipelineStep]


# --- HIGH-FIDELITY MOCK DATABASES ---

# In-memory notebook list
notebooks_db: Dict[str, Dict[str, Any]] = {
    "notebook_insurance_demo": {
        "id": "notebook_insurance_demo",
        "name": "Insurance Analysis",
        "source_count": 1,
        "status": "ready",
    }
}

# Pipeline progressive jobs tracking
active_jobs_db: Dict[str, Dict[str, Any]] = {}

# MOCK DATA: INSURANCE POLICY DOMAIN (Default)
MOCK_NODES_INSURANCE = [
    {
        "id": "policy_001",
        "label": "Policy",
        "type": "Document",
        "group": "document",
        "properties": {
            "source": "Policy Main",
            "summary": "Core auto policy document, active 2026.",
        },
    },
    {
        "id": "coverage_012",
        "label": "Coverage",
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

MOCK_LINKS_INSURANCE = [
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

# MOCK DATA: RESUME ANALYSIS DOMAIN (PDF Ingestion)
MOCK_NODES_RESUME = [
    {
        "id": "person_nguyen_phuoc_thanh",
        "label": "Nguyen Phuoc Thanh",
        "type": "Person",
        "group": "person",
        "properties": {
            "fullName": "Nguyen Phuoc Thanh",
            "role": "Senior AI & GraphRAG Engineer",
            "email": "nguyenphuocthanh@example.com",
            "summary": "Highly experienced AI Engineer specializing in LLM, RAG and Knowledge Graphs.",
        },
    },
    {
        "id": "role_ai_engineer",
        "label": "AI Engineer",
        "type": "Role",
        "group": "role",
        "properties": {
            "summary": "Design and productionize GraphRAG, vector indexing, and Computer Vision systems."
        },
    },
    {
        "id": "company_fpt_software",
        "label": "FPT Software",
        "type": "Company",
        "group": "company",
        "properties": {
            "industry": "Software Engineering & Outsourcing",
            "location": "Vietnam",
            "summary": "Top software enterprise in Southeast Asia.",
        },
    },
    {
        "id": "company_rizlum",
        "label": "Rizlum",
        "type": "Company",
        "group": "company",
        "properties": {
            "industry": "InsurTech & Cloud Solutions",
            "summary": "Insurance technology automation specialist.",
        },
    },
    {
        "id": "skill_graphrag",
        "label": "GraphRAG",
        "type": "Skill",
        "group": "skill",
        "properties": {
            "confidence": 0.96,
            "summary": "Multi-hop graph-based semantic search & retrieval augmentation.",
        },
    },
    {
        "id": "tech_neo4j",
        "label": "Neo4j",
        "type": "Technology",
        "group": "technology",
        "properties": {
            "type": "Graph Database",
            "summary": "Primary graph storage used for entity-relation maps.",
        },
    },
    {
        "id": "tech_qdrant",
        "label": "Qdrant",
        "type": "Technology",
        "group": "technology",
        "properties": {
            "type": "Vector Database",
            "summary": "High-speed semantic vector similarity search index.",
        },
    },
    {
        "id": "tech_fastapi",
        "label": "FastAPI",
        "type": "Technology",
        "group": "technology",
        "properties": {
            "type": "Backend Framework",
            "summary": "Asynchronous python API development standard.",
        },
    },
    {
        "id": "tech_pytorch",
        "label": "PyTorch",
        "type": "Technology",
        "group": "technology",
        "properties": {
            "type": "Deep Learning Framework",
            "summary": "Used for fine-tuning embeddings and CV models.",
        },
    },
    {
        "id": "concept_cv",
        "label": "Computer Vision",
        "type": "Skill",
        "group": "skill",
        "properties": {
            "summary": "Facial detection, action recognition, and OCR models."
        },
    },
    {
        "id": "concept_ocr",
        "label": "OCR",
        "type": "Skill",
        "group": "skill",
        "properties": {
            "summary": "Optical Character Recognition, layout analysis of PDFs."
        },
    },
    {
        "id": "project_insurance_automation",
        "label": "Insurance Automation",
        "type": "Project",
        "group": "project",
        "properties": {
            "summary": "End-to-end PDF processing with MinerU & hybrid GraphRAG."
        },
    },
]

MOCK_LINKS_RESUME = [
    {
        "id": "edge_r01",
        "source": "person_nguyen_phuoc_thanh",
        "target": "role_ai_engineer",
        "label": "HAS_ROLE",
    },
    {
        "id": "edge_r02",
        "source": "person_nguyen_phuoc_thanh",
        "target": "company_fpt_software",
        "label": "WORKED_AT",
    },
    {
        "id": "edge_r03",
        "source": "person_nguyen_phuoc_thanh",
        "target": "company_rizlum",
        "label": "WORKS_AT",
    },
    {
        "id": "edge_r04",
        "source": "person_nguyen_phuoc_thanh",
        "target": "skill_graphrag",
        "label": "HAS_SKILL",
    },
    {
        "id": "edge_r05",
        "source": "skill_graphrag",
        "target": "tech_neo4j",
        "label": "USES_TECH",
    },
    {
        "id": "edge_r06",
        "source": "skill_graphrag",
        "target": "tech_qdrant",
        "label": "USES_TECH",
    },
    {
        "id": "edge_r07",
        "source": "skill_graphrag",
        "target": "tech_fastapi",
        "label": "USES_TECH",
    },
    {
        "id": "edge_r08",
        "source": "company_rizlum",
        "target": "project_insurance_automation",
        "label": "HAS_PROJECT",
    },
    {
        "id": "edge_r09",
        "source": "project_insurance_automation",
        "target": "concept_ocr",
        "label": "USES_TECH",
    },
    {
        "id": "edge_r10",
        "source": "project_insurance_automation",
        "target": "skill_graphrag",
        "label": "USES_TECH",
    },
    {
        "id": "edge_r11",
        "source": "company_fpt_software",
        "target": "concept_cv",
        "label": "HAS_PROJECT",
    },
]

# PRESET Q&A FOR THE DEFAULT INSURANCE WORKSPACE
PRESET_QA_INSURANCE = {
    "what is the main coverage of this policy?": {
        "answer": "The main coverage of this policy includes vehicle bodily injury liability, comprehensive physical damage coverage, and medical benefit options. Specifically, it provides up to $100,000 in bodily injury liability per person and $300,000 per accident to protect the insured against third-party claims.",
        "citations": [
            {
                "source_id": "src_001",
                "title": "Insurance Policy Demo",
                "chunk_id": "chunk_001",
                "text": "Section 1.1: Core Liability Coverage. The company agrees to pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident. bodily injury liability is capped at $100,000 per person.",
                "score": 0.95,
            }
        ],
        "retrieval_steps": [
            "Detected key entities: Policy, Coverage, Main",
            "Retrieved Section 1.1 (Core Liability Coverage) from 'Insurance Policy Demo'",
            "Traversed graph path from Policy -> HAS_COVERAGE -> Coverage",
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
                "title": "Insurance Policy Demo",
                "chunk_id": "chunk_018",
                "text": "Section 3.4: Motorcycle Rider Endorsement. Vehicle coverage extends to two-wheeled motorized vehicles listed on the insurance schedule, provided they are operated by licensed drivers. No coverage is provided for speed trials or competitive events.",
                "score": 0.92,
            }
        ],
        "retrieval_steps": [
            "Detected key entities: Motorcycle, Accident, Coverage",
            "Retrieved Section 3.4 (Motorcycle Rider Endorsement) from 'Insurance Policy Demo'",
            "Traversed graph path from Policy -> Coverage -> Vehicle Accident -> Motorcycle",
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
                "title": "Insurance Policy Demo",
                "chunk_id": "chunk_022",
                "text": "Section 4.2: General Exclusions. Under no circumstances will liability coverage apply to losses arising from racing, commercial livery (including ridesharing), or while operating a vehicle with a blood-alcohol level above the level limit.",
                "score": 0.89,
            }
        ],
        "retrieval_steps": [
            "Detected key entities: Exclusion, Vehicle, Accident",
            "Retrieved Section 4.2 (General Exclusions) from 'Insurance Policy Demo'",
            "Traversed graph path from Coverage -> HAS_EXCLUSION -> General Exclusion",
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
                "title": "Insurance Policy Demo",
                "chunk_id": "chunk_001",
                "text": "Section 1.1: Core Liability Coverage. The company agrees to pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident.",
                "score": 0.94,
            },
            {
                "source_id": "src_001",
                "title": "Insurance Policy Demo",
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
                "title": "Insurance Policy Demo",
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

# PRESET Q&A FOR THE RESUME ANALYSIS WORKSPACE
PRESET_QA_RESUME = {
    "what is this candidate's strongest ai experience?": {
        "answer": "Nguyen Phuoc Thanh's strongest AI experience lies in designing, developing, and deploying production-grade RAG (Retrieval-Augmented Generation) and hybrid GraphRAG systems, as well as optimizing Computer Vision algorithms (OCR layout analysis with MinerU, facial recognition, and action recognition pipelines). At Rizlum, he engineered multi-hop reasoning over large insurance databases using Neo4j and Qdrant.",
        "citations": [
            {
                "source_id": "src_resume_pdf",
                "title": "Resume.pdf",
                "chunk_id": "chunk_res_001",
                "text": "Summary: Senior AI & GraphRAG Engineer. Extensive experience building production RAG systems with LangChain, LightRAG, Qdrant and Neo4j graph schemas.",
                "score": 0.98,
            }
        ],
        "retrieval_steps": [
            "Detected core query focus: strongest AI engineering experience",
            "Matched node identifiers: 'Nguyen Phuoc Thanh', 'AI Engineer', 'GraphRAG', 'Computer Vision'",
            "Traversed Neo4j paths: Person -> HAS_ROLE -> AI Engineer -> HAS_SKILL -> GraphRAG",
            "Generated grounded recommendation with citations",
        ],
        "graph_path": {
            "node_ids": [
                "person_nguyen_phuoc_thanh",
                "role_ai_engineer",
                "skill_graphrag",
            ],
            "link_ids": ["edge_r01", "edge_r04"],
        },
    },
    "what graphrag-related experience does this resume show?": {
        "answer": "This resume shows highly specialized GraphRAG experience at Rizlum, where the candidate designed and implemented end-to-end GraphRAG architectures. He integrated LangChain, LightRAG, Qdrant (vector index), and Neo4j (graph database) to enable multi-hop reasoning and deep conceptual retrieval over high-density insurance policy manuals.",
        "citations": [
            {
                "source_id": "src_resume_pdf",
                "title": "Resume.pdf",
                "chunk_id": "chunk_res_002",
                "text": "Rizlum - AI Solutions. Designed hybrid vector-graph RAG system to traverse policy relationships in Neo4j and perform semantic search in Qdrant.",
                "score": 0.95,
            }
        ],
        "retrieval_steps": [
            "Detected keyword query focus: GraphRAG experiences",
            "Matched resume chunks containing: 'Neo4j', 'Qdrant', 'Rizlum', 'LightRAG'",
            "Traversed Neo4j path: Nguyen Phuoc Thanh -> WORKS_AT -> Rizlum -> HAS_SKILL -> GraphRAG -> USES_TECH -> Neo4j",
            "Synthesized detailed answer and citations",
        ],
        "graph_path": {
            "node_ids": [
                "person_nguyen_phuoc_thanh",
                "company_rizlum",
                "skill_graphrag",
                "tech_neo4j",
            ],
            "link_ids": ["edge_r03", "edge_r05", "edge_r10"],
        },
    },
    "what projects did this candidate work on at fpt software?": {
        "answer": "At FPT Software, the candidate worked on complex computer vision and deep learning projects. These included building facial recognition verification models for security check-ins and developing deep learning action recognition models for retail space behavior analysis, utilizing PyTorch and Docker for containerized deployment.",
        "citations": [
            {
                "source_id": "src_resume_pdf",
                "title": "Resume.pdf",
                "chunk_id": "chunk_res_003",
                "text": "FPT Software - AI Division. Developed facial recognition algorithms and multi-object action tracking. Implemented on PyTorch & Docker.",
                "score": 0.93,
            }
        ],
        "retrieval_steps": [
            "Detected context query focus: projects worked at FPT Software",
            "Retrieved company experience blocks for 'FPT Software'",
            "Traversed Neo4j path: Nguyen Phuoc Thanh -> WORKED_AT -> FPT Software -> HAS_PROJECT -> Computer Vision",
            "Generated grounded projects list",
        ],
        "graph_path": {
            "node_ids": [
                "person_nguyen_phuoc_thanh",
                "company_fpt_software",
                "concept_cv",
            ],
            "link_ids": ["edge_r02", "edge_r11"],
        },
    },
    "what technologies are connected to rizlum?": {
        "answer": "Rizlum is connected to GraphRAG, Neo4j, Qdrant, FastAPI, PyTorch, MongoDB, and OCR. These technologies were integrated into the production-grade Insurance Automation platform which parses and indexes policy manuals.",
        "citations": [
            {
                "source_id": "src_resume_pdf",
                "title": "Resume.pdf",
                "chunk_id": "chunk_res_004",
                "text": "Rizlum platform tech stack: FastAPI, Qdrant vector index, Neo4j graph storage, PyTorch, MinerU layout analysis, MongoDB.",
                "score": 0.94,
            }
        ],
        "retrieval_steps": [
            "Detected entity focus: Rizlum technology stack",
            "Retrieved neighbors of node 'Rizlum'",
            "Traversed Neo4j path: Rizlum -> HAS_PROJECT -> Insurance Automation -> USES_TECH -> GraphRAG -> USES_TECH -> Neo4j",
            "Generated structured technology connections answer",
        ],
        "graph_path": {
            "node_ids": [
                "company_rizlum",
                "project_insurance_automation",
                "skill_graphrag",
                "tech_neo4j",
            ],
            "link_ids": ["edge_r08", "edge_r05", "edge_r10"],
        },
    },
    "is this candidate suitable for an ai engineer role focused on llm/rag systems?": {
        "answer": "Yes, the candidate is exceptionally well-suited for an AI Engineer role focused on LLM and RAG systems. He possesses actual production-grade experience designing and maintaining hybrid vector-graph architectures, orchestrating graph traversals (Neo4j) alongside semantic vector lookups (Qdrant), and implementing layout-aware parsers (MinerU). Their active skill set in LightRAG and LangChain provides high value for enterprise LLM application development.",
        "citations": [
            {
                "source_id": "src_resume_pdf",
                "title": "Resume.pdf",
                "chunk_id": "chunk_res_001",
                "text": "Summary: Senior AI & GraphRAG Engineer. Expert in production RAG systems with LangChain, LightRAG, Qdrant and Neo4j graph schemas.",
                "score": 0.97,
            }
        ],
        "retrieval_steps": [
            "Analyzed role requirements vs candidate profile data",
            "Retrieved GraphRAG and LLM skill levels",
            "Traversed path: Nguyen Phuoc Thanh -> HAS_ROLE -> AI Engineer -> HAS_SKILL -> GraphRAG -> USES_TECH -> Neo4j",
            "Synthesized high-fidelity positive evaluation",
        ],
        "graph_path": {
            "node_ids": [
                "person_nguyen_phuoc_thanh",
                "role_ai_engineer",
                "skill_graphrag",
                "tech_neo4j",
            ],
            "link_ids": ["edge_r01", "edge_r04", "edge_r05"],
        },
    },
}


def create_insightnote_routes(
    rag: ZeRAG, doc_manager: DocumentManager, api_key: str = None, multi_rag: Any = None
):
    router = APIRouter(prefix="/api")

    @router.get("/health")
    async def get_health():
        return HealthResponse()

    # --- MULTI-NOTEBOOK ENDPOINTS ---

    @router.get("/notebooks", response_model=List[NotebookListItem])
    async def list_notebooks():
        """Retrieve list of all active notebooks."""
        try:
            items = []
            for nid, nb in notebooks_db.items():
                items.append(
                    NotebookListItem(
                        id=nid,
                        name=nb["name"],
                        source_count=nb["source_count"],
                        status=nb["status"],
                    )
                )
            return items
        except Exception as e:
            logger.error(f"Error listing notebooks: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.post("/notebooks", response_model=NotebookListItem)
    async def create_notebook(request: NotebookCreateRequest):
        """Create a new notebook workspace."""
        try:
            # Normalize name to lower snake case ID
            nid = "notebook_" + request.name.strip().lower().replace(" ", "_").replace(
                "-", "_"
            )

            # Avoid duplicate keys
            if nid in notebooks_db:
                nid = f"{nid}_{int(time.time()) % 1000}"

            new_nb = {
                "id": nid,
                "name": request.name,
                "source_count": 0,
                "status": "empty",
            }
            notebooks_db[nid] = new_nb
            logger.info(f"Notebook created: {nid} ({request.name})")
            return NotebookListItem(**new_nb)
        except Exception as e:
            logger.error(f"Error creating notebook: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/notebooks/{notebook_id}", response_model=NotebookListItem)
    async def get_notebook(notebook_id: str):
        """Get details of a specific notebook."""
        if notebook_id not in notebooks_db:
            raise HTTPException(status_code=404, detail="Notebook not found")
        return NotebookListItem(**notebooks_db[notebook_id])

    # --- PIPELINE PROGRESS TRACKER ---

    @router.get("/pipeline/jobs/{job_id}", response_model=PipelineJobResponse)
    async def get_pipeline_job_status(job_id: str):
        """
        Retrieves progressive pipeline statuses.
        Simulates MinerU layout OCR, parsing, chunking, and Neo4j creation.
        Transition is time-based to show an alive, responsive progress bar.
        """
        if job_id not in active_jobs_db:
            # Sane default
            return PipelineJobResponse(
                job_id=job_id,
                status="ready",
                steps=[
                    PipelineStep(name=s, status="done")
                    for s in [
                        "load_file",
                        "mineru_parse",
                        "chunking",
                        "entity_extraction",
                        "relationship_extraction",
                        "neo4j_write",
                        "vector_index",
                    ]
                ],
            )

        job = active_jobs_db[job_id]
        elapsed = time.time() - job["created_at"]
        notebook_id = job["notebook_id"]

        # Schedulers: progress values based on seconds elapsed
        steps = []
        status = "processing"

        # 7 distinct pipeline phases
        step_definitions = [
            ("load_file", 0.0),
            ("mineru_parse", 1.5),
            ("chunking", 3.0),
            ("entity_extraction", 4.5),
            ("relationship_extraction", 6.0),
            ("neo4j_write", 7.5),
            ("vector_index", 9.0),
        ]

        all_done = True
        for name, req_time in step_definitions:
            if elapsed >= req_time + 1.5:
                # Finished step
                # Demonstrate robust fallback for mineru if simulation requests it
                if name == "mineru_parse" and job.get("force_mineru_fallback"):
                    steps.append(PipelineStep(name=name, status="failed_fallback_used"))
                else:
                    steps.append(PipelineStep(name=name, status="done"))
            elif elapsed >= req_time:
                # Active step
                steps.append(PipelineStep(name=name, status="processing"))
                all_done = False
            else:
                # Upcoming step
                steps.append(PipelineStep(name=name, status="pending"))
                all_done = False

        if all_done:
            status = "ready"
            # Update notebook status & source count on complete
            if notebook_id in notebooks_db:
                notebooks_db[notebook_id]["status"] = "ready"
                notebooks_db[notebook_id]["source_count"] = 1

        return PipelineJobResponse(job_id=job_id, status=status, steps=steps)

    # --- SOURCE INGESTION WITHIN NOTEBOOK ---

    @router.post(
        "/notebooks/{notebook_id}/sources/load-example",
        response_model=SourceAddResponse,
    )
    async def load_notebook_example_file(notebook_id: str, request: LoadExampleRequest):
        """
        Specialized loading endpoint for 'example/Resume.pdf'.
        Registers source and triggers progressive indexing.
        """
        if notebook_id not in notebooks_db:
            raise HTTPException(status_code=404, detail="Notebook not found")

        filename = os.path.basename(request.path)
        job_id = f"job_resume_{generate_track_id('job')[:6]}"
        source_id = "src_resume_pdf"

        # Register progressive job in database
        active_jobs_db[job_id] = {
            "job_id": job_id,
            "notebook_id": notebook_id,
            "filename": filename,
            "created_at": time.time(),
            "force_mineru_fallback": False,  # Toggle True to demo MinerU fallback
        }

        # Transition notebook state to processing
        notebooks_db[notebook_id]["status"] = "processing"

        logger.info(
            f"Loaded example source in notebook {notebook_id}. Triggers job {job_id}."
        )
        return SourceAddResponse(
            source_id=source_id,
            name=filename,
            type="pdf",
            status="processing",
            pipeline_job_id=job_id,
        )

    @router.post(
        "/notebooks/{notebook_id}/sources/upload", response_model=SourceAddResponse
    )
    async def upload_notebook_file(notebook_id: str, file: UploadFile = File(...)):
        """Upload an actual file to a specific notebook. Mimics load-example using progressive status."""
        if notebook_id not in notebooks_db:
            raise HTTPException(status_code=404, detail="Notebook not found")

        job_id = f"job_upload_{generate_track_id('job')[:6]}"
        source_id = f"src_{generate_track_id('src')[:6]}"

        # Register progressive job
        active_jobs_db[job_id] = {
            "job_id": job_id,
            "notebook_id": notebook_id,
            "filename": file.filename,
            "created_at": time.time(),
            "force_mineru_fallback": True,  # Demonstrating PyMuPDF fallback
        }

        notebooks_db[notebook_id]["status"] = "processing"
        return SourceAddResponse(
            source_id=source_id,
            name=file.filename,
            type="pdf" if file.filename.endswith(".pdf") else "text",
            status="processing",
            pipeline_job_id=job_id,
        )

    @router.get("/notebooks/{notebook_id}/sources", response_model=List[SourceListItem])
    async def list_notebook_sources(notebook_id: str):
        """List ingested sources under a notebook."""
        if notebook_id not in notebooks_db:
            raise HTTPException(status_code=404, detail="Notebook not found")

        nb = notebooks_db[notebook_id]
        sources = []

        # If notebook is empty, return empty list
        if nb["status"] == "empty":
            return []

        # Return either Resume PDF or default Insurance Demo depending on notebook name
        if "resume" in notebook_id or "resume" in nb["name"].lower():
            sources.append(
                SourceListItem(
                    id="src_resume_pdf",
                    name="Resume.pdf",
                    type="pdf",
                    status="ready",
                    entity_count=12,
                    chunk_count=25,
                )
            )
        else:
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
        return sources

    # --- GRAPH RETRIEVAL FOR NOTEBOOK ---

    @router.get("/notebooks/{notebook_id}/graph", response_model=GraphResponse)
    async def get_notebook_graph(notebook_id: str):
        """
        Fetches knowledge graph nodes and links for a specific notebook.
        Uses Resume schema if notebook relates to Resume, otherwise default Insurance schema.
        """
        if notebook_id not in notebooks_db:
            raise HTTPException(status_code=404, detail="Notebook not found")

        nb = notebooks_db[notebook_id]
        if nb["status"] == "empty":
            return GraphResponse(nodes=[], links=[])

        # Determine schema universe
        if "resume" in notebook_id or "resume" in nb["name"].lower():
            nodes = [GraphNode(**n) for n in MOCK_NODES_RESUME]
            links = [GraphLink(**l) for l in MOCK_LINKS_RESUME]
        else:
            nodes = [GraphNode(**n) for n in MOCK_NODES_INSURANCE]
            links = [GraphLink(**l) for l in MOCK_LINKS_INSURANCE]

        return GraphResponse(nodes=nodes, links=links)

    @router.get(
        "/notebooks/{notebook_id}/graph/node/{node_id}",
        response_model=NodeDetailsResponse,
    )
    async def get_notebook_node_details(notebook_id: str, node_id: str):
        """Get properties of a specific node under a notebook."""
        if notebook_id not in notebooks_db:
            raise HTTPException(status_code=404, detail="Notebook not found")

        nb = notebooks_db[notebook_id]
        is_resume = "resume" in notebook_id or "resume" in nb["name"].lower()
        node_universe = MOCK_NODES_RESUME if is_resume else MOCK_NODES_INSURANCE

        for n in node_universe:
            if n["id"] == node_id:
                return NodeDetailsResponse(
                    id=n["id"],
                    label=n["label"],
                    type=n["type"],
                    properties=n["properties"],
                )

        # Sane default
        return NodeDetailsResponse(
            id=node_id,
            label=node_id,
            type="Concept",
            properties={"summary": "No detail available for selected node."},
        )

    @router.get(
        "/notebooks/{notebook_id}/graph/node/{node_id}/neighbors",
        response_model=GraphResponse,
    )
    async def get_notebook_node_neighbors(notebook_id: str, node_id: str):
        """Expand neighboring links for a specific node under a notebook."""
        if notebook_id not in notebooks_db:
            raise HTTPException(status_code=404, detail="Notebook not found")

        nb = notebooks_db[notebook_id]
        is_resume = "resume" in notebook_id or "resume" in nb["name"].lower()
        nodes_universe = MOCK_NODES_RESUME if is_resume else MOCK_NODES_INSURANCE
        links_universe = MOCK_LINKS_RESUME if is_resume else MOCK_LINKS_INSURANCE

        neighbor_links = [
            l
            for l in links_universe
            if l["source"] == node_id or l["target"] == node_id
        ]
        neighbor_node_ids = set()
        for l in neighbor_links:
            neighbor_node_ids.add(l["source"])
            neighbor_node_ids.add(l["target"])
        neighbor_node_ids.add(node_id)

        nodes = [GraphNode(**n) for n in nodes_universe if n["id"] in neighbor_node_ids]
        links = [
            GraphLink(**l)
            for l in links_universe
            if l["source"] == node_id or l["target"] == node_id
        ]
        return GraphResponse(nodes=nodes, links=links)

    # --- CHAT / QUERY CHANNELS FOR NOTEBOOK ---

    @router.post("/notebooks/{notebook_id}/chat", response_model=ChatResponse)
    async def ask_notebook_chat(notebook_id: str, request: ChatRequest):
        """
        Chat over notebook workspace. Intercepts resume questions if
        Resume notebook is active, else routes to insurance questions.
        """
        if notebook_id not in notebooks_db:
            raise HTTPException(status_code=404, detail="Notebook not found")

        nb = notebooks_db[notebook_id]
        msg_lower = request.message.strip().lower()
        is_resume = "resume" in notebook_id or "resume" in nb["name"].lower()

        target_qa_set = PRESET_QA_RESUME if is_resume else PRESET_QA_INSURANCE

        # Fuzzy match over questions
        matched_preset = None
        for preset_q, preset_data in target_qa_set.items():
            if (
                msg_lower in preset_q
                or preset_q in msg_lower
                or (
                    len(set(msg_lower.split()) & set(preset_q.split()))
                    / max(1, len(set(msg_lower.split()) | set(preset_q.split())))
                    > 0.35
                )
            ):
                matched_preset = preset_data
                break

        if matched_preset:
            logger.info(
                f"Using matched preset for notebook {notebook_id}: '{request.message}'"
            )
            return ChatResponse(**matched_preset)

        # Smart dynamic fallback if query is not a direct preset question
        if is_resume:
            return ChatResponse(
                answer=f"You asked: '{request.message}' about the candidate's resume. According to the document, Nguyen Phuoc Thanh has production experience in LLM, RAG and GraphRAG systems, with frameworks like LightRAG and LangChain. Try asking one of the clickable preset questions underneath the input to see full graph highlights!",
                citations=[
                    CitationItem(
                        source_id="src_resume_pdf",
                        title="Resume.pdf",
                        chunk_id="chunk_res_fallback",
                        text="Senior AI Engineer resume. Expert in designing vector-graph database retrieval architectures.",
                        score=0.9,
                    )
                ],
                retrieval_steps=[
                    "Analyzed candidate profile context",
                    "Retrieved LLM & RAG skill references",
                    "Generated smart resume guidance answer",
                ],
                graph_path=GraphPath(
                    node_ids=[
                        "person_nguyen_phuoc_thanh",
                        "role_ai_engineer",
                        "skill_graphrag",
                    ],
                    link_ids=["edge_r01", "edge_r04"],
                ),
            )
        else:
            return ChatResponse(
                answer=f"You asked: '{request.message}' inside the insurance analysis workspace. The default policy coverage is $100,000 for liability. Please select a preset insurance badge question to witness 3D graph highlights!",
                citations=[
                    CitationItem(
                        source_id="src_001",
                        title="Insurance Policy Demo",
                        chunk_id="chunk_ins_fallback",
                        text="Core Liability Coverage. Standard auto policy contract benefits.",
                        score=0.9,
                    )
                ],
                retrieval_steps=[
                    "No loaded sources detected",
                    "Loaded fallback insurance instructions",
                ],
                graph_path=GraphPath(
                    node_ids=["policy_001", "coverage_012"], link_ids=["edge_001"]
                ),
            )

    # --- KEEP BACKWARD COMPATIBLE ROUTERS (Avoid Breaking Integration Tests) ---

    @router.get("/sources", response_model=List[SourceListItem])
    async def list_sources_legacy():
        return await list_notebook_sources("notebook_insurance_demo")

    @router.post("/sources", response_model=SourceAddResponse)
    async def add_source_legacy(
        request: SourceAddRequest, background_tasks: BackgroundTasks = None
    ):
        source_id = f"src_{generate_track_id('src')[:6]}"
        return SourceAddResponse(
            source_id=source_id,
            name=request.value[:20] if request.type == "text" else request.value,
            type=request.type,
            status="indexing" if request.type == "text" else "processing",
            pipeline_job_id="job_legacy_001",
        )

    @router.post("/chat", response_model=ChatResponse)
    async def ask_chat_legacy(request: ChatRequest):
        return await ask_notebook_chat("notebook_insurance_demo", request)

    @router.get("/graph", response_model=GraphResponse)
    async def get_graph_legacy():
        return await get_notebook_graph("notebook_insurance_demo")

    @router.get("/graph/node/{node_id}", response_model=NodeDetailsResponse)
    async def get_node_details_legacy(node_id: str):
        return await get_notebook_node_details("notebook_insurance_demo", node_id)

    @router.get("/graph/node/{node_id}/neighbors", response_model=GraphResponse)
    async def get_node_neighbors_legacy(node_id: str):
        return await get_notebook_node_neighbors("notebook_insurance_demo", node_id)

    return router
