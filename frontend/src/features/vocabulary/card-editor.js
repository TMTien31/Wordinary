function setEditImage(icon) {
  state.editingIcon = icon || ICON_FALLBACKS.default[0];
  const preview = $("#editImagePreview");
  preview.src = iconUrl(state.editingIcon);
  preview.classList.toggle("custom-image", /^(data:image\/|blob:|https?:\/\/)/i.test(state.editingIcon));
  $$(".edit-icon-option", $("#editIconOptions")).forEach(btn => btn.classList.toggle("active", btn.dataset.icon === state.editingIcon));
}

function renderEditIconOptions(icons) {
  const root = $("#editIconOptions");
  const unique = [...new Set((icons || []).filter(icon => /^[a-z0-9-]+:[a-z0-9-]+$/i.test(icon)))].slice(0, 8);
  root.innerHTML = unique.map(icon => `<button class="edit-icon-option ${icon === state.editingIcon ? "active" : ""}" data-icon="${escapeHtml(icon)}" type="button"><img src="${iconUrl(icon)}" alt=""></button>`).join("");
  $$(".edit-icon-option", root).forEach(btn => btn.addEventListener("click", () => setEditImage(btn.dataset.icon)));
}

async function openEditCard(cardId) {
  const card = state.cards.find(c => c.id === cardId);
  if (!card) return;
  closeSelectionPopup();
  state.editingCardId = cardId;
  state.editingIcon = card.icon || ICON_FALLBACKS.default[0];
  $("#editWord").value = card.word || "";
  $("#editTranslation").value = card.translation || "";
  $("#editPhonetic").value = card.phonetic || "";
  $("#editPartOfSpeech").value = card.partOfSpeech || "";
  $("#editDefinition").value = card.definition || "";
  $("#editSentence").value = card.sentence || "";
  $("#editSentenceTranslation").value = card.sentenceTranslation || "";
  $("#editSourceTitle").value = card.sourceTitle || "";
  $("#editIconStatus").textContent = "dang tim...";
  setEditImage(state.editingIcon);
  const quickIcons = fallbackIcons(inferVisualQuery(card.word || "", card.sentence || "", card.translation || ""));
  renderEditIconOptions([state.editingIcon, ...quickIcons]);
  $("#editCardModal").classList.add("show");
  $("#editCardModal").setAttribute("aria-hidden", "false");
  setTimeout(() => $("#editWord").focus(), 80);

  try {
    const query = inferVisualQuery(card.word || "", card.sentence || "", card.translation || "");
    const icons = await searchIcons(query);
    if (state.editingCardId !== cardId) return;
    renderEditIconOptions([state.editingIcon, ...icons]);
    $("#editIconStatus").textContent = `${Math.min(8, icons.length)} goi y`;
  } catch (_) {
    if (state.editingCardId === cardId) $("#editIconStatus").textContent = "icon offline";
  }
}

function closeEditCard() {
  $("#editCardModal").classList.remove("show");
  $("#editCardModal").setAttribute("aria-hidden", "true");
  $("#editImageInput").value = "";
  state.editingCardId = null;
  state.editingIcon = null;
}

async function saveEditedCard() {
  const card = state.cards.find(c => c.id === state.editingCardId);
  if (!card) return closeEditCard();
  const word = $("#editWord").value.trim();
  const translation = $("#editTranslation").value.trim();
  if (!word) return showToast("Thieu tu can hoc", "Hay nhap tu hoac cum tu cho flashcard.", "!");
  const payload = {
    word,
    translation: translation || "Chua co ban dich",
    phonetic: $("#editPhonetic").value.trim(),
    partOfSpeech: $("#editPartOfSpeech").value.trim(),
    definition: $("#editDefinition").value.trim(),
    sentence: $("#editSentence").value.trim(),
    sentenceTranslation: $("#editSentenceTranslation").value.trim(),
    source: {
      ...cardSourceFromCard(card),
      sourceTitle: $("#editSourceTitle").value.trim()
    },
    icon: state.editingIcon || card.icon || ICON_FALLBACKS.default[0]
  };
  try {
    const updated = upsertCard(apiVocabularyToCard(await vocabularyApiUpdate(card.id, payload)));
    saveState();
    updateStats();
    renderCards($("#cardSearch").value);
    renderPdfWordRail();
    if ($("#readerView").classList.contains("active")) refreshReaderArticleWords();
    closeEditCard();
    showToast(`Updated "${updated.word}"`, "Your changes were saved.", "OK");
  } catch (error) {
    showToast("Chua cap nhat duoc", error.message || "Hay thu lai.", "!");
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Khong the doc anh nay."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Anh khong hop le hoac bi hong."));
    image.src = src;
  });
}

async function compressCardImage(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Hay chon mot tep hinh anh.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Anh lon hon 8 MB. Hay chon anh nhe hon.");
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const scale = Math.min((size - 28) / image.naturalWidth, (size - 28) / image.naturalHeight, 1);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  return canvas.toDataURL("image/webp", .84);
}

async function handleEditImageUpload(file) {
  if (!file) return;
  const trigger = $("#editUploadTrigger");
  const previous = trigger.textContent;
  trigger.disabled = true;
  trigger.textContent = "Dang xu ly...";
  try {
    const dataUrl = await compressCardImage(file);
    setEditImage(dataUrl);
    $("#editIconStatus").textContent = "anh cua ban";
    showToast("Da thay anh", "Nhan Luu thay doi de hoan tat.", "OK");
  } catch (error) {
    showToast("Chua dung duoc anh", error.message || "Hay thu anh khac.", "!");
  } finally {
    trigger.disabled = false;
    trigger.textContent = previous;
    $("#editImageInput").value = "";
  }
}
