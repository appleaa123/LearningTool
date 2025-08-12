"""Callable deep research tool wrapping the existing LangGraph agent.

This allows the backbone agent or API routes to invoke the deep research workflow
programmatically with a simple function call.
"""

from typing import Dict, Any
from langchain_core.messages import HumanMessage

from agent.graph import graph


def run_deep_research(
    question: str,
    *,
    initial_queries: int,
    max_loops: int,
    reasoning_model: str,
) -> Dict[str, Any]:
    """Run the deep research workflow and return the resulting state.

    Args:
        question: Research question from the user.
        initial_queries: Number of initial search queries to spawn.
        max_loops: Maximum research loops before finalization.
        reasoning_model: Model used to compose the final answer.

    Returns:
        The final graph state containing `messages` and `sources_gathered` among others.
    """
    state = {
        "messages": [HumanMessage(content=question)],
        "initial_search_query_count": initial_queries,
        "max_research_loops": max_loops,
        "reasoning_model": reasoning_model,
    }
    return graph.invoke(state)


