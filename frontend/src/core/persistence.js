const BACKEND_BACKED_STORAGE_KEYS = [
  "wordinary_article",
  "wordinary_articles",
  "wordinary_library_items",
  "wordinary_cards",
  "wordinary_data_version",
  "lingoleaf_article",
  "lingoleaf_articles",
  "lingoleaf_cards"
];

function purgeBackendBackedBrowserState() {
  BACKEND_BACKED_STORAGE_KEYS.forEach(key => appStorage.removeItem(key));
}

function saveState() {
  purgeBackendBackedBrowserState();
  appStorage.setItem("wordinary_xp", state.xp);
  appStorage.setItem("wordinary_streak", state.streak);
  appStorage.setItem("wordinary_daily", state.daily);
  appStorage.setItem("wordinary_daily_goal", state.dailyGoal);
  appStorage.setItem("wordinary_daily_xp", state.dailyXp);
  appStorage.setItem("wordinary_longest_streak", state.longestStreak);
  appStorage.setItem("wordinary_theme", state.theme);
  appStorage.setItem("wordinary_font", state.fontSize);
  appStorage.setItem("wordinary_language", state.language);
  appStorage.setItem("wordinary_reader_rail", state.readerRailCollapsed ? "collapsed" : "open");
  appStorage.setItem("wordinary_reader_highlight_words", JSON.stringify(state.readerHighlightedWords || []));
  appStorage.setItem("wordinary_main_sidebar", state.mainSidebarCollapsed ? "collapsed" : "open");
  appStorage.setItem("lingoleaf_xp", state.xp);
  appStorage.setItem("lingoleaf_streak", state.streak);
  appStorage.setItem("lingoleaf_daily", state.daily);
  appStorage.setItem("lingoleaf_theme", state.theme);
  appStorage.setItem("lingoleaf_font", state.fontSize);
}
