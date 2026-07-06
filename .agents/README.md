# Agent Workspace — Genesis 2025

This `.agents/` directory contains the AI agent's working knowledge of the project.

## Directory Structure

```
.agents/
├── README.md             ← You are here
├── docs/                 ← Project documentation (moved from docs/)
│   ├── 1_Project-Status.md
│   ├── 2_Features_shipped.md
│   ├── ...
│   ├── Complete_ProofOfWork.md
│   └── optimizations/
│       ├── MEMORY_ANALYSIS.md
│       ├── MULTI_USER_ANALYSIS.md
│       └── SESSION_ARCHITECTURE_IMPLEMENTATION.md
├── issues/               ← Bug tracking & audit reports
│   └── 001_critical_flaws_initial_audit.md
└── memory/               ← Agent learning & reflections
```

## Documentation Index

### Getting Started
1. [Project Status](docs/1_Project-Status.md) — Current development status
2. [Backend Setup](docs/3_Setup_Backend.md) — Complete backend installation guide
3. [C++ Engine Setup](docs/4_Cpp_Engine_Microservice_Setup.md) — High-performance analytics engine

### Features & Architecture
4. [Features Shipped](docs/2_Features_shipped.md) — Complete list of implemented features
5. [C++ Engine Integration](docs/5_Cpp_Engine_Integration.md) — Performance optimization
6. [Complete Proof of Work](docs/Complete_ProofOfWork.md) — Full project documentation

### Data & Live Mode
7. [Market Ingestor Setup](docs/6_Market_Ingestor_Microservice(Live%20Mode%20Integration).md) — Real-time Binance feeds
8. [Data Flow Troubleshooting](docs/7_Trobleshooting_Data_flow.md) — Common data issues
9. [gRPC Live Mode Fix](docs/8_Fix_live_mode_gRPC_protocol_bug.md) — Protocol bug fix

### ML & Reports
10. [Model Training Workflow](docs/9_ML_model_training_optimisations_info.md) — ML pipeline
11. [Report Systems](docs/10_report_systems.md) — CSV report generation
12. [Quick Start Reports](docs/11_quick_start_report_service.md) — Report service setup
13. [POW Details](docs/12_POW.md) — Additional proof of work

### Optimizations
14. [Multi-User Analysis](docs/optimizations/MULTI_USER_ANALYSIS.md)
15. [Session Architecture](docs/optimizations/SESSION_ARCHITECTURE_IMPLEMENTATION.md)
16. [Memory Analysis](docs/optimizations/MEMORY_ANALYSIS.md)

### Known Issues
17. [Critical Flaws Audit](issues/001_critical_flaws_initial_audit.md) — 10 issues found (2026-07-04)

## OpenCode Skills

The agent is equipped with 8 domain-specific skills:
- `project-context` — Architecture overview and key files map
- `backend-python` — FastAPI/gRPC/analytics conventions
- `frontend-react` — React/Canvas/WebSocket patterns
- `database-sql` — PostgreSQL + TimescaleDB schema
- `docker-devops` — Docker/AWS deployment
- `cpp-engine` — C++ gRPC analytics microservice
- `financial-systems` — Market microstructure domain knowledge
- `grpc-protobuf` — gRPC communication patterns
- `token-efficiency` — Minimize context waste

## Graphify Knowledge Graph

The project has a populated knowledge graph:
- `graphify-out/graph.json` — 979 nodes, 1393 edges, 114 communities
- `graphify-out/GRAPH_REPORT.md` — Architecture report with god nodes
- `graphify-out/graph.html` — Interactive visualization

Query with: `graphify query "question"`, `graphify path "A" "B"`, `graphify explain "concept"`
