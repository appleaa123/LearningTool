#!/bin/bash
# Development server startup script with ASGI blocking workaround
# This allows synchronous database operations while we complete the async migration

set -e

echo "🛠️  Starting LearningTool Backend with ASGI blocking allowance..."
echo "⚠️  This is a temporary workaround during async migration"

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment not found at .venv"
    echo "Please create virtual environment with: python -m venv .venv"
    exit 1
fi

# Activate virtual environment  
source .venv/bin/activate

# Check if environment file exists
if [ ! -f "env" ]; then
    echo "⚠️  Environment file 'env' not found"
    echo "Using environment variables from shell..."
fi

echo "🚀 Starting LangGraph development server with blocking operations allowed..."
echo "📍 Server will be available at: http://127.0.0.1:2024"
echo "📚 API documentation: http://127.0.0.1:2024/docs"
echo ""
echo "🔧 ASGI Compliance Status:"
echo "   ✅ Topic Suggestion Service: Async converted"  
echo "   ✅ Background Transformations: Async converted"
echo "   🔄 Remaining Services: Being migrated"
echo ""

# Start LangGraph with allow-blocking flag for development
langgraph dev --allow-blocking