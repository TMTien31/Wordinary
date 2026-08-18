function reviewCardToLocalCard(card = {}) {
  return {
    id: card.vocabularyId || card.id,
    reviewSessionCardId: card.id,
    word: card.word || "",
    translation: card.translation || "",
    sentence: card.sentence || "",
    sentenceTranslation: card.sentenceTranslation || "",
    phonetic: card.phonetic || "",
    icon: card.icon || ICON_FALLBACKS.default[0],
    mastery: Number(card.mastery) || 0,
    reviewCount: Number(card.reviewCount) || 0
  };
}

function applyReviewAnswerToCard(card, answer = {}, rate = "") {
  card.mastery = Number(answer.mastery ?? card.mastery) || 0;
  card.reviewCount = Number(answer.reviewCount ?? card.reviewCount) || 0;
  card.lastResult = answer.result || rate;
  card.lastReviewedAt = Date.now();
  card.nextReview = answer.nextReviewAt ? Date.parse(answer.nextReviewAt) : card.nextReview;
  upsertCard({ ...card });
  updateStats();
  if ($("#cardsView")?.classList.contains("active")) renderCards($("#cardSearch")?.value || "");
  refreshLearningProfile().catch(error => console.warn("Could not refresh learning profile", error));
}

function randomClientAnswerId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
}

function normalizeReviewMode(mode = "due") {
  return ["due", "all", "retry"].includes(mode) ? mode : "due";
}

function localDeckForReviewMode(mode) {
  const now = Date.now();
  if (mode === "retry") return state.reviewMissedQueue.slice();
  if (mode === "due") return state.cards.filter(card => !card.nextReview || card.nextReview <= now);
  return state.cards.slice();
}

function updatePracticeModeTabs() {
  const root = $("#practiceModeTabs");
  if (!root) return;
  const mode = normalizeReviewMode(state.reviewMode);
  $$("[data-practice-mode]", root).forEach(button => {
    const isActive = button.dataset.practiceMode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

async function startReview(deck = null, mode = "due") {
  const normalizedMode = normalizeReviewMode(mode);
  let sourceDeck = Array.isArray(deck) ? deck : null;
  if (!sourceDeck && normalizedMode === "retry") sourceDeck = localDeckForReviewMode("retry");
  state.reviewLoading = true;
  state.reviewMode = normalizedMode;
  if (sourceDeck) state.reviewSessionId = "";
  renderReview();
  if (!sourceDeck && state.currentUser && getAuthToken() && typeof reviewApiCreateSession === "function") {
    try {
      const session = await reviewApiCreateSession({ mode: normalizedMode, limit: normalizedMode === "all" ? 50 : 30 });
      state.reviewSessionId = session.id || "";
      sourceDeck = (session.cards || []).map(reviewCardToLocalCard);
    } catch (error) {
      console.warn("Could not create review session", error);
      showToast("Review sync failed", error.message || "Using the local deck for now.", "!");
    }
  }
  sourceDeck = sourceDeck || localDeckForReviewMode(normalizedMode);
  state.reviewOriginalDeck = sourceDeck.slice();
  state.reviewQueue = sourceDeck.slice();
  state.reviewMissedQueue = [];
  state.reviewIndex = 0;
  state.reviewFlipped = false;
  state.reviewMode = normalizedMode;
  state.reviewRound = 1;
  state.reviewRoundKnown = 0;
  state.reviewRoundMissedCount = 0;
  state.reviewSessionStarted = true;
  state.reviewSummaryVisible = false;
  state.reviewLoading = false;
  renderReview();
}

function startReviewRound(deck, mode) {
  state.reviewQueue = deck.slice();
  state.reviewMissedQueue = [];
  state.reviewIndex = 0;
  state.reviewFlipped = false;
  state.reviewMode = mode;
  state.reviewRound += 1;
  state.reviewRoundKnown = 0;
  state.reviewRoundMissedCount = 0;
  state.reviewSummaryVisible = false;
  renderReview();
}

async function finishReviewSession() {
  if (state.reviewSessionId && typeof reviewApiFinishSession === "function") {
    reviewApiFinishSession(state.reviewSessionId).catch(error => console.warn("Could not finish review session", error));
  }
  state.reviewSessionStarted = false;
  state.reviewSummaryVisible = false;
  state.reviewSessionId = "";
  state.reviewQueue = [];
  state.reviewMissedQueue = [];
  renderReview();
}

function renderReviewSummary() {
  const root = $("#reviewShell");
  const missed = state.reviewMissedQueue.length;
  const seen = state.reviewQueue.length;
  const known = Math.max(0, seen - missed);
  const title = missed ? (state.language === "en" ? "One round complete" : "Bạn đã hoàn thành một lượt") : (state.language === "en" ? "You remembered every card" : "Bạn đã thuộc toàn bộ lượt này");
  const description = missed ? (state.language === "en" ? "Cards marked not learned are still here and ready for another round." : "Những từ bạn chọn chưa thuộc vẫn được giữ lại để học tiếp.") : (state.language === "en" ? "You can finish or review the full deck again." : "Bạn có thể kết thúc hoặc học lại toàn bộ bộ thẻ.");
  root.innerHTML = `<div class="review-stage"><div class="review-empty"><div class="review-round-chip">↻ ${state.reviewMode === "retry" ? (state.language === "en" ? `Retry round ${state.reviewRound}` : `Lượt học lại ${state.reviewRound}`) : (state.language === "en" ? "Main round" : "Lượt chính")}</div><div style="font-size:52px">${missed ? "🧠" : "🎉"}</div><h2>${title}</h2><p>${description}</p><div class="review-summary-stats"><div class="review-summary-stat"><strong>${seen}</strong><span>${state.language === "en" ? "cards reviewed" : "thẻ đã xem"}</span></div><div class="review-summary-stat"><strong>${known}</strong><span>${state.language === "en" ? "learned" : "đã thuộc"}</span></div><div class="review-summary-stat"><strong>${missed}</strong><span>${state.language === "en" ? "need another round" : "cần học lại"}</span></div></div><div class="review-summary-actions">${missed ? `<button class="tool-btn primary" id="reviewMissedAgain">↻ ${state.language === "en" ? `Review missed words · ${missed}` : `Học lại từ chưa thuộc · ${missed}`}</button>` : ""}<button class="tool-btn ghost" id="reviewAllAgain">◎ ${state.language === "en" ? "Review all" : "Học lại toàn bộ"}</button><button class="tool-btn ghost" id="finishReview">✓ ${state.language === "en" ? "Finish" : "Kết thúc"}</button></div></div></div>`;
  $("#reviewMissedAgain")?.addEventListener("click", () => startReviewRound(state.reviewMissedQueue, "retry"));
  $("#reviewAllAgain").addEventListener("click", () => startReviewRound(state.reviewOriginalDeck, "all"));
  $("#finishReview").addEventListener("click", async () => { await finishReviewSession(); setView("libraryView"); });
  applyLanguage();
}

function renderReview() {
  const root = $("#reviewShell");
  updatePracticeModeTabs();
  if (state.reviewLoading) {
    root.innerHTML = `<div class="review-stage"><div class="review-empty"><div style="font-size:52px">...</div><h2>Preparing practice</h2><p>Loading your due cards.</p></div></div>`;
    return;
  }
  if (!state.cards.length) {
    state.reviewSessionStarted = false;
    root.innerHTML = `<div class="review-stage"><div class="review-empty"><div style="font-size:52px">🌱</div><h2>${state.language === "en" ? "No cards to practice yet" : "Chưa có thẻ để luyện tập"}</h2><p>${state.language === "en" ? "Save a few words from an article, PDF, or video first." : "Hãy lưu vài từ từ bài đọc, PDF hoặc video trước."}</p><button class="tool-btn primary" style="margin-top:10px" id="backToLibrary">${state.language === "en" ? "Back to Library" : "Quay lại Thư viện"}</button></div></div>`;
    $("#backToLibrary").addEventListener("click", () => setView("libraryView"));
    return;
  }
  if (!state.reviewQueue.length) {
    state.reviewSessionStarted = false;
    const mode = normalizeReviewMode(state.reviewMode);
    const title = mode === "due"
      ? (state.language === "en" ? "No cards due today" : "Hôm nay chưa có thẻ đến hạn")
      : mode === "retry"
        ? (state.language === "en" ? "No missed cards to retry" : "Chưa có thẻ sai để học lại")
        : (state.language === "en" ? "No cards in this round" : "Lượt này chưa có thẻ");
    const description = mode === "due"
      ? (state.language === "en" ? "You are caught up. Practice the full deck if you want extra reps." : "Bạn đã học xong phần đến hạn. Có thể luyện toàn bộ bộ thẻ nếu muốn ôn thêm.")
      : mode === "retry"
        ? (state.language === "en" ? "Mark a card as not learned and it will appear here for a focused retry." : "Khi chọn chưa thuộc, thẻ đó sẽ xuất hiện ở đây để học lại.")
        : (state.language === "en" ? "Start again with your vocabulary deck." : "Bắt đầu lại với toàn bộ bộ từ vựng của bạn.");
    root.innerHTML = `<div class="review-stage"><div class="review-empty"><div style="font-size:52px">🌱</div><h2>${title}</h2><p>${description}</p><div class="review-empty-actions"><button class="tool-btn primary" id="reviewDuePractice">${state.language === "en" ? "Check due" : "Kiểm tra thẻ đến hạn"}</button><button class="tool-btn ghost" id="reviewAllPractice">${state.language === "en" ? "Practice all" : "Luyện toàn bộ"}</button></div></div></div>`;
    $("#reviewDuePractice").addEventListener("click", () => startReview(null, "due"));
    $("#reviewAllPractice").addEventListener("click", () => startReview(null, "all"));
    return;
  }
  if (state.reviewIndex >= state.reviewQueue.length) {
    state.reviewSummaryVisible = true;
    renderReviewSummary();
    updateStats();
    return;
  }
  const c = state.reviewQueue[state.reviewIndex];
  const progress = state.reviewIndex / state.reviewQueue.length * 100;
  const modeLabel = state.reviewMode === "retry"
    ? (state.language === "en" ? `Retry round · ${state.reviewIndex + 1}/${state.reviewQueue.length}` : `Lượt học lại · ${state.reviewIndex + 1}/${state.reviewQueue.length}`)
    : state.reviewMode === "due"
      ? (state.language === "en" ? `Due today · ${state.reviewIndex + 1}/${state.reviewQueue.length}` : `Đến hạn hôm nay · ${state.reviewIndex + 1}/${state.reviewQueue.length}`)
      : (state.language === "en" ? `All cards · ${state.reviewIndex + 1}/${state.reviewQueue.length}` : `Toàn bộ thẻ · ${state.reviewIndex + 1}/${state.reviewQueue.length}`);
  root.innerHTML = `<div class="review-stage"><div class="review-mini-score"><span>✓ ${state.language === "en" ? "Learned" : "Đã thuộc"}: ${state.reviewRoundKnown}</span><span>↻ ${state.language === "en" ? "Retry" : "Cần học lại"}: ${state.reviewRoundMissedCount}</span></div><div class="review-top"><span>${modeLabel}</span><span>${state.reviewQueue.length - state.reviewIndex} ${state.language === "en" ? "remaining" : "còn lại"}</span></div><div class="review-track"><span style="width:${progress}%"></span></div><div class="review-card-wrap" id="reviewFlipArea"><div class="review-card" id="reviewCard"><div class="review-face review-front"><div class="review-icon"><img src="${iconUrl(c.icon)}" alt=""></div><div class="review-word">${escapeHtml(c.word)}</div><div style="color:var(--muted);margin-top:7px">${escapeHtml(c.phonetic || "")}</div><div class="flip-hint">${state.language === "en" ? "Tap to reveal the meaning • Space" : "Chạm để xem nghĩa • Space"}</div></div><div class="review-face review-back"><div class="review-translation">${escapeHtml(c.translation)}</div><div class="review-sentence">“${escapeHtml(c.sentence)}”<br><small style="font-family:system-ui;font-size:12px">${escapeHtml(c.sentenceTranslation || "")}</small></div><button class="tool-btn ghost" style="margin-top:17px" id="reviewSpeak">🔊 ${state.language === "en" ? "Listen" : "Nghe từ"}</button><div class="flip-hint">${state.language === "en" ? "How well do you know this word?" : "Bạn đã thuộc từ này chưa?"}</div></div></div></div><div class="review-actions" id="reviewActions"><button class="rate-btn again" data-rate="again">↻ ${state.language === "en" ? "Not learned" : "Chưa thuộc"} <small>1</small></button><button class="rate-btn good" data-rate="good">✓ ${state.language === "en" ? "Learned" : "Đã thuộc"} <small>2</small></button></div></div>`;
  $("#reviewFlipArea").addEventListener("click", flipReview);
  $("#reviewSpeak").addEventListener("click", event => { event.stopPropagation(); speak(c.word); });
  $$('[data-rate]').forEach(button => button.addEventListener("click", () => rateReview(button.dataset.rate)));
  applyLanguage();
}

function flipReview() {
  state.reviewFlipped = !state.reviewFlipped;
  $("#reviewCard")?.classList.toggle("flipped", state.reviewFlipped);
  $("#reviewActions")?.classList.toggle("show", state.reviewFlipped);
}

async function rateReview(rate) {
  const card = state.reviewQueue[state.reviewIndex];
  if (!card) return;
  const previous = { ...card };
  card.reviewCount = (card.reviewCount || 0) + 1;
  card.lastReviewedAt = Date.now();
  card.lastResult = rate;
  if (rate === "good") {
    card.mastery = Math.min(5, (card.mastery || 0) + 1);
    const days = [1,2,5,12,30,60][card.mastery] || 60;
    card.nextReview = Date.now() + days * 86400000;
    state.reviewRoundKnown += 1;
    state.xp += 8; state.daily += 1;
  } else {
    card.mastery = Math.max(0, (card.mastery || 0) - 1);
    card.nextReview = Date.now() + 5 * 60000;
    if (!state.reviewMissedQueue.some(entry => entry.id === card.id)) state.reviewMissedQueue.push(card);
    state.reviewRoundMissedCount += 1;
    state.xp += 3; state.daily += 1;
  }
  const syncReview = state.reviewSessionId && typeof reviewApiAnswer === "function"
    ? reviewApiAnswer(state.reviewSessionId, {
        vocabularyId: card.id,
        result: rate,
        clientAnswerId: randomClientAnswerId()
      }).then(result => applyReviewAnswerToCard(card, result, rate))
    : vocabularyApiRecordReview(card.id, rate).then(result => {
        upsertCard(apiVocabularyToCard(result));
        refreshLearningProfile().catch(error => console.warn("Could not refresh learning profile", error));
      });
  syncReview.catch(error => {
    Object.assign(card, previous);
    console.warn("Could not sync review result", error);
  });
  saveState();
  state.reviewIndex += 1;
  state.reviewFlipped = false;
  renderReview();
  updateStats();
}
