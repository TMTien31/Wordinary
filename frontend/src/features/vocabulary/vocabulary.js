function highlightSavedRange(range, cardId) {
  try {
    const mark = document.createElement("mark");
    mark.className = "saved-word";
    mark.dataset.cardId = cardId;
    mark.title = "Đã lưu vào flashcard";
    range.surroundContents(mark);
  } catch (_) {
    try {
      const mark = document.createElement("mark");
      mark.className = "saved-word";
      mark.dataset.cardId = cardId;
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    } catch (_) {}
  }
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
}

function cardSourceFromSelection(selection = {}) {
  const sourceType = selection.sourceType || "article";
  const source = {
    type: ["article", "pdf", "video"].includes(sourceType) ? sourceType : "manual",
    sourceTitle: selection.sourceTitle || state.article?.title || "Wordinary"
  };
  if (source.type === "article" || source.type === "video") source.sourceUrl = selection.sourceUrl || "";
  let libraryItemId = "";
  if (source.type === "article") libraryItemId = selection.sourceId || state.article?.id || "";
  if (source.type === "pdf") libraryItemId = pdfState.libraryItemId || state.currentLibraryItemId || "";
  if (source.type === "video") libraryItemId = videoState.libraryItemId || state.currentLibraryItemId || "";
  if (isUuid(libraryItemId)) source.libraryItemId = libraryItemId;
  if (source.type === "pdf" && Number.isFinite(selection.sourcePage)) source.page = selection.sourcePage;
  if (source.type === "video") {
    if (Number.isFinite(selection.sourceTime)) source.timestamp = selection.sourceTime;
    if (Number.isFinite(selection.captionIndex)) source.captionIndex = selection.captionIndex;
  }
  return source;
}

function cardSourceFromCard(card = {}) {
  const source = {
    type: ["article", "pdf", "video"].includes(card.sourceType) ? card.sourceType : "manual",
    sourceTitle: card.sourceTitle || "Wordinary"
  };
  if (source.type === "article" || source.type === "video") source.sourceUrl = card.sourceUrl || "";
  if (isUuid(card.sourceId)) source.libraryItemId = card.sourceId;
  if (source.type === "pdf" && Number.isFinite(card.sourcePage)) source.page = card.sourcePage;
  if (source.type === "video" && Number.isFinite(card.sourceTime)) source.timestamp = card.sourceTime;
  if (source.type === "video" && Number.isFinite(card.sourceCaptionIndex)) source.captionIndex = card.sourceCaptionIndex;
  return source;
}

function apiVocabularyToCard(item = {}) {
  const source = item.source || {};
  return {
    id: item.id,
    word: item.word || "",
    translation: item.translation || "Chưa có bản dịch",
    sentence: item.sentence || "",
    sentenceTranslation: item.sentenceTranslation || "",
    definition: item.definition || "",
    phonetic: item.phonetic || "",
    partOfSpeech: item.partOfSpeech || "",
    icon: item.icon || ICON_FALLBACKS.default[0],
    sourceId: source.libraryItemId || "",
    sourceTitle: source.sourceTitle || "",
    sourceType: source.type || "manual",
    sourceUrl: source.sourceUrl || "",
    sourceTime: Number.isFinite(Number(source.timestamp)) ? Number(source.timestamp) : null,
    sourceCaptionIndex: Number.isFinite(Number(source.captionIndex)) ? Number(source.captionIndex) : null,
    sourcePage: Number.isFinite(Number(source.page)) ? Number(source.page) : null,
    createdAt: item.createdAt ? Date.parse(item.createdAt) : Date.now(),
    updatedAt: item.updatedAt ? Date.parse(item.updatedAt) : Date.now(),
    mastery: Number(item.mastery) || 0,
    nextReview: item.nextReviewAt ? Date.parse(item.nextReviewAt) : Date.now(),
    reviewCount: Number(item.reviewCount) || 0,
    lastResult: item.lastResult || ""
  };
}

function upsertCard(card) {
  const index = state.cards.findIndex(item => item.id === card.id);
  if (index >= 0) state.cards[index] = { ...state.cards[index], ...card };
  else state.cards.unshift(card);
  return state.cards.find(item => item.id === card.id);
}

function reviewCountLabel(card = {}) {
  const count = Number(card.reviewCount) || 0;
  if (state.language !== "en") return count ? `Đã ôn ${count} lần` : "Chưa ôn lần nào";
  return count === 1 ? "Reviewed 1 time" : `Reviewed ${count} times`;
}

function lastResultLabel(card = {}) {
  if (!card.lastResult) return "";
  if (state.language !== "en") return card.lastResult === "good" ? "lần trước: đã thuộc" : "lần trước: cần học lại";
  return card.lastResult === "good" ? "last: learned" : "last: not learned";
}

function cardReviewStatus(card = {}) {
  const next = Number(card.nextReview) || 0;
  const now = Date.now();
  if (!next || next <= now) {
    return {
      className: "due",
      label: state.language === "en" ? "Due now" : "Đến hạn ngay",
      detail: state.language === "en" ? "Ready for practice" : "Sẵn sàng luyện tập"
    };
  }
  const minutes = Math.ceil((next - now) / 60000);
  if (minutes < 60) {
    return {
      className: "soon",
      label: state.language === "en" ? `Due in ${minutes}m` : `Còn ${minutes} phút`,
      detail: reviewCountLabel(card)
    };
  }
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) {
    return {
      className: "soon",
      label: state.language === "en" ? `Due in ${hours}h` : `Còn ${hours} giờ`,
      detail: reviewCountLabel(card)
    };
  }
  const days = Math.ceil(hours / 24);
  return {
    className: "scheduled",
    label: state.language === "en"
      ? (days === 1 ? "Due tomorrow" : `Due in ${days} days`)
      : (days === 1 ? "Đến hạn ngày mai" : `Còn ${days} ngày`),
    detail: reviewCountLabel(card)
  };
}

function clearVocabularyCache() {
  state.cards = [];
  if (typeof purgeBackendBackedBrowserState === "function") purgeBackendBackedBrowserState();
}

async function refreshVocabularyFromApi(params = {}) {
  if (!state.currentUser || !getAuthToken()) {
    clearVocabularyCache();
    return null;
  }
  const page = await vocabularyApiList({
    page: 1,
    pageSize: 200,
    ...params
  });
  state.cards = (Array.isArray(page.items) ? page.items : []).map(apiVocabularyToCard);
  saveState();
  updateStats();
  updateVideoSavedCount();
  renderPdfWordRail();
  if ($("#cardsView")?.classList.contains("active")) renderCards($("#cardSearch")?.value || "");
  if ($("#libraryView")?.classList.contains("active")) renderLibraryOverview();
  return page;
}

async function saveCurrentSelection() {
  const s = state.selection;
  if (!s) return;
  if (!state.currentUser || !getAuthToken()) {
    showToast("Log in required", "Sign in to save vocabulary to your account.", "!");
    return;
  }
  const duplicate = state.cards.find(c => c.word.toLowerCase() === s.word.toLowerCase() && c.sentence === s.sentence);
  if (duplicate) {
    showToast("Từ đã có trong bộ", "Bạn có thể ôn lại thẻ này trong mục Từ đã lưu.", "🗂️");
    return;
  }
  const payload = {
    word: s.word,
    translation: s.translation || FALLBACK_TRANSLATIONS[s.word.toLowerCase()] || "Chưa có bản dịch",
    sentence: s.sentence,
    sentenceTranslation: s.sentenceTranslation || "",
    definition: s.definition || "",
    phonetic: s.phonetic || "",
    partOfSpeech: s.partOfSpeech || "",
    icon: s.selectedIcon || ICON_FALLBACKS.default[0],
    source: cardSourceFromSelection(s)
  };
  try {
    const card = upsertCard(apiVocabularyToCard(await vocabularyApiCreate(payload)));
    state.xp += 12;
    state.sessionXp += 12;
    state.sessionSaved += 1;
    state.daily += 1;
    highlightSavedRange(s.range, card.id);
    saveState();
    updateStats();
    updateVideoSavedCount();
    renderPdfWordRail();
    if ($("#readerView").classList.contains("active")) refreshReaderArticleWords();
    refreshLearningProfile().catch(error => console.warn("Could not refresh learning profile", error));
    $("#saveWord").textContent = "✓ Đã lưu";
    $("#saveWord").classList.add("saved");
    showToast(`Đã lưu “${card.word}”`, `+12 XP • ${card.translation}`, "🌱");
    if (state.daily === 8) showToast("Hoàn thành mục tiêu!", "Bạn đã hoàn thành 8 hoạt động học hôm nay.", "🏆");
  } catch (error) {
    showToast("Chưa lưu được từ", error.message || "Backend chưa nhận flashcard này.", "!");
  }
}

function renderCards(filter = "") {
  const root = $("#flashcardGrid");
  const q = filter.trim().toLowerCase();
  const cards = state.cards.filter(c => !q || `${c.word} ${c.translation} ${c.sentence}`.toLowerCase().includes(q));
  if (!cards.length) {
    root.innerHTML = `<div class="empty-state"><div class="big">✦</div><h3>${state.cards.length ? (state.language === "en" ? "No matching words" : "Không tìm thấy từ phù hợp") : (state.language === "en" ? "Your first saved word will appear here" : "Bộ từ đang chờ khoảnh khắc đầu tiên")}</h3><p>${state.cards.length ? (state.language === "en" ? "Try a different search term." : "Thử một từ khóa khác.") : (state.language === "en" ? "Go back to Read, highlight a new word, then save it as a flashcard." : "Quay lại bài đọc, bôi đen từ mới rồi nhấn lưu flashcard.")}</p></div>`;
    return;
  }
  root.innerHTML = cards.map(c => {
    const status = cardReviewStatus(c);
    const last = lastResultLabel(c);
    const mastery = Math.max(0, Math.min(5, Number(c.mastery) || 0));
    return `<article class="word-card ${status.className === "due" ? "is-due" : ""}" data-edit-card="${c.id}" title="${state.language === "en" ? "Click to edit flashcard" : "Nhấn để chỉnh sửa flashcard"}">
    <div class="card-top"><div class="card-icon"><img src="${iconUrl(c.icon)}" alt=""></div><button class="card-menu" data-edit="${c.id}" title="${state.language === "en" ? "Edit flashcard" : "Sửa flashcard"}">✎</button></div>
    <div class="card-word">${escapeHtml(c.word)}</div>
    <div class="card-meaning">${escapeHtml(c.translation)}</div>
    <div class="card-sentence">“${escapeHtml(c.sentence)}”</div>
    <div class="card-review-panel ${status.className}">
      <div><b>${escapeHtml(status.label)}</b><small>${escapeHtml(last ? `${status.detail} · ${last}` : status.detail)}</small></div>
      <div class="mastery-meter" aria-label="Mastery ${mastery} of 5"><span style="width:${mastery / 5 * 100}%"></span></div>
    </div>
    <div class="card-source">${c.sourceType === "video" ? "🎬" : c.sourceType === "pdf" ? "📄" : "📖"} ${escapeHtml(c.sourceTitle || (state.language === "en" ? "Untitled source" : "Nguồn chưa đặt"))}${Number.isFinite(c.sourceTime) ? ` · ${formatVideoTime(c.sourceTime)}` : Number.isFinite(c.sourcePage) ? ` · ${state.language === "en" ? "Page" : "Trang"} ${c.sourcePage}` : ""}</div>
    <div class="card-footer"><span class="level-pill">${mastery === 0 ? (state.language === "en" ? "New" : "Mới") : `Mastery ${mastery}/5`}</span><span class="review-count">${escapeHtml(reviewCountLabel(c))}</span><button class="review-mini-btn" data-review="${c.id}">${state.language === "en" ? "Review now" : "Ôn ngay"}</button></div>
  </article>`;
  }).join("");
  $$("[data-edit-card]", root).forEach(cardEl => cardEl.addEventListener("click", event => {
    if (event.target.closest("[data-review]")) return;
    openEditCard(cardEl.dataset.editCard);
  }));
  $$("[data-edit]", root).forEach(btn => btn.addEventListener("click", event => {
    event.stopPropagation();
    openEditCard(btn.dataset.edit);
  }));
  $$("[data-review]", root).forEach(btn => btn.addEventListener("click", event => {
    event.stopPropagation();
    const card = state.cards.find(c => c.id === btn.dataset.review);
    if (card) {
      state.reviewSessionStarted = true;
      setView("reviewView");
      startReview([card], "all");
    }
  }));
}

async function deleteCard(id) {
  const card = state.cards.find(c => c.id === id);
  if (!card) return;
  try {
    await vocabularyApiDelete(id);
    state.cards = state.cards.filter(c => c.id !== id);
    $$(`mark.saved-word[data-card-id="${id}"]`).forEach(mark => mark.replaceWith(...mark.childNodes));
    if (state.editingCardId === id) closeEditCard();
    saveState();
    updateStats();
    updateVideoSavedCount();
    renderPdfWordRail();
    renderCards($("#cardSearch").value);
    if ($("#readerView").classList.contains("active")) refreshReaderArticleWords();
    showToast("Đã xóa flashcard", `“${card.word}” đã được gỡ khỏi bộ.`, "🗑️");
  } catch (error) {
    showToast("Chưa xóa được flashcard", error.message || "Hãy thử lại.", "!");
  }
}
