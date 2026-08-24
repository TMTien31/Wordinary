    const SAMPLE_ARTICLE = {
      title: "Why curiosity makes new words stick",
      kicker: "Learning science • 6 min read",
      author: "Wordinary Journal",
      date: "August 3, 2026",
      level: "B1",
      content: `Curiosity changes the way we pay attention. When you encounter an unfamiliar word while reading something you genuinely care about, your brain treats that word as part of a meaningful problem rather than an isolated fact to memorize.

Imagine reading about a hidden village beside a river. The writer describes a narrow path that winds through the forest before reaching the river bank. You pause at the word “winds.” In this sentence, it does not describe the weather. It means that the path bends and turns. The surrounding scene helps you discover the meaning before a dictionary confirms it.

This moment of discovery is powerful because context gives the word several connections. You remember the path, the forest, the sentence, and perhaps even the feeling of wondering what happens next. A plain vocabulary list rarely provides such a rich network of clues.

Researchers often describe memory as a process of building and strengthening connections. A new word becomes easier to retain when it is linked to an image, a sound, a sentence, and a personal reason for learning it. That is why a small illustration can be surprisingly useful. It is not a perfect definition; it is a visual handle that helps you retrieve the idea later.

The best reading tools protect this natural flow. Looking up a word should take only a few seconds. If the process is slow or requires switching between several apps, curiosity can disappear. A quick translation, the original sentence, and one tap to save are often enough.

Later, a flashcard can bring the sentence back. Instead of asking you to remember a translation in isolation, it reminds you where the word lived. Over time, repeated encounters gradually make the word feel familiar. The goal is not to collect the largest possible deck. The goal is to notice useful language and meet it again at the right moment.

So choose articles that make you want to continue. Save only the words that block understanding or express an idea you would like to use. When learning begins with genuine curiosity, vocabulary practice stops feeling like a separate task and becomes part of reading itself.`
    };


    const WORDINARY_STARTER_ARTICLES = [
      {
        id: "wordinary-starter-walk",
        title: "The quiet power of walking without a destination",
        kicker: "Everyday ideas • 4 min read",
        author: "Wordinary Starter",
        date: "August 1, 2026",
        level: "B1",
        content: `A walk without a destination can feel unproductive at first. There is no finish line, no errand to complete, and no obvious result to show at the end.

Yet this ordinary activity creates room for attention. Without a strict route, you begin to notice small details: the rhythm of footsteps, a balcony filled with plants, or the changing sound of traffic as you turn into a quieter street.

Psychologists sometimes describe this state as soft fascination. Your mind is engaged, but it is not forced to solve a demanding problem. Thoughts can drift, combine, and return in a different shape.

That is why an aimless walk can become surprisingly useful for creative work. You are not escaping the problem. You are giving it enough space to breathe.`
      },
      {
        id: "wordinary-starter-rituals",
        title: "Why small rituals make creative work easier",
        kicker: "Creative habits • 5 min read",
        author: "Wordinary Starter",
        date: "July 29, 2026",
        level: "B2",
        content: `Creative work often looks spontaneous from the outside, but many artists rely on ordinary rituals. They make the same drink, clear the same corner of a desk, or begin with the same piece of music.

The ritual is not magical. Its value comes from repetition. A familiar sequence reduces the number of decisions required before starting, making it easier to cross the uncomfortable gap between intention and action.

Over time, the brain starts treating these small signals as an invitation to focus. The cup, the notebook, and the song become part of a doorway into the work.

A useful ritual should remain light. When the routine becomes more complicated than the task itself, it stops supporting creativity and begins to delay it.`
      }
    ];

    const FALLBACK_TRANSLATIONS = {
      curiosity: "sự tò mò", unfamiliar: "không quen thuộc", encounter: "bắt gặp", meaningful: "có ý nghĩa",
      isolated: "tách biệt", memorize: "ghi nhớ", hidden: "ẩn giấu", narrow: "hẹp", winds: "uốn lượn",
      bank: "bờ sông", surrounding: "xung quanh", confirms: "xác nhận", discovery: "sự khám phá",
      context: "ngữ cảnh", connections: "các mối liên hệ", wondering: "tò mò", clues: "manh mối",
      retain: "ghi nhớ lâu", linked: "được liên kết", illustration: "hình minh họa", retrieve: "gợi nhớ lại",
      flow: "mạch đọc", translation: "bản dịch", gradually: "dần dần", encounters: "những lần bắt gặp",
      familiar: "quen thuộc", genuine: "chân thật", vocabulary: "từ vựng", strengthening: "củng cố",
      path: "con đường", forest: "khu rừng", river: "con sông", village: "ngôi làng", weather: "thời tiết",
      reading: "việc đọc", sentence: "câu", image: "hình ảnh", sound: "âm thanh", reason: "lý do",
      word: "từ", language: "ngôn ngữ", remember: "nhớ", practice: "luyện tập", useful: "hữu ích"
    };

    const ICON_FALLBACKS = {
      default: ["noto:light-bulb", "noto:books", "noto:sparkles", "noto:magnifying-glass-tilted-right"],
      curiosity: ["noto:magnifying-glass-tilted-right", "noto:thinking-face", "noto:light-bulb", "noto:eyes"],
      river: ["noto:water-wave", "noto:national-park", "noto:canoe", "noto:bridge-at-night"],
      bank: ["noto:water-wave", "noto:national-park", "noto:bridge-at-night", "noto:canoe"],
      forest: ["noto:evergreen-tree", "noto:deciduous-tree", "noto:national-park", "noto:leaf-fluttering-in-wind"],
      village: ["noto:house-with-garden", "noto:hut", "noto:houses", "noto:sunrise-over-mountains"],
      path: ["noto:motorway", "noto:national-park", "noto:compass", "noto:footprints"],
      memory: ["noto:brain", "noto:light-bulb", "noto:card-index-dividers", "noto:books"],
      remember: ["noto:brain", "noto:pushpin", "noto:bookmark-tabs", "noto:light-bulb"],
      image: ["noto:framed-picture", "noto:artist-palette", "noto:camera", "noto:sparkles"],
      language: ["noto:speech-balloon", "noto:globe-showing-asia-australia", "noto:books", "noto:writing-hand"],
      reading: ["noto:open-book", "noto:books", "noto:bookmark", "noto:glasses"],
      discovery: ["noto:compass", "noto:magnifying-glass-tilted-right", "noto:world-map", "noto:sparkles"],
      sound: ["noto:speaker-high-volume", "noto:musical-note", "noto:headphone", "noto:studio-microphone"],
      time: ["noto:alarm-clock", "noto:hourglass-not-done", "noto:watch", "noto:calendar"]
    };
