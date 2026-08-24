function attachEvents() {
  bindVideoEvents();
  bindPdfEvents();
  bindDictationEvents();
  document.addEventListener("error", event => {
    if (event.target instanceof HTMLImageElement) handleIconError(event.target);
  }, true);
  $$("[data-view]").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
  $$('[data-go-cards]').forEach(btn => btn.addEventListener("click", () => setView("cardsView")));
  $("#mobileMenuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#sidebarCollapseToggle").addEventListener("click", () => {
    if (window.innerWidth <= 780) { $("#sidebar").classList.remove("open"); return; }
    state.mainSidebarCollapsed = !state.mainSidebarCollapsed;
    updateMainSidebarButton();
    saveState();
  });
  $("#themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    document.body.classList.toggle("dark", state.theme === "dark");
    $("#themeToggle").textContent = state.theme === "dark" ? "☀" : "☾";
    saveState();
  });
  $("#languageToggle").addEventListener("click", () => {
    state.language = state.language === "vi" ? "en" : "vi";
    if ($("#libraryView").classList.contains("active")) renderLibraryOverview();
    else if ($("#reviewView").classList.contains("active")) renderReview();
    else if ($("#dictationView").classList.contains("active")) renderDictation();
    else if ($("#cardsView").classList.contains("active")) renderCards($("#cardSearch")?.value || "");
    else applyLanguage();
    renderSettingsProfile();
    saveState();
  });
  $("#readerRailToggle").addEventListener("click", () => {
    state.readerRailCollapsed = !state.readerRailCollapsed;
    updateReaderRailButton();
    saveState();
  });
  $("#readerArticleWordList").addEventListener("click", event => {
    const highlightButton = event.target.closest("[data-reader-highlight-word]");
    if (highlightButton) {
      event.stopPropagation();
      toggleReaderWordHighlight(highlightButton.dataset.readerHighlightWord);
      return;
    }
    const card = event.target.closest("[data-reader-card]");
    if (card) openEditCard(card.dataset.readerCard);
  });
  $("#readerArticleWordList").addEventListener("keydown", event => {
    if (!["Enter", " "].includes(event.key)) return;
    if (event.target.closest("[data-reader-highlight-word]")) return;
    const card = event.target.closest("[data-reader-card]");
    if (!card) return;
    event.preventDefault();
    openEditCard(card.dataset.readerCard);
  });
  $("#readerCard").addEventListener("scroll", updateReadingProgress);
  $("#librarySearch").addEventListener("input", () => refreshAndRenderLibrary(350));
  $("#librarySort").addEventListener("change", () => refreshAndRenderLibrary());
  $("#libraryFilterTabs").addEventListener("click", event => { const button = event.target.closest("[data-library-filter]"); if (!button) return; state.libraryFilter = button.dataset.libraryFilter; refreshAndRenderLibrary(); });
  $("#practiceModeTabs").addEventListener("click", event => {
    const button = event.target.closest("[data-practice-mode]");
    if (!button || button.disabled) return;
    startReview(null, button.dataset.practiceMode);
  });
  $("#addContentFromLibrary").addEventListener("click", () => { $("#addContentModal").classList.add("show"); $("#addContentModal").setAttribute("aria-hidden", "false"); });
  $("#closeAddContent").addEventListener("click", () => { $("#addContentModal").classList.remove("show"); $("#addContentModal").setAttribute("aria-hidden", "true"); });
  $("#addContentModal").addEventListener("mousedown", event => { if (event.target === $("#addContentModal")) $("#closeAddContent").click(); });
  $$("[data-add-content-type]").forEach(button => button.addEventListener("click", () => {
    const type = button.dataset.addContentType;
    $("#closeAddContent").click();
    if (type === "article") { setView("readerView"); setTimeout(openImportModal, 80); }
    if (type === "pdf") { setView("pdfView"); state.pendingPdfLibraryId = null; setTimeout(() => $("#pdfFileInput").click(), 80); }
    if (type === "video") { setView("videoView"); setTimeout(() => $("#videoUrlInput").focus(), 80); }
  }));
  const handleLibraryGridClick = event => {
    const deleteButton = event.target.closest("[data-delete-library-item]");
    if (deleteButton) { event.stopPropagation(); deleteLibraryItem(deleteButton.dataset.deleteLibraryItem); return; }
    const card = event.target.closest("[data-open-library-item]");
    if (card) openLibraryItem(card.dataset.openLibraryItem);
  };
  $("#articleLibraryGrid").addEventListener("click", handleLibraryGridClick);
  $("#continueLearningGrid").addEventListener("click", handleLibraryGridClick);
  $("#articleBody").addEventListener("mouseup", handleSelection);
  $("#articleBody").addEventListener("touchend", handleSelection);
  $("#popupClose").addEventListener("click", closeSelectionPopup);
  $("#speakWord").addEventListener("click", () => state.selection && speak(state.selection.word));
  $("#saveWord").addEventListener("click", saveCurrentSelection);
  document.addEventListener("mousedown", e => {
    if (!$("#selectionPopup").contains(e.target) && !$("#articleBody").contains(e.target) && !$("#captionList").contains(e.target) && !$("#pdfTextLayer").contains(e.target)) closeSelectionPopup();
  });
  window.addEventListener("resize", closeSelectionPopup);
  window.addEventListener("pagehide", () => {
    flushArticleProgressSync({ keepalive: true });
    flushVideoProgressSync({ keepalive: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushArticleProgressSync({ keepalive: true });
      flushVideoProgressSync({ keepalive: true });
    }
  });
  $("#fontDown").addEventListener("click", () => setFont(state.fontSize - 1));
  $("#fontUp").addEventListener("click", () => setFont(state.fontSize + 1));
  $("#focusToggle").addEventListener("click", () => document.body.classList.toggle("focus-mode"));
  $("#openImport").addEventListener("click", openImportModal);
  $("#closeImport").addEventListener("click", closeImportModal);
  $("#cancelImport").addEventListener("click", closeImportModal);
  $("#importModal").addEventListener("mousedown", e => { if (e.target === $("#importModal")) closeImportModal(); });
  $("#editCurrentArticle").addEventListener("click", openEditArticleModal);
  $("#closeEditArticle").addEventListener("click", closeEditArticleModal);
  $("#cancelEditArticle").addEventListener("click", closeEditArticleModal);
  $("#saveEditArticle").addEventListener("click", saveEditedArticle);
  $("#editArticleModal").addEventListener("mousedown", e => { if (e.target === $("#editArticleModal")) closeEditArticleModal(); });
  $("#closeEditCard").addEventListener("click", closeEditCard);
  $("#cancelEditCard").addEventListener("click", closeEditCard);
  $("#saveEditCard").addEventListener("click", saveEditedCard);
  $("#editCardModal").addEventListener("mousedown", e => { if (e.target === $("#editCardModal")) closeEditCard(); });
  $("#editUploadTrigger").addEventListener("click", () => $("#editImageInput").click());
  $("#editImageInput").addEventListener("change", () => handleEditImageUpload($("#editImageInput").files[0]));
  $("#editUseSuggested").addEventListener("click", () => {
    const first = $("#editIconOptions .edit-icon-option")?.dataset.icon || ICON_FALLBACKS.default[0];
    setEditImage(first);
    $("#editIconStatus").textContent = "icon gợi ý";
  });
  $("#editDeleteCard").addEventListener("click", () => {
    const card = state.cards.find(c => c.id === state.editingCardId);
    if (card && confirm(state.language === "en" ? `Delete the flashcard “${card.word}”?` : `Xóa flashcard “${card.word}”?`)) deleteCard(card.id);
  });
  $("#articleBody").addEventListener("click", event => {
    const mark = event.target.closest("mark.saved-word");
    if (mark?.dataset.cardId) openEditCard(mark.dataset.cardId);
  });
  $("#loadSample").addEventListener("click", () => {
    state.article = normalizeArticleRecord(SAMPLE_ARTICLE, "wordinary-sample-curiosity"); state.sessionSaved = 0; state.sessionXp = 0; saveState(); renderArticle(); updateStats(); showToast("Đã mở bài mẫu", "Bôi đen “curiosity”, “winds” hoặc “bank” để thử.", "✨");
  });
  $$(".tab-btn").forEach(btn => btn.addEventListener("click", () => {
    state.currentTab = btn.dataset.tab;
    $$(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
    $$(".tab-panel").forEach(p => p.classList.toggle("active", p.id === state.currentTab));
  }));
  $("#doImport").addEventListener("click", importArticle);
  $("#dropzone").addEventListener("click", () => $("#fileInput").click());
  $("#fileInput").addEventListener("change", () => selectFile($("#fileInput").files[0]));
  ["dragenter", "dragover"].forEach(name => $("#dropzone").addEventListener(name, e => { e.preventDefault(); $("#dropzone").classList.add("drag"); }));
  ["dragleave", "drop"].forEach(name => $("#dropzone").addEventListener(name, e => { e.preventDefault(); $("#dropzone").classList.remove("drag"); }));
  $("#dropzone").addEventListener("drop", e => selectFile(e.dataTransfer.files[0]));
  $("#cardSearch").addEventListener("input", e => renderCards(e.target.value));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && $("#editCardModal").classList.contains("show")) { closeEditCard(); return; }
    if (!$("#reviewView").classList.contains("active") || e.target.matches("input,textarea")) return;
    if (e.code === "Space") { e.preventDefault(); flipReview(); }
    if (e.key === "1" && state.reviewFlipped) rateReview("again");
    if (e.key === "2" && state.reviewFlipped) rateReview("good");
  });
}

function selectFile(file) {
  if (!file) return;
  if (!/\.(txt|md|html?|)$/i.test(file.name)) return showToast("Định dạng chưa hỗ trợ", "Hãy dùng tệp TXT, MD hoặc HTML.", "⚠️");
  state.uploadedFile = file;
  $("#fileName").textContent = `✓ ${file.name} • ${Math.max(1, Math.round(file.size / 1024))} KB`;
}

function setFont(size) {
  state.fontSize = Math.min(28, Math.max(17, size));
  document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
  $("#fontSizeLabel").textContent = `${state.fontSize}px`;
  saveState();
}

function normalizeStoredTranslations() {
  let changed = false;
  state.cards = state.cards.map(card => {
    const translation = cleanTranslation(card.translation || "");
    const sentenceTranslation = cleanTranslation(card.sentenceTranslation || "");
    if (translation !== (card.translation || "") || sentenceTranslation !== (card.sentenceTranslation || "")) changed = true;
    return { ...card, translation, sentenceTranslation };
  });
  if (changed) saveState();
}

function init() {
  initializeAuthUi();
  if (typeof purgeBackendBackedBrowserState === "function") purgeBackendBackedBrowserState();
  normalizeStoredTranslations();
  initializeArticleLibrary();
  initializeUnifiedLibrary();
  document.body.classList.toggle("dark", state.theme === "dark");
  $("#themeToggle").textContent = state.theme === "dark" ? "☀" : "☾";
  setFont(state.fontSize);
  updateReaderRailButton();
  updateMainSidebarButton();
  renderArticle();
  updateStats();
  attachEvents();
  renderCards();
  renderLibraryOverview();
  initializeDictation();
  setView("isleView");
  updateVideoSavedCount();
  ensureVideoPolling();
  applyLanguage();
  observeI18n();
  if (!appSessionStorage.getItem("wordinary_seen") && !appSessionStorage.getItem("lingoleaf_seen")) {
    setTimeout(() => showToast("Thử ngay trong bài mẫu", "Bôi đen một từ tiếng Anh để xem popup dịch theo ngữ cảnh.", "👆"), 700);
    appSessionStorage.setItem("wordinary_seen", "1");
  }
}
