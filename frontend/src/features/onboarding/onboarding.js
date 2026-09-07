const ONBOARDING_VERSION = 1;

const ONBOARDING_STEPS = {
  en: [
    {
      viewId: "isleView", tab: "Your Isle", mark: "HOME", title: "Your learning home",
      description: "See your daily rhythm at a glance and return to the next useful activity.",
      points: ["Track XP, streaks, and your daily goal.", "Your Isle grows from the learning progress you make across Wordinary."]
    },
    {
      viewId: "libraryView", tab: "Library", mark: "LIB", title: "Everything stays together",
      description: "Your articles, PDFs, and videos live in one library, with progress saved per item.",
      points: ["Add new content or continue something recent.", "Filter by format and search by title or source."]
    },
    {
      viewId: "readerView", tab: "Read", mark: "Aa", title: "Read actively",
      description: "Paste text, upload a file, or import a public URL and read it as clean Markdown.",
      points: ["Highlight a word to translate it in context.", "Save the word with its sentence and memory image as a flashcard."]
    },
    {
      viewId: "pdfView", tab: "PDF", mark: "PDF", title: "Learn on the original page",
      description: "Open a PDF without losing its layout, images, columns, or typography.",
      points: ["Select text directly on the page to translate and save words.", "Use OCR on scanned pages when no text layer is available."]
    },
    {
      viewId: "videoView", tab: "Video", mark: "PLAY", title: "Turn captions into lessons",
      description: "Add YouTube or a public video and follow its captions while you watch.",
      points: ["Pause, replay, or loop the current caption.", "Highlight caption text to translate it and create flashcards."]
    },
    {
      viewId: "cardsView", tab: "Vocabulary", mark: "VOC", title: "Keep words in context",
      description: "Every saved word remembers where you found it, not only its translation.",
      points: ["Search, edit, and revisit the original sentence or source.", "Mastery and the next review date update as you practice."]
    },
    {
      viewId: "reviewView", tab: "Practice", mark: "SRS", title: "Review at the right time",
      description: "Spaced repetition brings words back when they are due, so review stays focused.",
      points: ["Remembered words return after longer intervals.", "Missed words come back soon and can be retried in the same session."]
    },
    {
      viewId: "dictationView", tab: "Dictation", mark: "LISTEN", title: "Train precise listening",
      description: "Listen to short caption segments, type what you hear, and check the full context.",
      points: ["Adjust speed, segment length, looping, and hints.", "Use captions from your current video as practice material."]
    },
    {
      viewId: "isleView", tab: "Wody", mark: "W", title: "Ask Wody to do the busywork",
      description: "Wody is the assistant in the bottom-right corner. Ask naturally instead of hunting through screens.",
      points: ["Find saved content, summarize progress, and manage vocabulary.", "Research the web and draft sourced Markdown articles for your library."]
    }
  ],
  vi: [
    {
      viewId: "isleView", tab: "Your Isle", mark: "HOME", title: "Trang học tập của bạn",
      description: "Xem nhịp học mỗi ngày và quay lại hoạt động phù hợp tiếp theo.",
      points: ["Theo dõi XP, chuỗi ngày học và mục tiêu hằng ngày.", "Your Isle phát triển từ tiến độ học của bạn trong Wordinary."]
    },
    {
      viewId: "libraryView", tab: "Thư viện", mark: "LIB", title: "Mọi nội dung ở cùng một nơi",
      description: "Bài đọc, PDF và video nằm trong một thư viện, mỗi nội dung có tiến độ riêng.",
      points: ["Thêm nội dung mới hoặc học tiếp nội dung gần đây.", "Lọc theo định dạng và tìm bằng tiêu đề hoặc nguồn."]
    },
    {
      viewId: "readerView", tab: "Đọc", mark: "Aa", title: "Đọc chủ động",
      description: "Dán văn bản, tải tệp hoặc nhập URL công khai để đọc dưới dạng Markdown sạch.",
      points: ["Bôi đen một từ để dịch theo đúng ngữ cảnh.", "Lưu từ cùng câu gốc và hình gợi nhớ thành flashcard."]
    },
    {
      viewId: "pdfView", tab: "PDF", mark: "PDF", title: "Học ngay trên trang gốc",
      description: "Mở PDF mà vẫn giữ nguyên bố cục, hình ảnh, cột và kiểu chữ.",
      points: ["Chọn chữ ngay trên trang để dịch và lưu từ.", "Dùng OCR cho trang scan khi tài liệu không có lớp chữ."]
    },
    {
      viewId: "videoView", tab: "Video", mark: "PLAY", title: "Biến caption thành bài học",
      description: "Thêm YouTube hoặc video công khai và theo dõi caption trong lúc xem.",
      points: ["Tạm dừng, nghe lại hoặc lặp caption hiện tại.", "Bôi đen chữ trong caption để dịch và tạo flashcard."]
    },
    {
      viewId: "cardsView", tab: "Từ vựng", mark: "VOC", title: "Giữ từ trong ngữ cảnh",
      description: "Mỗi từ đã lưu đều nhớ nơi bạn gặp nó, không chỉ giữ bản dịch.",
      points: ["Tìm kiếm, chỉnh sửa và xem lại câu hoặc nguồn gốc.", "Mức độ ghi nhớ và ngày ôn tiếp theo cập nhật sau mỗi lần luyện."]
    },
    {
      viewId: "reviewView", tab: "Luyện tập", mark: "SRS", title: "Ôn lại đúng thời điểm",
      description: "Học lặp lại ngắt quãng đưa từ trở lại khi đến hạn để mỗi lượt ôn luôn tập trung.",
      points: ["Từ đã nhớ sẽ xuất hiện lại sau khoảng thời gian dài hơn.", "Từ chưa nhớ quay lại sớm và có thể luyện lại ngay trong phiên."]
    },
    {
      viewId: "dictationView", tab: "Chép chính tả", mark: "LISTEN", title: "Luyện nghe chính xác",
      description: "Nghe từng đoạn caption ngắn, gõ lại điều bạn nghe và kiểm tra toàn bộ ngữ cảnh.",
      points: ["Điều chỉnh tốc độ, độ dài đoạn, lặp lại và gợi ý.", "Dùng caption từ video hiện tại làm nội dung luyện tập."]
    },
    {
      viewId: "isleView", tab: "Wody", mark: "W", title: "Để Wody xử lý việc mất thời gian",
      description: "Wody là trợ lý ở góc dưới bên phải. Cứ hỏi tự nhiên thay vì phải tìm qua nhiều màn hình.",
      points: ["Tìm nội dung đã lưu, tóm tắt tiến độ và quản lý từ vựng.", "Tìm nguồn web và soạn bài Markdown có nguồn cho thư viện."]
    }
  ]
};

let onboardingIndex = 0;
let onboardingPreviousView = "isleView";
let onboardingWasSidebarCollapsed = false;
let onboardingLastFocus = null;

function onboardingStorageKey() {
  return `wordinary_onboarding_${state.currentUser?.id || "guest"}`;
}

function ensureOnboarding() {
  let root = $("#onboardingBackdrop");
  if (root) return root;
  root = document.createElement("div");
  root.id = "onboardingBackdrop";
  root.className = "onboarding-backdrop";
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("data-no-i18n", "true");
  root.innerHTML = `
    <section class="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboardingTitle" aria-describedby="onboardingDescription">
      <header class="onboarding-head">
        <div class="onboarding-brand">
          <span class="onboarding-brand-mark" aria-hidden="true">W</span>
          <span><strong>Wordinary</strong><small id="onboardingGuideLabel"></small></span>
        </div>
        <button class="onboarding-close" id="onboardingClose" type="button" aria-label="Close">&times;</button>
      </header>
      <div class="onboarding-progress" aria-hidden="true"><span id="onboardingProgress"></span></div>
      <div class="onboarding-content">
        <div class="onboarding-step-meta">
          <span class="onboarding-tab-label" id="onboardingTab"></span>
          <span class="onboarding-step-count" id="onboardingCount"></span>
        </div>
        <div class="onboarding-feature-mark" id="onboardingMark" aria-hidden="true"></div>
        <h2 id="onboardingTitle"></h2>
        <p class="onboarding-description" id="onboardingDescription"></p>
        <ul class="onboarding-points" id="onboardingPoints"></ul>
      </div>
      <footer class="onboarding-actions">
        <button class="onboarding-skip" id="onboardingSkip" type="button"></button>
        <button class="onboarding-prev" id="onboardingPrev" type="button"></button>
        <button class="onboarding-next" id="onboardingNext" type="button"></button>
      </footer>
    </section>
  `;
  document.body.appendChild(root);
  return root;
}

function initOnboarding() {
  const root = ensureOnboarding();
  $("#openUserGuide")?.addEventListener("click", () => openOnboarding());
  $("#openProfileGuide")?.addEventListener("click", () => openOnboarding());
  $("#onboardingClose", root).addEventListener("click", () => closeOnboarding());
  $("#onboardingSkip", root).addEventListener("click", () => closeOnboarding());
  $("#onboardingPrev", root).addEventListener("click", () => showOnboardingStep(onboardingIndex - 1));
  $("#onboardingNext", root).addEventListener("click", () => {
    if (onboardingIndex >= ONBOARDING_STEPS.en.length - 1) closeOnboarding();
    else showOnboardingStep(onboardingIndex + 1);
  });
  $("#languageToggle")?.addEventListener("click", () => {
    if (root.classList.contains("show")) renderOnboardingStep();
  });
  document.addEventListener("keydown", handleOnboardingKeydown);
}

async function maybeShowOnboarding() {
  if (!state.currentUser || Number(appStorage.getItem(onboardingStorageKey()) || 0) >= ONBOARDING_VERSION) return;
  try {
    const status = await fetchOnboardingStatus();
    if (status.completed) {
      appStorage.setItem(onboardingStorageKey(), String(status.currentVersion || ONBOARDING_VERSION));
      return;
    }
  } catch (error) {
    console.warn("Could not load onboarding status", error);
  }
  setTimeout(() => {
    if (state.currentUser && !$("#onboardingBackdrop")?.classList.contains("show")) openOnboarding();
  }, 350);
}

function openOnboarding() {
  if (!state.currentUser) return;
  const root = ensureOnboarding();
  closeAccountMenu();
  if (typeof setWodyOpen === "function") setWodyOpen(false);
  onboardingLastFocus = document.activeElement;
  onboardingPreviousView = $(".view.active")?.id || "isleView";
  onboardingWasSidebarCollapsed = $("#appShell")?.classList.contains("sidebar-collapsed") || false;
  $("#appShell")?.classList.remove("sidebar-collapsed");
  root.classList.add("show");
  root.setAttribute("aria-hidden", "false");
  document.body.classList.add("onboarding-open");
  showOnboardingStep(0);
  setTimeout(() => $("#onboardingNext", root)?.focus(), 0);
}

function showOnboardingStep(index) {
  const steps = ONBOARDING_STEPS[state.language] || ONBOARDING_STEPS.en;
  onboardingIndex = Math.max(0, Math.min(index, steps.length - 1));
  const step = steps[onboardingIndex];
  setView(step.viewId, { onboardingPreview: true });
  renderOnboardingStep();
}

function renderOnboardingStep() {
  const root = $("#onboardingBackdrop");
  if (!root?.classList.contains("show")) return;
  const language = state.language === "vi" ? "vi" : "en";
  const steps = ONBOARDING_STEPS[language];
  const step = steps[onboardingIndex];
  const isLast = onboardingIndex === steps.length - 1;
  $("#onboardingGuideLabel", root).textContent = language === "vi" ? "Hướng dẫn sử dụng" : "Quick guide";
  $("#onboardingTab", root).textContent = step.tab;
  $("#onboardingCount", root).textContent = `${onboardingIndex + 1} / ${steps.length}`;
  $("#onboardingMark", root).textContent = step.mark;
  $("#onboardingTitle", root).textContent = step.title;
  $("#onboardingDescription", root).textContent = step.description;
  $("#onboardingPoints", root).innerHTML = step.points.map(point => `<li>${escapeHtml(point)}</li>`).join("");
  $("#onboardingProgress", root).style.width = `${((onboardingIndex + 1) / steps.length) * 100}%`;
  $("#onboardingSkip", root).textContent = language === "vi" ? "Bỏ qua hướng dẫn" : "Skip guide";
  $("#onboardingPrev", root).textContent = language === "vi" ? "Trước" : "Back";
  $("#onboardingNext", root).textContent = isLast
    ? (language === "vi" ? "Bắt đầu" : "Start learning")
    : (language === "vi" ? "Tiếp" : "Next");
  $("#onboardingPrev", root).disabled = onboardingIndex === 0;
  $("#onboardingClose", root).setAttribute("aria-label", language === "vi" ? "Đóng hướng dẫn" : "Close guide");
  highlightOnboardingTarget(step);
}

function highlightOnboardingTarget(step) {
  $$(".nav-btn.onboarding-nav-focus").forEach(button => button.classList.remove("onboarding-nav-focus"));
  $("#wodyWidget")?.classList.remove("onboarding-wody-focus");
  if (step.tab === "Wody") $("#wodyWidget")?.classList.add("onboarding-wody-focus");
  else $(`.nav-btn[data-view="${step.viewId}"]`)?.classList.add("onboarding-nav-focus");
}

function closeOnboarding(options = {}) {
  const root = $("#onboardingBackdrop");
  if (!root?.classList.contains("show")) return;
  const markCompleted = options.markCompleted !== false;
  root.classList.remove("show");
  root.setAttribute("aria-hidden", "true");
  document.body.classList.remove("onboarding-open");
  $$(".nav-btn.onboarding-nav-focus").forEach(button => button.classList.remove("onboarding-nav-focus"));
  $("#wodyWidget")?.classList.remove("onboarding-wody-focus");
  if (onboardingWasSidebarCollapsed) $("#appShell")?.classList.add("sidebar-collapsed");
  if (state.currentUser) setView(onboardingPreviousView);
  onboardingLastFocus?.focus?.();
  if (!markCompleted || !state.currentUser) return;
  appStorage.setItem(onboardingStorageKey(), String(ONBOARDING_VERSION));
  completeOnboarding().catch(error => console.warn("Could not save onboarding status", error));
}

function handleOnboardingKeydown(event) {
  const root = $("#onboardingBackdrop");
  if (!root?.classList.contains("show")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeOnboarding();
    return;
  }
  if (event.key === "ArrowLeft" && onboardingIndex > 0) {
    event.preventDefault();
    showOnboardingStep(onboardingIndex - 1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    if (onboardingIndex >= ONBOARDING_STEPS.en.length - 1) closeOnboarding();
    else showOnboardingStep(onboardingIndex + 1);
  }
}
