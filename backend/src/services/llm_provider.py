from typing import Literal
import os

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI


Provider = Literal["gemini", "openai", "openrouter"]


def get_chat_model(provider: Provider, model: str, temperature: float = 0.2) -> BaseChatModel:
    """Return a configured chat model for the given provider.

    Args:
        provider: One of "gemini", "openai", or "openrouter".
        model: Concrete model identifier for the provider.
        temperature: Decoding temperature.

    Returns:
        A LangChain-compatible chat model instance.

    Raises:
        ValueError: If the provider is not supported or the required API key is missing.
    """
    if provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set")
        return ChatGoogleGenerativeAI(model=model, temperature=temperature, api_key=api_key)

    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set")
        return ChatOpenAI(model=model, temperature=temperature, api_key=api_key)

    if provider == "openrouter":
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY is not set")
        base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        return ChatOpenAI(model=model, temperature=temperature, api_key=api_key, base_url=base_url)

    raise ValueError(f"Unsupported provider: {provider}")


