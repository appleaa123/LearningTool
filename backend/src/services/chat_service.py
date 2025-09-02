from __future__ import annotations

from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlmodel import select, Session

from src.services.db import session_scope
from src.services.models import ChatSession, ChatMessage, MessageType, Notebook


class ChatService:
    """
    Service for managing chat sessions and messages with notebook isolation.
    
    Provides session lifecycle management, message persistence, and history retrieval
    while maintaining strict user and notebook-based data isolation.
    """
    
    def get_or_create_session(
        self, 
        user_id: str, 
        notebook_id: int
    ) -> ChatSession:
        """
        Get existing chat session for notebook or create new one.
        
        Args:
            user_id: User identifier for access control
            notebook_id: Notebook to associate session with
            
        Returns:
            ChatSession instance for the notebook
            
        Raises:
            ValueError: If notebook doesn't exist or doesn't belong to user
        """
        with session_scope() as session:
            # Verify notebook exists and belongs to user
            notebook = session.exec(
                select(Notebook).where(
                    Notebook.id == notebook_id,
                    Notebook.user_id == user_id
                )
            ).first()
            
            if not notebook:
                raise ValueError(f"Notebook {notebook_id} not found for user {user_id}")
            
            # Look for existing session
            existing_session = session.exec(
                select(ChatSession).where(
                    ChatSession.user_id == user_id,
                    ChatSession.notebook_id == notebook_id
                )
            ).first()
            
            if existing_session:
                return existing_session
            
            # Create new session
            new_session = ChatSession(
                user_id=user_id,
                notebook_id=notebook_id
            )
            session.add(new_session)
            session.commit()
            session.refresh(new_session)
            return new_session
    
    def save_message(
        self,
        session_id: int,
        message_type: MessageType,
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None
    ) -> ChatMessage:
        """
        Save a chat message to the session.
        
        Args:
            session_id: Chat session ID
            message_type: 'user' or 'assistant'
            content: Message content
            sources: Optional sources for assistant messages
            
        Returns:
            Created ChatMessage instance
            
        Raises:
            ValueError: If session doesn't exist
        """
        with session_scope() as session:
            # Verify session exists
            chat_session = session.exec(
                select(ChatSession).where(ChatSession.id == session_id)
            ).first()
            
            if not chat_session:
                raise ValueError(f"Session {session_id} not found")
            
            # Create message
            message = ChatMessage(
                session_id=session_id,
                type=message_type,
                content=content,
                sources=sources or None
            )
            session.add(message)
            
            # Update session last_message_at timestamp
            chat_session.last_message_at = datetime.utcnow()
            chat_session.updated_at = datetime.utcnow()
            
            session.commit()
            session.refresh(message)
            return message
    
    def get_session_messages(
        self, 
        session_id: int,
        user_id: str,
        limit: Optional[int] = None
    ) -> List[ChatMessage]:
        """
        Get all messages for a chat session.
        
        Args:
            session_id: Chat session ID
            user_id: User ID for access control
            limit: Optional limit on number of messages
            
        Returns:
            List of ChatMessage ordered by creation time
            
        Raises:
            ValueError: If session doesn't exist or doesn't belong to user
        """
        with session_scope() as session:
            # Verify session belongs to user
            chat_session = session.exec(
                select(ChatSession).where(
                    ChatSession.id == session_id,
                    ChatSession.user_id == user_id
                )
            ).first()
            
            if not chat_session:
                raise ValueError(f"Session {session_id} not found for user {user_id}")
            
            # Get messages
            query = select(ChatMessage).where(
                ChatMessage.session_id == session_id
            ).order_by(ChatMessage.created_at.asc())
            
            if limit:
                query = query.limit(limit)
            
            messages = session.exec(query).all()
            return list(messages)
    
    def get_notebook_session(
        self, 
        user_id: str, 
        notebook_id: int
    ) -> Optional[ChatSession]:
        """
        Get existing chat session for a notebook.
        
        Args:
            user_id: User identifier
            notebook_id: Notebook ID
            
        Returns:
            ChatSession if exists, None otherwise
        """
        with session_scope() as session:
            return session.exec(
                select(ChatSession).where(
                    ChatSession.user_id == user_id,
                    ChatSession.notebook_id == notebook_id
                )
            ).first()
    
    def get_user_sessions(
        self,
        user_id: str,
        limit: Optional[int] = None
    ) -> List[ChatSession]:
        """
        Get all chat sessions for a user.
        
        Args:
            user_id: User identifier
            limit: Optional limit on sessions returned
            
        Returns:
            List of ChatSession ordered by last activity
        """
        with session_scope() as session:
            query = select(ChatSession).where(
                ChatSession.user_id == user_id
            ).order_by(ChatSession.last_message_at.desc().nullslast())
            
            if limit:
                query = query.limit(limit)
            
            sessions = session.exec(query).all()
            return list(sessions)
    
    def delete_session(
        self,
        session_id: int,
        user_id: str
    ) -> bool:
        """
        Delete a chat session and all its messages.
        
        Args:
            session_id: Session to delete
            user_id: User ID for access control
            
        Returns:
            True if deleted, False if not found
        """
        with session_scope() as session:
            # Verify session belongs to user
            chat_session = session.exec(
                select(ChatSession).where(
                    ChatSession.id == session_id,
                    ChatSession.user_id == user_id
                )
            ).first()
            
            if not chat_session:
                return False
            
            # Delete messages first (foreign key constraint)
            messages = session.exec(
                select(ChatMessage).where(ChatMessage.session_id == session_id)
            ).all()
            
            for message in messages:
                session.delete(message)
            
            # Delete session
            session.delete(chat_session)
            session.commit()
            return True
    
    def get_session_message_count(
        self,
        session_id: int,
        user_id: str
    ) -> int:
        """
        Get count of messages in a session.
        
        Args:
            session_id: Session ID
            user_id: User ID for access control
            
        Returns:
            Number of messages in session
        """
        with session_scope() as session:
            # Verify session belongs to user
            chat_session = session.exec(
                select(ChatSession).where(
                    ChatSession.id == session_id,
                    ChatSession.user_id == user_id
                )
            ).first()
            
            if not chat_session:
                return 0
            
            count = len(session.exec(
                select(ChatMessage).where(ChatMessage.session_id == session_id)
            ).all())
            
            return count


# Export singleton instance for consistent usage
chat_service = ChatService()