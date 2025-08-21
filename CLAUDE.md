# CLAUDE.md
# IMPORTANT: you must always answer in Russian!
This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Alpha Development Guidelines

**Local-only deployment** - each user runs their own instance.

### Core Principles

- **No backwards compatibility** - remove deprecated code immediately
- **Detailed errors over graceful failures** - we want to identify and fix issues fast
- **Break things to improve them** - alpha is for rapid iteration

### Error Handling

**Core Principle**: In alpha, we need to intelligently decide when to fail hard and fast to quickly address issues, and when to allow processes to complete in critical services despite failures. Read below carefully and make intelligent decisions on a case-by-case basis.

#### When to Fail Fast and Loud (Let it Crash!)

These errors should stop execution and bubble up immediately:

- **Service startup failures** - If credentials, database, or any service can't initialize, the system should crash with a clear error
- **Missing configuration** - Missing environment variables or invalid settings should stop the system
- **Database connection failures** - Don't hide connection issues, expose them
- **Authentication/authorization failures** - Security errors must be visible and halt the operation
- **Data corruption or validation errors** - Never silently accept bad data, Pydantic should raise
- **Critical dependencies unavailable** - If a required service is down, fail immediately
- **Invalid data that would corrupt state** - Never store zero embeddings, null foreign keys, or malformed JSON

#### When to Complete but Log Detailed Errors

These operations should continue but track and report failures clearly:

- **Batch processing** - When crawling websites or processing documents, complete what you can and report detailed failures for each item
- **Background tasks** - Embedding generation, async jobs should finish the queue but log failures
- **WebSocket events** - Don't crash on a single event failure, log it and continue serving other clients
- **Optional features** - If projects/tasks are disabled, log and skip rather than crash
- **External API calls** - Retry with exponential backoff, then fail with a clear message about what service failed and why

#### Critical Nuance: Never Accept Corrupted Data

When a process should continue despite failures, it must **skip the failed item entirely** rather than storing corrupted data:

**❌ WRONG - Silent Corruption:**

```python
try:
    embedding = create_embedding(text)
except Exception as e:
    embedding = [0.0] * 1536  # NEVER DO THIS - corrupts database
    store_document(doc, embedding)
```

**✅ CORRECT - Skip Failed Items:**

```python
try:
    embedding = create_embedding(text)
    store_document(doc, embedding)  # Only store on success
except Exception as e:
    failed_items.append({'doc': doc, 'error': str(e)})
    logger.error(f"Skipping document {doc.id}: {e}")
    # Continue with next document, don't store anything
```

**✅ CORRECT - Batch Processing with Failure Tracking:**

```python
def process_batch(items):
    results = {'succeeded': [], 'failed': []}

    for item in items:
        try:
            result = process_item(item)
            results['succeeded'].append(result)
        except Exception as e:
            results['failed'].append({
                'item': item,
                'error': str(e),
                'traceback': traceback.format_exc()
            })
            logger.error(f"Failed to process {item.id}: {e}")

    # Always return both successes and failures
    return results
```

#### Error Message Guidelines

- Include context about what was being attempted when the error occurred
- Preserve full stack traces with `exc_info=True` in Python logging
- Use specific exception types, not generic Exception catching
- Include relevant IDs, URLs, or data that helps debug the issue
- Never return None/null to indicate failure - raise an exception with details
- For batch operations, always report both success count and detailed failure list

### Code Quality

- Remove dead code immediately rather than maintaining it - no backward compatibility or legacy functions
- Prioritize functionality over production-ready patterns
- Focus on user experience and feature completeness
- When updating code, don't reference what is changing (avoid keywords like LEGACY, CHANGED, REMOVED), instead focus on comments that document just the functionality of the code

## Architecture Overview

Archon V2 Alpha is a microservices-based knowledge management system with MCP (Model Context Protocol) integration:

- **Frontend (port 3737)**: React + TypeScript + Vite + TailwindCSS
- **Main Server (port 8181)**: FastAPI + Socket.IO for real-time updates
- **MCP Server (port 8051)**: Lightweight HTTP-based MCP protocol server
- **Agents Service (port 8052)**: PydanticAI agents for AI/ML operations
- **Database**: Supabase (PostgreSQL + pgvector for embeddings)

## Development Commands

### Frontend (archon-ui-main/)

```bash
npm run dev              # Start development server on port 3737
npm run build            # Build for production
npm run lint             # Run ESLint
npm run test             # Run Vitest tests
npm run test:coverage    # Run tests with coverage report
```

### Backend (python/)

```bash
# Using uv package manager (modern, fast Python package manager)
uv sync                            # Install/update all dependencies
uv sync --group dev                # Install dev dependencies only
uv run pytest                     # Run all tests
uv run pytest tests/test_api_essentials.py -v  # Run specific test file
uv run pytest --cov=src --cov-report=html      # Run tests with coverage
uv run ruff check                  # Lint code
uv run mypy src/                   # Type checking
uv run python -m src.server.main  # Run server locally

# With Docker
docker-compose up --build -d       # Start all services
docker-compose logs -f archon-server  # View specific service logs
docker-compose restart archon-mcp     # Restart specific service
docker-compose down && docker-compose up --build -d  # Full rebuild
```

### Testing & Code Quality

```bash
# Frontend tests (from archon-ui-main/)
npm run test                       # Run all Vitest tests
npm run test:coverage              # Run with coverage report
npm run test:coverage:stream       # Run with streaming output
npm run test:ui                    # Run with Vitest UI
npm run lint                       # ESLint checking

# Backend tests (from python/)
uv run pytest                     # Run all tests
uv run pytest tests/test_api_essentials.py -v     # API core functionality
uv run pytest tests/test_service_integration.py -v # Service integration
uv run pytest tests/test_mcp_tools.py -v          # MCP tool functionality
uv run pytest --cov=src --cov-report=html         # Coverage report
uv run ruff check                  # Linting (replaces flake8, isort, etc.)
uv run ruff format                 # Code formatting
uv run mypy src/                   # Type checking

# Service-specific testing
docker-compose exec archon-server pytest tests/  # Test inside container
```

## Key API Endpoints

### Knowledge Base

- `POST /api/knowledge/crawl` - Crawl a website
- `POST /api/knowledge/upload` - Upload documents (PDF, DOCX, MD)
- `GET /api/knowledge/items` - List knowledge items
- `POST /api/knowledge/search` - RAG search

### MCP Integration

- `GET /api/mcp/health` - MCP server status
- `POST /api/mcp/tools/{tool_name}` - Execute MCP tool
- `GET /api/mcp/tools` - List available tools

### Projects & Tasks (when enabled)

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/{id}` - Get single project
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `GET /api/projects/{id}/tasks` - Get tasks for project (use this, not getTasks)
- `POST /api/tasks` - Create task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task

## Polling Architecture

### HTTP Polling (replaced Socket.IO)
- **Polling intervals**: 1-2s for active operations, 5-10s for background data
- **ETag caching**: Reduces bandwidth by ~70% via 304 Not Modified responses
- **Smart pausing**: Stops polling when browser tab is inactive
- **Progress endpoints**: `/api/progress/crawl`, `/api/progress/project-creation`

### Key Polling Hooks
- `usePolling` - Generic polling with ETag support
- `useDatabaseMutation` - Optimistic updates with rollback
- `useProjectMutation` - Project-specific operations

## Environment Variables

Required in `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
```

Optional:

```bash
OPENAI_API_KEY=your-openai-key        # Can be set via UI
LOGFIRE_TOKEN=your-logfire-token      # For observability
LOG_LEVEL=INFO                         # DEBUG, INFO, WARNING, ERROR
```

## File Organization

### Frontend Architecture (archon-ui-main/)

- `src/components/` - Reusable UI components with Framer Motion animations
- `src/pages/` - Main application pages with Socket.IO integration
- `src/services/` - API communication and Socket.IO client setup
- `src/hooks/` - Custom React hooks (useSocketSubscription, useOptimisticUpdates, etc.)
- `src/contexts/` - React context providers (Settings, Theme, Toast contexts)
- `src/types/` - TypeScript definitions for API responses and data models

### Backend Architecture (python/)

- `src/server/` - Main FastAPI application with Socket.IO server
- `src/server/api_routes/` - API route handlers organized by feature
- `src/server/services/` - Business logic services (crawling, knowledge, projects)
- `src/mcp/` - HTTP-based MCP server implementation (14+ tools)
- `src/agents/` - PydanticAI agent implementations for AI/ML operations
- `src/database/` - Database models, migrations, and utility functions
- `src/shared/` - Shared utilities and configurations across services

## Database Schema

Key tables in Supabase with pgvector and RLS policies:

- `sources` - Crawled websites and uploaded documents with metadata
- `documents` - Processed document chunks with pgvector embeddings for RAG
- `code_examples` - Extracted code snippets with contextual embeddings
- `projects` - Project management (optional feature controlled by archon_settings)
- `tasks` - Task tracking linked to projects with status management
- `archon_settings` - Runtime configuration (feature toggles, API keys, etc.)

### Key Database Patterns
- **pgvector Integration**: Hybrid search combining full-text and vector similarity
- **Row Level Security (RLS)**: Multi-tenant security policies
- **Contextual Embeddings**: Enhanced embeddings with document context for improved RAG
- **Configuration Storage**: Database-driven settings with encryption for sensitive data
## API Naming Conventions

### Task Status Values
Use database values directly (no UI mapping):
- `todo`, `doing`, `review`, `done`

### Service Method Patterns
- `get[Resource]sByProject(projectId)` - Scoped queries
- `get[Resource](id)` - Single resource
- `create[Resource](data)` - Create operations
- `update[Resource](id, updates)` - Updates
- `delete[Resource](id)` - Soft deletes

### State Naming
- `is[Action]ing` - Loading states (e.g., `isSwitchingProject`)
- `[resource]Error` - Error messages
- `selected[Resource]` - Current selection

## Common Development Tasks

## Service Communication Patterns

### HTTP-Based Architecture
- **No Shared Dependencies**: Each service maintains independent codebases
- **Service URLs**: Environment-based service discovery via Docker Compose networking
- **Health Checks**: All services expose `/health` endpoints for monitoring
- **Error Propagation**: HTTP status codes and structured error responses across services

### MCP Integration Details
- **HTTP Protocol**: Uses HTTP transport instead of stdio for MCP communication
- **Tool Categories**: Knowledge management, project management, code search, task management
- **Service Delegation**: MCP server delegates tool execution to appropriate backend services
- **Real-time Updates**: MCP operations trigger Socket.IO events for UI updates

## Development Workflow Patterns

### Container Development Strategy
- **Volume Mounts**: Source code mounted for hot reload in development
- **Service Isolation**: Each service runs in dedicated container with health monitoring
- **Network Communication**: All inter-service communication via Docker bridge network
- **Independent Scaling**: Services can be restarted or scaled independently

### Configuration Management
- **Environment Variables**: Docker Compose `.env` file for deployment settings
- **Database Settings**: Runtime configuration stored in `archon_settings` table
- **Feature Toggles**: Projects/tasks features controlled via database flags
- **Credential Management**: Encrypted storage for API keys and sensitive data

## Code Quality Standards

Automated code quality enforcement across all services:

### Python Backend
- **Python 3.12** with 120 character line length
- **Ruff** for linting (replaces flake8, isort, black) - comprehensive code analysis
- **Mypy** for static type checking with strict configuration
- **uv Package Manager** for fast, reliable dependency management
- **Async Patterns** - extensive use of asyncio for I/O operations

### TypeScript Frontend  
- **TypeScript 5+** with strict configuration
- **ESLint** with custom rules for React and accessibility
- **Vitest** for testing with coverage requirements
- **TailwindCSS** for consistent styling patterns

### Quality Gates
- Run `uv run ruff check && uv run mypy src/` before committing Python code
- Run `npm run lint && npm run test` before committing frontend code
- Docker builds include linting and type checking steps

## MCP Tools Available

When connected to Cursor/Windsurf:

- `archon:perform_rag_query` - Search knowledge base
- `archon:search_code_examples` - Find code snippets
- `archon:manage_project` - Project operations
- `archon:manage_task` - Task management
- `archon:get_available_sources` - List knowledge sources

## Important Notes

- Projects feature is optional - toggle in Settings UI
- All services communicate via HTTP, not gRPC
- HTTP polling handles all updates (Socket.IO removed)
- Frontend uses Vite proxy for API calls in development
- Python backend uses `uv` for dependency management
- Docker Compose handles service orchestration
