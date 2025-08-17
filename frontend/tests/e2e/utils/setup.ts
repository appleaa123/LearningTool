import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  // Global setup for all tests
  async page({ page }, use) {
    // Clear any existing data before each test
    await page.goto('/');
    
    // Wait for app to load
    await expect(page.locator('body')).toBeVisible();
    
    // Clear localStorage to reset notebook selection
    await page.evaluate(() => localStorage.clear());
    
    await use(page);
  },
});

export { expect } from '@playwright/test';

// Helper functions
export class TestHelpers {
  constructor(private page: any) {}

  async waitForAssistantResponse() {
    // Wait for loading state to finish
    await this.page.waitForSelector('[data-testid="assistant-loading"]', { state: 'hidden', timeout: 30000 });
  }

  async uploadTestDocument(filename: string) {
    await this.page.click('button:has-text("Add to Knowledge")');
    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(`tests/e2e/fixtures/test-documents/${filename}`);
    
    // Wait for upload success
    await this.page.waitForSelector('.text-green-400:has-text("Created chunks")', { timeout: 10000 });
  }

  async navigateToPage(pageName: 'graph' | 'feed' | 'transformations' | 'sources') {
    await this.page.click(`a:has-text("${pageName.charAt(0).toUpperCase() + pageName.slice(1)}")`);
    await this.page.waitForURL(`**/${pageName}`);
  }

  async askQuestion(question: string, options: { effort?: string; deepResearch?: boolean } = {}) {
    await this.page.fill('textarea[placeholder*="Ask"]', question);
    
    if (options.effort) {
      await this.page.selectOption('select:has-text("effort")', options.effort);
    }
    
    if (options.deepResearch) {
      await this.page.check('input[type="checkbox"]:has-text("Deep Research")');
    }
    
    await this.page.click('button[type="submit"]');
    await this.waitForAssistantResponse();
  }
}