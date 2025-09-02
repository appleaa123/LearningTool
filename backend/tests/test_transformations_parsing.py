"""
Tests for enhanced LLM response parsing in transformations.py

This module tests the structured metadata extraction from LLM responses
to ensure proper card type rendering in the frontend.
"""
import pytest
from src.ingestion.transformations import (
    parse_summary_response,
    parse_qa_response, 
    parse_flashcard_response
)


class TestSummaryParsing:
    """Test summary response parsing functionality."""
    
    def test_parse_summary_with_bullet_points(self):
        """Test parsing summary with clear bullet points."""
        llm_response = """This is a comprehensive summary of the content.

• Key point one about the topic
• Second important insight 
• Third critical finding
• Final summary point"""
        
        result = parse_summary_response(llm_response)
        
        assert result["summary"] == llm_response.strip()
        assert len(result["key_points"]) == 4
        assert result["key_points"][0] == "Key point one about the topic"
        assert result["confidence_score"] >= 0.8  # Should be high with 4 points
    
    def test_parse_summary_with_numbered_points(self):
        """Test parsing summary with numbered list."""
        llm_response = """Content summary here.

1. First numbered point
2. Second numbered point  
3. Third numbered point"""
        
        result = parse_summary_response(llm_response)
        
        assert len(result["key_points"]) == 3
        assert result["key_points"][0] == "First numbered point"
        assert result["confidence_score"] > 0.5
    
    def test_parse_summary_without_bullets(self):
        """Test parsing summary without clear bullet points."""
        llm_response = "This is a short summary without bullet points. It should still work."
        
        result = parse_summary_response(llm_response)
        
        assert result["summary"] == llm_response
        assert len(result["key_points"]) >= 1  # Should fallback to sentences
        assert result["confidence_score"] > 0.3


class TestQAParsing:
    """Test Q&A response parsing functionality."""
    
    def test_parse_qa_structured_format(self):
        """Test parsing Q&A with clear Q:/A: format."""
        llm_response = """Q: What is the main concept discussed?
A: The main concept is about structured data parsing for knowledge management.

Q: How does this improve user experience?
A: It provides better card rendering with consistent data formats."""
        
        result = parse_qa_response(llm_response)
        
        assert len(result["qa_pairs"]) == 2
        assert result["question"] == "What is the main concept discussed?"
        assert "structured data parsing" in result["answer"]
        assert result["confidence_score"] > 0.5
    
    def test_parse_qa_single_pair(self):
        """Test parsing single Q&A pair."""
        llm_response = """Q: What is machine learning?
A: Machine learning is a subset of artificial intelligence that enables computers to learn from data."""
        
        result = parse_qa_response(llm_response)
        
        assert len(result["qa_pairs"]) == 1
        assert result["question"] == "What is machine learning?"
        assert "artificial intelligence" in result["answer"]
    
    def test_parse_qa_fallback_format(self):
        """Test Q&A parsing with unstructured format."""
        llm_response = """This is a question about the topic?

This would be the answer to that question with some details."""
        
        result = parse_qa_response(llm_response)
        
        assert len(result["qa_pairs"]) >= 1
        assert result["question"].endswith("?")
        assert len(result["answer"]) > 0


class TestFlashcardParsing:
    """Test flashcard response parsing functionality."""
    
    def test_parse_flashcard_structured_format(self):
        """Test parsing flashcards with Front:/Back: format."""
        llm_response = """Front: What is Python?
Back: Python is a high-level programming language known for its simplicity.

Front: What are Python's key features?
Back: Key features include dynamic typing, interpreted execution, and extensive libraries."""
        
        result = parse_flashcard_response(llm_response)
        
        assert len(result["cards"]) == 2
        assert result["front"] == "What is Python?"
        assert "high-level programming language" in result["back"]
        assert result["difficulty"] == "medium"  # default
        assert result["total_cards"] == 2
    
    def test_parse_flashcard_single_card(self):
        """Test parsing single flashcard."""
        llm_response = """Front: Define API
Back: Application Programming Interface - a set of protocols for building software applications."""
        
        result = parse_flashcard_response(llm_response)
        
        assert len(result["cards"]) == 1
        assert result["front"] == "Define API"
        assert "Application Programming Interface" in result["back"]
        assert result["total_cards"] == 1
    
    def test_parse_flashcard_difficulty_assignment(self):
        """Test that difficulty is assigned based on content length."""
        # Short content should be "easy"
        short_response = """Front: CSS
Back: Styling language"""
        
        result_short = parse_flashcard_response(short_response)
        assert result_short["difficulty"] == "easy"
        
        # Long content should be "hard"
        long_response = """Front: Explain the detailed architecture of microservices with all components
Back: Microservices architecture is a complex distributed system approach that involves breaking down applications into small, independent services that communicate through well-defined APIs and protocols."""
        
        result_long = parse_flashcard_response(long_response)
        assert result_long["difficulty"] == "hard"
    
    def test_parse_flashcard_fallback_format(self):
        """Test flashcard parsing with unstructured content."""
        llm_response = """This is some content that could be a flashcard.
It has multiple lines and should be split appropriately for front and back."""
        
        result = parse_flashcard_response(llm_response)
        
        assert len(result["cards"]) >= 1
        assert len(result["front"]) > 0
        assert len(result["back"]) > 0


class TestIntegrationScenarios:
    """Test integration scenarios with real-world-like data."""
    
    def test_empty_responses(self):
        """Test handling of empty or minimal responses."""
        assert parse_summary_response("")["confidence_score"] < 0.5
        assert parse_qa_response("")["question"] == "No question available"
        assert len(parse_flashcard_response("")["cards"]) == 0
    
    def test_malformed_responses(self):
        """Test handling of malformed LLM responses."""
        malformed = "This is just random text without any structure or format."
        
        # Should not crash and provide reasonable fallbacks
        summary_result = parse_summary_response(malformed)
        assert summary_result["summary"] == malformed
        
        qa_result = parse_qa_response(malformed) 
        assert qa_result["question"] != "No question available"  # Should extract something
        
        flashcard_result = parse_flashcard_response(malformed)
        assert len(flashcard_result["cards"]) >= 1  # Should create fallback card


if __name__ == "__main__":
    pytest.main([__file__, "-v"])