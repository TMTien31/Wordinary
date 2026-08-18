async function fetchJson(url, timeout = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function cleanTranslation(value = "") {
  return decodeHtml(String(value))
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function translationLooksBroken(source, value) {
  const result = cleanTranslation(value);
  if (!result || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(result)) return true;
  if (/&(?:amp;)?#\d+;|&(?:amp;)?[a-z]+;/i.test(result)) return true;
  const sourceWords = source.trim().split(/\s+/).filter(Boolean).length;
  const resultWords = result.split(/\s+/).filter(Boolean).length;
  if (sourceWords === 1 && resultWords > 10) return true;
  if (source.length < 28 && result.length > Math.max(110, source.length * 12)) return true;
  return false;
}

async function translateWithGoogle(text) {
  // Public demo endpoint: convenient for a mock, but not a production SLA.
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dj=1&q=${encodeURIComponent(text.slice(0, 450))}`;
  const data = await fetchJson(url, 6500);
  const value = Array.isArray(data?.sentences)
    ? data.sentences.map(item => item?.trans || "").join("")
    : Array.isArray(data?.[0])
      ? data[0].map(item => Array.isArray(item) ? item[0] || "" : "").join("")
      : "";
  if (translationLooksBroken(text, value)) throw new Error("Google translation unavailable");
  return cleanTranslation(value);
}

async function translateWithMyMemory(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=en|vi`;
  const data = await fetchJson(url, 6500);
  const value = data?.responseData?.translatedText;
  if (translationLooksBroken(text, value)) throw new Error("MyMemory translation unavailable");
  return cleanTranslation(value);
}

async function translate(text) {
  try {
    return await translateWithGoogle(text);
  } catch (_) {
    return await translateWithMyMemory(text);
  }
}

function contextualLocalTranslation(word, sentence = "") {
  const key = word.toLowerCase().trim().replace(/^[^a-z]+|[^a-z]+$/g, "");
  const context = sentence.toLowerCase();
  if (key === "bank") {
    if (/money|account|loan|finance|deposit|cash|credit/.test(context)) return "ngân hàng";
    if (/river|stream|water|shore|lake/.test(context)) return "bờ sông";
  }
  if (key === "winds") {
    if (/path|road|river|trail|street/.test(context)) return "uốn lượn";
    if (/weather|air|storm|breeze/.test(context)) return "những cơn gió";
  }
  return FALLBACK_TRANSLATIONS[key] || "";
}

async function fetchDictionary(word) {
  if (!/^[a-zA-Z'-]+$/.test(word)) return null;
  const data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
  const entry = data?.[0];
  const meaning = entry?.meanings?.[0];
  return {
    phonetic: entry?.phonetic || entry?.phonetics?.find(p => p.text)?.text || "",
    partOfSpeech: meaning?.partOfSpeech || "",
    definition: meaning?.definitions?.[0]?.definition || ""
  };
}

function inferVisualQuery(word, sentence, translation) {
  const lowerWord = word.toLowerCase();
  const lowerSentence = sentence.toLowerCase();
  if (lowerWord === "bank" && /river|stream|water|shore/.test(lowerSentence)) return "river";
  if (lowerWord === "winds" && /path|road|river/.test(lowerSentence)) return "curved road";
  if (/curious|curiosity|wonder/.test(lowerWord)) return "curiosity";
  if (/remember|memory|retain|recall/.test(lowerWord)) return "memory";
  if (/read|article|book/.test(lowerWord)) return "reading";
  if (/language|word|vocabulary|translation/.test(lowerWord)) return "language";
  if (/sound|speak|voice/.test(lowerWord)) return "sound";
  if (/discover|discovery|explore/.test(lowerWord)) return "discovery";
  return lowerWord.replace(/[^a-z\s-]/g, "").trim() || "idea";
}

function fallbackIcons(query) {
  const key = Object.keys(ICON_FALLBACKS).find(k => query.includes(k));
  return [...(ICON_FALLBACKS[key || "default"] || ICON_FALLBACKS.default)];
}

async function searchIcons(query) {
  const fallback = fallbackIcons(query);
  try {
    const data = await fetchJson(`https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=24`, 4500);
    const icons = Array.isArray(data?.icons) ? data.icons : [];
    const preferred = ["noto", "fluent-emoji-flat", "twemoji", "openmoji", "streamline-emojis", "emojione"];
    icons.sort((a, b) => {
      const ap = preferred.indexOf(a.split(":")[0]);
      const bp = preferred.indexOf(b.split(":")[0]);
      return (ap < 0 ? 99 : ap) - (bp < 0 ? 99 : bp);
    });
    return [...new Set([...fallback, ...icons])].slice(0, 8);
  } catch (_) {
    return fallback;
  }
}

async function loadSelectionData() {
  const target = state.selection;
  if (!target) return;
  const wordKey = target.word.toLowerCase();

  const localTranslation = contextualLocalTranslation(target.word, target.sentence);
  const wordTranslationPromise = localTranslation
    ? Promise.resolve(localTranslation)
    : translate(target.word).catch(() => "Chưa có bản dịch");
  const sentenceTranslationPromise = translate(target.sentence).catch(() => "Không thể dịch cả câu lúc này — bạn vẫn có thể lưu thẻ.");
  const dictionaryPromise = fetchDictionary(target.word).catch(() => null);
  const visualQuery = inferVisualQuery(target.word, target.sentence, "");
  const iconsPromise = searchIcons(visualQuery);

  const [translation, sentenceTranslation, dict, icons] = await Promise.all([
    wordTranslationPromise,
    sentenceTranslationPromise,
    dictionaryPromise,
    iconsPromise
  ]);
  if (state.selection !== target) return;
  target.translation = decodeHtml(translation);
  target.sentenceTranslation = decodeHtml(sentenceTranslation);
  target.definition = dict?.definition || `Nghĩa đang dùng trong câu: ${target.translation}.`;
  target.phonetic = dict?.phonetic || "";
  target.partOfSpeech = dict?.partOfSpeech || "";
  target.icons = icons;
  target.selectedIcon = icons[0] || ICON_FALLBACKS.default[0];

  $("#popupTranslation").textContent = `${target.translation}${target.phonetic ? `  ·  ${target.phonetic}` : ""}`;
  $("#popupDefinition").textContent = `${target.partOfSpeech ? target.partOfSpeech + " · " : ""}${target.definition}`;
  $("#popupSentenceTranslation").textContent = target.sentenceTranslation;
  renderIconOptions(target);
}

function decodeHtml(value = "") {
  let current = String(value ?? "");
  // MyMemory occasionally returns double-encoded entities such as
  // &amp;#7881;. Decode repeatedly until the string stops changing.
  for (let i = 0; i < 5; i += 1) {
    const txt = document.createElement("textarea");
    txt.innerHTML = current;
    const decoded = txt.value;
    if (decoded === current) break;
    current = decoded;
  }
  return current;
}

function renderIconOptions(target) {
  $("#iconStatus").textContent = `${target.icons.length} gợi ý`;
  $("#popupIcon").src = iconUrl(target.selectedIcon);
  $("#iconOptions").innerHTML = target.icons.map(icon => `<button class="icon-option ${icon === target.selectedIcon ? 'active' : ''}" data-icon="${escapeHtml(icon)}"><img src="${iconUrl(icon)}" alt=""></button>`).join("");
  $$(".icon-option", $("#iconOptions")).forEach(btn => btn.addEventListener("click", () => {
    target.selectedIcon = btn.dataset.icon;
    $("#popupIcon").src = iconUrl(target.selectedIcon);
    $$(".icon-option", $("#iconOptions")).forEach(b => b.classList.toggle("active", b === btn));
  }));
}

function speak(text) {
  if (!("speechSynthesis" in window)) return showToast("Trình duyệt chưa hỗ trợ", "Không thể phát âm trên thiết bị này.", "🔇");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = .88;
  speechSynthesis.speak(utterance);
}
