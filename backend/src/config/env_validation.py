"""Environment variable validation for production readiness."""

import os
import re
from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class ValidationResult:
    """Result of environment validation."""
    is_valid: bool
    missing_required: List[str]
    invalid_format: List[str]
    warnings: List[str]
    
    @property
    def has_errors(self) -> bool:
        """Check if validation has any errors that would prevent startup."""
        return bool(self.missing_required or self.invalid_format)


class EnvironmentValidator:
    """Validates environment configuration for production readiness."""
    
    # Core API keys required for multimodal processing
    REQUIRED_KEYS = {
        "GEMINI_API_KEY": "Required for image and document processing",
        "OPENAI_API_KEY": "Required for fallback processing",
    }
    
    # Optional but recommended keys
    RECOMMENDED_KEYS = {
        "TAVILY_API_KEY": "Required for web research functionality",
    }
    
    # Configuration keys that should be set
    CONFIG_KEYS = {
        "INGEST_IMAGE_PROCESSOR": "Should be 'gemini' for production",
        "INGEST_DOCUMENT_PROCESSOR": "Should be 'gemini' or 'openai' for production",
        "LIGHTRAG_BASE_DIR": "Directory for knowledge graph storage",
        "SQLITE_DB_PATH": "Database file path (or DATABASE_URL for PostgreSQL)",
    }

    def __init__(self, environment: str = "development"):
        """Initialize validator for specific environment."""
        self.environment = environment.lower()
        
    def validate_api_key_format(self, key: str, value: str) -> bool:
        """Validate API key format based on provider."""
        if not value or value.startswith("your-") or value.startswith("sk-your"):
            return False
            
        # Basic format validation
        if key == "GEMINI_API_KEY" and not value.startswith("AIza"):
            return False
        elif key == "OPENAI_API_KEY" and not value.startswith("sk-"):
            return False
        elif key == "TAVILY_API_KEY" and not value.startswith("tvly-"):
            return False
            
        return True
    
    def test_api_connectivity(self, key: str, value: str) -> bool:
        """Test basic API connectivity (without making actual calls)."""
        # For now, just check format - could be extended to test actual connectivity
        return self.validate_api_key_format(key, value)
    
    def validate_paths(self) -> List[str]:
        """Validate file paths and directories."""
        issues = []
        
        lightrag_dir = os.getenv("LIGHTRAG_BASE_DIR")
        if lightrag_dir:
            # Check if parent directory exists
            parent_dir = os.path.dirname(lightrag_dir)
            if parent_dir and not os.path.exists(parent_dir):
                issues.append(f"LIGHTRAG_BASE_DIR parent directory does not exist: {parent_dir}")
        
        db_path = os.getenv("SQLITE_DB_PATH")
        if db_path:
            # Check if parent directory exists
            parent_dir = os.path.dirname(db_path)
            if parent_dir and not os.path.exists(parent_dir):
                issues.append(f"SQLITE_DB_PATH parent directory does not exist: {parent_dir}")
                
        return issues
    
    def validate_processing_config(self) -> List[str]:
        """Validate processing configuration for production."""
        issues = []
        
        image_processor = os.getenv("INGEST_IMAGE_PROCESSOR", "ocr").lower()
        if self.environment == "production" and image_processor == "ocr":
            issues.append("INGEST_IMAGE_PROCESSOR should be 'gemini' for production (avoids binary dependencies)")
            
        document_processor = os.getenv("INGEST_DOCUMENT_PROCESSOR", "unstructured").lower()
        if self.environment == "production" and document_processor == "unstructured":
            issues.append("INGEST_DOCUMENT_PROCESSOR should be 'gemini' or 'openai' for production (avoids binary dependencies)")
            
        return issues
    
    def validate(self) -> ValidationResult:
        """Perform complete environment validation."""
        missing_required = []
        invalid_format = []
        warnings = []
        
        # Check required API keys
        for key, description in self.REQUIRED_KEYS.items():
            value = os.getenv(key)
            if not value:
                missing_required.append(f"{key}: {description}")
            elif not self.validate_api_key_format(key, value):
                invalid_format.append(f"{key}: Invalid format or placeholder value")
        
        # Check recommended keys
        for key, description in self.RECOMMENDED_KEYS.items():
            value = os.getenv(key)
            if not value:
                warnings.append(f"Recommended: {key} - {description}")
            elif not self.validate_api_key_format(key, value):
                warnings.append(f"{key}: Invalid format or placeholder value")
        
        # Check configuration
        for key, description in self.CONFIG_KEYS.items():
            value = os.getenv(key)
            if not value:
                warnings.append(f"Configuration: {key} - {description}")
        
        # Validate paths
        path_issues = self.validate_paths()
        warnings.extend(path_issues)
        
        # Validate processing configuration
        processing_issues = self.validate_processing_config()
        warnings.extend(processing_issues)
        
        is_valid = len(missing_required) == 0 and len(invalid_format) == 0
        
        return ValidationResult(
            is_valid=is_valid,
            missing_required=missing_required,
            invalid_format=invalid_format,
            warnings=warnings
        )
    
    def print_validation_report(self, result: ValidationResult) -> None:
        """Print a formatted validation report."""
        print(f"\n🔍 Environment Validation Report ({self.environment.title()} Mode)")
        print("=" * 60)
        
        if result.is_valid:
            print("✅ Environment configuration is valid!")
        else:
            print("❌ Environment configuration has errors:")
            
        if result.missing_required:
            print("\n🚨 MISSING REQUIRED:")
            for item in result.missing_required:
                print(f"   • {item}")
                
        if result.invalid_format:
            print("\n⚠️  INVALID FORMAT:")
            for item in result.invalid_format:
                print(f"   • {item}")
                
        if result.warnings:
            print("\n💡 WARNINGS/RECOMMENDATIONS:")
            for item in result.warnings:
                print(f"   • {item}")
        
        if result.has_errors:
            print(f"\n📖 Setup Instructions:")
            print(f"   1. Copy backend/.env.example to backend/env")
            print(f"   2. Fill in your actual API keys")
            print(f"   3. Restart the application")
        
        print("=" * 60)


def validate_environment(environment: str = "development", exit_on_error: bool = True) -> ValidationResult:
    """
    Validate environment configuration and optionally exit on errors.
    
    Args:
        environment: Environment type ('development', 'production', 'test')
        exit_on_error: Whether to exit the process if validation fails
        
    Returns:
        ValidationResult object with validation details
    """
    validator = EnvironmentValidator(environment)
    result = validator.validate()
    validator.print_validation_report(result)
    
    if exit_on_error and result.has_errors:
        print("\n💥 Application startup aborted due to configuration errors.")
        print("Please fix the issues above and restart.\n")
        exit(1)
    
    return result


def get_environment_type() -> str:
    """Determine environment type from various indicators."""
    # Check explicit environment variable
    env = os.getenv("ENVIRONMENT", "").lower()
    if env in ["development", "production", "test"]:
        return env
    
    # Check if running in Docker (common production indicator)
    if os.path.exists("/.dockerenv") or os.getenv("DOCKER_CONTAINER"):
        return "production"
    
    # Check for production indicators
    if os.getenv("DATABASE_URL") or os.getenv("REDIS_URI"):
        return "production"
    
    # Default to development
    return "development"


# Auto-validation when module is imported (can be disabled by setting ENV_SKIP_VALIDATION=true)
if __name__ != "__main__" and not os.getenv("ENV_SKIP_VALIDATION", "").lower() in {"true", "1", "yes"}:
    environment_type = get_environment_type()
    validate_environment(environment_type, exit_on_error=False)