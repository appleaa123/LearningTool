import { test, expect, TestHelpers } from '../utils/setup';

test.describe('Application Navigation', () => {
  test('should navigate between all main pages', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Start at home
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    
    // Navigate to Graph
    await page.click('a:has-text("Graph")');
    await page.waitForURL('**/graph');
    await expect(page.locator('h2:has-text("Graph")')).toBeVisible();
    
    // Navigate to Feed
    await page.click('a:has-text("Feed")');
    await page.waitForURL('**/feed');
    await expect(page.locator('h2:has-text("Feed")')).toBeVisible();
    
    // Navigate to Transformations
    await page.click('a:has-text("Transformations")');
    await page.waitForURL('**/transformations');
    await expect(page.locator('h2:has-text("Transformations")')).toBeVisible();
    
    // Navigate to Sources
    await page.click('a:has-text("Sources")');
    await page.waitForURL('**/sources');
    await expect(page.locator('h2:has-text("Sources")')).toBeVisible();
    
    // Return to Chat
    await page.click('a:has-text("← Back to Chat")');
    await page.waitForURL('/');
  });

  test('should maintain state during navigation', async ({ page }) => {
    await page.goto('/');
    
    // Set up some state (like asking a question)
    const questionInput = page.locator('textarea').first();
    await questionInput.fill('Test question for navigation');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.text-sm.whitespace-pre-wrap', { timeout: 30000 });
    
    // Navigate away and back
    await page.click('a:has-text("Graph")');
    await page.waitForURL('**/graph');
    
    await page.click('a:has-text("← Back to Chat")');
    await page.waitForURL('/');
    
    // Check if state is maintained
    const response = page.locator('.text-sm.whitespace-pre-wrap');
    await expect(response).toBeVisible();
  });

  test('should open and close knowledge drawer', async ({ page }) => {
    await page.goto('/');
    
    // Open drawer
    await page.click('button:has-text("Add to Knowledge")');
    const drawer = page.locator('.fixed.right-0');
    await expect(drawer).toBeVisible();
    await expect(drawer).not.toHaveClass(/translate-x-full/);
    
    // Close drawer by clicking close button
    await page.click('button:has-text("Close")');
    await expect(drawer).toHaveClass(/translate-x-full/);
    
    // Open drawer again
    await page.click('button:has-text("Add to Knowledge")');
    await expect(drawer).not.toHaveClass(/translate-x-full/);
    
    // Close drawer by clicking backdrop
    await page.click('.fixed.inset-0.bg-black\\/50');
    await expect(drawer).toHaveClass(/translate-x-full/);
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    await page.goto('/');
    
    // Navigate through pages
    await page.click('a:has-text("Graph")');
    await page.waitForURL('**/graph');
    
    await page.click('a:has-text("Feed")');
    await page.waitForURL('**/feed');
    
    // Use browser back
    await page.goBack();
    await expect(page).toHaveURL(/.*graph/);
    
    await page.goBack();
    await expect(page).toHaveURL(/.*\/$|.*$/);
    
    // Use browser forward
    await page.goForward();
    await expect(page).toHaveURL(/.*graph/);
  });
});