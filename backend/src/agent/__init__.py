"""Agent package initializer.

Avoid importing heavy graph dependencies at package import time to prevent
environment issues before `.env` is loaded by `agent.app`.
"""

__all__ = []
