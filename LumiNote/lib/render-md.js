/**
 * LumiNote — Lightweight Markdown renderer (XSS-safe)
 *
 * Escapes HTML first, then applies basic formatting:
 *   ## headings, **bold**, `code`, - / * / 1. lists, | tables |, line breaks.
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Collect consecutive table rows and build a <table>.
 * First data row becomes <thead>, rest becomes <tbody>.
 */
function buildTable(rows) {
  if (!rows.length) return '';
  const parseRow = (r) =>
    r.slice(1, -1).split('|').map((c) => c.trim());

  const headerCells = parseRow(rows[0]);
  let html = '<table class="md-table"><thead><tr>';
  for (const c of headerCells) html += `<th>${c}</th>`;
  html += '</tr></thead>';

  if (rows.length > 1) {
    html += '<tbody>';
    for (let i = 1; i < rows.length; i++) {
      const cells = parseRow(rows[i]);
      html += '<tr>';
      for (const c of cells) html += `<td>${c}</td>`;
      html += '</tr>';
    }
    html += '</tbody>';
  }
  html += '</table>';
  return html;
}

export function renderMd(str) {
  const s = escapeHtml(str);
  const lines = s.split('\n');
  const output = [];
  let tableBuffer = [];

  const flushTable = () => {
    if (tableBuffer.length) {
      output.push(buildTable(tableBuffer));
      tableBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Table row: | ... | ... |
    if (/^\|.+\|$/.test(trimmed)) {
      // Skip separator rows like |------|------|
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue;
      tableBuffer.push(trimmed);
      continue;
    }

    // Non-table line — flush any pending table
    flushTable();

    // Headings (H1–H6). Render all levels with the same visual class but expose
    // the level via data-level so CSS can differentiate size if desired.
    const hMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2];
      output.push(`<strong class="md-heading md-h${level}" data-level="${level}">${text}</strong>`);
      continue;
    }
    // Horizontal rule: --- or ***
    if (/^[-*]{3,}$/.test(trimmed)) continue;
    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, '');
      output.push(`<span class="md-li">\u2022 ${text}</span>`);
      continue;
    }
    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      output.push(`<span class="md-li">${trimmed}</span>`);
      continue;
    }
    // Empty line
    if (trimmed === '') {
      output.push('\n');
      continue;
    }
    output.push(line);
  }
  flushTable();

  const html = output
    .join('\n')
    // Inline: **bold**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Inline: `code`
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    // Collapse 2+ consecutive newlines into a single <br>
    .replace(/\n{2,}/g, '<br>')
    // Single newline → <br> only between inline text (not after block elements)
    .replace(/\n/g, '<br>')
    // Remove <br> right after block elements (they already have display:block spacing)
    .replace(/(<\/strong>|<\/span>|<\/table>)<br>/g, '$1')
    // Remove <br> right before block elements
    .replace(/<br>(<table)/g, '$1')
    // Remove leading/trailing <br>
    .replace(/^(<br>)+|(<br>)+$/g, '');
  return html;
}
