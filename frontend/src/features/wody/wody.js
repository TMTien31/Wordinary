const WODY_POSITION_KEY = "wordinary_wody_position";
const WODY_MESSAGES_KEY = "wordinary_wody_messages";

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
        <button class="wody-close" id="wodyClose" type="button" aria-label="Collapse Wody">×</button>
      </div>
      <div class="wody-messages" id="wodyMessages" role="log" aria-live="polite"></div>
      <form class="wody-form" id="wodyForm">
        <input class="wody-input" id="wodyInput" autocomplete="off" maxlength="2000" placeholder="Ask Wody..." />
        <button class="wody-send" id="wodySend" type="submit" aria-label="Send">↑</button>
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
    content: "Xin chào, mình là Wody. Mình có thể tìm từ bạn đã lưu, lục library, tóm tắt tiến độ học, và tra web bằng Jina khi cần tin mới. Hỏi tự nhiên nha, mình hứa ví dụ dễ hiểu hơn menu quán nước giờ cao điểm."
  };
  const visibleMessages = messages.length ? messages : [initial];
  messagesRoot.innerHTML = visibleMessages.map(message => `
    <div class="wody-message ${escapeHtml(message.role)}">${escapeHtml(message.content)}</div>
  `).join("");
  messagesRoot.scrollTop = messagesRoot.scrollHeight;
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
  if (!text) return;

  const history = getWodyMessages().filter(message => ["user", "assistant"].includes(message.role));
  const nextMessages = [...history, { role: "user", content: text }];
  setWodyMessages(nextMessages);
  input.value = "";
  input.disabled = true;
  sendButton.disabled = true;
  renderWodyMessages();

  try {
    const response = await sendWodyMessage({ message: text, history });
    setWodyMessages([...nextMessages, { role: "assistant", content: response.reply || "" }]);
  } catch (error) {
    setWodyMessages([
      ...nextMessages,
      { role: "error", content: error.message || "Wody trượt chân một nhịp. Thử lại giúp mình nhé." }
    ]);
  } finally {
    input.disabled = false;
    sendButton.disabled = false;
    renderWodyMessages();
    input.focus();
  }
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
