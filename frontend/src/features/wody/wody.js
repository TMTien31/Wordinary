const WODY_POSITION_KEY = "wordinary_wody_position";
const WODY_MESSAGES_KEY = "wordinary_wody_messages";

let wodyThinking = false;

function initWody() {
  if ($("#wodyWidget")) return;

  const root = document.createElement("div");
  root.className = "wody-widget";
  root.id = "wodyWidget";
  root.innerHTML = `
    <div class="wody-panel is-hidden" id="wodyPanel" aria-hidden="true">
      <div class="wody-panel-head" id="wodyDragHandle">
        <div class="wody-title">
          <div class="wody-avatar" aria-hidden="true">W</div>
          <div><strong>Wody</strong><small>Wordinary helper</small></div>
        </div>
        <button class="wody-close" id="wodyClose" type="button" aria-label="Collapse Wody">&times;</button>
      </div>
      <div class="wody-messages" id="wodyMessages" role="log" aria-live="polite"></div>
      <form class="wody-form" id="wodyForm">
        <input class="wody-input" id="wodyInput" autocomplete="off" maxlength="2000" placeholder="Ask Wody..." />
        <button class="wody-send" id="wodySend" type="submit" aria-label="Send">&uarr;</button>
      </form>
    </div>
    <button class="wody-bubble" id="wodyBubble" type="button" aria-label="Open Wody chat"><span>W</span></button>
  `;
  document.body.appendChild(root);

  restoreWodyPosition(root);
  renderWodyMessages();

  $("#wodyBubble").addEventListener("click", event => {
    if (root.dataset.dragged === "true") {
      event.preventDefault();
      return;
    }
    toggleWodyPanel();
  });
  $("#wodyClose").addEventListener("click", () => setWodyOpen(false));
  $("#wodyForm").addEventListener("submit", submitWodyMessage);
  $("#wodyMessages").addEventListener("click", handleWodyActionClick);
  bindWodyDrag(root, $("#wodyBubble"));
  bindWodyDrag(root, $("#wodyDragHandle"));
}

function getWodyMessages() {
  try {
    const parsed = JSON.parse(appStorage.getItem(WODY_MESSAGES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-12) : [];
  } catch {
    return [];
  }
}

function setWodyMessages(messages) {
  appStorage.setItem(WODY_MESSAGES_KEY, JSON.stringify(messages.slice(-12)));
}

function renderWodyMessages() {
  const messagesRoot = $("#wodyMessages");
  if (!messagesRoot) return;
  const messages = getWodyMessages();
  const initial = {
    role: "assistant",
    content: "Xin chào, mình là Wody. Mình có thể tìm từ đã lưu, lục library, tóm tắt tiến độ, tra web bằng Jina, thêm/sửa flashcard, và thêm article tiếng Anh từ web. Nếu xóa gì đó, mình sẽ đưa nút xác nhận ngay trong chat. Hỏi tự nhiên nha."
  };
  const visibleMessages = messages.length ? messages : [initial];
  messagesRoot.innerHTML = [
    ...visibleMessages.map((message, index) => renderWodyMessage(message, index)),
    wodyThinking ? renderWodyThinking() : ""
  ].join("");
  messagesRoot.scrollTop = messagesRoot.scrollHeight;
}

function renderWodyMessage(message, index) {
  const role = ["assistant", "user", "error"].includes(message.role) ? message.role : "assistant";
  const actions = role === "assistant" && Array.isArray(message.actions) ? message.actions : [];
  const content = String(message.content || "").trim();
  return `
    <div class="wody-message-row ${role}">
      <div class="wody-message ${role}">
        <div class="wody-message-content">${escapeHtml(content)}</div>
        ${actions.length ? renderWodyActions(actions, index) : ""}
      </div>
    </div>
  `;
}

function renderWodyActions(actions, messageIndex) {
  return `
    <div class="wody-actions">
      ${actions.map((action, actionIndex) => `
        <button
          class="wody-action-btn ${action.type?.startsWith("delete_") ? "danger" : ""}"
          type="button"
          title="${escapeHtml(action.label || "Confirm")}"
          data-wody-action="confirm"
          data-message-index="${messageIndex}"
          data-action-index="${actionIndex}"
        >${escapeHtml(wodyActionConfirmLabel(action))}</button>
        <button
          class="wody-action-btn"
          type="button"
          data-wody-action="cancel"
          data-message-index="${messageIndex}"
          data-action-index="${actionIndex}"
        >Hủy</button>
      `).join("")}
    </div>
  `;
}

function wodyActionConfirmLabel(action) {
  if (action.type === "delete_vocabulary_item") return "Xóa từ";
  if (action.type === "delete_library_item") return "Xóa";
  return "Xác nhận";
}

function renderWodyThinking() {
  return `
    <div class="wody-message-row assistant">
      <div class="wody-message assistant wody-thinking" aria-label="Wody is thinking">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
}

function toggleWodyPanel() {
  setWodyOpen($("#wodyPanel").classList.contains("is-hidden"));
}

function setWodyOpen(open) {
  const panel = $("#wodyPanel");
  if (!panel) return;
  panel.classList.toggle("is-hidden", !open);
  panel.setAttribute("aria-hidden", open ? "false" : "true");
  $("#wodyBubble").setAttribute("aria-label", open ? "Collapse Wody chat" : "Open Wody chat");
  if (open) setTimeout(() => $("#wodyInput")?.focus(), 40);
}

async function submitWodyMessage(event) {
  event.preventDefault();
  const input = $("#wodyInput");
  const sendButton = $("#wodySend");
  const text = input.value.trim();
  if (!text || wodyThinking) return;

  const currentMessages = getWodyMessages();
  const history = currentMessages
    .filter(message => ["user", "assistant"].includes(message.role))
    .map(message => ({ role: message.role, content: message.content || "" }));
  const nextMessages = [...currentMessages, { role: "user", content: text }];
  setWodyMessages(nextMessages);
  input.value = "";
  input.disabled = true;
  sendButton.disabled = true;
  wodyThinking = true;
  renderWodyMessages();

  try {
    const response = await sendWodyMessage({ message: text, history });
    const actions = Array.isArray(response.pendingActions) ? response.pendingActions : [];
    setWodyMessages([...nextMessages, { role: "assistant", content: response.reply || "", actions }]);
    await refreshAfterWodyTools(response.toolsUsed || []);
  } catch (error) {
    setWodyMessages([
      ...nextMessages,
      { role: "error", content: error.message || "Wody trượt chân một nhịp. Thử lại giúp mình nhé." }
    ]);
  } finally {
    wodyThinking = false;
    input.disabled = false;
    sendButton.disabled = false;
    renderWodyMessages();
    input.focus();
  }
}

async function handleWodyActionClick(event) {
  const button = event.target.closest("[data-wody-action]");
  if (!button || button.disabled) return;

  const actionVerb = button.dataset.wodyAction;
  const messageIndex = Number(button.dataset.messageIndex);
  const actionIndex = Number(button.dataset.actionIndex);
  const messages = getWodyMessages();
  const message = messages[messageIndex];
  const action = message?.actions?.[actionIndex];
  if (!message || !action) return;

  message.actions = [];
  if (actionVerb === "cancel") {
    setWodyMessages([...messages, { role: "assistant", content: "Ok, mình không xóa nữa." }]);
    renderWodyMessages();
    return;
  }

  button.disabled = true;
  wodyThinking = true;
  renderWodyMessages();

  try {
    const response = await executeWodyAction(action);
    setWodyMessages([...messages, { role: response.ok ? "assistant" : "error", content: response.message || "Action completed." }]);
    await refreshAfterWodyTools([action.type]);
  } catch (error) {
    setWodyMessages([
      ...messages,
      { role: "error", content: error.message || "Wody chưa chạy được action này. Thử lại giúp mình nhé." }
    ]);
  } finally {
    wodyThinking = false;
    renderWodyMessages();
  }
}

async function refreshAfterWodyTools(toolsUsed = []) {
  const tools = new Set(toolsUsed);
  const refreshes = [];
  if (
    tools.has("create_vocabulary_item") ||
    tools.has("update_vocabulary_item") ||
    tools.has("delete_vocabulary_item")
  ) {
    if (typeof refreshVocabularyFromApi === "function") refreshes.push(refreshVocabularyFromApi());
  }
  if (
    tools.has("create_article_from_web_search") ||
    tools.has("delete_library_item")
  ) {
    if (typeof refreshAndRenderLibrary === "function") refreshes.push(refreshAndRenderLibrary());
  }
  await Promise.allSettled(refreshes);
}

function bindWodyDrag(root, handle) {
  if (!root || !handle) return;
  handle.addEventListener("pointerdown", event => {
    if (event.target.closest("button") && handle.id !== "wodyBubble") return;
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = root.getBoundingClientRect();
    const offsetX = startX - rect.left;
    const offsetY = startY - rect.top;
    let moved = false;

    handle.setPointerCapture(event.pointerId);
    root.dataset.dragged = "false";

    const onMove = moveEvent => {
      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);
      if (dx + dy > 4) moved = true;
      if (!moved) return;
      const nextLeft = moveEvent.clientX - offsetX;
      const nextTop = moveEvent.clientY - offsetY;
      setWodyPosition(root, nextLeft, nextTop);
      root.dataset.dragged = "true";
    };

    const onUp = upEvent => {
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      saveWodyPosition(root);
      setTimeout(() => { root.dataset.dragged = "false"; }, 0);
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}

function setWodyPosition(root, left, top) {
  const rect = root.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width - 8;
  const maxTop = window.innerHeight - rect.height - 8;
  root.style.left = `${Math.max(8, Math.min(maxLeft, left))}px`;
  root.style.top = `${Math.max(8, Math.min(maxTop, top))}px`;
  root.style.right = "auto";
  root.style.bottom = "auto";
}

function saveWodyPosition(root) {
  const rect = root.getBoundingClientRect();
  appStorage.setItem(WODY_POSITION_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
}

function restoreWodyPosition(root) {
  try {
    const position = JSON.parse(appStorage.getItem(WODY_POSITION_KEY) || "null");
    if (position && Number.isFinite(position.left) && Number.isFinite(position.top)) {
      setWodyPosition(root, position.left, position.top);
    }
  } catch {
    appStorage.removeItem(WODY_POSITION_KEY);
  }
}
