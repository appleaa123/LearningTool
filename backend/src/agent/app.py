# mypy: disable - error - code = "no-untyped-def,misc"
import pathlib
import os
from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles

# Define the FastAPI app and ensure .env is loaded if present
try:
    from dotenv import load_dotenv  # type: ignore
    # 1) Load default .env from CWD if present
    load_dotenv(os.getenv("ENV_FILE", default=None))
    # 2) Also attempt to load backend/env as a fallback for local deployments
    _fallback_env = pathlib.Path(__file__).parent.parent.parent / "env"
    if _fallback_env.exists():
        load_dotenv(dotenv_path=_fallback_env, override=False)
except Exception:
    # If python-dotenv is not present or fails, continue with OS env only
    pass

app = FastAPI()

# Validate environment configuration on startup
try:
    from src.config.env_validation import validate_environment, get_environment_type
    environment_type = get_environment_type()
    validation_result = validate_environment(environment_type, exit_on_error=False)
    if validation_result.has_errors:
        print("⚠️  Environment validation failed - some features may not work correctly")
except Exception as exc:
    print(f"WARN: Failed to validate environment: {exc}")

# Initialize DB schema on startup/import
try:
    from src.services.db import init_db  # type: ignore
    init_db()
except Exception as exc:
    print(f"WARN: Failed to initialize DB: {exc}")


def create_frontend_router(build_dir="../frontend/dist"):
    """Creates a router to serve the React frontend.

    Args:
        build_dir: Path to the React build directory relative to this file.

    Returns:
        A Starlette application serving the frontend.
    """
    build_path = pathlib.Path(__file__).parent.parent.parent / build_dir

    if not build_path.is_dir() or not (build_path / "index.html").is_file():
        print(
            f"WARN: Frontend build directory not found or incomplete at {build_path}. Serving frontend will likely fail."
        )
        # Return a dummy router if build isn't ready
        from starlette.routing import Route

        async def dummy_frontend(request):
            return Response(
                "Frontend not built. Run 'npm run build' in the frontend directory.",
                media_type="text/plain",
                status_code=503,
            )

        return Route("/{path:path}", endpoint=dummy_frontend)

    return StaticFiles(directory=build_path, html=True)


# Mount the frontend under /app to not conflict with the LangGraph API routes
app.mount(
    "/app",
    create_frontend_router(),
    name="frontend",
)

# Include application routers
try:
    from src.ingestion.router import router as ingest_router
    from src.routers.assistant import router as assistant_router
    from src.routers.knowledge import router as knowledge_router
    from src.routers.notebooks import router as notebooks_router

    app.include_router(ingest_router)
    app.include_router(assistant_router)
    app.include_router(knowledge_router)
    app.include_router(notebooks_router)
    
    # Simple configuration probe for frontend: which providers are enabled by env
    @app.get("/config/providers")
    def providers_config():
        return {
            "openai": bool(os.getenv("OPENAI_API_KEY")),
            "gemini": bool(os.getenv("GEMINI_API_KEY")),
        }
except Exception as exc:
    # Avoid import errors during early bootstrap; they will surface in logs.
    print(f"WARN: Skipping API routers due to import error: {exc}")


# Health endpoint to satisfy simple status checks
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
