import { test, expect } from '../utils/setup';

test.describe('AI Assistant Interaction', () => {
  test('should ask a simple question and get response', async ({ page }) => {
    
    await page.goto('/');
    
    // Fill in question
    const questionInput = page.locator('textarea').first();
    await questionInput.fill('What is artificial intelligence?');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for response - look for AI message content in ReactMarkdown
    await page.waitForSelector('.mb-3.leading-7', { timeout: 30000 });
    
    // Verify response is displayed - target the markdown paragraph content
    const response = page.locator('.mb-3.leading-7').last();
    await expect(response).toBeVisible();
    
    // Check that actual content exists (not just loading spinner)
    await expect(page.locator('.animate-spin')).not.toBeVisible();
    const responseText = await response.textContent();
    expect(responseText?.length).toBeGreaterThan(0);
  });

  test('should handle deep research mode', async ({ page }) => {
    await page.goto('/');
    
    const questionInput = page.locator('textarea').first();
    await questionInput.fill('Latest developments in AI 2025');
    
    // Enable deep research if toggle exists
    const deepResearchToggle = page.locator('input[type="checkbox"]');
    if (await deepResearchToggle.count() > 0) {
      await deepResearchToggle.check();
    }
    
    await page.click('button[type="submit"]');
    
    // Wait for response (longer timeout for research)
    await page.waitForSelector('.mb-3.leading-7', { timeout: 60000 });
    
    const response = page.locator('.mb-3.leading-7').last();
    await expect(response).toBeVisible();
    await expect(page.locator('.animate-spin')).not.toBeVisible();
  });

  test('should display citations when available', async ({ page }) => {
    await page.goto('/');
    
    // Ask question that might generate citations
    const questionInput = page.locator('textarea').first();
    await questionInput.fill('Summarize recent research on machine learning');
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('.mb-3.leading-7', { timeout: 30000 });
    
    // Check if citations section appears - look for badge elements with links
    const citationsSection = page.locator('text=Citations');
    if (await citationsSection.count() > 0) {
      await expect(citationsSection).toBeVisible();
      
      // Verify citation links - look for badge components with links
      const citationLinks = page.locator('.text-blue-400');
      if (await citationLinks.count() > 0) {
        await expect(citationLinks.first()).toBeVisible();
      }
    }
  });

  test('should handle conversation history', async ({ page }) => {
    await page.goto('/');
    
    // First question
    const questionInput = page.locator('textarea').first();
    await questionInput.fill('What is machine learning?');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.mb-3.leading-7', { timeout: 30000 });
    await expect(page.locator('.animate-spin')).not.toBeVisible();
    
    // Second question (should maintain context)
    await questionInput.fill('Can you elaborate on that?');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.mb-3.leading-7', { timeout: 30000 });
    await expect(page.locator('.animate-spin')).not.toBeVisible();
    
    // Verify both AI responses are visible - count markdown paragraph elements
    const aiResponses = page.locator('.mb-3.leading-7');
    await expect(aiResponses).toHaveCount(2);
  });

  test('should handle assistant errors gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Test with empty input - should not submit
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    
    // Verify no AI response appeared (since empty submission should be prevented)
    const aiResponses = page.locator('.mb-3.leading-7');
    await expect(aiResponses).toHaveCount(0);
    
    // Test with very long input
    const longText = 'a'.repeat(10000);
    const questionInput = page.locator('textarea').first();
    await questionInput.fill(longText);
    await page.click('button[type="submit"]');
    
    // Should handle gracefully - either timeout, error message, or successful processing
    await page.waitForTimeout(3000);
    
    // Check if either an error state or loading stopped
    const isStillLoading = await page.locator('.animate-spin').isVisible();
    if (!isStillLoading) {
      // If not loading, either successful response or error handling occurred
      const hasError = await page.locator('.text-red-400').isVisible();
      const hasResponse = await page.locator('.mb-3.leading-7').count() > 0;
      expect(hasError || hasResponse).toBeTruthy();
    }
  });
});