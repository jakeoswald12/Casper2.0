import { describe, it, expect } from 'vitest';
import { extractKeywords, scoreChunk } from '../lib/ragRetrieval';

describe('RAG Retrieval System', () => {
  describe('extractKeywords', () => {
    it('should extract meaningful keywords from query', () => {
      const keywords = extractKeywords('Tell me about machine learning algorithms');
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
      expect(keywords).toContain('algorithms');
    });

    it('should filter out common stop words', () => {
      const keywords = extractKeywords('What is the best approach for writing');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('is');
      expect(keywords).not.toContain('what');
      expect(keywords).not.toContain('for');
    });

    it('should handle empty queries', () => {
      const keywords = extractKeywords('');
      expect(keywords).toEqual([]);
    });

    it('should lowercase all keywords', () => {
      const keywords = extractKeywords('Machine Learning AI');
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
      expect(keywords).not.toContain('Machine');
    });

    it('should filter short words', () => {
      const keywords = extractKeywords('I am a writer');
      expect(keywords).not.toContain('i');
      expect(keywords).not.toContain('am');
      expect(keywords).not.toContain('a');
      expect(keywords).toContain('writer');
    });
  });

  describe('scoreChunk', () => {
    it('should score chunks based on keyword matches', () => {
      const chunk = {
        content: 'Machine learning is a subset of artificial intelligence',
        sectionTitle: 'Introduction to ML',
      };
      const keywords = ['machine', 'learning', 'intelligence'];

      const score = scoreChunk(chunk, keywords);
      expect(score).toBeGreaterThan(0);
    });

    it('should give higher score for exact phrase matches', () => {
      const chunk1 = {
        content: 'Machine learning is powerful',
        sectionTitle: null,
      };
      const chunk2 = {
        content: 'The machine is learning quickly',
        sectionTitle: null,
      };
      const keywords = ['machine', 'learning'];

      const score1 = scoreChunk(chunk1, keywords);
      const score2 = scoreChunk(chunk2, keywords);

      // Both should have matches
      expect(score1).toBeGreaterThan(0);
      expect(score2).toBeGreaterThan(0);
    });

    it('should return 0 for no matches', () => {
      const chunk = {
        content: 'This is about cooking recipes',
        sectionTitle: 'Cooking',
      };
      const keywords = ['machine', 'learning'];

      const score = scoreChunk(chunk, keywords);
      expect(score).toBe(0);
    });

    it('should include section title in scoring', () => {
      const chunkWithTitle = {
        content: 'Some content',
        sectionTitle: 'Machine Learning Chapter',
      };
      const chunkWithoutTitle = {
        content: 'Some content',
        sectionTitle: null,
      };
      const keywords = ['machine', 'learning'];

      const scoreWith = scoreChunk(chunkWithTitle, keywords);
      const scoreWithout = scoreChunk(chunkWithoutTitle, keywords);

      expect(scoreWith).toBeGreaterThan(scoreWithout);
    });
  });
});
