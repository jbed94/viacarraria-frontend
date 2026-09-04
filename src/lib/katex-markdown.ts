import katex from 'katex';
import type { MarkedExtension } from 'marked';

const inlineRule = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n\$]))\1/;
const blockRule = /^(\${1,2})\n((?:\\[^]|[^\\])+?)\n\1(?:\n|$)/;

export function katexExtension(): MarkedExtension {
  return {
    extensions: [
      {
        name: 'inlineKatex',
        level: 'inline',
        start(src: string) {
          return src.indexOf('$');
        },
        tokenizer(src: string) {
          const match = src.match(inlineRule);
          const delimiter = match?.[1];
          const math = match?.[2];
          if (match && delimiter && math) {
            return {
              type: 'inlineKatex',
              raw: match[0],
              text: math.trim(),
              displayMode: delimiter.length === 2,
            };
          }
        },
        renderer(token) {
          try {
            return katex.renderToString(
              (token as { text?: string }).text ?? '',
              {
                displayMode: Boolean(
                  (token as { displayMode?: boolean }).displayMode,
                ),
                throwOnError: false,
              },
            );
          } catch {
            return (token as { text?: string }).text ?? '';
          }
        },
      },
      {
        name: 'blockKatex',
        level: 'block',
        tokenizer(src: string) {
          const match = src.match(blockRule);
          const delimiter = match?.[1];
          const math = match?.[2];
          if (match && delimiter && math) {
            return {
              type: 'blockKatex',
              raw: match[0],
              text: math.trim(),
              displayMode: true,
            };
          }
        },
        renderer(token) {
          try {
            return (
              '<div class="katex-display">' +
              katex.renderToString((token as { text?: string }).text ?? '', {
                displayMode: true,
                throwOnError: false,
              }) +
              '</div>\n'
            );
          } catch {
            return (token as { text?: string }).text ?? '';
          }
        },
      },
    ],
  };
}
