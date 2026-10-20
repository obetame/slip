// markdown.ts renders a small, safe subset of Markdown.
//
// Every node is built with the DOM API and text goes in through
// textContent, so a slip that contains markup shows up as text. There is
// deliberately no innerHTML anywhere in this file: the input comes from a
// file a person dropped on the board, and this page shares an origin with
// the passphrase form.
//
// Supported: headings, paragraphs, fenced code, lists, block quotes,
// horizontal rules, and inline code, bold, italic, and links. Links are
// restricted to http and https. Anything else is left as literal text.

import { el } from "./dom";

const MAX_LINES = 4000;

const RE_FENCE_CAPTURE = /^\s*```(.*)$/;
const RE_FENCE_CLOSE = /^\s*```\s*$/;
const RE_HEADING_CAPTURE = /^(#{1,6})\s+(.*)$/;

// inline splits one line into text runs, code spans, emphasis, and links.
function inline(line: string, into: HTMLElement): void {
  let i = 0;
  let buf = "";

  function flush(): void {
    if (buf) {
      into.appendChild(document.createTextNode(buf));
      buf = "";
    }
  }

  while (i < line.length) {
    const ch = line.charAt(i);

    // Inline code: `like this`. No formatting inside.
    if (ch === "`") {
      const close = line.indexOf("`", i + 1);
      if (close > i + 1) {
        flush();
        const code = el("code", "md-code", line.slice(i + 1, close));
        into.appendChild(code);
        i = close + 1;
        continue;
      }
    }

    // Links: [label](url). Anything that is not http or https is left as
    // text, so javascript: and data: never become an anchor.
    if (ch === "[") {
      const mid = line.indexOf("](", i + 1);
      const close = mid === -1 ? -1 : line.indexOf(")", mid + 2);
      if (mid > i && close > mid) {
        const label = line.slice(i + 1, mid);
        const url = line.slice(mid + 2, close);
        if (safeURL(url)) {
          flush();
          const a = el("a", "md-link", label) as HTMLAnchorElement;
          a.href = url;
          a.rel = "noopener noreferrer";
          a.target = "_blank";
          into.appendChild(a);
          i = close + 1;
          continue;
        }
      }
    }

    // Bold: **text**.
    if (ch === "*" && line.charAt(i + 1) === "*") {
      const close = line.indexOf("**", i + 2);
      if (close > i + 2) {
        flush();
        const strong = el("strong", null, line.slice(i + 2, close));
        into.appendChild(strong);
        i = close + 2;
        continue;
      }
    }

    // Italic: *text* or _text_.
    if (ch === "*" || ch === "_") {
      const close = line.indexOf(ch, i + 1);
      if (close > i + 1) {
        flush();
        const em = el("em", null, line.slice(i + 1, close));
        into.appendChild(em);
        i = close + 1;
        continue;
      }
    }

    // A bare URL becomes a link too, which matches what people expect
    // when they paste an address into a note.
    if (ch === "h" && (line.slice(i, i + 7) === "http://" || line.slice(i, i + 8) === "https://")) {
      let end = i;
      while (end < line.length && !/\s/.test(line.charAt(end))) end++;
      const url = line.slice(i, end);
      flush();
      const a = el("a", "md-link", url) as HTMLAnchorElement;
      a.href = url;
      a.rel = "noopener noreferrer";
      a.target = "_blank";
      into.appendChild(a);
      i = end;
      continue;
    }

    buf += ch;
    i++;
  }
  flush();
}

export function safeURL(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.indexOf("http://") === 0 || u.indexOf("https://") === 0;
}

// render turns Markdown source into a document fragment.
export function render(source: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const limit = Math.min(lines.length, MAX_LINES);

  let i = 0;
  while (i < limit) {
    const line = lines[i];

    // Fenced code block.
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < limit && !RE_FENCE_CLOSE.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++;
      const pre = el("pre", "md-pre");
      const code = el("code", null, body.join("\n"));
      pre.appendChild(code);
      frag.appendChild(pre);
      continue;
    }

    // Blank line.
    if (!line.trim()) {
      i++;
      continue;
    }

    // Heading.
    const h = line.match(RE_HEADING_CAPTURE);
    if (h) {
      const tag = "h" + String(Math.min(h[1].length, 6));
      const heading = el(tag, "md-h");
      inline(h[2], heading);
      frag.appendChild(heading);
      i++;
      continue;
    }

    // Horizontal rule.
    if (RE_RULE.test(line)) {
      frag.appendChild(el("hr", "md-hr"));
      i++;
      continue;
    }

    // Block quote: collect the run.
    if (RE_QUOTE.test(line)) {
      const body: string[] = [];
      while (i < limit && RE_QUOTE.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      const quote = el("blockquote", "md-quote");
      inline(body.join(" "), quote);
      frag.appendChild(quote);
      continue;
    }

    // Unordered list.
    if (RE_BULLET.test(line)) {
      const list = el("ul", "md-list");
      while (i < limit && RE_BULLET.test(lines[i])) {
        const item = el("li");
        inline(lines[i].replace(/^\s*[-*+]\s+/, ""), item);
        list.appendChild(item);
        i++;
      }
      frag.appendChild(list);
      continue;
    }

    // Ordered list.
    if (RE_ORDERED.test(line)) {
      const list = el("ol", "md-list");
      while (i < limit && RE_ORDERED.test(lines[i])) {
        const item = el("li");
        inline(lines[i].replace(/^\s*\d+[.)]\s+/, ""), item);
        list.appendChild(item);
        i++;
      }
      frag.appendChild(list);
      continue;
    }

    // Paragraph: take lines until a blank one or the start of a block.
    const para: string[] = [];
    while (i < limit && lines[i].trim() && !isBlockStart(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    if (!para.length) {
      // A line that opens a block but did not match any rule above. Show it
      // as plain text rather than dropping it.
      const p = el("p", "md-p");
      inline(line, p);
      frag.appendChild(p);
      i++;
      continue;
    }
    const p = el("p", "md-p");
    inline(para.join("\n"), p);
    frag.appendChild(p);
  }

  if (lines.length > MAX_LINES) {
    frag.appendChild(el("p", "md-p md-cut", "..."));
  }
  return frag;
}

const RE_FENCE = /^\s*```/;
const RE_HEADING = /^(#{1,6})\s+/;
const RE_QUOTE = /^\s*>\s?/;
const RE_BULLET = /^\s*[-*+]\s+/;
const RE_ORDERED = /^\s*\d+[.)]\s+/;
const RE_RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

function isBlockStart(line: string): boolean {
  return (
    RE_FENCE.test(line) ||
    RE_HEADING.test(line) ||
    RE_QUOTE.test(line) ||
    RE_BULLET.test(line) ||
    RE_ORDERED.test(line) ||
    RE_RULE.test(line)
  );
}

// isMarkdown reports whether a file should be shown rendered rather than
// as plain text.
export function isMarkdown(name?: string, mime?: string): boolean {
  const n = String(name || "").toLowerCase();
  const m = String(mime || "").toLowerCase();
  return n.slice(-3) === ".md" || n.slice(-9) === ".markdown" || m === "text/markdown";
}
