#!/usr/bin/env python3
"""
Quick validation script for REQ-005 parsing enhancements.
Tests the core parsing functions with sample LLM responses.
"""

from src.ingestion.transformations import (
    parse_summary_response,
    parse_qa_response, 
    parse_flashcard_response
)

def test_summary_parsing():
    """Test summary parsing with bullet points."""
    print("Testing Summary Parsing...")
    llm_response = """This is a comprehensive overview of machine learning concepts.

• Machine learning enables computers to learn from data
• Deep learning uses neural networks with multiple layers  
• Supervised learning requires labeled training data
• Unsupervised learning finds patterns in unlabeled data"""
    
    result = parse_summary_response(llm_response)
    print(f"✅ Summary parsed: {len(result['key_points'])} key points found")
    print(f"✅ Confidence score: {result['confidence_score']}")
    assert len(result['key_points']) == 4
    assert result['confidence_score'] >= 0.8
    return True

def test_qa_parsing():
    """Test Q&A parsing with structured format."""
    print("\nTesting Q&A Parsing...")
    llm_response = """Q: What is artificial intelligence?
A: Artificial intelligence (AI) is the simulation of human intelligence by machines.

Q: How does machine learning relate to AI?  
A: Machine learning is a subset of AI that focuses on algorithms that improve through experience."""
    
    result = parse_qa_response(llm_response)
    print(f"✅ Q&A parsed: {len(result['qa_pairs'])} pairs found")
    print(f"✅ First question: {result['question']}")
    assert len(result['qa_pairs']) == 2
    assert "artificial intelligence" in result['question'].lower()
    return True

def test_flashcard_parsing():
    """Test flashcard parsing with Front/Back format."""
    print("\nTesting Flashcard Parsing...")
    llm_response = """Front: What is Python?
Back: Python is a high-level, interpreted programming language known for its simplicity.

Front: What are Python's main uses?
Back: Python is used for web development, data science, automation, and artificial intelligence."""
    
    result = parse_flashcard_response(llm_response)
    print(f"✅ Flashcard parsed: {result['total_cards']} cards found")
    print(f"✅ First card front: {result['front']}")
    print(f"✅ Difficulty assigned: {result['difficulty']}")
    assert result['total_cards'] == 2
    assert "Python" in result['front']
    return True

def test_fallback_scenarios():
    """Test fallback parsing for unstructured content."""
    print("\nTesting Fallback Scenarios...")
    
    # Test with minimal content
    minimal_content = "This is a short piece of text."
    summary_result = parse_summary_response(minimal_content)
    print(f"✅ Minimal summary handled: confidence {summary_result['confidence_score']}")
    
    # Test with question-like content for Q&A
    question_content = "What is the meaning of life? It's a philosophical question with many possible answers."
    qa_result = parse_qa_response(question_content)
    print(f"✅ Question format detected: {qa_result['question'][:30]}...")
    
    # Test with unstructured content for flashcard
    unstructured = "JavaScript is a programming language. It runs in browsers and servers."
    card_result = parse_flashcard_response(unstructured)
    print(f"✅ Fallback flashcard created: {len(card_result['cards'])} card(s)")
    
    return True

def main():
    """Run all validation tests."""
    print("🔍 REQ-005 Knowledge Feed Debug - Parsing Validation")
    print("=" * 60)
    
    try:
        test_summary_parsing()
        test_qa_parsing() 
        test_flashcard_parsing()
        test_fallback_scenarios()
        
        print("\n" + "=" * 60)
        print("🎉 All parsing functions validated successfully!")
        print("✅ Summary cards: Enhanced with key_points and confidence")
        print("✅ Q&A cards: Structured question/answer extraction")
        print("✅ Flashcard cards: Front/back parsing with difficulty")
        print("✅ Fallback handling: Graceful degradation for unstructured data")
        
    except Exception as e:
        print(f"\n❌ Validation failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)