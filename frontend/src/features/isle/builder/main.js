/**
 * Native Wordinary mount for the Isle builder.
 *
 * This keeps the imported builder spine as owned Isle feature code instead of
 * booting it as a standalone app.
 */

import { loadAssetsForIds, loadCategoryAssets } from './assets/assetLoader.js';
import { Game } from './core/Game.js';
import { UIManager } from './ui/UIManager.js';
import { loadUiAudio } from './ui/Audio.js';
import { clampIsleLevel } from './unlocks.js';

const STYLE_HREF = '/src/features/isle/builder/styles.css?v=isle-native-builder-6';

export async function mountIsleBuilder(host) {
    if (!host) return null;
    if (host.__isleBuilderGame) return host.__isleBuilderGame;

    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    root.innerHTML = builderTemplate();

    try {
        // One-time cleanup for layouts saved by the temporary standalone embed.
        localStorage.removeItem('mykonos-island-voxels.save.v1');
    } catch {}

    const fill = root.getElementById('loading-fill');
    const status = root.getElementById('loading-status');
    const loadingScreen = root.getElementById('loading-screen');
    const app = root.getElementById('app');

    try {
        await loadCategoryAssets('terrain', (p, label) => {
            fill.style.width = `${Math.round(p * 100)}%`;
            status.textContent = `crafting ${label}...`;
        });

        loadUiAudio();

        fill.style.width = '100%';
        status.textContent = 'arriving at the harbor';
        await new Promise(r => setTimeout(r, 250));

        app.classList.remove('hidden');

        const canvas = root.getElementById('game-canvas');
        const game = new Game(canvas);
        const ui = new UIManager(game, root);
        game.ui = ui;
        bindWordinaryProgress(host, game);
        ui.update();

        const loaded = game.load();
        if (loaded) {
            const ids = assetIdsInWorld(game);
            if (ids.length) {
                status.textContent = 'restoring your saved island...';
                await loadAssetsForIds(ids, (p, label) => {
                    fill.style.width = `${Math.round(p * 100)}%`;
                    status.textContent = `restoring ${label}...`;
                });
                game.renderer.clearAnimations();
                game.renderer.markDirty();
            }
        }
        if (loaded && hasPlacedContent(game)) {
            ui.showToast('Welcome back');
        }
        if (!loaded) {
            seedExampleVillage(game);
        }

        loadingScreen.classList.add('hidden');
        host.__isleBuilderGame = game;
        return game;
    } catch (err) {
        console.error(err);
        status.textContent = `Something went wrong: ${err.message}`;
        return null;
    }
}

function builderTemplate() {
    return `
        <link rel="stylesheet" href="${STYLE_HREF}" />

        <div id="loading-screen">
            <div class="loading-card">
                <div class="loading-logo"></div>
                <div class="loading-title">Your Isle</div>
                <div class="loading-sub">Preparing your island builder...</div>
                <div class="loading-bar"><div class="loading-fill" id="loading-fill"></div></div>
                <div class="loading-status" id="loading-status">warming the kilns</div>
            </div>
        </div>

        <div id="app" class="isle-builder-root hidden">
            <canvas id="game-canvas"></canvas>

            <header id="title-card">
                <div class="title-logo"></div>
                <div class="title-text">
                    <h1>Your Isle</h1>
                    <p>Build your own Mediterranean learning island</p>
                </div>
            </header>

            <aside id="toolbar"></aside>

            <section id="slot-panel" aria-label="Island save slots">
                <select id="slot-select" aria-label="Island save slot"></select>
                <button id="slot-new" type="button" title="New save slot" aria-label="New save slot">+</button>
                <button id="slot-delete" type="button" title="Delete current save slot" aria-label="Delete current save slot">-</button>
                <button id="slot-screenshot" type="button" title="Download screenshot" aria-label="Download screenshot">PNG</button>
            </section>

            <section id="palette">
                <div id="palette-header">
                    <nav id="palette-tabs"></nav>
                    <button id="palette-collapse" type="button" title="Collapse asset panel" aria-label="Collapse asset panel">&gt;</button>
                </div>
                <div id="palette-grid"></div>
                <div id="palette-lock" hidden>
                    <div class="palette-lock-mark">LOCKED</div>
                    <strong id="palette-lock-level">Level 1</strong>
                    <span id="palette-lock-text">Reach this level to place these assets.</span>
                </div>
            </section>

            <section id="hud">
                <div class="hud-row">
                    <div class="hud-clock">
                        <span class="sun-icon"></span>
                        <span id="hud-time">10:42</span>
                    </div>
                </div>
                <div class="hud-toggles">
                    <label class="toggle"><span>Shadows</span><input type="checkbox" id="toggle-ao" checked /><span class="switch"></span></label>
                    <label class="toggle"><span>Grid</span><input type="checkbox" id="toggle-grid" /><span class="switch"></span></label>
                    <label class="toggle"><span>Borders</span><input type="checkbox" id="toggle-borders" checked /><span class="switch"></span></label>
                </div>
                <div class="hud-layers">Layers</div>
            </section>

            <details id="instructions" aria-label="Controls help">
                <summary class="ins-summary">
                    <span class="ins-badge" aria-hidden="true">?</span>
                    <span class="ins-summary-label">Controls</span>
                    <span class="ins-summary-hint" aria-hidden="true">click to open</span>
                </summary>
                <div class="ins-grid ins-grid--mouse">
                    <span class="key">Click</span><span>Place selected asset</span>
                    <span class="key">Drag</span><span>Brush place across cells</span>
                    <span class="key">Right click</span><span>Erase</span>
                    <span class="key">Right drag</span><span>Brush erase</span>
                    <span class="key">Shift drag</span><span>Pan camera</span>
                    <span class="key">Wheel</span><span>Zoom</span>
                    <span class="key">H / V</span><span>Flip preview</span>
                    <span class="key">E</span><span>Toggle erase mode</span>
                    <span class="key">G</span><span>Toggle grid</span>
                    <span class="key">1-5</span><span>Switch categories</span>
                    <span class="key">Ctrl Z/Y</span><span>Undo / redo</span>
                    <span class="key">S / R</span><span>Save / reset</span>
                </div>
                <div class="ins-grid ins-grid--touch">
                    <span class="key">Tap</span><span>Place selected asset</span>
                    <span class="key">Drag</span><span>Brush place across cells</span>
                    <span class="key">Long-press</span><span>Erase tile under finger</span>
                    <span class="key">Pinch</span><span>Zoom in / out</span>
                    <span class="key">Two-finger drag</span><span>Pan camera</span>
                    <span class="key">Tabs</span><span>Switch asset categories</span>
                </div>
            </details>

            <div id="toast"></div>
        </div>
    `;
}

function bindWordinaryProgress(host, game) {
    const applyProgress = (progress = {}) => {
        const fallback = host.closest('#isleView')?.dataset.isleLevel ?? 0;
        game.setUnlockLevel(clampIsleLevel(progress.level ?? fallback), Number(progress.xp) || 0);
    };

    applyProgress(window.__wordinaryIsleProgress);
    window.addEventListener('wordinary:isle-progress', event => applyProgress(event.detail));
}

function hasPlacedContent(game) {
    return game.tileMap.terrain.some(Boolean) || game.tileMap.objects.length > 0;
}

function assetIdsInWorld(game) {
    const ids = new Set(game.tileMap.terrain.filter(Boolean));
    for (const obj of game.tileMap.objects) ids.add(obj.assetId);
    return Array.from(ids);
}

function seedExampleVillage(game) {
    const W = game.tileMap.width, H = game.tileMap.height;
    const STEP_MS = 32;
    const placeT = (id, gx, gy) => {
        const delay = (gx + gy) * STEP_MS;
        game.placeAndAnimate(id, gx, gy, { delay });
    };

    for (let gy = 0; gy < H; gy++)
    for (let gx = 0; gx < W; gx++) {
        placeT('grass', gx, gy);
    }

    const midX = Math.floor(W / 2);
    const midY = Math.floor(H / 2);
    for (let gx = 1; gx < W - 1; gx++) placeT('path', gx, midY);
    for (let gy = 1; gy < H - 1; gy++) placeT('path', midX, gy);

    for (let gx = 0; gx < W; gx++) {
        placeT('water', gx, H - 1);
        placeT('water', gx, H - 2);
    }
    for (let gx = 0; gx < W; gx++) placeT('sand', gx, H - 3);
}
