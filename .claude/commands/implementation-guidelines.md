# IMPLEMENTATION GUIDELINES & PATTERNS

*Reusable development patterns and standards for LearningTool project*
*Last Updated: August 28, 2025*

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

*These patterns are extracted from successful implementations in the LearningTool project. Always adapt them to specific use cases while maintaining the core principles.*