import type React from 'react';

const STOP_WORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  'did',
  'do',
  'does',
  'doing',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'just',
  'me',
  'more',
  'most',
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  'she',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'will',
  'with',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
]);

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeBoundaryPattern(term: string): string {
  const escaped = escapeRegExp(term);
  const startBoundary = /^\w/.test(term) ? '\\b' : '';
  const endBoundary = /\w$/.test(term) ? '\\b' : '';
  return `${startBoundary}${escaped}${endBoundary}`;
}

export interface TokenizedSearchTerms {
  exactTerms: string[];
  synonymTerms: string[];
}

/**
 * Parses user search query and backend-expanded synonyms into classified highlight term sets.
 * Exact query keywords take strict precedence over expanded synonyms.
 */
export function tokenizeSearchTerms(
  query?: string,
  expandedKeywords?: string[],
): TokenizedSearchTerms {
  const exactTermsSet = new Set<string>();
  const synonymTermsSet = new Set<string>();

  if (query && query.trim()) {
    const trimmed = query.trim().toLowerCase();
    // Add multi-word query phrase if applicable
    if (trimmed.includes(' ') && trimmed.length >= 3) {
      exactTermsSet.add(trimmed);
    }

    // Split query by whitespace and common punctuation delimiters
    const words = trimmed.split(/[\s,;:.!?()\[\]{}"'`]+/);
    for (const word of words) {
      if (word.length >= 2 && !STOP_WORDS.has(word)) {
        exactTermsSet.add(word);
      }
    }
  }

  if (expandedKeywords && Array.isArray(expandedKeywords)) {
    for (const keyword of expandedKeywords) {
      if (!keyword || typeof keyword !== 'string') continue;
      const lowerKeyword = keyword.trim().toLowerCase();
      if (!lowerKeyword || lowerKeyword.length < 2) continue;

      // Only treat as synonym if not already part of exact query terms
      if (!exactTermsSet.has(lowerKeyword)) {
        synonymTermsSet.add(lowerKeyword);
      }

      // If synonym is a multi-word phrase, also index meaningful individual words
      if (lowerKeyword.includes(' ')) {
        const subWords = lowerKeyword.split(/[\s,;:.!?()\[\]{}"'`]+/);
        for (const subWord of subWords) {
          if (
            subWord.length >= 3 &&
            !STOP_WORDS.has(subWord) &&
            !exactTermsSet.has(subWord)
          ) {
            synonymTermsSet.add(subWord);
          }
        }
      }
    }
  }

  return {
    exactTerms: Array.from(exactTermsSet),
    synonymTerms: Array.from(synonymTermsSet),
  };
}

type HighlightToken =
  | { type: 'text'; text: string }
  | { type: 'exact'; text: string }
  | { type: 'synonym'; text: string };

/**
 * Highlights exact query terms and expanded semantic synonyms with distinct styling.
 * Applies exact query matches first, followed by synonym matches in remaining text segments.
 */
export function renderHighlightedText(
  text: string,
  query?: string,
  expandedKeywords?: string[],
): React.ReactNode {
  if (!text) return '';

  const { exactTerms, synonymTerms } = tokenizeSearchTerms(
    query,
    expandedKeywords,
  );

  if (exactTerms.length === 0 && synonymTerms.length === 0) {
    return text;
  }

  // Pass 1: Exact matches
  let tokens: HighlightToken[] = [{ type: 'text', text }];

  if (exactTerms.length > 0) {
    const sortedExact = [...exactTerms].sort((a, b) => b.length - a.length);
    const exactRegex = new RegExp(
      `(${sortedExact.map(makeBoundaryPattern).join('|')})`,
      'gi',
    );

    const nextTokens: HighlightToken[] = [];
    for (const token of tokens) {
      if (token.type !== 'text') {
        nextTokens.push(token);
        continue;
      }
      const parts = token.text.split(exactRegex);
      for (const part of parts) {
        if (!part) continue;
        const isMatch = sortedExact.some(
          (t) => t.toLowerCase() === part.toLowerCase(),
        );
        if (isMatch) {
          nextTokens.push({ type: 'exact', text: part });
        } else {
          nextTokens.push({ type: 'text', text: part });
        }
      }
    }
    tokens = nextTokens;
  }

  // Pass 2: Synonym matches
  if (synonymTerms.length > 0) {
    const sortedSynonyms = [...synonymTerms].sort(
      (a, b) => b.length - a.length,
    );
    const synonymRegex = new RegExp(
      `(${sortedSynonyms.map(makeBoundaryPattern).join('|')})`,
      'gi',
    );

    const nextTokens: HighlightToken[] = [];
    for (const token of tokens) {
      if (token.type !== 'text') {
        nextTokens.push(token);
        continue;
      }
      const parts = token.text.split(synonymRegex);
      for (const part of parts) {
        if (!part) continue;
        const isMatch = sortedSynonyms.some(
          (t) => t.toLowerCase() === part.toLowerCase(),
        );
        if (isMatch) {
          nextTokens.push({ type: 'synonym', text: part });
        } else {
          nextTokens.push({ type: 'text', text: part });
        }
      }
    }
    tokens = nextTokens;
  }

  if (tokens.length === 1 && tokens[0]?.type === 'text') {
    return text;
  }

  return tokens.map((token, index) => {
    if (token.type === 'exact') {
      return (
        <mark
          key={`exact-${index}-${token.text}`}
          className="search-highlight-exact"
          title="Direct query keyword match"
        >
          {token.text}
        </mark>
      );
    }
    if (token.type === 'synonym') {
      return (
        <mark
          key={`synonym-${index}-${token.text}`}
          className="search-highlight-synonym"
          title="Expanded synonym / acronym match"
        >
          {token.text}
        </mark>
      );
    }
    return token.text;
  });
}

export interface HighlightedSnippetProps {
  text: string;
  query?: string;
  expandedKeywords?: string[];
  className?: string;
}

export function HighlightedSnippet({
  text,
  query,
  expandedKeywords,
  className,
}: HighlightedSnippetProps) {
  const content = renderHighlightedText(text, query, expandedKeywords);

  if (className) {
    return <span className={className}>{content}</span>;
  }

  return <>{content}</>;
}
