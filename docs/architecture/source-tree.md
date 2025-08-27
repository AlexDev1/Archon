# Archon Project Structure

## Overview

This document provides a comprehensive guide to the Archon project structure, explaining the organization, patterns, and conventions used across the entire codebase. Archon follows a microservices architecture with clear separation of concerns between frontend, backend services, and supporting infrastructure.

## Root Directory Structure

```
Archon/
├── archon-ui-main/          # Frontend React application
├── python/                  # Backend services (API, MCP, Agents)
├── docs/                    # Documentation and guides
├── deploy/                  # Deployment configurations
├── migration/               # Database setup and migrations
├── PRPs/                    # Product Requirement Prompts
├── docker-compose.yml       # Service orchestration
├── CLAUDE.md               # Development workflow guide
├── CONTRIBUTING.md         # Contribution guidelines
└── README.md               # Project overview
```

## Frontend Architecture (`archon-ui-main/`)

The frontend follows a modern React 18 application structure with TypeScript, organized by feature domains and layered architecture.

### Directory Structure

```
archon-ui-main/
├── src/                     # Source code
│   ├── components/          # Reusable UI components
│   ├── pages/              # Top-level page components
│   ├── services/           # API communication layer
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React context providers
│   ├── types/              # TypeScript type definitions
│   ├── config/             # Configuration files
│   ├── lib/                # Utility libraries
│   ├── styles/             # Global CSS and animations
│   └── utils/              # Helper functions
├── public/                 # Static assets
├── test/                   # Test files and configurations
├── docs/                   # Frontend-specific documentation
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite build configuration
├── tailwind.config.js      # TailwindCSS configuration
└── tsconfig.json           # TypeScript configuration
```

### Component Organization

#### Feature-Based Component Structure

```
src/components/
├── animations/             # Framer Motion animation components
│   ├── Animations.tsx
│   └── DisconnectScreenAnimations.tsx
├── bug-report/            # Bug reporting functionality
│   ├── BugReportButton.tsx
│   ├── BugReportModal.tsx
│   └── ErrorBoundaryWithBugReport.tsx
├── knowledge-base/        # Knowledge management components
│   ├── CrawlingProgressCard.tsx
│   ├── EditKnowledgeItemModal.tsx
│   ├── KnowledgeItemCard.tsx
│   └── KnowledgeTable.tsx
├── project-tasks/         # Project and task management
│   ├── DataTab.tsx
│   ├── DocsTab.tsx
│   ├── TaskBoardView.tsx
│   ├── TaskTableView.tsx
│   ├── DraggableTaskCard.tsx
│   └── MilkdownEditor.tsx
├── settings/              # Configuration and settings
│   ├── APIKeysSection.tsx
│   ├── FeaturesSection.tsx
│   └── RAGSettings.tsx
├── layouts/               # Layout components
│   ├── MainLayout.tsx
│   ├── SideNavigation.tsx
│   └── ArchonChatPanel.tsx
├── mcp/                   # MCP integration components
│   ├── ClientCard.tsx
│   ├── MCPClients.tsx
│   └── ToolTestingPanel.tsx
└── ui/                    # Basic UI primitives
    ├── Button.tsx
    ├── Card.tsx
    ├── Input.tsx
    ├── Badge.tsx
    └── ThemeToggle.tsx
```

#### Component Naming Conventions

- **Components**: PascalCase with descriptive names
  - `KnowledgeItemCard.tsx` - Specific functionality
  - `DraggableTaskCard.tsx` - Behavior included in name
  - `EditKnowledgeItemModal.tsx` - Action + Entity + Type

- **Hooks**: camelCase starting with "use"
  - `useSocketSubscription.ts` - WebSocket management
  - `useOptimisticUpdates.ts` - UI state optimization
  - `useTaskSocket.ts` - Task-specific socket handling

- **Services**: camelCase with "Service" suffix
  - `knowledgeBaseService.ts` - Knowledge operations
  - `projectService.ts` - Project management
  - `socketIOService.ts` - WebSocket communication

#### Page Organization

```
src/pages/
├── KnowledgeBasePage.tsx   # Knowledge management interface
├── ProjectPage.tsx         # Project and task management
├── SettingsPage.tsx        # System configuration
├── MCPPage.tsx            # MCP integration tools
└── OnboardingPage.tsx     # User setup flow
```

#### Context and State Management

```
src/contexts/
├── SettingsContext.tsx     # Global application settings
├── ThemeContext.tsx        # UI theme management
└── ToastContext.tsx        # Notification system
```

#### Service Layer Architecture

```
src/services/
├── api.ts                  # Core API client configuration
├── knowledgeBaseService.ts # Knowledge CRUD operations
├── projectService.ts      # Project management API
├── mcpService.ts          # MCP protocol communication
├── socketIOService.ts     # Real-time WebSocket handling
├── credentialsService.ts  # API key management
└── testService.ts         # Testing and validation
```

### Testing Structure

```
test/
├── components/            # Component tests
│   ├── project-tasks/
│   │   ├── DocsTab.integration.test.tsx
│   │   └── MilkdownEditor.test.tsx
│   └── prp/
│       └── PRPViewer.test.tsx
├── services/             # Service layer tests
│   └── projectService.test.ts
├── pages.test.tsx        # Page-level integration tests
├── errors.test.tsx       # Error handling tests
├── user_flows.test.tsx   # End-to-end user scenarios
└── setup.ts             # Test configuration
```

## Backend Architecture (`python/`)

The backend is organized into three distinct microservices, each with its own specialized purpose and dependencies.

### Directory Structure

```
python/
├── src/                    # Source code for all services
│   ├── server/            # Main API server (port 8181)
│   ├── mcp_server/        # MCP protocol server (port 8051)
│   ├── agents/            # AI agents service (port 8052)
│   └── shared/            # Shared utilities (minimal)
├── tests/                 # Test suites for all services
├── Dockerfile.server      # Main server container
├── Dockerfile.mcp         # MCP server container
├── Dockerfile.agents      # Agents service container
├── pyproject.toml         # Project configuration and dependencies
└── requirements.*.txt     # Service-specific requirements
```

### Main Server Service (`src/server/`)

```
src/server/
├── main.py                # Application entry point
├── socketio_app.py        # Socket.IO server configuration
├── api_routes/            # HTTP API endpoints
│   ├── knowledge_api.py   # Knowledge management endpoints
│   ├── projects_api.py    # Project CRUD operations
│   ├── mcp_api.py         # MCP integration endpoints
│   ├── settings_api.py    # Configuration management
│   ├── socketio_handlers.py # WebSocket event handlers
│   └── socketio_broadcasts.py # Real-time update broadcasts
├── services/              # Business logic layer
│   ├── crawling/          # Web crawling operations
│   │   ├── crawling_service.py
│   │   ├── code_extraction_service.py
│   │   ├── strategies/    # Crawling strategies
│   │   │   ├── single_page.py
│   │   │   ├── recursive.py
│   │   │   ├── sitemap.py
│   │   │   └── batch.py
│   │   └── helpers/       # Crawling utilities
│   ├── embeddings/        # AI embedding operations
│   │   ├── embedding_service.py
│   │   └── contextual_embedding_service.py
│   ├── search/            # RAG and search functionality
│   │   ├── rag_service.py
│   │   ├── hybrid_search_strategy.py
│   │   ├── agentic_rag_strategy.py
│   │   └── reranking_strategy.py
│   ├── projects/          # Project management services
│   │   ├── project_service.py
│   │   ├── task_service.py
│   │   ├── document_service.py
│   │   └── versioning_service.py
│   ├── knowledge/         # Knowledge base operations
│   └── storage/           # Data persistence layer
├── config/                # Configuration management
│   ├── config.py          # Application settings
│   └── service_discovery.py # Inter-service communication
├── middleware/            # Request/response middleware
└── utils/                 # Server utilities
```

### MCP Server Service (`src/mcp_server/`)

```
src/mcp_server/
├── mcp_server.py          # MCP protocol server
├── features/              # MCP tool implementations
│   ├── projects/          # Project management tools
│   │   └── project_tools.py
│   ├── tasks/             # Task management tools
│   │   └── task_tools.py
│   ├── documents/         # Document management tools
│   │   ├── document_tools.py
│   │   └── version_tools.py
│   └── feature_tools.py   # Feature management tools
├── modules/               # Shared MCP modules
│   ├── models.py          # Data models
│   └── rag_module.py      # RAG integration
└── utils/                 # MCP utilities
    ├── http_client.py     # HTTP service communication
    ├── error_handling.py  # Error management
    └── timeout_config.py  # Request timeout handling
```

### Agents Service (`src/agents/`)

```
src/agents/
├── server.py              # Agents service entry point
├── base_agent.py          # Base agent functionality
├── document_agent.py      # Document processing agents
├── rag_agent.py           # RAG-specific agents
└── mcp_client.py          # MCP client for agent communication
```

### Service Communication Patterns

#### HTTP-Only Communication

Each service communicates via HTTP APIs with standardized patterns:

```python
# Service URL configuration
API_SERVICE_URL = "http://archon-server:8181"
AGENTS_SERVICE_URL = "http://archon-agents:8052"

# Standard service client pattern
class ServiceClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def post(self, endpoint: str, data: dict) -> dict:
        response = await self.client.post(f"{self.base_url}{endpoint}", json=data)
        return response.json()
```

#### API Route Organization

```python
# Standard API route structure
@router.post("/api/knowledge/search")
async def search_knowledge(request: SearchRequest) -> SearchResponse:
    # Business logic delegation to service layer
    return await knowledge_service.search(request)

# Socket.IO event pattern
@sio.event
async def join_room(sid: str, data: dict):
    room = data.get('room')
    await sio.enter_room(sid, room)
    await sio.emit('joined_room', {'room': room}, room=sid)
```

### Testing Architecture

```
tests/
├── mcp_server/           # MCP-specific tests
│   ├── features/         # Tool implementation tests
│   └── utils/            # MCP utility tests
├── test_api_essentials.py # Core API functionality
├── test_service_integration.py # Inter-service communication
├── test_rag_strategies.py # RAG implementation tests
├── test_embedding_service.py # Embedding functionality
└── conftest.py           # Test configuration and fixtures
```

## File Naming Conventions

### Python Backend

**Service Files:**
- `*_service.py` - Business logic services
- `*_api.py` - HTTP API route handlers
- `*_tools.py` - MCP tool implementations
- `*_strategy.py` - Strategy pattern implementations

**Configuration and Utilities:**
- `config.py` - Configuration modules
- `*_client.py` - External service clients
- `*_manager.py` - Resource management classes

**Test Files:**
- `test_*.py` - Unit and integration tests
- `*_test.py` - Alternative test naming
- `conftest.py` - Pytest configuration

### TypeScript Frontend

**Component Files:**
- `ComponentName.tsx` - React components
- `ComponentName.test.tsx` - Component tests
- `useHookName.ts` - Custom React hooks

**Service and Configuration:**
- `serviceName.ts` - Service implementations
- `config.ts` - Configuration modules
- `utils.ts` - Utility functions

**Type Definitions:**
- `types.ts` - TypeScript interfaces and types
- `*.types.ts` - Domain-specific types

## Code Organization Patterns

### Layered Architecture

#### Frontend Layers
1. **Pages Layer**: Top-level routing and page orchestration
2. **Components Layer**: Reusable UI components and feature modules
3. **Services Layer**: API communication and external integrations
4. **Utilities Layer**: Helper functions and shared logic

#### Backend Layers
1. **API Layer**: HTTP endpoints and Socket.IO handlers
2. **Service Layer**: Business logic and domain operations
3. **Storage Layer**: Database operations and data persistence
4. **Integration Layer**: External service communication

### Domain-Driven Organization

#### Frontend Domains
- **Knowledge Management**: Crawling, search, document management
- **Project Management**: Projects, tasks, versioning
- **System Configuration**: Settings, API keys, feature toggles
- **Real-time Communication**: Socket.IO, live updates

#### Backend Domains
- **Knowledge Domain**: RAG, embeddings, search strategies
- **Crawling Domain**: Web scraping, content extraction
- **Project Domain**: Project lifecycle, task management
- **Integration Domain**: MCP protocol, agent communication

### Dependency Injection Patterns

#### Python Service Layer

```python
# Dependency injection via constructor
class ProjectService:
    def __init__(
        self,
        db_client: DatabaseClient,
        embedding_service: EmbeddingService,
        logger: Logger
    ):
        self.db = db_client
        self.embeddings = embedding_service
        self.logger = logger

# Service registration in main application
async def create_app() -> FastAPI:
    app = FastAPI()
    
    # Service dependencies
    db_client = await create_db_client()
    embedding_service = EmbeddingService(db_client)
    project_service = ProjectService(db_client, embedding_service, logger)
    
    # Route registration with dependency injection
    app.include_router(projects_router(project_service))
    return app
```

#### React Service Layer

```typescript
// Service composition pattern
class APIService {
  constructor(
    private httpClient: HttpClient,
    private socketClient: SocketIOClient
  ) {}
  
  async searchKnowledge(query: string): Promise<SearchResults> {
    return this.httpClient.post('/api/knowledge/search', { query });
  }
}

// React context for service injection
export const ServiceContext = createContext<APIService | null>(null);

export const useServices = () => {
  const services = useContext(ServiceContext);
  if (!services) throw new Error('Services not initialized');
  return services;
};
```

## Configuration Management

### Environment-Based Configuration

**Development Configuration:**
```bash
# Docker Compose development setup
ARCHON_SERVER_PORT=8181
ARCHON_MCP_PORT=8051  
ARCHON_AGENTS_PORT=8052
ARCHON_UI_PORT=3737
SERVICE_DISCOVERY_MODE=docker_compose
```

**Service Discovery Pattern:**
```python
# Service URL resolution
def get_service_url(service_name: str, port: int) -> str:
    if os.getenv('SERVICE_DISCOVERY_MODE') == 'docker_compose':
        return f"http://{service_name}:{port}"
    else:
        return f"http://localhost:{port}"
```

### Database-Driven Configuration

**Runtime Settings Management:**
```python
# Settings stored in archon_settings table
class SettingsService:
    async def get_feature_flag(self, flag_name: str) -> bool:
        setting = await self.db.fetch_one(
            "SELECT value FROM archon_settings WHERE key = $1",
            f"feature_{flag_name}"
        )
        return setting['value'] if setting else False
```

## Documentation Structure

### Inline Documentation

**Python Docstring Standards:**
```python
class KnowledgeService:
    """Service for managing knowledge base operations.
    
    Handles document storage, retrieval, and search operations
    with support for vector similarity and full-text search.
    
    Attributes:
        db_client: Database connection for persistence
        embedding_service: AI embedding generation
    """
    
    async def search(self, query: str, limit: int = 10) -> List[Document]:
        """Search knowledge base with hybrid search strategy.
        
        Args:
            query: Search query string
            limit: Maximum results to return
            
        Returns:
            List of matching documents with similarity scores
            
        Raises:
            SearchError: If search operation fails
        """
        pass
```

**TypeScript Documentation Standards:**
```typescript
/**
 * Service for managing project-related API operations
 * 
 * Provides CRUD operations for projects, tasks, and documents
 * with real-time updates via Socket.IO integration.
 */
export class ProjectService {
  /**
   * Create a new project with initial configuration
   * 
   * @param projectData - Project creation parameters
   * @returns Promise resolving to created project
   * @throws {APIError} When project creation fails
   */
  async createProject(projectData: CreateProjectRequest): Promise<Project> {
    // Implementation
  }
}
```

This project structure provides a solid foundation for maintaining and scaling the Archon application while ensuring clear separation of concerns, consistent naming conventions, and efficient development workflows.