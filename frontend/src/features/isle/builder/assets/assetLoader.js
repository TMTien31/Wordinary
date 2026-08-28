/**
 * assetLoader.js
 *
 * Loads the generated image asset pack from Wordinary's public Isle assets.
 *
 * For each manifest entry:
 *   1. Try to load /public/assets/isle/<filename>.
 *   2. If that succeeds, run it through imageToAsset() to produce the
 *      canonical record.
 *   3. If it fails (image not yet generated), fall back to the procedural
 *      voxel builder so the editor still functions during dev.
 *
 * The eventual goal is for every entry to have a real image so the fallback
 * path is never taken at runtime.
 */

import { ASSET_INDEX, ASSET_MANIFEST } from './assetManifest.js';
import { imageToAsset, loadImageElement } from './imageToAsset.js';
import { renderVoxels } from './voxelRenderer.js';

const _assets = {};
const _loading = new Map();
const _loadedCategories = new Set();
const ASSET_BASE_URL = '/public/assets/isle/';

/**
 * Quality knobs for asset pre-rendering.
 *
 * DISPLAY_SUPERSAMPLE: how many times the asset's display (CSS) size we
 *   bake into the per-asset draw canvas. The renderer always blits this
 *   canvas at the asset's display size, so the only resampling left at
 *   runtime is from `displayCanvas.size` (≈ display × SUPERSAMPLE) down to
 *   the on-screen pixel size at the current camera zoom × devicePixelRatio.
 *
 *   This is capped aggressively because the source PNGs are large. A 6x
 *   display cache across dozens of assets can cost more memory than the
 *   original images; 2-3x keeps zoomed-in assets crisp without turning the
 *   browser into a bitmap warehouse.
 *
 * SHADOW_SUPERSAMPLE / SHADOW_BLUR_PX: shadows are projected then blurred
 *   at draw time. We pre-blur a smaller silhouette once at load time and
 *   then just blit it transformed per frame, so the slow `ctx.filter`
 *   blur path is gone from the render loop entirely.
 */
const DEFAULT_DPR = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
const DISPLAY_SUPERSAMPLE = Math.max(2, Math.min(3, Math.ceil(DEFAULT_DPR * 1.5)));
const SHADOW_SUPERSAMPLE  = 1;
const SHADOW_BLUR_PX      = 6;

/**
 * Pre-render an asset's source canvas down to a draw-ready canvas at the
 * asset's display resolution × SUPERSAMPLE. The render loop later blits
 * this canvas at `(width, height)` regardless of camera zoom, so the
 * browser only ever resamples a small intermediate instead of the full
 * 1k–2k px PNG, and only does it once per zoom-change effectively.
 *
 * Returns the original canvas as-is when the source is already small
 * enough — pre-rendering would be a net loss in that case.
 */
function buildDisplayCanvas(srcCanvas, displayW, displayH) {
    if (!srcCanvas || !srcCanvas.width || !srcCanvas.height) return srcCanvas;
    const targetW = Math.max(1, Math.ceil(displayW * DISPLAY_SUPERSAMPLE));
    const targetH = Math.max(1, Math.ceil(displayH * DISPLAY_SUPERSAMPLE));
    if (targetW >= srcCanvas.width && targetH >= srcCanvas.height) {
        // Source isn't bigger than the supersampled draw size, so the
        // browser would be upsampling either way. Skip the extra canvas.
        return srcCanvas;
    }
    const out = document.createElement('canvas');
    out.width  = targetW;
    out.height = targetH;
    const ctx = out.getContext('2d');
    if (!ctx) return srcCanvas;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
    return out;
}

/**
 * Build a black silhouette of an asset canvas for use as a cast shadow,
 * pre-resampled to display resolution and pre-blurred so the per-frame
 * shadow pass is just a transformed `drawImage` (no `ctx.filter` blur,
 * no full-resolution silhouette upload to the GPU each frame).
 */
function buildShadowCanvas(srcCanvas, displayW, displayH) {
    if (!srcCanvas || !srcCanvas.width || !srcCanvas.height) return null;
    const targetW = Math.max(1, Math.ceil(displayW * SHADOW_SUPERSAMPLE));
    const targetH = Math.max(1, Math.ceil(displayH * SHADOW_SUPERSAMPLE));
    const pad = Math.ceil(SHADOW_BLUR_PX * 2.5);
    const w = targetW + pad * 2;
    const h = targetH + pad * 2;

    const tmp = document.createElement('canvas');
    tmp.width  = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d');
    if (!tctx) return null;
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(srcCanvas, pad, pad, targetW, targetH);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, w, h);

    // Pre-blur once at load time. If the browser doesn't support
    // `ctx.filter`, we just ship the un-blurred silhouette — the renderer
    // adds an extra alpha shrink to soften it visually.
    if (typeof tctx.filter !== 'string') {
        return { canvas: tmp, padding: pad, width: targetW, height: targetH, blurred: false };
    }
    const out = document.createElement('canvas');
    out.width  = w;
    out.height = h;
    const octx = out.getContext('2d');
    octx.filter = `blur(${SHADOW_BLUR_PX}px)`;
    octx.drawImage(tmp, 0, 0);
    return { canvas: out, padding: pad, width: targetW, height: targetH, blurred: true };
}

/**
 * Find left/right foot points for low contact-shadow assets such as fences.
 * We look for tall opaque column clusters (the posts) and return their
 * bottom-center points scaled into the final draw size.
 */
function buildContactPoints(srcCanvas, displayW, displayH) {
    if (!srcCanvas || !srcCanvas.width || !srcCanvas.height) return [];
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const ctx = srcCanvas.getContext('2d');
    if (!ctx) return [];

    let data;
    try {
        data = ctx.getImageData(0, 0, w, h).data;
    } catch {
        return [];
    }

    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 20) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (maxX < minX || maxY < minY) return [];

    const visibleH = maxY - minY + 1;
    const threshold = visibleH * 0.45;
    const runs = [];
    let runStart = -1;
    for (let x = minX; x <= maxX; x++) {
        let count = 0;
        for (let y = minY; y <= maxY; y++) {
            if (data[(y * w + x) * 4 + 3] > 20) count++;
        }
        if (count >= threshold && runStart < 0) runStart = x;
        if ((count < threshold || x === maxX) && runStart >= 0) {
            const end = count < threshold ? x - 1 : x;
            if (end - runStart >= 5) runs.push({ start: runStart, end });
            runStart = -1;
        }
    }
    if (runs.length < 2) return [];

    const postRuns = [runs[0], runs[runs.length - 1]];
    const sx = displayW / w;
    const sy = displayH / h;
    return postRuns.map(run => {
        let bottomY = minY;
        for (let y = minY; y <= maxY; y++) {
            for (let x = run.start; x <= run.end; x++) {
                if (data[(y * w + x) * 4 + 3] > 20) {
                    if (y > bottomY) bottomY = y;
                    break;
                }
            }
        }
        return {
            x: ((run.start + run.end) / 2) * sx,
            y: bottomY * sy,
        };
    });
}

function buildThumbnailCanvas(record, max = 56) {
    const src = record.displayCanvas || record.canvas;
    if (!src || !record.width || !record.height) return null;
    const scale = Math.min(max / record.width, max / record.height, 2);
    const out = document.createElement('canvas');
    out.width  = Math.max(1, Math.ceil(record.width  * scale));
    out.height = Math.max(1, Math.ceil(record.height * scale));
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, out.width, out.height);
    return out;
}

async function loadEntry(entry) {
    if (_assets[entry.id]) return _assets[entry.id];
    if (_loading.has(entry.id)) return _loading.get(entry.id);

    const promise = (async () => {
        const meta = {
            id: entry.id,
            name: entry.name,
            category: entry.category,
            kind: entry.kind,
            footprint: entry.footprint,
            tileLike: entry.tileLike === true,
            noShadow: entry.noShadow === true,
            flatBase: entry.flatBase === true,
            shadowStyle: entry.shadowStyle ?? 'cast',
        };

        let record = null;

        if (entry.filename) {
            try {
                const img = await loadImageElement(`${ASSET_BASE_URL}${entry.filename}`);
                record = imageToAsset(img, entry.footprint, entry.kind, {
                    sizeScale: entry.sizeScale ?? 1,
                    tileLike:  entry.tileLike === true,
                    fitCell:   entry.fitCell === true,
                    flatBase:  entry.flatBase === true,
                });
                record.source = 'image';
            } catch {
                /* fall through to procedural fallback */
            }
        }

        if (!record && entry.builder) {
            const voxels = entry.builder();
            record = renderVoxels(voxels, entry.footprint);
            record.source = 'procedural';
        }

        if (!record) return null;

        record.displayCanvas = buildDisplayCanvas(
            record.canvas, record.width, record.height,
        );

        const asset = { ...meta, ...record };
        asset.thumbnailCanvas = buildThumbnailCanvas(asset);

        if (
            entry.kind === 'object'
            && !meta.tileLike
            && !meta.noShadow
            && record.canvas
        ) {
            const shadow = buildShadowCanvas(record.canvas, record.width, record.height);
            if (shadow) {
                asset.shadowCanvas  = shadow.canvas;
                asset.shadowPadding = shadow.padding;
                asset.shadowWidth   = shadow.width;
                asset.shadowHeight  = shadow.height;
                asset.shadowBlurred = shadow.blurred;
            }
            if (meta.shadowStyle === 'contact') {
                asset.contactPoints = buildContactPoints(
                    record.canvas,
                    record.width,
                    record.height,
                );
            }
        }

        _assets[entry.id] = asset;
        return asset;
    })();

    _loading.set(entry.id, promise);
    try {
        return await promise;
    } finally {
        _loading.delete(entry.id);
    }
}

export async function loadAssets(onProgress = () => {}) {
    const assets = await loadAssetEntries(ASSET_MANIFEST, onProgress);
    for (const entry of ASSET_MANIFEST) _loadedCategories.add(entry.category);
    return assets;
}

export async function loadCategoryAssets(category, onProgress = () => {}) {
    if (_loadedCategories.has(category)) {
        onProgress(1, category);
        return _assets;
    }
    const entries = ASSET_MANIFEST.filter(entry => entry.category === category);
    await loadAssetEntries(entries, onProgress);
    _loadedCategories.add(category);
    return _assets;
}

export async function loadAssetsForIds(ids = [], onProgress = () => {}) {
    const uniqueEntries = Array.from(new Set(ids))
        .map(id => ASSET_INDEX[id])
        .filter(Boolean);
    return loadAssetEntries(uniqueEntries, onProgress);
}

async function loadAssetEntries(entries, onProgress) {
    const total = entries.length || 1;
    let imageCount = 0;
    let fallbackCount = 0;

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const before = _assets[entry.id]?.source;
        const asset = await loadEntry(entry);
        const source = asset?.source ?? before;
        if (!before && source === 'image') imageCount++;
        if (!before && source === 'procedural') fallbackCount++;

        onProgress((i + 1) / total, entry.name);
        if (i % 2 === 0) await new Promise(r => requestAnimationFrame(r));
    }

    if (entries.length) {
        console.info(`[assets] ready ${entries.length} requested assets (${imageCount} images, ${fallbackCount} fallbacks newly loaded).`);
    }
    return _assets;
}

export function isAssetLoaded(id) {
    return !!_assets[id];
}

export function isCategoryLoaded(category) {
    return _loadedCategories.has(category);
}

export function getAsset(id) {
    const a = _assets[id];
    return a;
}

export function allAssets() {
    return _assets;
}
