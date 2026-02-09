import { describe, it, expect } from 'vitest';
import { calculateContextBudget, buildContextPrompt } from '../lib/ragRetrieval';

describe('Full-Context Retrieval System', () => {
  describe('calculateContextBudget', () => {
    it('should calculate available budget for empty manuscript', () => {
      const budget = calculateContextBudget(0, 0);

      expect(budget.totalBudget).toBe(600_000);
      expect(budget.used).toBe(3_000); // just prompt overhead
      expect(budget.availableForSources).toBe(597_000);
    });

    it('should subtract manuscript words from budget', () => {
      const budget = calculateContextBudget(50_000, 0);

      expect(budget.used).toBe(53_000); // 50K manuscript + 3K overhead
      expect(budget.availableForSources).toBe(547_000);
    });

    it('should subtract both manuscript and outline words', () => {
      const budget = calculateContextBudget(100_000, 10_000);

      expect(budget.used).toBe(113_000); // 100K + 10K + 3K
      expect(budget.availableForSources).toBe(487_000);
    });

    it('should return 0 available when budget is exceeded', () => {
      const budget = calculateContextBudget(400_000, 200_000);

      expect(budget.availableForSources).toBe(0);
    });

    it('should handle very large manuscripts gracefully', () => {
      const budget = calculateContextBudget(700_000, 0);

      expect(budget.availableForSources).toBe(0);
      expect(budget.used).toBe(703_000);
    });
  });

  describe('buildContextPrompt', () => {
    it('should return empty string with no sources or starred messages', () => {
      const prompt = buildContextPrompt({
        sources: [],
        starredMessages: [],
        budget: { totalBudget: 600_000, used: 3_000, availableForSources: 597_000, sourceWordsUsed: 0 },
      });

      expect(prompt).toBe('');
    });

    it('should include source materials in prompt', () => {
      const prompt = buildContextPrompt({
        sources: [
          {
            title: 'Test Source',
            authorName: 'Test Author',
            wordCount: 1000,
            content: 'This is test content from the source material.',
          },
        ],
        starredMessages: [],
        budget: { totalBudget: 600_000, used: 4_000, availableForSources: 596_000, sourceWordsUsed: 1000 },
      });

      expect(prompt).toContain('<source_materials>');
      expect(prompt).toContain('Test Source');
      expect(prompt).toContain('Test Author');
      expect(prompt).toContain('test content');
      expect(prompt).toContain('</source_materials>');
    });

    it('should include starred messages in prompt', () => {
      const prompt = buildContextPrompt({
        sources: [],
        starredMessages: [
          {
            content: 'This is a starred insight',
            role: 'assistant',
            createdAt: new Date(),
          },
        ],
        budget: { totalBudget: 600_000, used: 3_000, availableForSources: 597_000, sourceWordsUsed: 0 },
      });

      expect(prompt).toContain('<starred_insights>');
      expect(prompt).toContain('starred insight');
      expect(prompt).toContain('</starred_insights>');
    });

    it('should include both sources and starred messages', () => {
      const prompt = buildContextPrompt({
        sources: [
          { title: 'Source', authorName: null, wordCount: 500, content: 'Source text' },
        ],
        starredMessages: [
          { content: 'Starred text', role: 'user', createdAt: new Date() },
        ],
        budget: { totalBudget: 600_000, used: 3_500, availableForSources: 596_500, sourceWordsUsed: 500 },
      });

      expect(prompt).toContain('<source_materials>');
      expect(prompt).toContain('<starred_insights>');
    });
  });
});
