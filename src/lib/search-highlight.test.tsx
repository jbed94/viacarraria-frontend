import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  HighlightedSnippet,
  renderHighlightedText,
  tokenizeSearchTerms,
} from './search-highlight';

describe('search-highlight utility', () => {
  describe('tokenizeSearchTerms', () => {
    it('extracts exact query words ignoring stop words and single characters', () => {
      const { exactTerms, synonymTerms } = tokenizeSearchTerms(
        'how to deploy k8s in cloud',
        ['kubernetes', 'cloud computing'],
      );

      expect(exactTerms).toContain('deploy');
      expect(exactTerms).toContain('k8s');
      expect(exactTerms).toContain('cloud');
      // Stop words omitted
      expect(exactTerms).not.toContain('how');
      expect(exactTerms).not.toContain('to');
      expect(exactTerms).not.toContain('in');

      // Synonym terms
      expect(synonymTerms).toContain('kubernetes');
      expect(synonymTerms).toContain('cloud computing');
      expect(synonymTerms).toContain('computing');
      // 'cloud' was in exact query so it must not be in synonymTerms
      expect(synonymTerms).not.toContain('cloud');
    });

    it('handles empty or missing query and expandedKeywords gracefully', () => {
      const empty = tokenizeSearchTerms(undefined, undefined);
      expect(empty.exactTerms).toEqual([]);
      expect(empty.synonymTerms).toEqual([]);

      const emptyStrings = tokenizeSearchTerms('', []);
      expect(emptyStrings.exactTerms).toEqual([]);
      expect(emptyStrings.synonymTerms).toEqual([]);
    });
  });

  describe('renderHighlightedText', () => {
    it('returns original string when query and expandedKeywords are empty', () => {
      const output = renderHighlightedText('Simple raw text snippet.');
      expect(output).toBe('Simple raw text snippet.');
    });

    it('renders exact keyword match with search-highlight-exact class', () => {
      const { container } = render(
        <div>
          {renderHighlightedText(
            'Weaviate supports hybrid search for fast vector lookups.',
            'weaviate vector',
          )}
        </div>,
      );

      const exactMarks = container.querySelectorAll('.search-highlight-exact');
      expect(exactMarks.length).toBe(2);
      expect(exactMarks[0]?.textContent).toBe('Weaviate');
      expect(exactMarks[1]?.textContent).toBe('vector');
    });

    it('renders synonym match with search-highlight-synonym class', () => {
      const { container } = render(
        <div>
          {renderHighlightedText(
            'The cluster uses Kubernetes for managing pods.',
            'k8s',
            ['kubernetes'],
          )}
        </div>,
      );

      const exactMarks = container.querySelectorAll('.search-highlight-exact');
      const synonymMarks = container.querySelectorAll(
        '.search-highlight-synonym',
      );

      expect(exactMarks.length).toBe(0);
      expect(synonymMarks.length).toBe(1);
      expect(synonymMarks[0]?.textContent).toBe('Kubernetes');
    });

    it('preserves casing of matched text in snippets', () => {
      const { container } = render(
        <div>
          {renderHighlightedText(
            'KUBERNETES and kubernetes are the same.',
            'k8s',
            ['kubernetes'],
          )}
        </div>,
      );

      const marks = container.querySelectorAll('.search-highlight-synonym');
      expect(marks.length).toBe(2);
      expect(marks[0]?.textContent).toBe('KUBERNETES');
      expect(marks[1]?.textContent).toBe('kubernetes');
    });

    it('prioritizes exact query match over synonym match', () => {
      const { container } = render(
        <div>
          {renderHighlightedText(
            'PostgreSQL database engine optimization.',
            'postgresql database',
            ['database', 'rdbms'],
          )}
        </div>,
      );

      const exactMarks = container.querySelectorAll('.search-highlight-exact');
      const synonymMarks = container.querySelectorAll(
        '.search-highlight-synonym',
      );

      expect(exactMarks.length).toBe(1);
      expect(exactMarks[0]?.textContent).toBe('PostgreSQL database');
      expect(synonymMarks.length).toBe(0);
    });

    it('matches multi-word phrases correctly without duplicate splitting', () => {
      const { container } = render(
        <div>
          {renderHighlightedText(
            'We recommend container orchestration for scalable systems.',
            'orchestration',
            ['container orchestration'],
          )}
        </div>,
      );

      const exactMarks = container.querySelectorAll('.search-highlight-exact');
      expect(exactMarks.length).toBe(1);
      expect(exactMarks[0]?.textContent).toBe('orchestration');

      const synonymMarks = container.querySelectorAll(
        '.search-highlight-synonym',
      );
      expect(synonymMarks.length).toBe(1);
      expect(synonymMarks[0]?.textContent).toBe('container');
    });
  });

  describe('HighlightedSnippet Component', () => {
    it('renders with optional className wrapping container', () => {
      render(
        <HighlightedSnippet
          text="FastStream message queue processing"
          query="queue"
          expandedKeywords={['broker']}
          className="custom-snippet-class"
        />,
      );

      const container = screen.getByText('queue').closest('span');
      expect(container).toHaveClass('custom-snippet-class');
      expect(screen.getByText('queue')).toHaveClass('search-highlight-exact');
    });
  });
});
