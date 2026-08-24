function dictationCleanText(value = "") {
  const holder = document.createElement("div");
  holder.innerHTML = String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(?:c|v|lang|ruby|rt)[^>]*>/gi, "");
  return decodeHtml(holder.textContent || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dictationNormalize(value = "", mode = "normal") {
  let result = dictationCleanText(value)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (mode !== "strict") {
    result = result
      .replace(/\bdo not\b/g, "don't")
      .replace(/\bcannot\b/g, "can't")
      .replace(/\bwill not\b/g, "won't");
  }
  if (mode === "easy") {
    result = result.replace(/[^a-z0-9'\s]/g, "");
  } else if (mode === "normal") {
    result = result.replace(/[.,!?;:"()[\]{}]/g, "");
  }
  return result.replace(/\s+/g, " ").trim();
}

function dictationTokenize(value = "", mode = "normal") {
  return dictationNormalize(value, mode).split(/\s+/).filter(Boolean);
}

function dictationLcsMatrix(expectedTokens, typedTokens) {
  const rows = expectedTokens.length + 1;
  const cols = typedTokens.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = expectedTokens.length - 1; i >= 0; i -= 1) {
    for (let j = typedTokens.length - 1; j >= 0; j -= 1) {
      matrix[i][j] = expectedTokens[i] === typedTokens[j]
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }
  return matrix;
}

function dictationBuildDiff(expected = "", typed = "", mode = "normal") {
  const expectedTokens = dictationTokenize(expected, mode);
  const typedTokens = dictationTokenize(typed, mode);
  const matrix = dictationLcsMatrix(expectedTokens, typedTokens);
  const pieces = [];
  let i = 0;
  let j = 0;
  while (i < expectedTokens.length || j < typedTokens.length) {
    if (i < expectedTokens.length && j < typedTokens.length && expectedTokens[i] === typedTokens[j]) {
      pieces.push({ type: "match", text: expectedTokens[i] });
      i += 1;
      j += 1;
      continue;
    }
    if (j < typedTokens.length && (i === expectedTokens.length || matrix[i][j + 1] >= matrix[i + 1]?.[j])) {
      pieces.push({ type: "extra", text: typedTokens[j] });
      j += 1;
      continue;
    }
    if (i < expectedTokens.length) {
      pieces.push({ type: "missing", text: expectedTokens[i] });
      i += 1;
    }
  }
  const matches = pieces.filter(piece => piece.type === "match").length;
  const denominator = Math.max(expectedTokens.length, typedTokens.length, 1);
  return {
    pieces,
    matches,
    expectedTokens,
    typedTokens,
    expectedCount: expectedTokens.length,
    typedCount: typedTokens.length,
    accuracy: Math.round(matches / denominator * 100)
  };
}

function dictationExpandedContraction(token = "") {
  const contractions = {
    "can't": "cannot",
    "won't": "will not",
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "i'm": "i am",
    "it's": "it is",
    "that's": "that is",
    "there's": "there is",
    "they're": "they are",
    "we're": "we are",
    "you're": "you are",
    "i've": "i have",
    "we've": "we have",
    "they've": "they have",
    "i'll": "i will",
    "you'll": "you will",
    "we'll": "we will",
    "they'll": "they will"
  };
  return contractions[token] || "";
}

function dictationStemLike(a = "", b = "") {
  if (!a || !b || a === b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length < 3) return false;
  if (longer === `${shorter}s` || longer === `${shorter}es` || longer === `${shorter}ed`) return true;
  if (shorter.endsWith("y") && (longer === `${shorter.slice(0, -1)}ies` || longer === `${shorter.slice(0, -1)}ied`)) return true;
  if (longer.endsWith("ing") && longer.startsWith(shorter)) return true;
  return false;
}

function dictationBuildFeedback(diff) {
  const smallWords = new Set(["a", "an", "the", "to", "of", "in", "on", "at", "for", "with", "is", "are", "was", "were"]);
  const missing = diff.pieces.filter(piece => piece.type === "missing").map(piece => piece.text);
  const extra = diff.pieces.filter(piece => piece.type === "extra").map(piece => piece.text);
  const notes = [];
  const missingSmall = missing.filter(token => smallWords.has(token));
  if (missingSmall.length) {
    notes.push({ type: "small-word", text: `Missing small word${missingSmall.length > 1 ? "s" : ""}: ${[...new Set(missingSmall)].join(", ")}` });
  }
  const extraSet = new Set(extra);
  const reordered = missing.filter(token => extraSet.has(token));
  if (reordered.length) {
    notes.push({ type: "word-order", text: `Word order looks off around: ${[...new Set(reordered)].slice(0, 4).join(", ")}` });
  }
  const contractionPairs = [];
  missing.forEach(token => {
    const expanded = dictationExpandedContraction(token);
    if (expanded && expanded.split(" ").every(part => extraSet.has(part))) contractionPairs.push(`${expanded} -> ${token}`);
  });
  extra.forEach(token => {
    const expanded = dictationExpandedContraction(token);
    if (expanded && expanded.split(" ").every(part => missing.includes(part))) contractionPairs.push(`${token} -> ${expanded}`);
  });
  if (contractionPairs.length) {
    notes.push({ type: "contraction", text: `Contraction mismatch: ${[...new Set(contractionPairs)].slice(0, 2).join(", ")}` });
  }
  const suffixPairs = [];
  missing.forEach(expected => {
    const typed = extra.find(token => dictationStemLike(expected, token));
    if (typed) suffixPairs.push(`${typed} / ${expected}`);
  });
  if (suffixPairs.length) {
    notes.push({ type: "suffix", text: `Check endings like -s or -ed: ${[...new Set(suffixPairs)].slice(0, 3).join(", ")}` });
  }
  return notes;
}

function dictationCheckAnswer(expected = "", typed = "", mode = "normal") {
  const normalizedExpected = dictationNormalize(expected, mode);
  const normalizedTyped = dictationNormalize(typed, mode);
  const diff = dictationBuildDiff(expected, typed, mode);
  const exact = normalizedExpected === normalizedTyped && normalizedExpected.length > 0;
  const almost = !exact && diff.accuracy >= (mode === "strict" ? 96 : mode === "easy" ? 88 : 92);
  return {
    exact,
    almost,
    accepted: exact || almost,
    normalizedExpected,
    normalizedTyped,
    diff,
    notes: dictationBuildFeedback(diff)
  };
}
