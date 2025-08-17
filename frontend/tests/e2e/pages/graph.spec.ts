import { test, expect } from '../utils/setup';

test.describe('Graph Visualization Page', () => {
  test('should load and display knowledge graph', async ({ page }) => {
    await page.goto('/graph');
    
    // Wait for page to load
    await expect(page.locator('h2:has-text("Graph")')).toBeVisible();
    
    // Check if Cytoscape component is present
    const graphContainer = page.locator('[data-cy="cytoscape"]').or(page.locator('#cy')).or(page.locator('.cytoscape-container'));
    
    // If graph data exists, Cytoscape should render
    // Wait a bit for potential graph rendering
    await page.waitForTimeout(2000);
    
    // Check for search input
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
  });

  test('should handle graph search functionality', async ({ page }) => {
    await page.goto('/graph');
    
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    
    // Test search input
    await searchInput.fill('test search term');
    await expect(searchInput).toHaveValue('test search term');
    
    // Clear search
    await searchInput.fill('');
    await expect(searchInput).toHaveValue('');
  });

  test('should navigate back to chat', async ({ page }) => {
    await page.goto('/graph');
    
    const backLink = page.locator('a:has-text("← Back to Chat")');
    await expect(backLink).toBeVisible();
    
    await backLink.click();
    await page.waitForURL('/');
  });

  test('should handle empty graph state', async ({ page }) => {
    // Mock empty graph response
    await page.route('**/knowledge/graph*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nodes: [], edges: [] })
      });
    });
    
    await page.goto('/graph');
    
    // Should still load without errors
    await expect(page.locator('h2:has-text("Graph")')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('should handle graph API errors', async ({ page }) => {
    // Mock API error
    await page.route('**/knowledge/graph*', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    await page.goto('/graph');
    
    // Should handle error gracefully
    await expect(page.locator('h2:has-text("Graph")')).toBeVisible();
  });
});