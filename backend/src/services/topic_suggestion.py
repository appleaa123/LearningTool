from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from sqlmodel import Session, select
from langchain_core.messages import HumanMessage

from src.services.llm_provider import get_chat_model
from src.services.models import (
    SuggestedTopic, 
    TopicSuggestionPreference, 
    TopicStatus,
    Notebook
)

logger = logging.getLogger(__name__)


class TopicSuggestionService:
    """Service for generating and managing topic suggestions using Gemini API."""
    
    def __init__(self, session: Session):
        self.session = session
        self.gemini_model = get_chat_model("gemini", "gemini-2.0-flash-exp", temperature=0.3)
    
    async def generate_topics_for_content(
        self,
        content: str,
        source_type: str,
        notebook_id: int,
        source_filename: Optional[str] = None,
        max_topics: int = 3
    ) -> List[SuggestedTopic]:
        """Generate topic suggestions for given content using Gemini API.
        
        Args:
            content: The text content to analyze
            source_type: Type of source ("document", "image", "text")
            notebook_id: Target notebook ID for user isolation
            source_filename: Original filename if applicable
            max_topics: Maximum number of topics to generate (1-5)
            
        Returns:
            List of SuggestedTopic objects ready for database insertion
        """
        try:
            # Get user preferences
            preferences = await self._get_or_create_preferences(notebook_id)
            if not preferences.auto_suggest_enabled:
                return []
            
            # Use preference settings
            max_topics = min(max_topics, preferences.suggestion_count)
            min_score = preferences.min_priority_score
            
            # Generate topics using Gemini
            topics_data = await self._call_gemini_for_topics(content, source_type, max_topics)
            
            # Create SuggestedTopic objects
            suggested_topics = []
            for topic_data in topics_data:
                if topic_data.get("priority_score", 0.0) >= min_score:
                    topic = SuggestedTopic(
                        notebook_id=notebook_id,
                        source_content=content[:1000],  # Truncate for storage
                        source_type=source_type,
                        source_filename=source_filename,
                        topic=topic_data["topic"],
                        context=topic_data["context"],
                        priority_score=topic_data["priority_score"],
                        status=TopicStatus.pending,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    suggested_topics.append(topic)
            
            # Store in database
            for topic in suggested_topics:
                self.session.add(topic)
            self.session.commit()
            
            # Refresh objects to get IDs
            for topic in suggested_topics:
                self.session.refresh(topic)
            
            logger.info(f"Generated {len(suggested_topics)} topic suggestions for notebook {notebook_id}")
            return suggested_topics
            
        except Exception as e:
            logger.error(f"Failed to generate topics for notebook {notebook_id}: {e}")
            self.session.rollback()
            return []
    
    async def _call_gemini_for_topics(
        self, 
        content: str, 
        source_type: str, 
        max_topics: int
    ) -> List[Dict[str, Any]]:
        """Call Gemini API to generate topic suggestions."""
        
        # Create context-aware prompt based on source type
        if source_type == "image":
            context_hint = "This content was extracted from an image/screenshot"
        elif source_type == "document":
            context_hint = "This content comes from an uploaded document"
        else:
            context_hint = "This is text content provided by the user"
        
        prompt = f"""Analyze the following content and suggest {max_topics} interesting research topics that would help the user learn more about the subject matter. {context_hint}.

Content to analyze:
{content[:2000]}  # Limit content for API efficiency

For each topic, provide:
1. A clear, specific research question or topic
2. Context explaining why this topic is relevant and interesting
3. A priority score (0.0-1.0) based on relevance and potential learning value

Return your response as a JSON array with this exact format:
[
  {{
    "topic": "Specific research question or topic",
    "context": "Why this topic is relevant and interesting for learning",
    "priority_score": 0.85
  }}
]

Guidelines:
- Focus on topics that would enhance understanding of the subject matter
- Prioritize actionable, specific research questions over generic topics
- Ensure topics are educational and suitable for knowledge building
- Score higher (0.7-1.0) for highly relevant topics, lower (0.3-0.6) for tangentially related ones
- Only suggest topics that genuinely add value to the user's knowledge base"""

        try:
            response = await self.gemini_model.ainvoke([HumanMessage(content=prompt)])
            
            # Extract JSON from response
            response_text = response.content.strip()
            
            # Handle potential markdown code blocks
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            topics_data = json.loads(response_text)
            
            # Validate and clean data
            validated_topics = []
            for topic in topics_data[:max_topics]:
                if all(key in topic for key in ["topic", "context", "priority_score"]):
                    # Ensure priority score is valid
                    score = max(0.0, min(1.0, float(topic["priority_score"])))
                    validated_topics.append({
                        "topic": str(topic["topic"])[:500],  # Limit length
                        "context": str(topic["context"])[:1000],  # Limit length
                        "priority_score": score
                    })
            
            return validated_topics
            
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            return []
    
    async def _get_or_create_preferences(self, notebook_id: int) -> TopicSuggestionPreference:
        """Get or create topic suggestion preferences for a notebook."""
        preferences = self.session.exec(
            select(TopicSuggestionPreference).where(
                TopicSuggestionPreference.notebook_id == notebook_id
            )
        ).first()
        
        if not preferences:
            preferences = TopicSuggestionPreference(
                notebook_id=notebook_id,
                auto_suggest_enabled=True,
                suggestion_count=3,
                min_priority_score=0.5,
                preferred_domains=[],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            self.session.add(preferences)
            self.session.commit()
            self.session.refresh(preferences)
        
        return preferences
    
    async def get_pending_topics(
        self, 
        notebook_id: int,
        limit: int = 10
    ) -> List[SuggestedTopic]:
        """Get pending topic suggestions for a notebook."""
        topics = self.session.exec(
            select(SuggestedTopic)
            .where(
                SuggestedTopic.notebook_id == notebook_id,
                SuggestedTopic.status == TopicStatus.pending
            )
            .order_by(SuggestedTopic.priority_score.desc(), SuggestedTopic.created_at.desc())
            .limit(limit)
        ).all()
        
        return list(topics)
    
    async def accept_topic(self, topic_id: int, notebook_id: int) -> Optional[SuggestedTopic]:
        """Accept a topic suggestion and mark for research."""
        topic = self.session.exec(
            select(SuggestedTopic).where(
                SuggestedTopic.id == topic_id,
                SuggestedTopic.notebook_id == notebook_id,
                SuggestedTopic.status == TopicStatus.pending
            )
        ).first()
        
        if not topic:
            return None
        
        topic.status = TopicStatus.accepted
        topic.updated_at = datetime.utcnow()
        self.session.commit()
        self.session.refresh(topic)
        
        logger.info(f"Topic {topic_id} accepted for notebook {notebook_id}")
        return topic
    
    async def reject_topic(self, topic_id: int, notebook_id: int) -> Optional[SuggestedTopic]:
        """Reject a topic suggestion."""
        topic = self.session.exec(
            select(SuggestedTopic).where(
                SuggestedTopic.id == topic_id,
                SuggestedTopic.notebook_id == notebook_id,
                SuggestedTopic.status == TopicStatus.pending
            )
        ).first()
        
        if not topic:
            return None
        
        topic.status = TopicStatus.rejected
        topic.updated_at = datetime.utcnow()
        self.session.commit()
        
        logger.info(f"Topic {topic_id} rejected for notebook {notebook_id}")
        return topic
    
    async def update_preferences(
        self,
        notebook_id: int,
        **preferences_data
    ) -> TopicSuggestionPreference:
        """Update topic suggestion preferences for a notebook."""
        preferences = await self._get_or_create_preferences(notebook_id)
        
        # Update allowed fields
        allowed_fields = {
            'auto_suggest_enabled', 'suggestion_count', 
            'min_priority_score', 'preferred_domains'
        }
        
        for field, value in preferences_data.items():
            if field in allowed_fields:
                setattr(preferences, field, value)
        
        preferences.updated_at = datetime.utcnow()
        self.session.commit()
        self.session.refresh(preferences)
        
        return preferences