import { SourceListItem, GraphNode, GraphLink, ChatResponse } from './types';

export const MOCK_SOURCES: SourceListItem[] = [
  { id: 'src_001', name: 'Insurance Policy Main', type: 'pdf', status: 'ready', entity_count: 8, chunk_count: 24 },
  { id: 'src_002', name: 'https://example.com/insurance-terms', type: 'url', status: 'ready', entity_count: 3, chunk_count: 5 },
  { id: 'src_003', name: 'Rider Special Notes', type: 'text', status: 'ready', entity_count: 2, chunk_count: 2 },
  { id: 'src_004', name: 'Accident Claim Procedure', type: 'text', status: 'ready', entity_count: 4, chunk_count: 3 },
];

export const MOCK_NODES: GraphNode[] = [
  {
    id: "policy_001",
    label: "Insurance Policy",
    type: "Document",
    group: "document",
    properties: {
      source: "Policy Main",
      summary: "Core auto policy document, active 2026.",
    },
  },
  {
    id: "coverage_012",
    label: "Comprehensive Coverage",
    type: "Clause",
    group: "clause",
    properties: {
      source: "Section 1.1",
      confidence: 0.95,
      summary: "Defines liability and damage coverages.",
    },
  },
  {
    id: "vehicle_accident_007",
    label: "Vehicle Accident",
    type: "Concept",
    group: "concept",
    properties: { summary: "Event involving collision of motor vehicles." },
  },
  {
    id: "motorcycle_003",
    label: "Motorcycle",
    type: "Concept",
    group: "concept",
    properties: { summary: "Two-wheeled motor vehicle rider rules." },
  },
  {
    id: "claim_099",
    label: "Accident Claim",
    type: "Process",
    group: "process",
    properties: { summary: "Submission process for reimbursement of loss." },
  },
  {
    id: "condition_055",
    label: "Claim Condition",
    type: "Rule",
    group: "rule",
    properties: {
      summary: "Requires police report within 24 hours of accident."
    },
  },
  {
    id: "exclusion_004",
    label: "General Exclusion",
    type: "Rule",
    group: "rule",
    properties: { summary: "Excludes street racing, ridesharing and DUI." },
  },
  {
    id: "benefit_011",
    label: "Hospital Benefit",
    type: "Clause",
    group: "clause",
    properties: { summary: "Pays $150 per day of hospitalization." },
  },
  {
    id: "police_report_022",
    label: "Police Report",
    type: "Document",
    group: "document",
    properties: { summary: "Official law enforcement accident description." },
  },
  {
    id: "customer_001",
    label: "John Doe",
    type: "Person",
    group: "person",
    properties: { role: "Primary Insured", joined: "2024-03-12" },
  },
];

export const MOCK_LINKS: GraphLink[] = [
  {
    id: "edge_001",
    source: "policy_001",
    target: "coverage_012",
    label: "HAS_COVERAGE",
  },
  {
    id: "edge_002",
    source: "coverage_012",
    target: "vehicle_accident_007",
    label: "APPLIES_TO",
  },
  {
    id: "edge_003",
    source: "vehicle_accident_007",
    target: "motorcycle_003",
    label: "INCLUDES",
  },
  {
    id: "edge_004",
    source: "motorcycle_003",
    target: "police_report_022",
    label: "REQUIRES",
  },
  {
    id: "edge_005",
    source: "claim_099",
    target: "condition_055",
    label: "MUST_SATISFY",
  },
  {
    id: "edge_006",
    source: "coverage_012",
    target: "exclusion_004",
    label: "HAS_EXCLUSION",
  },
  {
    id: "edge_007",
    source: "policy_001",
    target: "benefit_011",
    label: "OFFERS",
  },
  {
    id: "edge_008",
    source: "customer_001",
    target: "policy_001",
    label: "OWNS",
  },
  {
    id: "edge_009",
    source: "claim_099",
    target: "police_report_022",
    label: "VERIFIED_BY",
  },
];

export const PRESET_QA: Record<string, ChatResponse> = {
  "what is the main coverage of this policy?": {
    answer: "The main coverage of this policy includes vehicle bodily injury liability, comprehensive physical damage coverage, and medical benefit options. Specifically, it provides up to $100,000 in bodily injury liability per person and $300,000 per accident to protect the insured against third-party claims.",
    citations: [
      {
        source_id: "src_001",
        title: "Insurance Policy Main",
        chunk_id: "chunk_001",
        text: "Section 1.1: Core Liability Coverage. The company agrees to pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident. bodily injury liability is capped at $100,000 per person.",
        score: 0.95,
      }
    ],
    retrieval_steps: [
      "Detected key entities: Policy, Coverage, Main",
      "Retrieved Section 1.1 (Core Liability Coverage) from 'Insurance Policy'",
      "Traversed graph path from Policy -> HAS_COVERAGE -> Comprehensive Coverage",
      "Generated grounded answer with citations",
    ],
    graph_path: {
      node_ids: ["policy_001", "coverage_012"],
      link_ids: ["edge_001"],
    },
  },
  "does this policy cover motorcycle accidents?": {
    answer: "Yes. Motorcycle accidents are covered under specific conditions under this policy, as long as the motorcycle is listed as an insured vehicle on the policy schedule and the rider holds a valid motorcycle license. However, coverage is explicitly excluded if the motorcycle is used for professional racing or off-road stunt riding.",
    citations: [
      {
        source_id: "src_001",
        title: "Insurance Policy Main",
        chunk_id: "chunk_018",
        text: "Section 3.4: Motorcycle Rider Endorsement. Vehicle coverage extends to two-wheeled motorized vehicles listed on the insurance schedule, provided they are operated by licensed drivers. No coverage is provided for speed trials or competitive events.",
        score: 0.92,
      }
    ],
    retrieval_steps: [
      "Detected key entities: Motorcycle, Accident, Coverage",
      "Retrieved Section 3.4 (Motorcycle Rider Endorsement) from 'Insurance Policy'",
      "Traversed graph path from Policy -> Comprehensive Coverage -> Vehicle Accident -> Motorcycle",
      "Generated grounded answer with citations",
    ],
    graph_path: {
      node_ids: [
        "policy_001",
        "coverage_012",
        "vehicle_accident_007",
        "motorcycle_003",
      ],
      link_ids: ["edge_001", "edge_002", "edge_003"],
    },
  },
  "what exclusions apply to vehicle accidents?": {
    answer: "The exclusions that apply to vehicle accidents under this policy include: (1) using the vehicle for commercial ride-sharing or livery services without a proper commercial endorsement, (2) driving under the influence (DUI) of alcohol or non-prescribed controlled substances, and (3) intentional damage or participating in competitive racing/speed events.",
    citations: [
      {
        source_id: "src_001",
        title: "Insurance Policy Main",
        chunk_id: "chunk_022",
        text: "Section 4.2: General Exclusions. Under no circumstances will liability coverage apply to losses arising from racing, commercial livery (including ridesharing), or while operating a vehicle with a blood-alcohol level above the legal limit.",
        score: 0.89,
      }
    ],
    retrieval_steps: [
      "Detected key entities: Exclusion, Vehicle, Accident",
      "Retrieved Section 4.2 (General Exclusions) from 'Insurance Policy'",
      "Traversed graph path from Comprehensive Coverage -> HAS_EXCLUSION -> General Exclusion",
      "Generated grounded answer with citations",
    ],
    graph_path: {
      node_ids: ["coverage_012", "exclusion_004"],
      link_ids: ["edge_006"],
    },
  },
  "which clauses support your answer?": {
    answer: "The answer is supported by Section 1.1 (Core Liability Coverage), Section 3.4 (Motorcycle Rider Endorsement), and Section 4.2 (General Exclusions) of the Insurance Policy. These clauses establish the standard coverage, the rider-specific allowances, and the explicit exclusions, respectively.",
    citations: [
      {
        source_id: "src_001",
        title: "Insurance Policy Main",
        chunk_id: "chunk_001",
        text: "Section 1.1: Core Liability Coverage. The company agrees to pay damages for bodily injury or property damage for which any insured becomes legally responsible because of an auto accident.",
        score: 0.94,
      },
      {
        source_id: "src_001",
        title: "Insurance Policy Main",
        chunk_id: "chunk_018",
        text: "Section 3.4: Motorcycle Rider Endorsement. Vehicle coverage extends to two-wheeled motorized vehicles listed on the insurance schedule, provided they are operated by licensed drivers.",
        score: 0.91,
      },
    ],
    retrieval_steps: [
      "Analyzed prior chat context and supporting clauses",
      "Traversed graph paths for Policy, Coverage, and Exclusions",
      "Generated list of supporting policy clauses",
    ],
    graph_path: {
      node_ids: ["policy_001", "coverage_012", "exclusion_004"],
      link_ids: ["edge_001", "edge_006"],
    },
  },
  "show me the reasoning path in the graph.": {
    answer: "The reasoning path starting from your Policy goes to Coverage, then to Vehicle Accident, and finally to the Motorcycle Accident node. This connects the high-level contract document down to the specific vehicle rules, and is highlighted in orange on the 3D graph visualization.",
    citations: [
      {
        source_id: "src_001",
        title: "Insurance Policy Main",
        chunk_id: "chunk_018",
        text: "Section 3.4: Motorcycle Rider Endorsement. Vehicle coverage extends to two-wheeled motorized vehicles listed on the insurance schedule...",
        score: 0.96,
      }
    ],
    retrieval_steps: [
      "Retrieved path from Neo4j DB for Policy -> Coverage -> Vehicle Accident -> Motorcycle",
      "Formatted graph path for visual highlighting",
    ],
    graph_path: {
      node_ids: [
        "policy_001",
        "coverage_012",
        "vehicle_accident_007",
        "motorcycle_003",
      ],
      link_ids: ["edge_001", "edge_002", "edge_003"],
    },
  },
};

export const MOCK_NODES_RESUME: GraphNode[] = [
  {
    id: "person_nguyen_phuoc_thanh",
    label: "Nguyen Phuoc Thanh",
    type: "Person",
    group: "person",
    properties: {
      fullName: "Nguyen Phuoc Thanh",
      role: "Senior AI & GraphRAG Engineer",
      email: "nguyenphuocthanh@example.com",
      summary: "Highly experienced AI Engineer specializing in LLM, RAG and Knowledge Graphs.",
    },
  },
  {
    id: "role_ai_engineer",
    label: "AI Engineer",
    type: "Role",
    group: "role",
    properties: {
      summary: "Design and productionize GraphRAG, vector indexing, and Computer Vision systems."
    },
  },
  {
    id: "company_fpt_software",
    label: "FPT Software",
    type: "Company",
    group: "company",
    properties: {
      industry: "Software Engineering & Outsourcing",
      location: "Vietnam",
      summary: "Top software enterprise in Southeast Asia.",
    },
  },
  {
    id: "company_rizlum",
    label: "Rizlum",
    type: "Company",
    group: "company",
    properties: {
      industry: "InsurTech & Cloud Solutions",
      summary: "Insurance technology automation specialist.",
    },
  },
  {
    id: "skill_graphrag",
    label: "GraphRAG",
    type: "Skill",
    group: "skill",
    properties: {
      confidence: 0.96,
      summary: "Multi-hop graph-based semantic search & retrieval augmentation.",
    },
  },
  {
    id: "tech_neo4j",
    label: "Neo4j",
    type: "Technology",
    group: "technology",
    properties: {
      type: "Graph Database",
      summary: "Primary graph storage used for entity-relation maps.",
    },
  },
  {
    id: "tech_qdrant",
    label: "Qdrant",
    type: "Technology",
    group: "technology",
    properties: {
      type: "Vector Database",
      summary: "High-speed semantic vector similarity search index.",
    },
  },
  {
    id: "tech_fastapi",
    label: "FastAPI",
    type: "Technology",
    group: "technology",
    properties: {
      type: "Backend Framework",
      summary: "Asynchronous python API development standard.",
    },
  },
  {
    id: "tech_pytorch",
    label: "PyTorch",
    type: "Technology",
    group: "technology",
    properties: {
      type: "Deep Learning Framework",
      summary: "Used for fine-tuning embeddings and CV models.",
    },
  },
  {
    id: "concept_cv",
    label: "Computer Vision",
    type: "Skill",
    group: "skill",
    properties: {
      summary: "Facial detection, action recognition, and OCR models."
    },
  },
  {
    id: "concept_ocr",
    label: "OCR",
    type: "Skill",
    group: "skill",
    properties: {
      summary: "Optical Character Recognition, layout analysis of PDFs."
    },
  },
  {
    id: "project_insurance_automation",
    label: "Insurance Automation",
    type: "Project",
    group: "project",
    properties: {
      summary: "Accident Claim parsing with MinerU & hybrid GraphRAG."
    },
  },
];

export const MOCK_LINKS_RESUME: GraphLink[] = [
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
  {
    id: "edge_r08",
    source: "company_rizlum",
    target: "project_insurance_automation",
    label: "HAS_PROJECT",
  },
  {
    id: "edge_r09",
    source: "project_insurance_automation",
    target: "concept_ocr",
    label: "USES_TECH",
  },
  {
    id: "edge_r10",
    source: "project_insurance_automation",
    target: "skill_graphrag",
    label: "USES_TECH",
  },
  {
    id: "edge_r11",
    source: "company_fpt_software",
    target: "concept_cv",
    label: "HAS_PROJECT",
  },
];

export const PRESET_QA_RESUME: Record<string, ChatResponse> = {
  "what is this candidate's strongest ai experience?": {
    answer: "Nguyen Phuoc Thanh's strongest AI experience lies in designing, developing, and deploying production-grade RAG (Retrieval-Augmented Generation) and hybrid GraphRAG systems, as well as optimizing Computer Vision algorithms (OCR layout analysis with MinerU, facial recognition, and action recognition pipelines). At Rizlum, he engineered multi-hop reasoning over large insurance databases using Neo4j and Qdrant.",
    citations: [
      {
        source_id: "src_resume_pdf",
        title: "Resume.pdf",
        chunk_id: "chunk_res_001",
        text: "Summary: Senior AI & GraphRAG Engineer. Extensive experience building production RAG systems with LangChain, LightRAG, Qdrant and Neo4j graph schemas.",
        score: 0.98,
      }
    ],
    retrieval_steps: [
      "Detected core query focus: strongest AI engineering experience",
      "Matched node identifiers: 'Nguyen Phuoc Thanh', 'AI Engineer', 'GraphRAG', 'Computer Vision'",
      "Traversed Neo4j paths: Person -> HAS_ROLE -> AI Engineer -> HAS_SKILL -> GraphRAG",
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
  "what graphrag-related experience does this resume show?": {
    answer: "This resume shows highly specialized GraphRAG experience at Rizlum, where the candidate designed and implemented end-to-end GraphRAG architectures. He integrated LangChain, LightRAG, Qdrant (vector index), and Neo4j (graph database) to enable multi-hop reasoning and deep conceptual retrieval over high-density insurance policy manuals.",
    citations: [
      {
        source_id: "src_resume_pdf",
        title: "Resume.pdf",
        chunk_id: "chunk_res_002",
        text: "Rizlum - AI Solutions. Designed hybrid vector-graph RAG system to traverse policy relationships in Neo4j and perform semantic search in Qdrant.",
        score: 0.95,
      }
    ],
    retrieval_steps: [
      "Detected keyword query focus: GraphRAG experiences",
      "Matched resume chunks containing: 'Neo4j', 'Qdrant', 'Rizlum', 'LightRAG'",
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
  "what projects did this candidate work on at fpt software?": {
    answer: "At FPT Software, the candidate worked on complex computer vision and deep learning projects. These included building facial recognition verification models for security check-ins and developing deep learning action recognition models for retail space behavior analysis, utilizing PyTorch and Docker for containerized deployment.",
    citations: [
      {
        source_id: "src_resume_pdf",
        title: "Resume.pdf",
        chunk_id: "chunk_res_003",
        text: "FPT Software - AI Division. Developed facial recognition algorithms and multi-object action tracking. Implemented on PyTorch & Docker.",
        score: 0.93,
      }
    ],
    retrieval_steps: [
      "Detected context query focus: projects worked at FPT Software",
      "Retrieved company experience blocks for 'FPT Software'",
      "Traversed Neo4j path: Nguyen Phuoc Thanh -> WORKED_AT -> FPT Software -> HAS_PROJECT -> Computer Vision",
      "Generated grounded projects list",
    ],
    graph_path: {
      node_ids: [
        "person_nguyen_phuoc_thanh",
        "company_fpt_software",
        "concept_cv",
      ],
      link_ids: ["edge_r02", "edge_r11"],
    },
  },
  "what technologies are connected to rizlum?": {
    answer: "Rizlum is connected to GraphRAG, Neo4j, Qdrant, FastAPI, PyTorch, MongoDB, and OCR. These technologies were integrated into the production-grade Insurance Automation platform which parses and indexes policy manuals.",
    citations: [
      {
        source_id: "src_resume_pdf",
        title: "Resume.pdf",
        chunk_id: "chunk_res_004",
        text: "Rizlum platform tech stack: FastAPI, Qdrant vector index, Neo4j graph storage, PyTorch, MinerU layout analysis, MongoDB.",
        score: 0.94,
      }
    ],
    retrieval_steps: [
      "Detected entity focus: Rizlum technology stack",
      "Retrieved neighbors of node 'Rizlum'",
      "Traversed Neo4j path: Rizlum -> HAS_PROJECT -> Insurance Automation -> USES_TECH -> GraphRAG -> USES_TECH -> Neo4j",
      "Generated structured technology connections answer",
    ],
    graph_path: {
      node_ids: [
        "company_rizlum",
        "project_insurance_automation",
        "skill_graphrag",
        "tech_neo4j",
      ],
      link_ids: ["edge_r08", "edge_r05", "edge_r10"],
    },
  },
  "is this candidate suitable for an ai engineer role focused on llm/rag systems?": {
    answer: "Yes, the candidate is exceptionally well-suited for an AI Engineer role focused on LLM and RAG systems. He possesses actual production-grade experience designing and maintaining hybrid vector-graph architectures, orchestrating graph traversals (Neo4j) alongside semantic vector lookups (Qdrant), and implementing layout-aware parsers (MinerU). Their active skill set in LightRAG and LangChain provides high value for enterprise LLM application development.",
    citations: [
      {
        source_id: "src_resume_pdf",
        title: "Resume.pdf",
        chunk_id: "chunk_res_001",
        text: "Summary: Senior AI & GraphRAG Engineer. Expert in production RAG systems with LangChain, LightRAG, Qdrant and Neo4j graph schemas.",
        score: 0.97,
      }
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

