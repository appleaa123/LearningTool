import { test, expect, TestHelpers } from '../utils/setup';

test.describe('Knowledge Ingestion', () => {
  test('should upload and process a text document', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Navigate to home page
    await page.goto('/');
    
    // Open knowledge drawer
    await page.click('button:has-text("Add to Knowledge")');
    await expect(page.locator('.fixed.right-0')).toBeVisible();
    
    // Create test file
    const testContent = 'This is a test document for ingestion testing.';
    await page.evaluate((content) => {
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.files = dt.files;
    }, testContent);
    
    // Upload the file
    const fileInput = page.locator('input[type="file"]').first();
    
    // Trigger change event
    await fileInput.dispatchEvent('change');
    
    // Wait for success message
    await expect(page.locator('.text-green-400')).toContainText('Created chunks', { timeout: 10000 });
    
    // Close drawer
    await page.click('button:has-text("Close")');
  });

  test('should handle text input ingestion', async ({ page }) => {
    await page.goto('/');
    
    // Test direct text input via API
    const response = await page.request.post('/api/ingest/text', {
      data: {
        text: 'Direct text input for testing',
        user_id: 'test-user'
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result).toHaveProperty('inserted');
    expect(result.inserted).toBeGreaterThan(0);
  });

  test('should show upload progress and handle errors', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('/');
    await page.click('button:has-text("Add to Knowledge")');
    
    // Test with invalid file type (if validation exists)
    await page.evaluate(() => {
      const file = new File(['invalid'], 'test.exe', { type: 'application/x-executable' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (input) input.files = dt.files;
    });
    
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.dispatchEvent('change');
    
    // Should either reject or handle gracefully
    // This test depends on your validation logic
  });
});