# Archon Coding Standards

## Overview

This document establishes comprehensive coding standards for the Archon project, ensuring consistency, maintainability, and quality across all codebases. These standards support the microservices architecture while maintaining developer productivity and system reliability.

## Universal Principles

### Core Development Philosophy

1. **Type Safety First**: Strict typing in both Python and TypeScript
2. **Fail Fast in Development**: Immediate feedback for faster iteration
3. **Async-First Architecture**: Non-blocking I/O throughout the system
4. **HTTP-Only Communication**: Clean service boundaries without shared dependencies
5. **Test-Driven Quality**: Comprehensive testing at all layers

### Alpha Development Guidelines

#### When to Fail Fast and Loud

**Service startup failures** - Crash with clear errors if:
- Database connections fail
- Required environment variables are missing
- Service dependencies are unavailable
- Configuration is invalid

```python
# ✅ CORRECT - Fail fast on startup
async def startup_event():
    try:
        await database.connect()
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        raise SystemExit(1)  # Crash the service
```

#### When to Continue with Detailed Logging

**Batch processing operations** - Continue but track failures:
- Web crawling with individual page failures
- Document processing with individual document errors
- Background task processing

```python
# ✅ CORRECT - Continue processing, log failures
async def process_documents(documents: List[Document]) -> ProcessingResult:
    results = {"succeeded": [], "failed": []}
    
    for doc in documents:
        try:
            processed = await process_document(doc)
            results["succeeded"].append(processed)
        except Exception as e:
            results["failed"].append({
                "document_id": doc.id,
                "error": str(e),
                "traceback": traceback.format_exc()
            })
            logger.error(f"Failed to process document {doc.id}: {e}")
    
    return ProcessingResult(**results)
```

#### Never Accept Corrupted Data

**Critical Rule**: Skip failed items entirely rather than storing corrupted data:

```python
# ❌ WRONG - Silent corruption
try:
    embedding = create_embedding(text)
except Exception:
    embedding = [0.0] * 1536  # NEVER DO THIS
    
# ✅ CORRECT - Skip entirely on failure
try:
    embedding = create_embedding(text)
    await store_document(doc, embedding)
except Exception as e:
    failed_items.append({"doc_id": doc.id, "error": str(e)})
    continue  # Skip this item completely
```

## Python Backend Standards

### Code Quality Tools

#### Ruff Configuration (Primary Linter)

**pyproject.toml Configuration:**
```toml
[tool.ruff]
line-length = 120
target-version = "py312"

[tool.ruff.lint]
select = [
    "E",    # pycodestyle errors
    "W",    # pycodestyle warnings  
    "F",    # pyflakes
    "I",    # isort
    "B",    # flake8-bugbear
    "C4",   # flake8-comprehensions
    "UP",   # pyupgrade
]
ignore = [
    "E501", # line too long (handled by line-length)
    "B008", # function calls in argument defaults
    "C901", # too complex
]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

**Usage Commands:**
```bash
uv run ruff check                    # Lint code
uv run ruff check --fix              # Auto-fix issues
uv run ruff format                   # Format code
```

#### Mypy Configuration (Type Checking)

**pyproject.toml Configuration:**
```toml
[tool.mypy]
python_version = "3.12"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = false       # Gradual typing
disallow_any_unimported = false
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_ignores = true
check_untyped_defs = true
ignore_missing_imports = true       # Third-party libraries
```

**Usage Commands:**
```bash
uv run mypy src/                     # Type check source
uv run mypy src/server/              # Check specific module
```

#### UV Package Manager

**Project Setup:**
```bash
uv sync                              # Install all dependencies
uv sync --group dev                  # Install dev dependencies only
uv add package-name                  # Add new dependency
uv add --group dev package-name      # Add dev dependency
```

**Dependency Management:**
```toml
# pyproject.toml
[project]
dependencies = [
    "fastapi>=0.104.0",
    "pydantic>=2.0.0",
]

[project.optional-dependencies]
test = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.21.0",
]

[dependency-groups]
dev = [
    "mypy>=1.17.0",
    "ruff>=0.12.5",
]
```

### Python Coding Patterns

#### Async/Await Standards

**Service Layer Pattern:**
```python
class KnowledgeService:
    def __init__(self, db_client: DatabaseClient, embedding_service: EmbeddingService):
        self.db = db_client
        self.embeddings = embedding_service
    
    async def search_documents(
        self, 
        query: str, 
        limit: int = 10
    ) -> List[SearchResult]:
        """Search documents with hybrid strategy."""
        # Concurrent operations where possible
        embeddings_task = asyncio.create_task(
            self.embeddings.create_embedding(query)
        )
        
        # Full-text search while embedding is generated
        text_results = await self.db.full_text_search(query, limit)
        
        # Wait for embedding and perform vector search
        query_embedding = await embeddings_task
        vector_results = await self.db.vector_search(query_embedding, limit)
        
        # Combine and rerank results
        return await self._rerank_results(text_results, vector_results)
```

#### Error Handling Patterns

**Service-Level Error Handling:**
```python
from typing import Union, List
from pydantic import BaseModel

class ServiceError(Exception):
    """Base service error with context."""
    def __init__(self, message: str, context: dict = None):
        self.message = message
        self.context = context or {}
        super().__init__(message)

class CrawlingService:
    async def crawl_website(self, url: str) -> CrawlingResult:
        """Crawl website with detailed error tracking."""
        try:
            pages = await self._discover_pages(url)
            results = {"succeeded": [], "failed": []}
            
            for page_url in pages:
                try:
                    content = await self._crawl_page(page_url)
                    results["succeeded"].append(content)
                except Exception as e:
                    results["failed"].append({
                        "url": page_url,
                        "error": str(e),
                        "error_type": type(e).__name__,
                        "timestamp": datetime.utcnow()
                    })
                    logger.error(f"Failed to crawl {page_url}: {e}")
            
            return CrawlingResult(**results)
            
        except Exception as e:
            raise ServiceError(
                f"Website crawling failed for {url}",
                context={"url": url, "original_error": str(e)}
            )
```

#### Database Integration Patterns

**Async Database Operations:**
```python
from contextlib import asynccontextmanager
from asyncpg import Connection

class DatabaseService:
    def __init__(self, connection_pool):
        self.pool = connection_pool
    
    @asynccontextmanager
    async def transaction(self):
        """Database transaction context manager."""
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                yield conn
    
    async def store_documents_batch(
        self, 
        documents: List[Document]
    ) -> BatchResult:
        """Store multiple documents in transaction."""
        async with self.transaction() as conn:
            results = {"stored": [], "failed": []}
            
            for doc in documents:
                try:
                    await conn.execute(
                        "INSERT INTO documents (id, content, embedding) VALUES ($1, $2, $3)",
                        doc.id, doc.content, doc.embedding
                    )
                    results["stored"].append(doc.id)
                except Exception as e:
                    results["failed"].append({"doc_id": doc.id, "error": str(e)})
                    logger.error(f"Failed to store document {doc.id}: {e}")
            
            return BatchResult(**results)
```

#### Pydantic Model Standards

**Data Model Definition:**
```python
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime

class CreateProjectRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    github_repo: Optional[str] = Field(None, regex=r"^https://github\.com/.+/.+$")
    
    @validator("title")
    def validate_title(cls, v):
        if not v.strip():
            raise ValueError("Title cannot be empty or whitespace only")
        return v.strip()

class Project(BaseModel):
    id: str
    title: str
    description: str
    github_repo: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
```

### Testing Standards

#### Pytest Configuration

**pytest.ini:**
```ini
[tool:pytest]
testpaths = tests
python_files = test_*.py *_test.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
timeout = 30
```

#### Test Structure Patterns

**Service Test Pattern:**
```python
import pytest
from unittest.mock import AsyncMock, patch
from your_service import KnowledgeService

class TestKnowledgeService:
    @pytest.fixture
    async def service(self):
        """Create service with mocked dependencies."""
        db_client = AsyncMock()
        embedding_service = AsyncMock()
        return KnowledgeService(db_client, embedding_service)
    
    @pytest.mark.asyncio
    async def test_search_documents_success(self, service):
        """Test successful document search."""
        # Arrange
        service.embeddings.create_embedding.return_value = [0.1, 0.2, 0.3]
        service.db.vector_search.return_value = [{"id": "1", "score": 0.8}]
        
        # Act
        results = await service.search_documents("test query")
        
        # Assert
        assert len(results) > 0
        service.embeddings.create_embedding.assert_called_once_with("test query")
    
    @pytest.mark.asyncio
    async def test_search_documents_embedding_failure(self, service):
        """Test handling of embedding service failure."""
        # Arrange
        service.embeddings.create_embedding.side_effect = Exception("API Error")
        
        # Act & Assert
        with pytest.raises(ServiceError) as exc_info:
            await service.search_documents("test query")
        
        assert "embedding failed" in str(exc_info.value).lower()
```

#### Integration Test Patterns

**API Integration Tests:**
```python
import pytest
from fastapi.testclient import TestClient
from your_app import app

@pytest.fixture
def client():
    return TestClient(app)

def test_knowledge_search_endpoint(client):
    """Test knowledge search API endpoint."""
    response = client.post(
        "/api/knowledge/search",
        json={"query": "test", "limit": 10}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert isinstance(data["results"], list)
```

## TypeScript Frontend Standards

### ESLint Configuration

**.eslintrc.js:**
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    // Strict type rules
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    
    // React-specific rules
    'react-hooks/exhaustive-deps': 'error',
    'react/prop-types': 'off', // Using TypeScript for prop validation
    
    // General code quality
    'prefer-const': 'error',
    'no-var': 'error',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

### TypeScript Configuration

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### React Coding Patterns

#### Component Standards

**Functional Component Pattern:**
```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';

// Props validation schema
const TaskCardPropsSchema = z.object({
  task: z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(['todo', 'doing', 'review', 'done']),
    assignee: z.string().optional(),
  }),
  onStatusChange: z.function(
    z.tuple([z.string(), z.string()]), 
    z.void()
  ),
  className: z.string().optional(),
});

type TaskCardProps = z.infer<typeof TaskCardPropsSchema>;

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onStatusChange, 
  className = '' 
}) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  
  // Memoized callback to prevent unnecessary re-renders
  const handleStatusChange = useCallback(async (newStatus: string) => {
    setIsUpdating(true);
    try {
      await onStatusChange(task.id, newStatus);
    } catch (error) {
      console.error('Failed to update task status:', error);
      // Handle error appropriately
    } finally {
      setIsUpdating(false);
    }
  }, [task.id, onStatusChange]);
  
  return (
    <div className={`task-card ${className}`}>
      <h3>{task.title}</h3>
      <div className="status-controls">
        {/* Status change controls */}
      </div>
      {isUpdating && <div>Updating...</div>}
    </div>
  );
};
```

#### Custom Hooks Pattern

**Data Fetching Hook:**
```typescript
import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';

const ProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
});

type Project = z.infer<typeof ProjectSchema>;

interface UseProjectsResult {
  projects: Project[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useProjects = (): UseProjectsResult => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validate response data
      const validatedProjects = z.array(ProjectSchema).parse(data.projects);
      setProjects(validatedProjects);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);
  
  return { projects, loading, error, refetch: fetchProjects };
};
```

#### Service Layer Pattern

**API Service Implementation:**
```typescript
import { z } from 'zod';

// Response schemas for validation
const SearchResponseSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    content: z.string(),
    score: z.number(),
  })),
  total: z.number(),
});

type SearchResponse = z.infer<typeof SearchResponseSchema>;

class KnowledgeService {
  private readonly baseUrl: string;
  
  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }
  
  async searchKnowledge(
    query: string, 
    limit: number = 10
  ): Promise<SearchResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/knowledge/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit }),
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response structure
      return SearchResponseSchema.parse(data);
      
    } catch (error) {
      console.error('Knowledge search failed:', error);
      throw new Error(
        `Failed to search knowledge base: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}

export const knowledgeService = new KnowledgeService();
```

### Testing Standards with Vitest

#### Vitest Configuration

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
```

#### Component Testing Pattern

**Component Test Example:**
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { TaskCard } from '../components/TaskCard';

describe('TaskCard', () => {
  const mockTask = {
    id: 'task-1',
    title: 'Test Task',
    status: 'todo' as const,
    assignee: 'John Doe',
  };
  
  it('renders task information correctly', () => {
    const mockOnStatusChange = vi.fn();
    
    render(
      <TaskCard task={mockTask} onStatusChange={mockOnStatusChange} />
    );
    
    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('todo')).toBeInTheDocument();
  });
  
  it('calls onStatusChange when status is updated', async () => {
    const mockOnStatusChange = vi.fn().mockResolvedValue(void 0);
    
    render(
      <TaskCard task={mockTask} onStatusChange={mockOnStatusChange} />
    );
    
    const statusButton = screen.getByRole('button', { name: /change status/i });
    fireEvent.click(statusButton);
    
    await waitFor(() => {
      expect(mockOnStatusChange).toHaveBeenCalledWith('task-1', 'doing');
    });
  });
  
  it('handles status change errors gracefully', async () => {
    const mockOnStatusChange = vi.fn().mockRejectedValue(new Error('API Error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <TaskCard task={mockTask} onStatusChange={mockOnStatusChange} />
    );
    
    const statusButton = screen.getByRole('button', { name: /change status/i });
    fireEvent.click(statusButton);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to update task status:',
        expect.any(Error)
      );
    });
    
    consoleSpy.mockRestore();
  });
});
```

## Quality Gates and CI/CD

### Pre-commit Quality Checks

#### Python Quality Gate

**Required Commands:**
```bash
# Linting and formatting
uv run ruff check src/
uv run ruff format src/ --check

# Type checking  
uv run mypy src/

# Test execution
uv run pytest --cov=src --cov-report=term-missing

# All checks combined
uv run ruff check src/ && uv run mypy src/ && uv run pytest
```

#### Frontend Quality Gate

**Required Commands:**
```bash
# Linting
npm run lint

# Type checking (implicit in build)
npx tsc --noEmit

# Test execution with coverage
npm run test:coverage

# Build verification
npm run build

# All checks combined
npm run lint && npm run test && npm run build
```

### Docker Build Integration

**Multi-stage Build with Quality Checks:**
```dockerfile
# Python service Dockerfile
FROM python:3.12-slim AS builder

WORKDIR /app
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN pip install uv
RUN uv sync --frozen

# Quality checks stage
FROM builder AS quality
COPY src/ src/
COPY tests/ tests/

# Run quality gates
RUN uv run ruff check src/
RUN uv run mypy src/
RUN uv run pytest

# Production stage
FROM builder AS production
COPY src/ src/
EXPOSE 8181
CMD ["uv", "run", "uvicorn", "src.server.main:app", "--host", "0.0.0.0", "--port", "8181"]
```

### Continuous Integration Pipeline

**GitHub Actions Example:**
```yaml
name: Quality Gates

on: [push, pull_request]

jobs:
  python-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          pip install uv
          uv sync
      
      - name: Lint with Ruff
        run: uv run ruff check src/
      
      - name: Type check with Mypy
        run: uv run mypy src/
      
      - name: Test with pytest
        run: uv run pytest --cov=src --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  frontend-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Test
        run: npm run test:coverage
      
      - name: Build
        run: npm run build
```

## Microservices Architecture Standards

### Service Communication Patterns

#### HTTP-Only Communication

**Service Client Pattern:**
```python
import httpx
from typing import Optional, Dict, Any

class ServiceClient:
    def __init__(self, base_url: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip('/')
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def post(
        self, 
        endpoint: str, 
        data: Dict[str, Any],
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make POST request with error handling."""
        try:
            response = await self.client.post(
                f"{self.base_url}{endpoint}",
                json=data,
                headers=headers or {}
            )
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPStatusError as e:
            raise ServiceError(
                f"HTTP {e.response.status_code}: {e.response.text}",
                context={"endpoint": endpoint, "status_code": e.response.status_code}
            )
        except httpx.RequestError as e:
            raise ServiceError(
                f"Request failed: {str(e)}",
                context={"endpoint": endpoint, "error_type": type(e).__name__}
            )
```

#### Service Discovery Pattern

**Environment-based Discovery:**
```python
import os
from typing import Dict

class ServiceDiscovery:
    def __init__(self):
        self.mode = os.getenv('SERVICE_DISCOVERY_MODE', 'local')
    
    def get_service_url(self, service_name: str, default_port: int) -> str:
        """Get service URL based on discovery mode."""
        if self.mode == 'docker_compose':
            port = os.getenv(f'{service_name.upper()}_PORT', str(default_port))
            return f"http://{service_name}:{port}"
        else:
            port = os.getenv(f'{service_name.upper()}_PORT', str(default_port))
            return f"http://localhost:{port}"
    
    @property
    def service_urls(self) -> Dict[str, str]:
        return {
            'api': self.get_service_url('archon-server', 8181),
            'mcp': self.get_service_url('archon-mcp', 8051),
            'agents': self.get_service_url('archon-agents', 8052),
        }
```

### Error Handling Standards

#### Structured Error Responses

**API Error Format:**
```python
from pydantic import BaseModel
from typing import Optional, Dict, Any

class ErrorResponse(BaseModel):
    error: str
    message: str
    context: Optional[Dict[str, Any]] = None
    timestamp: str
    request_id: Optional[str] = None

# FastAPI error handler
@app.exception_handler(ServiceError)
async def service_error_handler(request: Request, exc: ServiceError):
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error=type(exc).__name__,
            message=exc.message,
            context=exc.context,
            timestamp=datetime.utcnow().isoformat(),
            request_id=getattr(request.state, 'request_id', None)
        ).dict()
    )
```

#### Frontend Error Handling

**Consistent Error Processing:**
```typescript
interface APIError {
  error: string;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  request_id?: string;
}

class APIService {
  async request<T>(
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<T> {
    try {
      const response = await fetch(`/api${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      
      if (!response.ok) {
        const errorData: APIError = await response.json();
        throw new Error(
          `${errorData.error}: ${errorData.message} (${response.status})`
        );
      }
      
      return await response.json();
      
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }
}
```

## Performance Standards

### Backend Performance

#### Async Operation Guidelines

**Concurrent Operations:**
```python
import asyncio
from typing import List, Coroutine, Any

async def process_concurrently<T>(
    operations: List[Coroutine[Any, Any, T]],
    max_concurrent: int = 10
) -> List[T]:
    """Process operations with controlled concurrency."""
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def limited_operation(op: Coroutine[Any, Any, T]) -> T:
        async with semaphore:
            return await op
    
    tasks = [limited_operation(op) for op in operations]
    return await asyncio.gather(*tasks)

# Usage example
async def process_documents(document_urls: List[str]) -> List[Document]:
    operations = [
        process_document(url) for url in document_urls
    ]
    return await process_concurrently(operations, max_concurrent=5)
```

#### Database Optimization

**Connection Pooling:**
```python
import asyncpg
from contextlib import asynccontextmanager

class DatabasePool:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.pool: Optional[asyncpg.Pool] = None
    
    async def initialize(self):
        """Initialize connection pool."""
        self.pool = await asyncpg.create_pool(
            self.connection_string,
            min_size=5,
            max_size=20,
            max_queries=50000,
            max_inactive_connection_lifetime=300,
        )
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire connection from pool."""
        if not self.pool:
            raise RuntimeError("Pool not initialized")
        
        async with self.pool.acquire() as connection:
            yield connection
```

### Frontend Performance

#### React Optimization Patterns

**Memoization Strategy:**
```typescript
import React, { memo, useMemo, useCallback } from 'react';

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  filter: TaskFilter;
}

export const TaskList = memo<TaskListProps>(({ 
  tasks, 
  onTaskUpdate, 
  filter 
}) => {
  // Memoize filtered tasks to prevent recalculation
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (filter.status && task.status !== filter.status) return false;
      if (filter.assignee && task.assignee !== filter.assignee) return false;
      return true;
    });
  }, [tasks, filter]);
  
  // Memoize callback to prevent child re-renders
  const handleTaskUpdate = useCallback((taskId: string, updates: Partial<Task>) => {
    onTaskUpdate(taskId, updates);
  }, [onTaskUpdate]);
  
  return (
    <div className="task-list">
      {filteredTasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onUpdate={handleTaskUpdate}
        />
      ))}
    </div>
  );
});

TaskList.displayName = 'TaskList';
```

#### Bundle Optimization

**Code Splitting Pattern:**
```typescript
import React, { lazy, Suspense } from 'react';

// Lazy load heavy components
const ProjectPage = lazy(() => import('./pages/ProjectPage'));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage'));

export const AppRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route 
          path="/projects/*" 
          element={
            <Suspense fallback={<div>Loading...</div>}>
              <ProjectPage />
            </Suspense>
          } 
        />
        <Route 
          path="/knowledge" 
          element={
            <Suspense fallback={<div>Loading...</div>}>
              <KnowledgeBasePage />
            </Suspense>
          } 
        />
      </Routes>
    </Router>
  );
};
```

These coding standards ensure consistent, maintainable, and high-quality code across the entire Archon project while supporting rapid development and reliable operation in the alpha phase.