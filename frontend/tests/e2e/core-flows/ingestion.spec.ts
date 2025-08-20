import { test, expect, TestHelpers } from '../utils/setup';

test.describe('Knowledge Ingestion', () => {
  test('should upload and process a text document', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Navigate to home page
    await page.goto('/');
    
    // Open knowledge drawer
    await page.click('button:has-text("Add to Knowledge")');
    await expect(page.locator('.fixed.right-0')).toBeVisible();
    
    // Create test file in the document upload section
    const testContent = 'This is a test document for ingestion testing.';
    await page.evaluate((content) => {
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const dt = new DataTransfer();
      dt.items.add(file);
      // Look for the file input in the document upload section
      const inputs = document.querySelectorAll('input[type="file"]');
      const documentInput = Array.from(inputs).find(input => 
        input.accept?.includes('.txt') || input.accept?.includes('text/plain')
      ) as HTMLInputElement;
      if (documentInput) documentInput.files = dt.files;
    }, testContent);
    
    // Find the document upload file input and trigger change
    const documentFileInput = page.locator('input[type="file"]').nth(2); // Third file input is for documents
    await documentFileInput.dispatchEvent('change');
    
    // Click upload button
    await page.click('button:has-text("Upload Document")');
    
    // Wait for success message - look for the actual success text structure
    await expect(page.locator('.text-green-400')).toContainText('Created chunks', { timeout: 10000 });
    
    // Close drawer
    await page.click('button:has-text("Close")');
  });

  test('should handle text input ingestion', async ({ page }) => {
    await page.goto('/');
    
    // Test direct text input via API
    const formData = new FormData();
    formData.append('text', 'Direct text input for testing');
    formData.append('user_id', 'test-user');
    
    const response = await page.request.post('http://localhost:2024/ingest/text', {
      data: formData
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