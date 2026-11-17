/**
 * LumiRead — Prompt Templates
 * Builds structured prompts for progressive AI explanations.
 */

/**
 * depth: 'brief' | 'detailed' | 'deep'
 * outputLanguage: e.g. 'Chinese', 'English', 'Japanese'
 */
export function buildMessages({
  markType = 'text',
  selectedText,
  context,
  imageUrl,
  imageAlt,
  imageMimeType,
  imageData,
  sourceTitle,
  depth,
  outputLanguage,
}) {
  if (markType === 'image' || markType === 'screenshot') {
    return buildImageMessages({
      imageUrl,
      imageAlt,
      imageMimeType,
      imageData,
      context,
      sourceTitle,
      depth,
      outputLanguage,
    });
  }

  if (markType === 'page-note') {
    return buildPageSummaryMessages({ context, sourceTitle, selectedText, depth, outputLanguage });
  }

  const lang = outputLanguage || 'Chinese';
  const systemPrompt = buildSystemPrompt(lang);
  const userPrompt = buildUserPrompt({ selectedText, context, depth, lang });

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

function buildSystemPrompt(lang) {
  return `You are LumiNote, an expert AI learning assistant. Your role is to help online learners understand concepts, terms, ideas, and saved visual references they encounter while browsing.

Key behaviors:
- Always respond in ${lang}
- Be precise, educational, and engaging
- Adapt your explanation depth based on the requested level
- Use the surrounding context to give domain-specific explanations
- When relevant, acknowledge if a term has different meanings in different fields
- If image data is unavailable, explicitly say you are inferring from metadata and page context only
- Format your response in clean, readable text (use markdown sparingly, avoid heavy formatting)`;
}

function buildUserPrompt({ selectedText, context, depth, lang }) {
  const contextSection = context?.trim()
    ? `\n\n**Reading Context (surrounding text):**\n"${context.trim()}"`
    : '';

  switch (depth) {
    case 'brief':
      return `I'm reading and came across this term: **"${selectedText}"**${contextSection}

Please give me a **brief, one to two sentence explanation** of what this means in the context above. Be direct and clear. Respond in ${lang}.
At the very end, output 3–5 semantic tags as: TAGS:["tag1","tag2","tag3"]`;

    case 'detailed':
      return `I'm reading and came across this term: **"${selectedText}"**${contextSection}

Please give me a **detailed explanation** that includes:
1. What it means (in this specific context)
2. A concrete example or analogy
3. Why it matters / how it's used

Respond in ${lang}. Keep it educational but accessible.
At the very end, output 3–5 semantic tags as: TAGS:["tag1","tag2","tag3"]`;

    case 'deep':
      return `I'm reading and came across this term: **"${selectedText}"**${contextSection}

Please give me an **in-depth explanation** that includes:
1. Core definition and meaning in this context
2. Underlying principles or mechanisms
3. A concrete example
4. Common misconceptions or nuances
5. **Related concepts** (list 3–5 terms I should also understand, formatted as a JSON array at the very end like: \`RELATED:["term1","term2","term3"]\`)

Respond in ${lang}. Be thorough but organized.
At the very end (after RELATED if present), output 3–5 semantic tags as: TAGS:["tag1","tag2","tag3"]`;

    default:
      return buildUserPrompt({ selectedText, context, depth: 'brief', lang });
  }
}

function buildImageMessages({ imageUrl, imageAlt, imageMimeType, imageData, context, sourceTitle, depth, outputLanguage }) {
  const lang = outputLanguage || 'Chinese';
  const systemPrompt = buildSystemPrompt(lang);
  const userPrompt = buildImageUserPrompt({ imageAlt, context, sourceTitle, depth, lang, imageAvailable: Boolean(imageData || imageUrl) });
  const content = [{ type: 'text', text: userPrompt }];

  if (imageData && imageMimeType) {
    content.push({
      type: 'image',
      mimeType: imageMimeType,
      data: imageData,
    });
  } else if (imageUrl) {
    content.push({
      type: 'image_url',
      url: imageUrl,
    });
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ];
}

function buildImageUserPrompt({ imageAlt, context, sourceTitle, depth, lang, imageAvailable }) {
  const altSection = imageAlt?.trim()
    ? `\n\n**Image alt text:**\n"${imageAlt.trim()}"`
    : '';
  const titleSection = sourceTitle?.trim()
    ? `\n\n**Page title:**\n"${sourceTitle.trim()}"`
    : '';
  const contextSection = context?.trim()
    ? `\n\n**Nearby page context:**\n"${context.trim()}"`
    : '';
  const availabilityLine = imageAvailable
    ? 'Use the actual image plus the metadata below.'
    : 'The actual image pixels are unavailable. Infer carefully from the metadata below and clearly say when you are relying on metadata only.';

  switch (depth) {
    case 'detailed':
      return `I'm saving an image from a webpage.${altSection}${titleSection}${contextSection}

${availabilityLine}

Please give me a **detailed image summary** that includes:
1. What is visually happening in the image
2. The likely topic or meaning in this page context
3. Why this image might be worth saving

Respond in ${lang}.
At the very end, output 3–5 semantic tags as: TAGS:["tag1","tag2","tag3"]`;
    case 'deep':
      return `I'm saving an image from a webpage.${altSection}${titleSection}${contextSection}

${availabilityLine}

Please give me an **in-depth image explanation** that includes:
1. What the image appears to show
2. Relevant context or interpretation from the page
3. Any notable details, structure, or implied message
4. Why someone may want to revisit it later
5. **Related concepts** (list 3–5 terms I should also understand, formatted as a JSON array at the very end like: \`RELATED:["term1","term2","term3"]\`)

Respond in ${lang}.
At the very end (after RELATED if present), output 3–5 semantic tags as: TAGS:["tag1","tag2","tag3"]`;
    case 'brief':
    default:
      return `I'm saving an image from a webpage.${altSection}${titleSection}${contextSection}

${availabilityLine}

Please give me a **brief, one to two sentence summary** of what this image shows and why it may matter in this page context. Respond in ${lang}.
At the very end, output 3–5 semantic tags as: TAGS:["tag1","tag2","tag3"]`;
  }
}

/**
 * Parse related concepts from a 'deep' level AI response.
 * Looks for RELATED:["term1","term2"] at the end of the response.
 */
export function parseRelatedConcepts(text) {
  const match = text.match(/RELATED:\s*(\[.*?\])/s);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

function buildPageSummaryMessages({ context, sourceTitle, selectedText, depth, outputLanguage }) {
  const lang = outputLanguage || 'Chinese';
  const systemPrompt = buildSystemPrompt(lang);

  const titleLine = (sourceTitle || selectedText || '').trim();
  const titleSection = titleLine ? `**Page title:** "${titleLine}"\n\n` : '';
  const bodySection = context?.trim()
    ? `**Page content:**\n"${context.trim()}"`
    : 'No page content available.';

  let prompt;
  switch (depth) {
    case 'detailed':
      prompt = `I saved a webpage for later review. Please give me a **detailed summary** of what this page is about:\n\n${titleSection}${bodySection}\n\nInclude: main topic, key points, and why it might be worth revisiting. Respond in ${lang}.\nAt the very end, output 3–5 semantic tags as: TAGS:["tag1","tag2","tag3"]`;
      break;
    case 'deep':
      prompt = `I saved a webpage for later review. Please give me an **in-depth analysis** of this page:\n\n${titleSection}${bodySection}\n\nInclude: main topic, key arguments or findings, notable details, and **related concepts** (list 3–5 terms as \`RELATED:["term1","term2"]\` at the end). Respond in ${lang}.\nAt the very end (after RELATED if present), output 3–5 semantic tags as: TAGS:["tag1","tag2","tag3"]`;
      break;
    default:
      prompt = `I saved a webpage for later review. Please give me a **brief summary** (2–4 sentences) of what this page is about:\n\n${titleSection}${bodySection}\n\nRespond in ${lang}.\nAt the very end, output 3–5 semantic tags as: TAGS:["tag1","tag2","tag3"]`;
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];
}

/**
 * Strip the RELATED:[...] marker from response text for clean display.
 */
export function stripRelatedMarker(text) {
  return text.replace(/RELATED:\s*\[.*?\]/s, '').trim();
}

/**
 * Parse semantic tags from AI response.
 * Looks for TAGS:["tag1","tag2"] at the end of the response.
 */
export function parseTags(text) {
  const match = text.match(/TAGS:\s*(\[.*?\])/s);
  if (!match) return [];
  try {
    return JSON.parse(match[1]).map(t => String(t).trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Strip the TAGS:[...] marker from response text for clean display.
 */
export function stripTagsMarker(text) {
  return text.replace(/TAGS:\s*\[.*?\]/s, '').trim();
}
