# IMPLEMENTATION GUIDELINES & PATTERNS

*Reusable development patterns and standards for LearningTool project*
*Last Updated: August 29, 2025 15:30 UTC*

---

## 📋 OVERVIEW

This document contains proven patterns, standards, and guidelines extracted from successful implementations in the LearningTool project. Use these patterns to maintain consistency, quality, and architectural coherence.

**Related Files:**
- [active-roadmap.md](./active-roadmap.md) - Current development priorities
- [completed-work-archive.md](./completed-work-archive.md) - Implemented examples
- [new-requirements.md](./new-requirements.md) - Template for new features

---

## 🔧 BACKEND DEVELOPMENT PATTERNS

### FastAPI Endpoint Pattern

**Standard API Endpoint Structure:**
```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import logging

router = APIRouter(prefix="/api/endpoint", tags=["feature"])
logger = logging.getLogger(__name__)

class RequestModel(BaseModel):
    """Pydantic model for request validation"""
    field: str
    optional_field: Optional[str] = None

class ResponseModel(BaseModel):
    """Typed response model"""
    status: str
    data: Optional[dict] = None
    message: str

@router.post("/action")
async def endpoint_handler(
    request: RequestModel,
    background_tasks: BackgroundTasks,
    service: ServiceDep = Depends()
) -> ResponseModel:
    """
    Endpoint description with purpose, parameters, and returns.
    
    Args:
        request: Validated request data
        background_tasks: For async operations
        service: Injected service dependency
    
    Returns:
        ResponseModel with operation results
        
    Raises:
        HTTPException: With appropriate status codes
    """
    try:
        # Input validation
        if not request.field:
            raise HTTPException(400, detail="Field is required")
        
        # Core business logic
        result = await service.process(request)
        
        # Background task if needed
        if result.needs_async_processing:
            background_tasks.add_task(async_process, result.id)
        
        return ResponseModel(
            status="success",
            data=result.to_dict(),
            message="Operation completed successfully"
        )
        
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in endpoint_handler: {e}")
        raise HTTPException(500, detail="Internal server error")
```

### Database Model Pattern

**SQLModel Entity Pattern:**
```python
from sqlmodel import Field, SQLModel, Relationship
from typing import Optional, List
from datetime import datetime
from enum import Enum

class StatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"
    pending = "pending"

class BaseEntity(SQLModel):
    """Base model with common fields"""
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: Optional[datetime] = None
    user_id: str = Field(index=True, max_length=255)  # User isolation

class EntityModel(BaseEntity, table=True):
    """Specific entity model"""
    name: str = Field(max_length=500, index=True)
    status: StatusEnum = Field(default=StatusEnum.active, index=True)
    data: Optional[str] = Field(max_length=2000)
    
    # Foreign key relationships (when needed)
    parent_id: Optional[int] = Field(foreign_key="parenttable.id")
    
    class Config:
        table = True
        arbitrary_types_allowed = True
```

### Service Layer Pattern

**Business Logic Service Pattern:**
```python
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

class BaseService(ABC):
    """Abstract base service with common patterns"""
    
    def __init__(self, session: Session):
        self.session = session
    
    async def create(self, data: dict, user_id: str) -> Dict[str, Any]:
        """Create entity with user isolation"""
        try:
            entity = EntityModel(**data, user_id=user_id)
            self.session.add(entity)
            await self.session.commit()
            await self.session.refresh(entity)
            
            logger.info(f"Created entity {entity.id} for user {user_id}")
            return entity.dict()
            
        except Exception as e:
            await self.session.rollback()
            logger.error(f"Failed to create entity: {e}")
            raise
    
    async def get_by_user(self, user_id: str, filters: Optional[dict] = None) -> List[Dict[str, Any]]:
        """Get entities with user isolation"""
        query = select(EntityModel).where(EntityModel.user_id == user_id)
        
        if filters:
            for key, value in filters.items():
                if hasattr(EntityModel, key):
                    query = query.where(getattr(EntityModel, key) == value)
        
        result = await self.session.exec(query)
        return [entity.dict() for entity in result.all()]
```

### Error Handling Pattern

**Comprehensive Error Handling:**
```python
class ServiceError(Exception):
    """Base service error"""
    def __init__(self, message: str, code: str = "SERVICE_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)

class ValidationError(ServiceError):
    """Validation specific error"""
    def __init__(self, message: str, field: str = None):
        self.field = field
        super().__init__(message, "VALIDATION_ERROR")

def handle_service_errors(func):
    """Decorator for consistent error handling"""
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except ValidationError as e:
            logger.warning(f"Validation error in {func.__name__}: {e.message}")
            raise HTTPException(400, detail={"error": e.code, "message": e.message, "field": e.field})
        except ServiceError as e:
            logger.error(f"Service error in {func.__name__}: {e.message}")
            raise HTTPException(500, detail={"error": e.code, "message": e.message})
        except Exception as e:
            logger.error(f"Unexpected error in {func.__name__}: {e}")
            raise HTTPException(500, detail={"error": "INTERNAL_ERROR", "message": "An unexpected error occurred"})
    return wrapper
```

---

## 🎨 FRONTEND DEVELOPMENT PATTERNS

### React Component Pattern

**Standard Component Structure:**
```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Spinner } from '@/components/ui';

// Type definitions
interface ComponentProps {
  data: DataType;
  onAction: (id: string) => Promise<void>;
  className?: string;
  loading?: boolean;
}

interface ComponentState {
  processing: boolean;
  error: string | null;
}

// Main component with proper typing
export const ComponentName: React.FC<ComponentProps> = ({
  data,
  onAction,
  className = "",
  loading = false
}) => {
  // State management
  const [state, setState] = useState<ComponentState>({
    processing: false,
    error: null
  });

  // Event handlers with useCallback for performance
  const handleAction = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, processing: true, error: null }));
    
    try {
      await onAction(id);
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'An error occurred' 
      }));
    } finally {
      setState(prev => ({ ...prev, processing: false }));
    }
  }, [onAction]);

  // Loading state
  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center gap-2">
          <Spinner size="sm" />
          <span>Loading...</span>
        </div>
      </Card>
    );
  }

  // Error state
  if (state.error) {
    return (
      <Card className={`p-4 border-red-200 bg-red-50 ${className}`}>
        <p className="text-red-800">{state.error}</p>
        <Button 
          onClick={() => setState(prev => ({ ...prev, error: null }))}
          variant="outline"
          size="sm"
          className="mt-2"
        >
          Dismiss
        </Button>
      </Card>
    );
  }

  // Main render
  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <h3 className="font-medium">{data.title}</h3>
        <p className="text-muted-foreground">{data.description}</p>
        
        <Button
          onClick={() => handleAction(data.id)}
          disabled={state.processing}
          className="w-full"
        >
          {state.processing ? <Spinner size="xs" /> : 'Take Action'}
        </Button>
      </div>
    </Card>
  );
};

// Performance optimization for heavy components
export default React.memo(ComponentName);
```

### API Service Pattern

**Type-Safe API Service:**
```typescript
import { apiClient } from './api';

// Request/Response types
export interface ServiceRequest {
  field: string;
  optional?: string;
}

export interface ServiceResponse {
  status: string;
  data: any;
  message: string;
}

export interface ServiceOptions {
  timeout?: number;
  retries?: number;
}

// Service class with proper error handling
export class ApiService {
  private static baseURL = '/api/service';

  static async performAction(
    request: ServiceRequest,
    options: ServiceOptions = {}
  ): Promise<ServiceResponse> {
    try {
      const response = await apiClient.post(
        `${this.baseURL}/action`,
        request,
        {
          timeout: options.timeout || 10000,
          ...options
        }
      );
      
      return response.data;
    } catch (error: any) {
      // Structured error handling
      if (error.response?.status === 400) {
        throw new Error(`Validation error: ${error.response.data.message}`);
      } else if (error.response?.status === 500) {
        throw new Error('Server error occurred. Please try again.');
      } else if (error.code === 'NETWORK_ERROR') {
        throw new Error('Network error. Please check your connection.');
      } else {
        throw new Error('An unexpected error occurred.');
      }
    }
  }

  static async getData(
    userId: string,
    filters?: Record<string, any>
  ): Promise<ServiceResponse> {
    const params = new URLSearchParams({ user_id: userId });
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    try {
      const response = await apiClient.get(
        `${this.baseURL}/data?${params}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private static handleError(error: any): Error {
    // Centralized error handling logic
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || 'Unknown error';
      return new Error(`API Error (${status}): ${message}`);
    } else if (error.request) {
      return new Error('Network error: Unable to reach server');
    } else {
      return new Error(`Request error: ${error.message}`);
    }
  }
}
```

### Custom Hook Pattern

**Reusable Logic Hook:**
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseServiceHookResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  reset: () => void;
}

export function useServiceHook<T>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = []
): UseServiceHookResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchFn();
      if (isMountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFn]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, dependencies);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return { data, loading, error, refetch: fetchData, reset };
}
```

---

## 🗃️ DATABASE PATTERNS

### User Isolation Pattern

**Consistent User Isolation:**
```python
# Always include user_id in queries
def get_user_data(session: Session, user_id: str, entity_id: int):
    """Get entity with user isolation"""
    result = session.exec(
        select(EntityModel)
        .where(EntityModel.id == entity_id)
        .where(EntityModel.user_id == user_id)  # Critical for security
    ).first()
    
    if not result:
        raise HTTPException(404, detail="Entity not found")
    
    return result

# Index patterns for performance
class UserEntity(SQLModel, table=True):
    user_id: str = Field(index=True, max_length=255)  # Always indexed
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    status: str = Field(index=True)  # Index frequently filtered fields
```

### Migration Pattern

**Database Schema Evolution:**
```python
# Always provide migration scripts
"""Add new feature table

Revision ID: 001_add_feature
Created: 2025-08-28
"""

def upgrade():
    # Create new tables
    op.create_table(
        'new_feature',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('user_id', sa.String(255), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime, nullable=False, index=True),
        # ... other columns
    )
    
    # Add indexes
    op.create_index('ix_new_feature_user_created', 'new_feature', ['user_id', 'created_at'])

def downgrade():
    # Always provide rollback
    op.drop_table('new_feature')
```

---

## 🔒 SECURITY PATTERNS

### Input Validation Pattern

**Comprehensive Validation:**
```python
from pydantic import BaseModel, validator, Field
import re

class UserInput(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    user_id: str = Field(..., regex=r'^[a-zA-Z0-9_-]+$', max_length=255)
    file_path: Optional[str] = None
    
    @validator('text')
    def validate_text(cls, v):
        # Sanitize input
        if not v.strip():
            raise ValueError('Text cannot be empty')
        return v.strip()
    
    @validator('file_path')
    def validate_file_path(cls, v):
        if v is None:
            return v
        # Prevent path traversal
        if '..' in v or v.startswith('/'):
            raise ValueError('Invalid file path')
        return v

    @validator('user_id')
    def validate_user_id(cls, v):
        # Additional user ID validation
        if len(v) < 3:
            raise ValueError('User ID too short')
        return v
```

### Authentication Pattern

**Consistent Auth Handling:**
```python
from functools import wraps

def require_auth(f):
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        user_id = get_current_user_id()  # Your auth mechanism
        if not user_id:
            raise HTTPException(401, detail="Authentication required")
        
        # Add user_id to kwargs for convenience
        kwargs['current_user_id'] = user_id
        return await f(*args, **kwargs)
    
    return decorated_function

@router.post("/protected")
@require_auth
async def protected_endpoint(data: InputModel, current_user_id: str):
    # user_id automatically available
    pass
```

---

## 🧪 TESTING PATTERNS

### API Test Pattern

**Comprehensive API Testing:**
```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock

class TestApiEndpoint:
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_successful_operation(self, client):
        """Test happy path"""
        response = client.post("/api/endpoint", json={
            "field": "valid_value"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "data" in data
    
    def test_validation_error(self, client):
        """Test input validation"""
        response = client.post("/api/endpoint", json={
            "field": ""  # Invalid empty value
        })
        
        assert response.status_code == 400
        assert "Field is required" in response.json()["detail"]
    
    def test_server_error(self, client):
        """Test error handling"""
        with patch('service.process', side_effect=Exception("Test error")):
            response = client.post("/api/endpoint", json={
                "field": "valid_value"
            })
            
            assert response.status_code == 500
            assert "Internal server error" in response.json()["detail"]
```

### Component Test Pattern

**React Component Testing:**
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  const mockOnAction = vi.fn();
  const mockData = {
    id: 'test-id',
    title: 'Test Title',
    description: 'Test Description'
  };

  beforeEach(() => {
    mockOnAction.mockClear();
  });

  it('renders component correctly', () => {
    render(
      <ComponentName 
        data={mockData} 
        onAction={mockOnAction} 
      />
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('handles action correctly', async () => {
    mockOnAction.mockResolvedValue(undefined);

    render(
      <ComponentName 
        data={mockData} 
        onAction={mockOnAction} 
      />
    );

    fireEvent.click(screen.getByText('Take Action'));
    
    await waitFor(() => {
      expect(mockOnAction).toHaveBeenCalledWith('test-id');
    });
  });

  it('displays error state', async () => {
    const errorMessage = 'Test error';
    mockOnAction.mockRejectedValue(new Error(errorMessage));

    render(
      <ComponentName 
        data={mockData} 
        onAction={mockOnAction} 
      />
    );

    fireEvent.click(screen.getByText('Take Action'));
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});
```

---

## 📊 PERFORMANCE PATTERNS

### Optimization Strategies

**Backend Performance:**
```python
# Database query optimization
async def get_user_items_optimized(user_id: str, limit: int = 20, offset: int = 0):
    """Optimized query with pagination and selective loading"""
    query = (
        select(EntityModel)
        .where(EntityModel.user_id == user_id)
        .options(selectinload(EntityModel.related_items))  # Avoid N+1
        .order_by(EntityModel.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    
    result = await session.exec(query)
    return result.all()

# Caching pattern
from functools import lru_cache
from typing import Dict, Any

@lru_cache(maxsize=128)
def expensive_computation(input_key: str) -> Dict[str, Any]:
    """Cache expensive operations"""
    # Expensive operation here
    pass

# Background task pattern
async def background_processor(data: dict):
    """Non-blocking background processing"""
    try:
        # Heavy processing
        result = await heavy_operation(data)
        
        # Update database
        await update_result(data['id'], result)
        
    except Exception as e:
        logger.error(f"Background processing failed: {e}")
        # Handle error appropriately
```

**Frontend Performance:**
```typescript
// Component memoization
import { memo, useMemo, useCallback } from 'react';

const ExpensiveComponent = memo(({ data, onAction }) => {
  // Memoize expensive calculations
  const processedData = useMemo(() => {
    return data.map(item => expensiveProcessing(item));
  }, [data]);

  // Memoize event handlers
  const handleAction = useCallback((id: string) => {
    onAction(id);
  }, [onAction]);

  return (
    <div>
      {processedData.map(item => (
        <ItemComponent 
          key={item.id} 
          item={item} 
          onAction={handleAction}
        />
      ))}
    </div>
  );
});

// Lazy loading pattern
const LazyComponent = lazy(() => import('./HeavyComponent'));

// Usage with Suspense
function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LazyComponent />
    </Suspense>
  );
}
```

---

## 📚 CODE ORGANIZATION

### File Structure Pattern

**Backend Structure:**
```
backend/src/
├── api/
│   ├── __init__.py
│   ├── dependencies.py      # Dependency injection
│   └── middleware.py        # Custom middleware
├── routers/
│   ├── __init__.py
│   ├── feature.py           # Feature-specific routes
│   └── auth.py             # Authentication routes
├── services/
│   ├── __init__.py
│   ├── feature_service.py   # Business logic
│   └── auth_service.py     # Authentication logic
├── models/
│   ├── __init__.py
│   ├── base.py             # Base model classes
│   └── feature.py          # Feature-specific models
├── utils/
│   ├── __init__.py
│   ├── validators.py       # Validation utilities
│   └── helpers.py          # Helper functions
└── tests/
    ├── test_routes.py
    ├── test_services.py
    └── fixtures/
```

**Frontend Structure:**
```
frontend/src/
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── feature/            # Feature-specific components
│   └── layout/            # Layout components
├── pages/
│   ├── FeaturePage.tsx
│   └── index.tsx
├── hooks/
│   ├── useFeature.ts       # Custom hooks
│   └── useApi.ts
├── services/
│   ├── api.ts              # API client
│   └── featureService.ts   # Feature-specific API calls
├── types/
│   ├── api.ts              # API type definitions
│   └── feature.ts          # Feature type definitions
├── utils/
│   ├── constants.ts        # App constants
│   └── helpers.ts          # Utility functions
└── tests/
    ├── components/
    └── utils/
```

---

## 🚀 DEPLOYMENT PATTERNS

### Environment Configuration

**Environment Variables Pattern:**
```python
# backend/src/config/settings.py
from pydantic import BaseSettings, validator
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./app.db"
    
    # API Keys (required)
    gemini_api_key: str
    openai_api_key: str
    tavily_api_key: str
    
    # Optional settings
    debug_mode: bool = False
    max_upload_size: int = 50 * 1024 * 1024  # 50MB
    
    # Validation
    @validator('gemini_api_key')
    def validate_gemini_key(cls, v):
        if not v or len(v) < 10:
            raise ValueError('Valid Gemini API key required')
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

### Docker Configuration

**Multi-stage Dockerfile Pattern:**
```dockerfile
# Backend Dockerfile
FROM python:3.11-slim as builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim as runtime

WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## ✅ VALIDATION CHECKLIST

### Code Review Checklist

**Backend Code Review:**
- [ ] Proper error handling with appropriate HTTP status codes
- [ ] User isolation implemented in all queries  
- [ ] Input validation using Pydantic models
- [ ] Database transactions properly handled
- [ ] Logging implemented for debugging
- [ ] Security best practices followed
- [ ] Performance considerations addressed

**Frontend Code Review:**
- [ ] TypeScript types properly defined
- [ ] Error boundaries implemented
- [ ] Loading states provided
- [ ] Accessibility attributes included
- [ ] Performance optimizations applied (memo, useMemo)
- [ ] Mobile responsive design
- [ ] Proper error handling and user feedback

---

## 🎯 NEW REQUIREMENTS IMPLEMENTATION PATTERNS

### Chat System Implementation Pattern (REQ-004)

**Chat Session Management Pattern:**
```python
# Backend chat session service
from sqlmodel import Field, SQLModel, Relationship
from typing import Optional, List
import uuid
from datetime import datetime

class ChatSession(SQLModel, table=True):
    """Chat session model with notebook relationship"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(index=True, max_length=255)
    notebook_id: str = Field(index=True, max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_message_at: Optional[datetime] = None

class ChatMessage(SQLModel, table=True):
    """Individual chat message with session reference"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    session_id: str = Field(foreign_key="chatsession.id", index=True)
    type: str = Field(regex="^(user|assistant)$")  # user or assistant
    content: str = Field(max_length=10000)
    sources: Optional[str] = None  # JSON string of sources
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

# Chat service pattern
class ChatService:
    def __init__(self, session: Session, llm_service: LLMService):
        self.session = session
        self.llm_service = llm_service
    
    async def create_or_get_session(self, user_id: str, notebook_id: str) -> ChatSession:
        """Get existing session or create new one"""
        existing_session = self.session.exec(
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .where(ChatSession.notebook_id == notebook_id)
            .order_by(ChatSession.last_message_at.desc())
        ).first()
        
        if existing_session:
            return existing_session
        
        new_session = ChatSession(user_id=user_id, notebook_id=notebook_id)
        self.session.add(new_session)
        await self.session.commit()
        return new_session
    
    async def add_message(self, session_id: str, message_type: str, content: str, sources: List[dict] = None) -> ChatMessage:
        """Add message to session with user isolation"""
        message = ChatMessage(
            session_id=session_id,
            type=message_type,
            content=content,
            sources=json.dumps(sources) if sources else None
        )
        
        self.session.add(message)
        
        # Update session last message time
        session = self.session.get(ChatSession, session_id)
        session.last_message_at = datetime.utcnow()
        
        await self.session.commit()
        return message
```

**Frontend Chat Component Pattern:**
```typescript
// Chat component with session management
import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, ScrollArea } from '@/components/ui';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  sources?: Array<{title: string, content: string}>;
  timestamp: string;
}

interface ChatSession {
  id: string;
  notebook_id: string;
  messages: ChatMessage[];
}

export const ChatComponent: React.FC<{notebookId: string}> = ({ notebookId }) => {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load or create chat session
  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionData = await chatService.getOrCreateSession(notebookId);
        setSession(sessionData);
      } catch (error) {
        console.error('Failed to load chat session:', error);
      }
    };
    
    loadSession();
  }, [notebookId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !session || isGenerating) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsGenerating(true);

    try {
      // Add user message optimistically
      const newUserMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      };

      setSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, newUserMessage]
      } : null);

      // Send to backend
      const response = await chatService.sendMessage({
        question: userMessage,
        session_id: session.id,
        notebook_id: session.notebook_id,
        mode: 'local'
      });

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: response.message_id,
        type: 'assistant',
        content: response.answer,
        sources: response.sources,
        timestamp: new Date().toISOString()
      };

      setSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, assistantMessage]
      } : null);

    } catch (error) {
      console.error('Failed to send message:', error);
      // Handle error state
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Message history */}
      <ScrollArea className="flex-1 p-4">
        {session?.messages.map((message) => (
          <div key={message.id} className={`mb-4 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
            <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
              message.type === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-900'
            }`}>
              <p>{message.content}</p>
              {message.sources && (
                <div className="mt-2 text-sm opacity-80">
                  Sources: {message.sources.map(s => s.title).join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
        {isGenerating && (
          <div className="text-left mb-4">
            <div className="inline-block bg-gray-100 text-gray-900 p-3 rounded-lg">
              Generating response...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Input area */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question about your knowledge..."
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={isGenerating}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={isGenerating || !inputValue.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
```

### Knowledge Feed Card Implementation Pattern (REQ-005)

**Feed Card Component Factory Pattern:**
```typescript
// Card type definitions
interface BaseFeedCard {
  id: string;
  type: 'research' | 'flashcard' | 'qa' | 'chunk' | 'summary';
  title: string;
  content: string;
  metadata: {
    topic: string;
    created_at: string;
    relevancy_score?: number;
  };
}

interface ResearchCard extends BaseFeedCard {
  type: 'research';
  sources: Array<{title: string, url: string}>;
}

interface FlashCard extends BaseFeedCard {
  type: 'flashcard';
  reveal_content: string;
}

interface QACard extends BaseFeedCard {
  type: 'qa';
  question: string;
  answer: string;
}

// Card component factory
export const FeedCardFactory: React.FC<{item: BaseFeedCard}> = ({ item }) => {
  switch (item.type) {
    case 'research':
      return <ResearchCardComponent item={item as ResearchCard} />;
    case 'flashcard':
      return <FlashCardComponent item={item as FlashCard} />;
    case 'qa':
      return <QACardComponent item={item as QACard} />;
    case 'chunk':
      return <ChunkCardComponent item={item} />;
    case 'summary':
      return <SummaryCardComponent item={item} />;
    default:
      return <DefaultCardComponent item={item} />;
  }
};

// Research card with sources
const ResearchCardComponent: React.FC<{item: ResearchCard}> = ({ item }) => {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-sm text-blue-600">Research</CardTitle>
        <h3 className="font-medium">{item.title}</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm mb-2">Summary</h4>
            <p className="text-sm text-gray-700">{item.content}</p>
          </div>
          
          {item.sources.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2">Sources</h4>
              <ul className="space-y-1">
                {item.sources.map((source, idx) => (
                  <li key={idx}>
                    <a 
                      href={source.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Flash card with reveal functionality
const FlashCardComponent: React.FC<{item: FlashCard}> = ({ item }) => {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <Card className="mb-4 cursor-pointer" onClick={() => setIsRevealed(!isRevealed)}>
      <CardHeader>
        <CardTitle className="text-sm text-purple-600">Flash Card</CardTitle>
        <h3 className="font-medium">{item.title}</h3>
      </CardHeader>
      <CardContent>
        {!isRevealed ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-2">Click to reveal knowledge</p>
            <Button variant="outline" size="sm">Reveal</Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">{item.reveal_content}</p>
            <Button variant="ghost" size="sm" onClick={() => setIsRevealed(false)}>
              Hide
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

### Upload Status Pattern (REQ-001)

**Upload Status Management Pattern:**
```typescript
// Upload status types
interface UploadStatus {
  id: string;
  filename: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  message: string;
  progress?: number;
}

// Upload component with status
export const UploadComponent: React.FC = () => {
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);

  const handleFileUpload = async (files: FileList, type: 'image' | 'document' | 'audio') => {
    for (const file of Array.from(files)) {
      const uploadId = Date.now().toString();
      
      // Add upload status
      setUploadStatuses(prev => [...prev, {
        id: uploadId,
        filename: file.name,
        status: 'uploading',
        message: 'Uploading file...',
        progress: 0
      }]);

      try {
        if (type === 'audio') {
          // Handle audio upload with development message
          setUploadStatuses(prev => prev.map(status => 
            status.id === uploadId 
              ? { ...status, status: 'failed', message: 'Sorry, this feature is under development and will be live soon!' }
              : status
          ));
          return;
        }

        // Actual upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', getCurrentUserId());

        const response = await uploadService.uploadFile(formData, type);

        // Update status to processing
        setUploadStatuses(prev => prev.map(status => 
          status.id === uploadId 
            ? { ...status, status: 'processing', message: 'Processing file...' }
            : status
        ));

        // Poll for completion (optional)
        if (response.upload_id) {
          pollUploadStatus(uploadId, response.upload_id);
        } else {
          // Direct completion
          setUploadStatuses(prev => prev.map(status => 
            status.id === uploadId 
              ? { ...status, status: 'completed', message: 'File uploaded and ready for use!' }
              : status
          ));
        }

      } catch (error) {
        setUploadStatuses(prev => prev.map(status => 
          status.id === uploadId 
            ? { ...status, status: 'failed', message: 'Upload failed. Please try again.' }
            : status
        ));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload buttons */}
      <div className="flex gap-2">
        <UploadButton type="image" onUpload={handleFileUpload} />
        <UploadButton type="document" onUpload={handleFileUpload} />
        <UploadButton type="audio" onUpload={handleFileUpload} disabled />
      </div>

      {/* Upload status list */}
      {uploadStatuses.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Upload Status</h4>
          {uploadStatuses.map(status => (
            <div key={status.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <StatusIcon status={status.status} />
              <div className="flex-1">
                <p className="text-sm font-medium">{status.filename}</p>
                <p className="text-xs text-gray-600">{status.message}</p>
              </div>
              {status.status === 'completed' && (
                <Button variant="ghost" size="sm" onClick={() => removeStatus(status.id)}>
                  ×
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Research Topic Background Processing Pattern (REQ-002)

**Background Research Processing Pattern:**
```python
# Backend background research pattern
from celery import Celery
from typing import List

class ResearchTopicService:
    def __init__(self, session: Session, research_agent: LangGraphAgent):
        self.session = session
        self.research_agent = research_agent
    
    async def process_topic_selection(self, user_id: str, topic_id: str, action: str):
        """Handle topic selection with background processing"""
        topic = self.session.get(ResearchTopic, topic_id)
        
        if action == "interested":
            # Update topic status
            topic.status = "researching"
            
            # Create research task
            research_task = ResearchTask(
                topic_id=topic_id,
                user_id=user_id,
                status="queued",
                progress_message="Queued for research..."
            )
            
            self.session.add(research_task)
            await self.session.commit()
            
            # Start background research
            start_background_research.delay(research_task.id)
            
        elif action == "not_interested":
            topic.status = "rejected"
            await self.session.commit()
        
        return {"status": action, "research_id": research_task.id if action == "interested" else None}

@celery_app.task
def start_background_research(research_task_id: str):
    """Background research task"""
    try:
        research_task = session.get(ResearchTask, research_task_id)
        research_task.status = "processing"
        research_task.progress_message = "Searching relevant knowledge..."
        session.commit()
        
        # Perform research using LangGraph agent
        results = research_agent.research_topic(research_task.topic.title)
        
        # Save results
        research_task.status = "completed"
        research_task.progress_message = "Research complete!"
        research_task.results = json.dumps(results)
        research_task.completed_at = datetime.utcnow()
        
        # Create feed items for results
        create_research_feed_items(research_task.user_id, results)
        
        session.commit()
        
    except Exception as e:
        research_task.status = "failed"
        research_task.progress_message = f"Research failed: {str(e)}"
        session.commit()
```

**Frontend Async Processing Pattern:**
```typescript
// Research topic component with async processing
export const ResearchTopicsComponent: React.FC = () => {
  const [topics, setTopics] = useState<ResearchTopic[]>([]);
  const [processingTopics, setProcessingTopics] = useState<Set<string>>(new Set());
  const [allTopicsProcessed, setAllTopicsProcessed] = useState(false);

  const handleTopicAction = async (topicId: string, action: 'interested' | 'not_interested') => {
    setProcessingTopics(prev => new Set([...prev, topicId]));
    
    try {
      const response = await researchService.processTopicSelection(topicId, action);
      
      // Update topic status
      setTopics(prev => prev.map(topic => 
        topic.id === topicId 
          ? { ...topic, status: action === 'interested' ? 'researching' : 'rejected' }
          : topic
      ));

      // Start polling for research progress if interested
      if (action === 'interested' && response.research_id) {
        pollResearchProgress(response.research_id);
      }

      // Check if all topics processed
      const remainingTopics = topics.filter(t => t.id !== topicId && t.status === 'pending');
      if (remainingTopics.length === 0) {
        setAllTopicsProcessed(true);
        setTimeout(() => {
          setAllTopicsProcessed(false); // Reset for next batch
        }, 5000);
      }

    } catch (error) {
      console.error('Failed to process topic:', error);
    } finally {
      setProcessingTopics(prev => {
        const newSet = new Set(prev);
        newSet.delete(topicId);
        return newSet;
      });
    }
  };

  const pollResearchProgress = async (researchId: string) => {
    const poll = async () => {
      try {
        const status = await researchService.getResearchStatus(researchId);
        
        // Update UI based on status
        if (status.status === 'completed') {
          showNotification('Research complete! Check your Knowledge Feed for results.');
          return; // Stop polling
        } else if (status.status === 'failed') {
          showNotification('Research failed. Please try again.', 'error');
          return; // Stop polling
        }
        
        // Continue polling
        setTimeout(poll, 5000);
        
      } catch (error) {
        console.error('Failed to poll research status:', error);
      }
    };
    
    poll();
  };

  return (
    <div className="space-y-4">
      {/* Topic cards */}
      {topics.filter(t => t.status === 'pending').map(topic => (
        <TopicCard 
          key={topic.id}
          topic={topic}
          onAction={handleTopicAction}
          isProcessing={processingTopics.has(topic.id)}
        />
      ))}

      {/* Completion message */}
      {allTopicsProcessed && (
        <Card className="p-4 bg-green-50 border-green-200">
          <p className="text-green-800">
            Thanks for letting me know your interests! I will process your research requests 
            and show the knowledge in Chat or Knowledge Feed tabs for your reference 😊
          </p>
        </Card>
      )}
    </div>
  );
};
```

### Testing Patterns for New Requirements

**Chat System Tests:**
```python
# Backend chat tests
class TestChatSystem:
    def test_session_creation(self):
        """Test chat session creation with notebook relationship"""
        service = ChatService(session, llm_service)
        
        chat_session = await service.create_or_get_session("user123", "notebook456")
        
        assert chat_session.user_id == "user123"
        assert chat_session.notebook_id == "notebook456"
        assert chat_session.id is not None
    
    def test_message_persistence(self):
        """Test message saving with session context"""
        session = await chat_service.create_or_get_session("user123", "notebook456")
        
        message = await chat_service.add_message(
            session.id, "user", "Test question"
        )
        
        # Verify message saved
        saved_message = db_session.get(ChatMessage, message.id)
        assert saved_message.content == "Test question"
        assert saved_message.session_id == session.id
    
    def test_session_isolation(self):
        """Test user isolation for chat sessions"""
        session1 = await chat_service.create_or_get_session("user1", "notebook1")
        session2 = await chat_service.create_or_get_session("user2", "notebook1")
        
        assert session1.id != session2.id
        assert session1.user_id != session2.user_id
```

**Frontend Component Tests:**
```typescript
// Chat component tests
describe('ChatComponent', () => {
  it('changes button text from Search to Send', () => {
    render(<ChatComponent notebookId="test" />);
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument();
  });

  it('displays chat history correctly', async () => {
    const mockMessages = [
      { id: '1', type: 'user', content: 'Hello', timestamp: '2025-08-29T15:00:00Z' },
      { id: '2', type: 'assistant', content: 'Hi there!', timestamp: '2025-08-29T15:00:01Z' }
    ];
    
    vi.mocked(chatService.getOrCreateSession).mockResolvedValue({
      id: 'session1',
      notebook_id: 'notebook1',
      messages: mockMessages
    });
    
    render(<ChatComponent notebookId="notebook1" />);
    
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });
});

// Upload status tests
describe('UploadComponent', () => {
  it('shows development message for audio uploads', async () => {
    render(<UploadComponent />);
    
    const audioButton = screen.getByRole('button', { name: /upload audio/i });
    fireEvent.click(audioButton);
    
    await waitFor(() => {
      expect(screen.getByText(/this feature is under development/i)).toBeInTheDocument();
    });
  });

  it('displays upload success status', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    
    vi.mocked(uploadService.uploadFile).mockResolvedValue({
      status: 'success',
      message: 'File uploaded successfully'
    });
    
    render(<UploadComponent />);
    
    const input = screen.getByLabelText(/upload document/i);
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText(/uploaded and ready for use/i)).toBeInTheDocument();
    });
  });
});
```

---

*These patterns are extracted from successful implementations in the LearningTool project and enhanced with new requirements specifications. Always adapt them to specific use cases while maintaining the core principles.*