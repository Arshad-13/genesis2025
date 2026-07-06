## Genesis 2025 — HFT Market Surveillance Platform

**Stack**: Python FastAPI + C++ gRPC + React 18 + PostgreSQL/TimescaleDB + Binance WebSocket

### Quick Reference
- Architecture docs: `.agents/docs/`
- Known issues: `.agents/issues/001_critical_flaws_initial_audit.md`
- Knowledge graph: `graphify-out/graph.json` (979 nodes, 1393 edges, 114 communities)
- Project memory: `.agents/memory/`

### Critical Rules (ALWAYS FOLLOW)
1. **Never commit `.env`** — secrets stay in env vars only
2. **No tokens in localStorage** — use httpOnly cookies for auth
3. **Lock `data_buffer`** — concurrent access needs `asyncio.Lock`
4. **All endpoints need auth** — except `/auth/login`, `/auth/register`, `/health`
5. **Query graph first** — `graphify query "..."` before reading files

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
