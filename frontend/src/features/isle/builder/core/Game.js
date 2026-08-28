/**
 * Game.js
 *
 * Top-level game controller. Owns the world (TileMap), camera, renderer,
 * input manager, placement system, and UI. Exposes a small intent API
 * (setTool, selectAsset, save, reset, …) consumed by the UI.
 */

import { CONFIG } from '../config.js';
import { Camera } from './Camera.js';
import { Renderer } from './Renderer.js';
import { InputManager } from './InputManager.js';
import { TileMap } from '../grid/TileMap.js';
import { PlacementSystem } from '../building/PlacementSystem.js';
import { PlacedObject } from '../building/PlacedObject.js';
import { ASSET_INDEX, ASSET_MANIFEST } from '../assets/assetManifest.js';
import { isAssetLoaded, loadAssetsForIds } from '../assets/assetLoader.js';
import { SaveSystem } from '../storage/SaveSystem.js';
import { cellToScreen } from '../grid/IsoGrid.js';
import { playPlacementFor } from '../ui/Audio.js';
import { clampIsleLevel, isCategoryUnlocked, requiredLevelForCategory, categoryLabel } from '../unlocks.js';

export class Game {
    constructor(canvas, ui = null) {
        this.canvas = canvas;
        this.tileMap = new TileMap();
        this.camera = new Camera();
        this.renderer = new Renderer(canvas, this.camera, this.tileMap);
        this.placement = new PlacementSystem(this.tileMap);
        this.input = new InputManager(canvas, this.camera, this);

        // Any camera mutation (pan/zoom/recenter) needs the next frame
        // re-rendered. The renderer itself is otherwise idle.
        this.camera.onChange(() => this.renderer.markDirty());

        // Default selection
        this.tool = 'place';                  // 'place' | 'erase' | 'pan'
        this.category = 'terrain';
        this.selectedAssetId = ASSET_MANIFEST.find(a => a.category === 'terrain').id;
        this.ui = ui;
        this.unlockLevel = 0;
        this.unlockXp = 0;
        this._lastLockedToastAt = 0;
        this._history = {
            undo: [],
            redo: [],
            limit: 80,
            batchDepth: 0,
            batchBefore: null,
            batchDirty: false,
        };

        // Preview-only flip state for the current selection. Toggled by the
        // user (H / V) before commit; the values are baked into the
        // PlacedObject when the asset is placed.
        this.flipH = false;
        this.flipV = false;

        // Center camera over grid
        this._centerCamera();

        // Animation loop
        this._loop = this._loop.bind(this);
        requestAnimationFrame(this._loop);
    }

    _centerCamera() {
        const c = cellToScreen(this.tileMap.width / 2, this.tileMap.height / 2);
        const { w, h } = this.renderer.cssSize();
        this.camera.centerOn(c.x, c.y, w, h);
    }

    /* ── Intents from UI / input ──────────────────────────────── */

    setTool(t) {
        this.tool = t;
        this.renderer.eraseMode = (t === 'erase');
        this.canvas.style.cursor = t === 'pan' ? 'grab'
                                  : t === 'erase' ? 'crosshair'
                                  : 'crosshair';
        this.renderer.markDirty();
        this.ui?.update();
    }

    setCategory(cat) {
        if (this.category === cat) return;
        this.category = cat;
        // Auto-select first asset of that category.
        const first = ASSET_MANIFEST.find(a => a.category === cat);
        if (first) this.selectedAssetId = first.id;
        this._resetFlip();
        this.renderer.markDirty();
        this.ui?.update();
    }

    setUnlockLevel(level, xp = this.unlockXp) {
        const nextLevel = clampIsleLevel(level);
        const nextXp = Number(xp) || 0;
        if (nextLevel === this.unlockLevel && nextXp === this.unlockXp) return;
        this.unlockLevel = nextLevel;
        this.unlockXp = nextXp;
        this.renderer.markDirty();
        this.ui?.update();
    }

    isCategoryUnlocked(category) {
        return isCategoryUnlocked(category, this.unlockLevel);
    }

    isAssetUnlocked(assetId) {
        const asset = ASSET_INDEX[assetId];
        return !!asset && this.isCategoryUnlocked(asset.category);
    }

    lockedMessageForAsset(assetId = this.selectedAssetId) {
        const asset = ASSET_INDEX[assetId];
        if (!asset) return 'Asset locked';
        return `${categoryLabel(asset.category)} unlocks at level ${requiredLevelForCategory(asset.category)}`;
    }

    _showLockedToast(assetId = this.selectedAssetId) {
        const now = performance.now();
        if (now - this._lastLockedToastAt < 900) return;
        this._lastLockedToastAt = now;
        this.ui?.showToast(this.lockedMessageForAsset(assetId));
    }

    selectAsset(id) {
        const a = ASSET_INDEX[id];
        if (!a) return;
        const changed = this.selectedAssetId !== id;
        this.selectedAssetId = id;
        this.category = a.category;
        if (changed) this._resetFlip();
        // Picking an asset implies "place" mode.
        if (this.tool === 'erase') this.setTool('place');
        this.renderer.markDirty();
        this.ui?.update();
    }

    toggleFlipH() {
        this.flipH = !this.flipH;
        this._syncPreviewFlip();
        this.renderer.markDirty();
        this.ui?.showToast(`Flip horizontal: ${this.flipH ? 'on' : 'off'}`);
        this.ui?.update();
    }

    toggleFlipV() {
        this.flipV = !this.flipV;
        this._syncPreviewFlip();
        this.renderer.markDirty();
        this.ui?.showToast(`Flip vertical: ${this.flipV ? 'on' : 'off'}`);
        this.ui?.update();
    }

    _resetFlip() {
        this.flipH = false;
        this.flipV = false;
        this._syncPreviewFlip();
    }

    _syncPreviewFlip() {
        this.renderer.previewFlipH = this.flipH;
        this.renderer.previewFlipV = this.flipV;
    }

    toggleGrid() {
        this.renderer.showGrid = !this.renderer.showGrid;
        this.renderer.markDirty();
        this.ui?.hud?.syncToggles();
        this.ui?.update();
    }

    save() {
        const ok = SaveSystem.save(this.tileMap, this.camera);
        this.ui?.showToast(ok ? 'Saved your island' : 'Save failed');
        this.ui?.update();
    }

    load() {
        const ok = SaveSystem.load(this.tileMap, this.camera);
        if (ok) this.renderer.markDirty();
        if (ok) this.clearHistory();
        return ok;
    }

    reset() {
        if (!hasWorldContent(this.tileMap)) {
            this.ui?.showToast('World already empty');
            return;
        }
        const before = this._snapshotWorld();
        this.tileMap.clearAll();
        this._recordMutation(before);
        this._centerCamera();
        SaveSystem.save(this.tileMap, this.camera);
        this.renderer.markDirty();
        this.ui?.showToast('World reset');
    }

    async loadSlot(slotId) {
        SaveSystem.setActiveSlot(slotId);
        const ok = SaveSystem.load(this.tileMap, this.camera, slotId);
        if (!ok) {
            this.tileMap.clearAll();
            this._centerCamera();
            SaveSystem.save(this.tileMap, this.camera, slotId);
        } else {
            this.ui?.showToast('Loading slot assets...');
            await this.ensureWorldAssetsLoaded();
        }
        this.clearHistory();
        this.renderer.markDirty();
        this.ui?.showToast(ok ? 'Slot loaded' : 'Empty slot ready');
        this.ui?.update();
        return ok;
    }

    createSlot(name) {
        const slot = SaveSystem.createSlot(name);
        this.tileMap.clearAll();
        this._centerCamera();
        SaveSystem.save(this.tileMap, this.camera, slot.id);
        this.clearHistory();
        this.renderer.markDirty();
        this.ui?.showToast('New slot ready');
        this.ui?.update();
        return slot;
    }

    deleteCurrentSlot() {
        const current = SaveSystem.activeSlotId();
        const ok = SaveSystem.deleteSlot(current);
        if (!ok) {
            this.ui?.showToast('Keep at least one slot');
            return false;
        }
        this.loadSlot(SaveSystem.activeSlotId());
        return true;
    }

    undo() {
        const before = this._history.undo.pop();
        if (!before) {
            this.ui?.showToast('Nothing to undo');
            return false;
        }
        this._history.redo.push(this._snapshotWorld());
        this._restoreWorld(before);
        this.ui?.showToast('Undone');
        this.ui?.update();
        return true;
    }

    redo() {
        const next = this._history.redo.pop();
        if (!next) {
            this.ui?.showToast('Nothing to redo');
            return false;
        }
        this._history.undo.push(this._snapshotWorld());
        this._restoreWorld(next);
        this.ui?.showToast('Redone');
        this.ui?.update();
        return true;
    }

    canUndo() {
        return this._history.undo.length > 0;
    }

    canRedo() {
        return this._history.redo.length > 0;
    }

    clearHistory() {
        this._history.undo.length = 0;
        this._history.redo.length = 0;
        this._history.batchDepth = 0;
        this._history.batchBefore = null;
        this._history.batchDirty = false;
        this.ui?.update();
    }

    beginHistoryBatch() {
        if (this._history.batchDepth === 0) {
            this._history.batchBefore = this._snapshotWorld();
            this._history.batchDirty = false;
        }
        this._history.batchDepth++;
    }

    endHistoryBatch() {
        if (this._history.batchDepth <= 0) return;
        this._history.batchDepth--;
        if (this._history.batchDepth > 0) return;
        if (this._history.batchDirty && this._history.batchBefore) {
            this._pushUndo(this._history.batchBefore);
        }
        this._history.batchBefore = null;
        this._history.batchDirty = false;
        this.ui?.update();
    }

    downloadScreenshot() {
        this.renderer.markDirty();
        this.renderer.draw();
        this.canvas.toBlob(blob => {
            if (!blob) {
                this.ui?.showToast('Screenshot failed');
                return;
            }
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.href = url;
            link.download = `your-isle-${stamp}.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.ui?.showToast('Screenshot downloaded');
        }, 'image/png');
    }

    async ensureWorldAssetsLoaded() {
        const ids = new Set(this.tileMap.terrain.filter(Boolean));
        for (const obj of this.tileMap.objects) ids.add(obj.assetId);
        const missing = Array.from(ids).filter(id => !isAssetLoaded(id));
        if (!missing.length) return;
        await loadAssetsForIds(missing);
        this.renderer.clearAnimations();
        this.renderer.markDirty();
        this.ui?.update();
    }

    /**
     * Carpet the entire grid with grass in one click. Empty cells get a
     * fresh grass tile; cells whose terrain is already something else
     * (path, sand, water) are left alone so the user doesn't lose any
     * intentional terrain work. Each tile is queued through the same
     * staggered animation pipeline as the starter scene so the fill
     * ripples diagonally across the island instead of snapping in flat.
     *
     * Returns the number of cells that were actually filled.
     */
    fillGrass() {
        if (!this.isAssetUnlocked('grass')) {
            this._showLockedToast('grass');
            return 0;
        }

        const W = this.tileMap.width;
        const H = this.tileMap.height;
        const before = this._snapshotWorld();
        // Same wave timing as the starter scene reveal so the two feel
        // like one consistent visual language.
        const STEP_MS = 32;
        let filled = 0;
        for (let gy = 0; gy < H; gy++)
        for (let gx = 0; gx < W; gx++) {
            if (this.tileMap.getTerrain(gx, gy)) continue;
            if (this.placeAndAnimate('grass', gx, gy, { delay: (gx + gy) * STEP_MS })) {
                filled++;
            }
        }
        if (filled > 0) {
            this._recordMutation(before);
            // One sound at the start; the per-tile placement audio path
            // would fire ~196 times in a fraction of a second otherwise.
            playPlacementFor('grass');
            this.ui?.showToast(`Filled ${filled} ${filled === 1 ? 'tile' : 'tiles'} with grass`);
        } else {
            this.ui?.showToast('Grid already covered');
        }
        return filled;
    }

    /* ── Mouse callbacks (called by InputManager) ─────────────── */

    onHover(cell) {
        const prev = this.renderer.hoverCell;
        const sameCell = prev && prev.gx === cell.gx && prev.gy === cell.gy;
        this.renderer.hoverCell = cell;
        if (this.tool === 'erase') {
            this.renderer.previewAssetId = null;
            this.renderer.previewValid = !!this.tileMap.objectAt(cell.gx, cell.gy)
                || !!this.tileMap.getTerrain(cell.gx, cell.gy);
        } else if (this.tool === 'place') {
            this.renderer.previewAssetId = this.selectedAssetId;
            this.renderer.previewValid = isAssetLoaded(this.selectedAssetId)
                && this.isAssetUnlocked(this.selectedAssetId)
                && this.placement.canPlace(this.selectedAssetId, cell.gx, cell.gy);
        } else {
            this.renderer.previewAssetId = null;
            this.renderer.previewValid = true;
        }
        // Only invalidate the next frame when the highlighted cell or its
        // validity actually changed. Hover events fire on every mousemove
        // pixel, so this matters.
        if (!sameCell) this.renderer.markDirty();
    }

    onPrimaryClick(gx, gy) {
        if (!this.tileMap.inBounds(gx, gy)) return;
        if (this.tool === 'erase') {
            // Capture what's about to be removed so we can pick the right
            // SFX (water erase splashes, everything else thuds).
            const before = this._snapshotWorld();
            const objHere = this.tileMap.objectAt(gx, gy);
            const terrainHere = this.tileMap.getTerrain(gx, gy);
            const targetId = objHere ? objHere.assetId : terrainHere;
            if (this.placement.erase(gx, gy)) {
                this._recordMutation(before);
                this.renderer.markDirty();
                playPlacementFor(targetId);
            }
        } else if (this.tool === 'place') {
            if (!this.isAssetUnlocked(this.selectedAssetId)) {
                this._showLockedToast();
                return;
            }
            if (!isAssetLoaded(this.selectedAssetId)) {
                this.ui?.showToast('Assets are still loading');
                return;
            }
            const before = this._snapshotWorld();
            const result = this.placement.place(this.selectedAssetId, gx, gy, {
                flipH: this.flipH,
                flipV: this.flipV,
            });
            if (result?.kind === 'object') {
                this._recordMutation(before);
                const o = result.object;
                this.renderer.spawnAnim(`obj-${o.id}`, {
                    gx: o.gx,
                    gy: o.gy,
                    w: o.footprint?.w ?? 1,
                    d: o.footprint?.d ?? 1,
                });
                playPlacementFor(o.assetId);
            } else if (result?.kind === 'terrain') {
                this._recordMutation(before);
                this.renderer.spawnAnim(`t-${result.gx},${result.gy}`, {
                    gx: result.gx,
                    gy: result.gy,
                    w: 1,
                    d: 1,
                });
                playPlacementFor(result.assetId);
            }
        }
    }

    onSecondaryClick(gx, gy) {
        // Right click always erases.
        if (!this.tileMap.inBounds(gx, gy)) return;
        const before = this._snapshotWorld();
        const objHere = this.tileMap.objectAt(gx, gy);
        const terrainHere = this.tileMap.getTerrain(gx, gy);
        const targetId = objHere ? objHere.assetId : terrainHere;
        if (this.placement.erase(gx, gy)) {
            this._recordMutation(before);
            this.renderer.markDirty();
            playPlacementFor(targetId);
        }
    }

    _snapshotWorld() {
        return JSON.parse(JSON.stringify(this.tileMap.serialize()));
    }

    _restoreWorld(snapshot) {
        this.tileMap.deserialize(snapshot, d => new PlacedObject(d));
        this.renderer.clearAnimations();
        this.renderer.markDirty();
    }

    _recordMutation(beforeSnapshot) {
        if (this._history.batchDepth > 0) {
            this._history.batchDirty = true;
            return;
        }
        this._pushUndo(beforeSnapshot);
        this.ui?.update();
    }

    _pushUndo(snapshot) {
        this._history.undo.push(snapshot);
        if (this._history.undo.length > this._history.limit) this._history.undo.shift();
        this._history.redo.length = 0;
    }

    /**
     * Place an asset and queue its elastic placement animation, optionally
     * delayed by `opts.delay` milliseconds. Used by the starter-scene
     * reveal to ripple the seeded village in back-to-front so first-run
     * players see the world build itself instead of just appearing.
     *
     * Returns the placement result (or null if the placement was rejected).
     */
    placeAndAnimate(assetId, gx, gy, opts = {}) {
        const result = this.placement.place(assetId, gx, gy, {
            flipH: !!opts.flipH,
            flipV: !!opts.flipV,
        });
        if (!result) return null;
        const startAt = performance.now() + (opts.delay ?? 0);
        const duration = opts.duration ?? 460;
        if (result.kind === 'object') {
            const o = result.object;
            this.renderer.spawnAnim(`obj-${o.id}`, {
                gx: o.gx,
                gy: o.gy,
                w: o.footprint?.w ?? 1,
                d: o.footprint?.d ?? 1,
            }, duration, startAt);
        } else if (result.kind === 'terrain') {
            this.renderer.spawnAnim(`t-${result.gx},${result.gy}`, {
                gx: result.gx,
                gy: result.gy,
                w: 1,
                d: 1,
            }, duration, startAt);
        }
        return result;
    }

    /* ── Frame loop ───────────────────────────────────────────── */

    _loop() {
        // The renderer skips its own work when nothing has changed and
        // there are no animations running, so this loop is effectively
        // free at idle. We still keep `requestAnimationFrame` ticking so
        // we resume instantly when input or animations resume.
        this.renderer.draw();
        requestAnimationFrame(this._loop);
    }
}

function hasWorldContent(tileMap) {
    return tileMap.terrain.some(Boolean) || tileMap.objects.length > 0;
}
