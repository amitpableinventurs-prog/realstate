import React from 'react';

// Renders the plain-text article format written in the admin panel:
// blank lines separate blocks, "## " starts a heading, "- " starts a bullet.
// Built from React elements only, so no admin-entered HTML reaches the page.

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string };

const parseBlocks = (content: string): Block[] => {
  const blocks: Block[] = [];
  for (const chunk of content.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    let paragraph: string[] = [];
    const flushParagraph = () => {
      if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    };

    for (const line of lines) {
      if (line.startsWith('## ')) {
        flushParagraph();
        blocks.push({ kind: 'heading', text: line.slice(3) });
      } else if (line.startsWith('- ')) {
        flushParagraph();
        const last = blocks[blocks.length - 1];
        if (last?.kind === 'list') last.items.push(line.slice(2));
        else blocks.push({ kind: 'list', items: [line.slice(2)] });
      } else {
        paragraph.push(line);
      }
    }
    flushParagraph();
  }
  return blocks;
};

const ArticleBody: React.FC<{ content: string }> = ({ content }) => (
  <div className="font-manrope text-[17px] leading-[1.8] text-[#374151]">
    {parseBlocks(content).map((block, i) => {
      if (block.kind === 'heading') {
        return (
          <h2 key={i} className="font-fraunces text-2xl text-[#1A0A1E] mt-10 mb-4 first:mt-0">
            {block.text}
          </h2>
        );
      }
      if (block.kind === 'list') {
        return (
          <ul key={i} className="my-5 space-y-2">
            {block.items.map((item, j) => (
              <li key={j} className="flex gap-3">
                <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A3078F]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        );
      }
      return <p key={i} className="my-5">{block.text}</p>;
    })}
  </div>
);

export default ArticleBody;
