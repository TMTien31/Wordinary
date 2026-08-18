let i18nBusy = false;

function translateUiString(value, target = state.language) {
  if (!value) return value;
  const original = String(value);
  const trimmed = original.trim();
  const normalized = decodeLegacyMojibake(trimmed);
  if (normalized !== trimmed) {
    const normalizedTranslation = target === "vi"
      ? (EN_TO_VI[normalized] || normalized)
      : (VI_TO_EN[normalized] || translateDynamicVietnamese(normalized) || normalized);
    return original.replace(trimmed, normalizedTranslation);
  }
  const map = target === "vi" ? EN_TO_VI : VI_TO_EN;
  if (map[trimmed]) return original.replace(trimmed, map[trimmed]);

  const translated = target === "vi"
    ? translateDynamicEnglish(trimmed)
    : translateDynamicVietnamese(trimmed);
  return translated ? original.replace(trimmed, translated) : value;
}

function decodeLegacyMojibake(value) {
  if (!value || ![...value].some(isLikelyLegacyByte)) return value;
  const bytes = [];
  for (const char of value) {
    const code = char.charCodeAt(0);
    const byte = WINDOWS_1252_EXTRA_BYTES[code] ?? (code <= 255 ? code : null);
    if (byte === null) return value;
    bytes.push(byte);
  }
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    return decoded && decoded !== value ? decoded : value;
  } catch (_) {
    return value;
  }
}

function isLikelyLegacyByte(char) {
  const code = char.charCodeAt(0);
  return (code >= 0x80 && code <= 0xff) || WINDOWS_1252_EXTRA_BYTES[code] !== undefined;
}

const WINDOWS_1252_EXTRA_BYTES = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f
};

function translateDynamicVietnamese(value) {
  let match = value.match(/^(\d+) ngày$/);
  if (match) return `${match[1]} days`;
  match = value.match(/^Trang (\d+) \/ (\d+)$/);
  if (match) return `Page ${match[1]} / ${match[2]}`;
  match = value.match(/^(\d+) trang$/);
  if (match) return `${match[1]} pages`;
  match = value.match(/^(\d+) vị trí$/);
  if (match) return `${match[1]} occurrences`;
  match = value.match(/^(\d+)\/(\d+) vị trí$/);
  if (match) return `${match[1]}/${match[2]} occurrences`;
  match = value.match(/^Thẻ (\d+)\/(\d+)$/);
  if (match) return `Card ${match[1]}/${match[2]}`;
  match = value.match(/^(\d+) còn lại$/);
  if (match) return `${match[1]} remaining`;
  match = value.match(/^(\d+) gợi ý$/);
  if (match) return `${match[1]} suggestions`;
  match = value.match(/^(\d+) từ$/);
  if (match) return `${match[1]} words`;
  match = value.match(/^(\d+) dòng đã sẵn sàng để đồng bộ\.$/);
  if (match) return `${match[1]} caption lines are ready to sync.`;
  match = value.match(/^(\d+) dòng caption đã tải\.$/);
  if (match) return `${match[1]} caption lines loaded.`;
  match = value.match(/^Đang chọn “(.+)” tại (.+)$/);
  if (match) return `Selected “${match[1]}” at ${match[2]}`;
  match = value.match(/^Đã lưu “(.+)”$/);
  if (match) return `Saved “${match[1]}”`;
  match = value.match(/^Đã cập nhật “(.+)”$/);
  if (match) return `Updated “${match[1]}”`;
  match = value.match(/^Nghĩa đang dùng trong câu: (.+)\.$/);
  if (match) return `Meaning used in this sentence: ${match[1]}.`;
  return "";
}

function translateDynamicEnglish(value) {
  let match = value.match(/^(\d+) days$/);
  if (match) return `${match[1]} ngày`;
  match = value.match(/^Page (\d+) \/ (\d+)$/);
  if (match) return `Trang ${match[1]} / ${match[2]}`;
  match = value.match(/^(\d+) pages$/);
  if (match) return `${match[1]} trang`;
  match = value.match(/^(\d+) occurrences$/);
  if (match) return `${match[1]} vị trí`;
  match = value.match(/^(\d+)\/(\d+) occurrences$/);
  if (match) return `${match[1]}/${match[2]} vị trí`;
  match = value.match(/^Card (\d+)\/(\d+)$/);
  if (match) return `Thẻ ${match[1]}/${match[2]}`;
  match = value.match(/^(\d+) remaining$/);
  if (match) return `${match[1]} còn lại`;
  match = value.match(/^(\d+) suggestions$/);
  if (match) return `${match[1]} gợi ý`;
  match = value.match(/^(\d+) words$/);
  if (match) return `${match[1]} từ`;
  match = value.match(/^(\d+) caption lines are ready to sync\.$/);
  if (match) return `${match[1]} dòng đã sẵn sàng để đồng bộ.`;
  match = value.match(/^(\d+) caption lines loaded\.$/);
  if (match) return `${match[1]} dòng caption đã tải.`;
  match = value.match(/^Selected “(.+)” at (.+)$/);
  if (match) return `Đang chọn “${match[1]}” tại ${match[2]}`;
  match = value.match(/^Saved “(.+)”$/);
  if (match) return `Đã lưu “${match[1]}”`;
  match = value.match(/^Updated “(.+)”$/);
  if (match) return `Đã cập nhật “${match[1]}”`;
  match = value.match(/^Meaning used in this sentence: (.+)\.$/);
  if (match) return `Nghĩa đang dùng trong câu: ${match[1]}.`;
  return "";
}

function shouldSkipI18n(node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return !element || !!element.closest("script,style,#articleBody,#pdfTextLayer,[data-no-i18n],input[type=file]");
}

function translateUiTree(root = document.body) {
  if (!root || i18nBusy) return;
  i18nBusy = true;
  const translateElementAttrs = element => {
    if (shouldSkipI18n(element)) return;
    ["placeholder","title","aria-label","alt","data-label"].forEach(attr => {
      if (!element.hasAttribute?.(attr)) return;
      const current = element.getAttribute(attr);
      const translated = translateUiString(current);
      if (translated !== current) element.setAttribute(attr, translated);
    });
  };
  if (root.nodeType === Node.ELEMENT_NODE) translateElementAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!shouldSkipI18n(node) && node.nodeValue.trim()) {
        const translated = translateUiString(node.nodeValue);
        if (translated !== node.nodeValue) node.nodeValue = translated;
      }
    } else {
      translateElementAttrs(node);
    }
  }
  i18nBusy = false;
}

function applyLanguage() {
  document.documentElement.lang = state.language === "en" ? "en" : "vi";
  document.body.dataset.language = state.language;
  translateUiTree(document.body);
  $("#languageCode").textContent = state.language.toUpperCase();
  $("#languageToggle").title = state.language === "vi" ? "Switch to English" : "Switch to Vietnamese";
  const active = $(".nav-btn.active")?.dataset.view;
  if (active) {
    const namesVi = { libraryView:"Thư viện",cardsView:"Từ vựng",reviewView:"Luyện tập",readerView:"Đọc",pdfView:"PDF",videoView:"Video",settingsView:"Cài đặt" };
    const namesEn = { libraryView:"Library",cardsView:"Vocabulary",reviewView:"Practice",readerView:"Read",pdfView:"PDF",videoView:"Video",settingsView:"Settings" };
    $("#crumbName").textContent = (state.language === "en" ? namesEn : namesVi)[active];
  }
  updateReaderRailButton();
  updateMainSidebarButton();
}

function observeI18n() {
  const observer = new MutationObserver(records => {
    if (i18nBusy || state.language !== "en") return;
    records.forEach(record => {
      if (record.type === "characterData") {
        translateUiTree(record.target.parentElement);
        return;
      }
      if (record.type === "attributes") {
        translateUiTree(record.target);
        return;
      }
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) translateUiTree(node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
      });
    });
  });
  observer.observe(document.body, {
    childList:true, subtree:true, characterData:true, attributes:true,
    attributeFilter:["placeholder","title","aria-label","alt","data-label"]
  });
}

function updateReaderRailButton() {
  const layout = $("#readerView .reader-layout");
  const button = $("#readerRailToggle");
  if (!layout || !button) return;
  layout.classList.toggle("rail-collapsed", state.readerRailCollapsed);
  button.classList.toggle("active", state.readerRailCollapsed);
  $("#readerRailToggleIcon").textContent = state.readerRailCollapsed ? "‹" : "›";
  const label = state.readerRailCollapsed
    ? (state.language === "en" ? "Open right sidebar" : "Mở sidebar bên phải")
    : (state.language === "en" ? "Collapse right sidebar" : "Thu gọn sidebar bên phải");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", String(!state.readerRailCollapsed));
}

function updateMainSidebarButton() {
  const shell = $("#appShell");
  const button = $("#sidebarCollapseToggle");
  if (!shell || !button) return;
  shell.classList.toggle("sidebar-collapsed", state.mainSidebarCollapsed);
  $("#sidebarCollapseIcon").textContent = state.mainSidebarCollapsed ? "›" : "‹";
  const label = state.mainSidebarCollapsed
    ? (state.language === "en" ? "Expand navigation" : "Mở rộng menu")
    : (state.language === "en" ? "Collapse navigation" : "Thu gọn menu");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", String(!state.mainSidebarCollapsed));
  const viewNamesVi = { libraryView:"Thư viện", cardsView:"Từ vựng", reviewView:"Luyện tập", readerView:"Đọc", pdfView:"PDF", videoView:"Video", settingsView:"Cài đặt" };
  const viewNamesEn = { libraryView:"Library", cardsView:"Vocabulary", reviewView:"Practice", readerView:"Read", pdfView:"PDF", videoView:"Video", settingsView:"Settings" };
  $$(".nav-btn").forEach(nav => {
    const name = (state.language === "en" ? viewNamesEn : viewNamesVi)[nav.dataset.view] || nav.querySelector(".nav-text")?.textContent.trim() || "";
    nav.title = state.mainSidebarCollapsed ? name : "";
  });
}
