import { test, expect, TestHelpers } from '../utils/setup';

test.describe('AI Assistant Interaction', () => {
  test('should ask a simple question and get response', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/');
    
    // Fill in question
    const questionInput = page.locator('textarea').first();
    await questionInput.fill('What is artificial intelligence?');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for response
    await page.waitForSelector('.text-sm.whitespace-pre-wrap', { timeout: 30000 });
    
    // Verify response is displayed
    const response = page.locator('.text-sm.whitespace-pre-wrap');
    await expect(response).toBeVisible();
    await expect(response).not.toHaveText('');
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
    await page.waitForSelector('.text-sm.whitespace-pre-wrap', { timeout: 60000 });
    
    const response = page.locator('.text-sm.whitespace-pre-wrap');
    await expect(response).toBeVisible();
  });

  test('should display citations when available', async ({ page }) => {
    await page.goto('/');
    
    // Ask question that might generate citations
    const questionInput = page.locator('textarea').first();
    await questionInput.fill('Summarize recent research on machine learning');
    
    await page.click('button[type="submit"]');
    await page.waitForSelector('.text-sm.whitespace-pre-wrap', { timeout: 30000 });
    
    // Check if citations section appears
    const citationsSection = page.locator('.text-xs.text-neutral-400:has-text("Citations")');
    if (await citationsSection.count() > 0) {
      await expect(citationsSection).toBeVisible();
      
      // Verify citation links
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
    await page.waitForSelector('.text-sm.whitespace-pre-wrap', { timeout: 30000 });
    
    // Second question (should maintain context)
    await questionInput.fill('Can you elaborate on that?');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.text-sm.whitespace-pre-wrap', { timeout: 30000 });
    
    // Verify both responses are visible
    const responses = page.locator('.text-sm.whitespace-pre-wrap');
    await expect(responses).toHaveCount(2);
  });

  test('should handle assistant errors gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Test with empty input
    await page.click('button[type="submit"]');
    
    // Should not submit or show error
    // Exact behavior depends on validation logic
    
    // Test with very long input
    const longText = 'a'.repeat(10000);
    const questionInput = page.locator('textarea').first();
    await questionInput.fill(longText);
    await page.click('button[type="submit"]');
    
    // Should handle gracefully (timeout or error message)
    await page.waitForTimeout(2000);
  });
});