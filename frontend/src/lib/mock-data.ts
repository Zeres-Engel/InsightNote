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
