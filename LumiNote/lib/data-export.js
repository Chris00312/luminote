/**
 * LumiNote — Data Export
 * Export all memories and moodboard sessions as JSON or Markdown.
 */

import { getAllEntries } from './notebook.js';
import { getAllSessions } from './moodboard.js';

/**
 * Export all user data as JSON
 * @returns {Promise<string>} JSON string
 */
export async function exportAsJSON() {
  const entries = await getAllEntries();
  const sessions = await getAllSessions();

  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    app: 'LumiNote',
    memories: entries.map(e => ({
      id: e.id,
      type: e.entryType,
      title: e.term,
      note: e.note,
      aiSummary: e.aiSummary,
      sourceUrl: e.sourceUrl,
      sourceTitle: e.sourceTitle,
      tags: e.tags,
      createdAt: new Date(e.timestamp).toISOString(),
    })),
    moodboards: sessions.map(s => ({
      id: s.id,
      name: s.name,
      createdAt: new Date(s.createdAt).toISOString(),
      cards: (s.cards || []).map(c => ({
        cardId: c.cardId,
        entryId: c.entryId,
        position: { x: c.x, y: c.y, w: c.w, h: c.h },
      })),
    })),
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Export all user data as Markdown
 * @returns {Promise<string>} Markdown string
 */
export async function exportAsMarkdown() {
  const entries = await getAllEntries();
  const sessions = await getAllSessions();

  let md = `# LumiNote Export\n\n`;
  md += `> Exported: ${new Date().toLocaleString()}\n\n`;

  // Memories section
  md += `## Memories (${entries.length})\n\n`;

  for (const entry of entries) {
    md += `### ${entry.term || 'Untitled'}\n\n`;
    if (entry.note) md += `**Note:** ${entry.note}\n\n`;
    if (entry.aiSummary) md += `**AI Summary:** ${entry.aiSummary}\n\n`;
    if (entry.sourceUrl) md += `**Source:** [${entry.sourceTitle || entry.sourceUrl}](${entry.sourceUrl})\n\n`;
    if (entry.tags?.length) md += `**Tags:** ${entry.tags.join(', ')}\n\n`;
    md += `*Created: ${new Date(entry.timestamp).toLocaleString()}*\n\n`;
    md += `---\n\n`;
  }

  // Moodboards section
  md += `## Moodboards (${sessions.length})\n\n`;

  for (const session of sessions) {
    md += `### ${session.name}\n\n`;
    md += `Cards: ${(session.cards || []).length}\n\n`;

    for (const card of (session.cards || [])) {
      // Find the entry for this card
      const entry = entries.find(e => e.id === card.entryId);
      if (entry) {
        md += `- **${entry.term || 'Untitled'}**`;
        if (entry.note) md += ` — ${entry.note}`;
        md += `\n`;
      }
    }
    md += `\n---\n\n`;
  }

  return md;
}

/**
 * Trigger a file download in the browser
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
