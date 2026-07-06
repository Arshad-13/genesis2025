# Token Efficiency Skill — Minimize Context Waste

You are operating with a **limited token budget**. Every token counts. Follow these rules strictly to avoid wasting context on repeated work.

## Core Principles

### 1. Use the Knowledge Graph First
This project has a populated knowledge graph at `graphify-out/`. Before reading any file:
```
graphify query "what handles X?" --graph graphify-out/graph.json
graphify path "ComponentA" "ComponentB" --graph graphify-out/graph.json
graphify explain "ClassNameOrConcept" --graph graphify-out/graph.json
```
These return **scoped, relevant subgraphs** (10-50 nodes) instead of full-file reads. Only read source files when the graph query is insufficient.

### 2. Read Only What You Need
- Use `offset`/`limit` to read specific sections of large files (not the entire 1800-line `main.py`)
- Use `grep` pattern search to find the exact location before reading
- Read 50-100 lines around the target, not the entire file

### 3. Batch Parallel Operations
- Multiple independent `grep` searches → single message with multiple calls
- Multiple file reads → concurrent `read` calls
- Multiple bash commands → single message with parallel `bash` calls

### 4. Don't Re-Read Known Information
If you already read a file earlier in the session, refer back to that content. Don't re-read.
If the project skill files (`project-context/SKILL.md`) contain the answer, use that.

### 5. Use Targeted Tools Over Broad Ones
| Instead of | Use |
|---|---|
| `read main.py` (1800 lines) | `read main.py offset=400 limit=100` |
| `grep` for a class name in all files | `graphify query "ClassName"` |
| Reading entire test files | `grep` for specific test patterns |
| Searching docs manually | `graphify query "how does X work?"` |
| Reading every file in a directory | `graphify query "key abstractions"` |

### 6. Project-Specific Shortcuts
- **Auth questions** → read `backend/routers/auth.py` (121 lines) or `backend/utils/security.py` (64 lines) — they're small
- **Analytics questions** → `graphify query "..."` first, then read `backend/analytics_core.py` section by `offset`
- **Session questions** → `backend/session_replay.py` is only 168 lines — safe to read fully
- **Strategy questions** → `backend/strategy_service.py` is 157 lines — safe to read fully
- **Deployment questions** → check `backend/docker-compose.yml` first
- **Frontend questions** → check component files directly (they're short)

### 7. Summary Files Available
| File | Content | Use When |
|---|---|---|
| `README.md` | Project overview | Quick reference on features, stack |
| `AGENTS.md` | Agent instructions | Contains graphify usage rules |
| `graphify-out/GRAPH_REPORT.md` | Full architecture report | Broad architecture questions |
| `.agents/issues/*.md` | Known issues | Checking if a bug is already documented |
| `.agents/docs/*.md` | Project documentation | Setup, features, troubleshooting |
| `.opencode/skills/*/SKILL.md` | Domain knowledge | Context on specific technologies |

### 8. Minimum Output Principle
- Answer in 1-3 lines when possible
- No explanations unless asked
- No code comments unless asked
- No summaries after edits
- Code speaks for itself — write clean, obvious code

### 9. When Writing Code
- Don't add comments to generated/edited code unless asked
- Follow existing patterns — no need to re-explain the pattern
- Use existing utilities and imports — no need to re-import
- One edit per conceptual change — batch edits in a single `edit` call when possible
