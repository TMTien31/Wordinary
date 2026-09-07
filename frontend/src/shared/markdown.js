function markdownUrl(value = "", { imagesOnly = false } = {}) {
  const trimmed = String(value || "").trim();
  try {
    const url = new URL(trimmed, window.location.origin);
    const protocol = url.protocol.toLowerCase();
    if (protocol === "http:" || protocol === "https:") return url.href;
    if (!imagesOnly && protocol === "mailto:") return url.href;
  } catch (_) {
    return "";
  }
  return "";
}

function stashMarkdownHtml(tokens, html) {
  const token = `@@MDTOKEN${tokens.length}@@`;
  tokens.push(html);
  return token;
}

function restoreMarkdownHtml(value, tokens) {
  return value.replace(/@@MDTOKEN(\d+)@@/g, (_, index) => tokens[Number(index)] || "");
}

function renderMarkdownInline(value = "") {
  const tokens = [];
  let text = String(value || "");
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, rawUrl) => {
    const url = markdownUrl(rawUrl, { imagesOnly: true });
    if (!url) return "";
    return stashMarkdownHtml(tokens, `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt || "")}" loading="lazy" referrerpolicy="no-referrer">`);
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, rawUrl) => {
    const url = markdownUrl(rawUrl);
    const safeLabel = escapeHtml(label || url || "");
    if (!url) return safeLabel;
    return stashMarkdownHtml(tokens, `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`);
  });
  text = text.replace(/`([^`]+)`/g, (_, code) => stashMarkdownHtml(tokens, `<code>${escapeHtml(code)}</code>`));
  let html = escapeHtml(text);
  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  return restoreMarkdownHtml(html, tokens);
}

function renderMarkdown(markdown = "") {
  const blocks = String(markdown || "").replace(/\r\n?/g, "\n").trim().split(/\n{2,}/).filter(Boolean);
  if (!blocks.length) return "";
  return blocks.map(block => {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    const first = lines[0] || "";
    const heading = first.match(/^(#{1,4})\s+(.+)$/);
    if (heading && lines.length === 1) {
      const level = Math.min(4, Math.max(2, heading[1].length + 1));
      return `<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`;
    }
    if (/^---+$/.test(first)) return "<hr>";
    if (lines.every(line => /^>\s?/.test(line))) {
      return `<blockquote>${lines.map(line => renderMarkdownInline(line.replace(/^>\s?/, ""))).join("<br>")}</blockquote>`;
    }
    if (lines.every(line => /^[-*+]\s+/.test(line))) {
      return `<ul>${lines.map(line => `<li>${renderMarkdownInline(line.replace(/^[-*+]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    if (lines.every(line => /^\d+\.\s+/.test(line))) {
      return `<ol>${lines.map(line => `<li>${renderMarkdownInline(line.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
    }
    if (lines.length === 1 && /^!\[[^\]]*\]\([^)]+\)$/.test(first)) {
      return `<figure>${renderMarkdownInline(first)}</figure>`;
    }
    return `<p>${renderMarkdownInline(lines.join(" "))}</p>`;
  }).join("");
}
