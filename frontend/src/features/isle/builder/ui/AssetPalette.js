/**
 * AssetPalette.js
 *
 * Bottom palette: category tabs + horizontal swatch row. Each swatch
 * displays the asset's generated bitmap so the player sees exactly what
 * they'll be placing.
 */

import { ASSET_MANIFEST, CATEGORIES } from '../assets/assetManifest.js';
import { allAssets, isCategoryLoaded, loadCategoryAssets } from '../assets/assetLoader.js';
import { playUiClick } from './Audio.js';
import { isCategoryUnlocked, requiredLevelForCategory, categoryLabel } from '../unlocks.js';

export class AssetPalette {
    constructor(tabsEl, gridEl, game) {
        this.tabsEl = tabsEl;
        this.gridEl = gridEl;
        this.game = game;
        this.paletteEl = this.tabsEl.closest('#palette');
        this.collapseButton = this.paletteEl?.querySelector('#palette-collapse') ?? null;
        this.lockOverlay = this.paletteEl?.querySelector('#palette-lock') ?? null;
        this.lockLevel = this.paletteEl?.querySelector('#palette-lock-level') ?? null;
        this.lockText = this.paletteEl?.querySelector('#palette-lock-text') ?? null;
        this.tabButtons = new Map();
        this.loadingCategories = new Set();
        this.renderedCategory = null;
        this._buildTabs();
        this._bindCollapse();
        this._renderGrid();
    }

    _bindCollapse() {
        if (!this.paletteEl || !this.collapseButton) return;
        this.collapseButton.addEventListener('click', () => {
            playUiClick();
            const collapsed = !this.paletteEl.classList.contains('is-collapsed');
            this.paletteEl.classList.toggle('is-collapsed', collapsed);
            this.collapseButton.textContent = collapsed ? '<' : '>';
            this.collapseButton.title = collapsed ? 'Expand asset panel' : 'Collapse asset panel';
            this.collapseButton.setAttribute(
                'aria-label',
                collapsed ? 'Expand asset panel' : 'Collapse asset panel',
            );
            this.game.renderer.markDirty();
        });
    }

    _buildTabs() {
        this.tabsEl.innerHTML = '';
        for (const c of CATEGORIES) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tab';
            btn.textContent = c[0].toUpperCase() + c.slice(1);
            btn.addEventListener('click', () => {
                playUiClick();
                this.game.setCategory(c);
            });
            this.tabsEl.appendChild(btn);
            this.tabButtons.set(c, btn);
        }
        this.update();
    }

    _renderGrid() {
        this.gridEl.innerHTML = '';
        const generated = allAssets();
        const items = ASSET_MANIFEST.filter(a => a.category === this.game.category);
        this.renderedCategory = this.game.category;
        for (const def of items) {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.className = 'swatch';
            swatch.dataset.assetId = def.id;

            const gen = generated[def.id];
            const preview = gen?.thumbnailCanvas ? copyCanvas(gen.thumbnailCanvas) : null;
            if (preview) swatch.appendChild(preview);
            else swatch.appendChild(placeholderThumb());

            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = def.name;
            swatch.appendChild(name);

            swatch.addEventListener('click', () => {
                playUiClick();
                this.game.selectAsset(def.id);
            });
            this.gridEl.appendChild(swatch);
        }
        this.update();
    }

    _ensureCategoryLoaded() {
        const category = this.game.category;
        if (isCategoryLoaded(category) || this.loadingCategories.has(category)) return;
        this.loadingCategories.add(category);
        this.paletteEl?.classList.add('is-loading');
        loadCategoryAssets(category, () => {})
            .then(() => {
                if (this.game.category === category) {
                    this._renderGrid();
                    this.game.renderer.markDirty();
                }
            })
            .finally(() => {
                this.loadingCategories.delete(category);
                if (!this.loadingCategories.size) this.paletteEl?.classList.remove('is-loading');
                this.update();
            });
    }

    update() {
        this._ensureCategoryLoaded();
        for (const [c, btn] of this.tabButtons) {
            btn.classList.toggle('active', c === this.game.category);
            const required = requiredLevelForCategory(c);
            const locked = !isCategoryUnlocked(c, this.game.unlockLevel);
            btn.classList.toggle('is-locked', locked);
            btn.title = locked
                ? `${categoryLabel(c)} unlocks at level ${required}`
                : `${categoryLabel(c)} assets`;
        }

        const currentRequired = requiredLevelForCategory(this.game.category);
        const currentLocked = !isCategoryUnlocked(this.game.category, this.game.unlockLevel);
        this.paletteEl?.classList.toggle('is-locked', currentLocked);
        this.gridEl.setAttribute('aria-disabled', currentLocked ? 'true' : 'false');
        if (this.lockOverlay) this.lockOverlay.hidden = !currentLocked;
        if (this.lockLevel) this.lockLevel.textContent = `Level ${currentRequired}`;
        if (this.lockText) {
            this.lockText.textContent = `Reach level ${currentRequired} to place ${categoryLabel(this.game.category)} assets.`;
        }

        // Re-render grid only when category changed.
        const visibleIds = Array.from(this.gridEl.querySelectorAll('.swatch'))
            .map(el => el.dataset.assetId);
        const expectedIds = ASSET_MANIFEST
            .filter(a => a.category === this.game.category)
            .map(a => a.id);
        const sameSet = visibleIds.length === expectedIds.length
            && visibleIds.every((id, i) => id === expectedIds[i]);
        if (!sameSet || this.renderedCategory !== this.game.category) this._renderGrid();

        for (const sw of this.gridEl.querySelectorAll('.swatch')) {
            sw.classList.toggle('selected', sw.dataset.assetId === this.game.selectedAssetId);
            sw.classList.toggle('is-locked', currentLocked);
            sw.classList.toggle('is-loading', !allAssets()[sw.dataset.assetId]);
        }
    }
}

function copyCanvas(source) {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.drawImage(source, 0, 0);
    return canvas;
}

function placeholderThumb() {
    const el = document.createElement('span');
    el.className = 'thumb-placeholder';
    return el;
}
