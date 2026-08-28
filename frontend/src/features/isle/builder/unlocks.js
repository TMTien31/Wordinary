import { CATEGORIES } from './assets/assetManifest.js';

export const XP_PER_ISLE_LEVEL = 100;
export const MAX_ISLE_LEVEL = CATEGORIES.length;

export const CATEGORY_UNLOCK_LEVELS = Object.freeze(
    CATEGORIES.reduce((levels, category, index) => {
        levels[category] = index + 1;
        return levels;
    }, {}),
);

export function levelFromXp(xp = 0) {
    const value = Number(xp) || 0;
    return clampIsleLevel(Math.floor(value / XP_PER_ISLE_LEVEL));
}

export function clampIsleLevel(level = 0) {
    return Math.max(0, Math.min(MAX_ISLE_LEVEL, Math.floor(Number(level) || 0)));
}

export function requiredLevelForCategory(category) {
    return CATEGORY_UNLOCK_LEVELS[category] ?? MAX_ISLE_LEVEL;
}

export function isCategoryUnlocked(category, level = 0) {
    return clampIsleLevel(level) >= requiredLevelForCategory(category);
}

export function categoryLabel(category = '') {
    return String(category).charAt(0).toUpperCase() + String(category).slice(1);
}
