function renderArticle(article = state.article) {
  $("#articleTitle").textContent = article.title || "Untitled article";
  $("#articleKicker").textContent = article.kicker || "Your article • English reading";
  $("#articleAuthor").textContent = article.author || "Imported by you";
  $("#articleDate").textContent = article.date || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  $("#articleLevel").textContent = article.level || estimateLevel(article.content || "");
  const words = (article.content || "").trim().split(/\s+/).filter(Boolean).length;
  $("#articleWordCount").textContent = `${words} words`;
  const normalized = normalizeArticleRecord(article);
  state.article = normalized;
  if (normalized.storageSource === "api") upsertArticle(normalized, true);
  const body = $("#articleBody");
  body.innerHTML = textToParagraphs(normalized.content || "No content yet.");
  renderReaderArticleWords();
  applyReaderHighlights(false);
  const reader = $("#readerCard");
  state.suppressProgress = true;
  requestAnimationFrame(() => {
    const max = Math.max(0, reader.scrollHeight - reader.clientHeight);
    reader.scrollTop = max * (normalized.progress || 0) / 100;
    updateReadingProgress();
    state.suppressProgress = false;
  });
  saveState();
}

function openEditArticleModal() {
  const article = state.article;
  if (!article?.id) return;
  $("#editArticleTitle").value = article.title || "";
  $("#editArticleAuthor").value = article.author || "";
  $("#editArticleLevel").value = article.level || "";
  $("#editArticleContent").value = article.content || "";
  $("#editArticleModal").classList.add("show");
  $("#editArticleModal").setAttribute("aria-hidden", "false");
}

function closeEditArticleModal() {
  $("#editArticleModal").classList.remove("show");
  $("#editArticleModal").setAttribute("aria-hidden", "true");
}

async function saveEditedArticle() {
  const article = state.article;
  if (!article?.id) return;
  const button = $("#saveEditArticle");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = state.language === "en" ? "Saving..." : "Đang lưu...";
  try {
    const payload = {
      title: $("#editArticleTitle").value.trim(),
      author: $("#editArticleAuthor").value.trim() || null,
      level: $("#editArticleLevel").value.trim() || null,
      content: $("#editArticleContent").value.trim()
    };
    if (!payload.title || !payload.content) throw new Error(state.language === "en" ? "Title and content are required." : "Cần có tiêu đề và nội dung.");

    if (article.storageSource !== "api" || !state.currentUser || !getAuthToken()) {
      throw new Error(state.language === "en" ? "This article is not synced. Log in and import it before editing." : "Bài này chưa đồng bộ. Hãy đăng nhập và nhập bài trước khi chỉnh sửa.");
    }
    const updated = upsertApiArticleDetail(await libraryApiUpdateArticleContent(article.id, payload));
    renderArticle(updated);
    updateStats();
    if ($("#libraryView").classList.contains("active")) renderLibraryOverview();
    closeEditArticleModal();
    showToast(state.language === "en" ? "Article updated" : "Đã cập nhật bài đọc", updated.title, "✓");
  } catch (error) {
    showToast(state.language === "en" ? "Could not update article" : "Chưa cập nhật được bài", error.message || "Please try again.", "!");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function textToParagraphs(text) {
  return text.trim().split(/\n\s*\n/).filter(Boolean).map(block => {
    const clean = escapeHtml(block.trim()).replace(/\n/g, " ");
    if (/^#{1,3}\s/.test(block)) return `<h2>${clean.replace(/^#{1,3}\s/, "")}</h2>`;
    if (/^>\s/.test(block)) return `<blockquote>${clean.replace(/^&gt;\s/, "")}</blockquote>`;
    return `<p>${clean}</p>`;
  }).join("");
}

function estimateLevel(text) {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  if (!words.length) return "A2";
  const longRatio = words.filter(w => w.length >= 9).length / words.length;
  const avg = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  if (longRatio > .18 || avg > 5.7) return "C1";
  if (longRatio > .11 || avg > 5.1) return "B2";
  if (longRatio > .06 || avg > 4.6) return "B1";
  return "A2";
}

function updateReadingProgress() {
  const card = $("#readerCard");
  const max = card.scrollHeight - card.clientHeight;
  const percent = max > 0 ? Math.min(100, Math.max(0, card.scrollTop / max * 100)) : 0;
  $("#readingProgress").style.width = `${percent}%`;
  $("#readingPercent").textContent = `${Math.round(percent)}%`;
  if (!state.suppressProgress && state.article?.id) {
    state.article.progress = Math.round(percent);
    if (state.article.storageSource === "api") {
      const stored = state.articles.find(article => article.id === state.article.id);
      if (stored) { stored.progress = state.article.progress; stored.lastOpenedAt = Date.now(); }
      if (typeof scheduleArticleProgressSync === "function") scheduleArticleProgressSync(state.article, state.article.progress);
      clearTimeout(updateReadingProgress._saveTimer);
      updateReadingProgress._saveTimer = setTimeout(saveState, 220);
    }
  }
}

function renderSavedPreview() {
  const root = $("#savedPreview");
  if (!root) return;
  const cards = state.cards.slice(0, 4);
  if (!cards.length) {
    root.innerHTML = `<div class="empty-mini">No saved words yet. Highlight a word in the article to start your collection.</div>`;
    return;
  }
  root.innerHTML = cards.map(c => `<div class="saved-mini" data-mini-edit="${c.id}" title="Click to edit"><div class="saved-mini-icon"><img src="${iconUrl(c.icon || ICON_FALLBACKS.default[0])}" alt=""></div><div><b>${escapeHtml(c.word)}</b><small>${escapeHtml(c.translation)}</small></div><span class="mastery-dot" style="background:${c.mastery > 2 ? 'var(--green)' : c.mastery > 0 ? 'var(--yellow)' : 'var(--red)'}"></span></div>`).join("");
  $$('[data-mini-edit]', root).forEach(item => item.addEventListener("click", () => openEditCard(item.dataset.miniEdit)));
}

function readerCardsForArticle(article) {
  if (!article) return [];
  const sourceCards = typeof cardsForArticle === "function"
    ? cardsForArticle(article)
    : state.cards.filter(card => {
      const sourceType = card.sourceType || "article";
      return sourceType === "article" && (card.sourceId === article.id || card.sourceId === article.contentId || card.sourceTitle === article.title);
    });
  const map = new Map();
  sourceCards.forEach(card => {
    const key = (card.word || "").trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, card);
  });
  return [...map.values()];
}

function readerWordRegex(word = "") {
  const trimmed = word.trim();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const source = /^[a-z0-9].*[a-z0-9]$/i.test(trimmed) ? `\\b${escaped}\\b` : escaped;
  try { return new RegExp(source, "gi"); } catch (_) { return null; }
}

function readerOccurrenceCount(text = "", word = "") {
  const regex = readerWordRegex(word);
  if (!regex) return 0;
  return (text.match(regex) || []).length;
}

const READER_HIGHLIGHT_COLORS = ["yellow", "green", "coral", "violet", "blue", "mint", "rose", "amber", "teal", "indigo"];

function normalizeReaderHighlightedWords(cards = readerCardsForArticle(state.article)) {
  const available = new Map(cards.map(card => [(card.word || "").trim().toLowerCase(), card.word || ""]));
  state.readerHighlightedWords = (Array.isArray(state.readerHighlightedWords) ? state.readerHighlightedWords : [])
    .map(word => String(word || "").trim())
    .filter((word, index, words) => word && available.has(word.toLowerCase()) && words.findIndex(item => item.toLowerCase() === word.toLowerCase()) === index)
    .map(word => available.get(word.toLowerCase()) || word);
  return state.readerHighlightedWords;
}

function readerHighlightColorClass(word = "") {
  const index = normalizeReaderHighlightedWords().findIndex(item => item.toLowerCase() === word.toLowerCase());
  return READER_HIGHLIGHT_COLORS[Math.max(0, index) % READER_HIGHLIGHT_COLORS.length];
}

function renderReaderArticleWords() {
  const root = $("#readerArticleWordList");
  if (!root) return;
  const article = state.article;
  const cards = readerCardsForArticle(article);
  normalizeReaderHighlightedWords(cards);
  if (!cards.length) {
    root.innerHTML = `<div class="empty-mini">No saved words for this article yet. Highlight a word in the article to add it to your vocabulary.</div>`;
    return;
  }
  root.innerHTML = cards.map(card => {
    const active = state.readerHighlightedWords.some(word => word.toLowerCase() === (card.word || "").toLowerCase());
    const count = readerOccurrenceCount(article.content || "", card.word || "");
    const color = active ? readerHighlightColorClass(card.word || "") : "off";
    return `<div class="reader-word-item ${active ? "active" : ""}" data-reader-card="${card.id}" role="button" tabindex="0">
      <span class="reader-word-icon"><img src="${iconUrl(card.icon)}" alt=""></span>
      <span class="reader-word-copy"><b>${escapeHtml(card.word)}</b><small>${escapeHtml(card.translation || "No translation yet")}</small></span>
      <button class="reader-word-highlight ${active ? "active" : ""} ${color}" data-reader-highlight-word="${escapeHtml(card.word)}" type="button" title="${active ? "Highlight off" : "Highlight on"}" aria-pressed="${active ? "true" : "false"}"><span aria-hidden="true">H</span><small>${count}</small></button>
    </div>`;
  }).join("");
}

function refreshReaderArticleWords() {
  renderReaderArticleWords();
  applyReaderHighlights(false);
}

function createReaderHighlightedBody(words = []) {
  const body = $("#articleBody");
  body.innerHTML = textToParagraphs(state.article?.content || "No content yet.");
  const entries = words.map((word, index) => ({ word, regex: readerWordRegex(word), color: READER_HIGHLIGHT_COLORS[index % READER_HIGHLIGHT_COLORS.length] })).filter(entry => entry.regex);
  if (!entries.length) return [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) { return node.parentElement?.closest("mark") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const text = node.nodeValue || "";
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    while (cursor < text.length) {
      let found = null;
      entries.forEach(entry => {
        entry.regex.lastIndex = cursor;
        const match = entry.regex.exec(text);
        if (!match) return;
        if (!found || match.index < found.match.index || (match.index === found.match.index && match[0].length > found.match[0].length)) {
          found = { ...entry, match };
        }
      });
      if (!found) break;
      fragment.append(text.slice(cursor, found.match.index));
      const mark = document.createElement("mark");
      mark.className = `reader-word-match ${found.color}`;
      mark.dataset.readerWord = found.word;
      mark.textContent = found.match[0];
      fragment.append(mark);
      cursor = found.match.index + found.match[0].length;
      if (!found.match[0].length) cursor += 1;
    }
    fragment.append(text.slice(cursor));
    node.replaceWith(fragment);
  });
  return $$("mark.reader-word-match", body);
}

function applyReaderHighlights() {
  const words = normalizeReaderHighlightedWords();
  if (!words.length) {
    $("#articleBody").innerHTML = textToParagraphs(state.article?.content || "No content yet.");
    renderReaderArticleWords();
    return;
  }
  createReaderHighlightedBody(words);
  renderReaderArticleWords();
}

function toggleReaderWordHighlight(word = "") {
  const value = word.trim();
  if (!value) return;
  normalizeReaderHighlightedWords();
  const exists = state.readerHighlightedWords.some(item => item.toLowerCase() === value.toLowerCase());
  state.readerHighlightedWords = exists
    ? state.readerHighlightedWords.filter(item => item.toLowerCase() !== value.toLowerCase())
    : [...state.readerHighlightedWords, value];
  applyReaderHighlights();
  saveState();
}


function setView(viewId) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === viewId));
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === viewId));
  const namesVi = { isleView: "Đảo của bạn", libraryView: "Thư viện", cardsView: "Từ vựng", reviewView: "Luyện tập", readerView: "Đọc", pdfView: "PDF", videoView: "Video", dictationView: "Chép chính tả", settingsView: "Cài đặt" };
  const namesEn = { isleView: "Your Isle", libraryView: "Library", cardsView: "Vocabulary", reviewView: "Practice", readerView: "Read", pdfView: "PDF", videoView: "Video", dictationView: "Dictation", settingsView: "Settings" };
  $("#crumbName").textContent = (state.language === "en" ? namesEn : namesVi)[viewId];
  $("#sidebar").classList.remove("open");
  closeSelectionPopup();
  if (viewId === "libraryView") refreshAndRenderLibrary();
  if (viewId === "isleView") renderYourIsle();
  if (viewId === "cardsView") renderCards();
  if (viewId === "reviewView") { if (!state.reviewSessionStarted) startReview(); else renderReview(); }
  if (viewId === "dictationView") prepareDictationView();
  if (viewId === "pdfView") { renderPdfWordRail(); if (pdfState.doc) requestAnimationFrame(() => renderPdfPage(pdfState.page)); }
  if (viewId === "videoView") { ensureVideoPolling(); updateVideoSavedCount(); }
  queueMicrotask(applyLanguage);
}

function getContextFromRange(range) {
  let container = range.commonAncestorContainer;
  if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
  container = container.closest("p, blockquote, h2") || container;
  const text = container.textContent.trim();
  const preRange = range.cloneRange();
  try {
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
  } catch (_) {}
  const startIndex = preRange.toString().length;
  let sentence = text;
  try {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    const segments = [...segmenter.segment(text)];
    const found = segments.find(seg => startIndex >= seg.index && startIndex <= seg.index + seg.segment.length);
    if (found) sentence = found.segment.trim();
  } catch (_) {
    const chunks = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    sentence = chunks.find(s => s.toLowerCase().includes(range.toString().trim().toLowerCase())) || text;
  }
  return { sentence, container };
}

function normalizeSelectedText(text) {
  return text.replace(/[“”‘’".,!?;:()\[\]{}]/g, "").replace(/\s+/g, " ").trim();
}

async function handleSelection(event) {
  await sleep(10);
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!$("#articleBody").contains(range.commonAncestorContainer)) return;
  const selected = normalizeSelectedText(selection.toString());
  if (!selected || selected.length > 80 || selected.split(" ").length > 8) return;
  const { sentence } = getContextFromRange(range);
  const rect = range.getBoundingClientRect();
  state.selection = {
    word: selected,
    sentence,
    range: range.cloneRange(),
    translation: "",
    sentenceTranslation: "",
    definition: "",
    phonetic: "",
    icons: [],
    selectedIcon: ICON_FALLBACKS.default[0],
    sourceId: state.article.id,
    sourceTitle: state.article.title,
    sourceType: "article",
    sourceUrl: state.article.sourceUrl || ""
  };
  openSelectionPopup(rect);
  loadSelectionData();
}

function openSelectionPopup(rect) {
  const popup = $("#selectionPopup");
  const word = state.selection.word;
  $("#popupWord").textContent = word;
  $("#popupTranslation").innerHTML = `<div class="loading-line" style="width:105px"></div>`;
  $("#popupDefinition").innerHTML = `<div class="loading-line" style="width:94%;margin-top:4px"></div>`;
  $("#popupSentence").textContent = state.selection.sentence;
  $("#popupSentenceTranslation").innerHTML = `<span class="loading-line" style="display:block;width:85%"></span>`;
  $("#iconOptions").innerHTML = "";
  $("#iconStatus").textContent = "searching...";
  $("#saveWord").textContent = state.cards.some(c => c.word.toLowerCase() === word.toLowerCase() && c.sentence === state.selection.sentence) ? "✓ Saved" : "＋ Save flashcard";
  $("#saveWord").classList.toggle("saved", $("#saveWord").textContent.includes("Saved"));
  $("#popupIcon").src = iconUrl(ICON_FALLBACKS.default[0]);
  popup.classList.add("show");
  requestAnimationFrame(() => {
    const w = popup.offsetWidth, h = popup.offsetHeight;
    let left = rect.left + rect.width / 2 - w / 2;
    let top = rect.top - h - 12;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    if (top < 12) top = Math.min(window.innerHeight - h - 12, rect.bottom + 12);
    popup.style.left = `${left}px`;
    popup.style.top = `${Math.max(12, top)}px`;
  });
}

function closeSelectionPopup() {
  $("#selectionPopup").classList.remove("show");
}
