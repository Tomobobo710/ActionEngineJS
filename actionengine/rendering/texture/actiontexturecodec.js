// actionengine/rendering/texture/actiontexturecodec.js
//
// ActionTextureCodec - GPU block compression written in plain JS, no dependencies.
//
// BC7 (EXT_texture_compression_bptc): every 4x4 pixel block becomes 16 bytes (RGBA8 is 64), so a texture is 4x
// smaller in VRAM and the GPU samples it directly. BC7 has eight block modes; this encoder writes mode 6 only -
// one pair of RGBA endpoints (7 bits + a shared low "p-bit" each) and a 4-bit index per pixel - which handles
// colour with or without alpha in a single, simple layout.
//
// Every method is static and refers only to ActionTextureCodec and its own arguments, so the whole class can
// be shipped into a worker by source and run there unchanged.
//
//   const levels = ActionTextureCodec.encodeLayerBC7(rgba, 512, 512);   // [Uint8Array level0, level1, ...]
//   gl.compressedTexSubImage3D(..., ext.COMPRESSED_RGBA_BPTC_UNORM_EXT, levels[i])
class ActionTextureCodec {
    /** Bytes of BC7 data for a w x h image (whole 4x4 blocks, so 1x1 and 2x2 levels still take one block). */
    static bc7Size(w, h) {
        return Math.ceil(w / 4) * Math.ceil(h / 4) * 16;
    }

    /** Number of mip levels down to 1x1. */
    static mipCount(w, h) {
        return Math.floor(Math.log2(Math.max(w, h))) + 1;
    }

    /**
     * The full mip chain of an RGBA8 image as [{ px, w, h }], level 0 first. Each level is a 2x2 box filter of
     * the one above (an odd edge repeats its last row / column).
     */
    static mipChain(px, w, h) {
        const out = [{ px, w, h }];
        let cur = px, cw = w, ch = h;
        while (cw > 1 || ch > 1) {
            const nw = Math.max(1, cw >> 1), nh = Math.max(1, ch >> 1), nx = new Uint8Array(nw * nh * 4);
            for (let y = 0; y < nh; y++) {
                const y0 = Math.min(ch - 1, y * 2), y1 = Math.min(ch - 1, y * 2 + 1);
                for (let x = 0; x < nw; x++) {
                    const x0 = Math.min(cw - 1, x * 2), x1 = Math.min(cw - 1, x * 2 + 1);
                    const a = (y0 * cw + x0) * 4, b = (y0 * cw + x1) * 4, c = (y1 * cw + x0) * 4, d = (y1 * cw + x1) * 4, o = (y * nw + x) * 4;
                    for (let k = 0; k < 4; k++) nx[o + k] = (cur[a + k] + cur[b + k] + cur[c + k] + cur[d + k] + 2) >> 2;
                }
            }
            out.push({ px: nx, w: nw, h: nh });
            cur = nx; cw = nw; ch = nh;
        }
        return out;
    }

    /** Encode an RGBA8 image and its whole mip chain to BC7. Returns one Uint8Array per level, level 0 first. */
    static encodeLayerBC7(px, w, h) {
        return ActionTextureCodec.mipChain(px, w, h).map((l) => ActionTextureCodec.encodeBC7(l.px, l.w, l.h));
    }

    /** Encode one RGBA8 image (any size; partial edge blocks repeat their last row / column) to BC7 mode 6. */
    static encodeBC7(px, w, h) {
        const bw = Math.ceil(w / 4), bh = Math.ceil(h / 4), out = new Uint8Array(bw * bh * 16), blk = new Float32Array(64);
        const sc = ActionTextureCodec._scratch();
        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                let solid = true;
                for (let i = 0; i < 16; i++) {
                    const x = Math.min(w - 1, bx * 4 + (i & 3)), y = Math.min(h - 1, by * 4 + (i >> 2)), s = (y * w + x) * 4;
                    blk[i * 4] = px[s]; blk[i * 4 + 1] = px[s + 1]; blk[i * 4 + 2] = px[s + 2]; blk[i * 4 + 3] = px[s + 3];
                    if (solid && i && (blk[i * 4] !== blk[0] || blk[i * 4 + 1] !== blk[1] || blk[i * 4 + 2] !== blk[2] || blk[i * 4 + 3] !== blk[3])) solid = false;
                }
                const off = (by * bw + bx) * 16;
                // a one-colour block encodes the same every time: encode each colour once per image and copy it after that
                if (solid) {
                    const key = ((blk[0] << 24) | (blk[1] << 16) | (blk[2] << 8) | blk[3]) >>> 0, hit = sc.solid.get(key);
                    if (hit) { out.set(hit, off); continue; }
                    ActionTextureCodec.encodeBlockBC7(blk, out, off, sc);
                    sc.solid.set(key, out.slice(off, off + 16));
                    continue;
                }
                ActionTextureCodec.encodeBlockBC7(blk, out, off, sc);
            }
        }
        return out;
    }

    /** Working buffers for the block encoder, made once per image instead of once per block. */
    static _scratch() {
        const W = new Int32Array([0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64]);
        const near = new Uint8Array(65);                      // weight 0..64 -> nearest index in W
        for (let t = 0; t <= 64; t++) {
            let bi = 0;
            for (let j = 1; j < 16; j++) if (Math.abs(W[j] - t) < Math.abs(W[bi] - t)) bi = j;
            near[t] = bi;
        }
        return {
            W, near, m: new Float64Array(4), ax: new Float64Array(4), n: new Float64Array(4), C: new Float64Array(16),
            e0: new Float64Array(4), e1: new Float64Array(4), ra: new Float64Array(4), rb: new Float64Array(4),
            pal: new Int32Array(64), c0: new Int32Array(4), c1: new Int32Array(4), q0: new Int32Array(4), q1: new Int32Array(4),
            idx: new Uint8Array(16), bIdx: new Uint8Array(16), bq0: new Int32Array(4), bq1: new Int32Array(4),
            best: { err: 0, p0: 0, p1: 0 }, solid: new Map()
        };
    }

    /**
     * One 4x4 block (16 RGBA pixels as 64 floats, 0..255) -> 16 bytes of BC7 mode 6 at out[off].
     * Endpoints come from the block's principal axis, are refined once by least squares on the chosen indices,
     * and the lowest squared error wins. One-colour blocks are encoded once per image (see encodeBC7) and copied.
     */
    static encodeBlockBC7(p, out, off, sc) {
        sc = sc || ActionTextureCodec._scratch();
        const m = sc.m, ax = sc.ax, n = sc.n, C = sc.C, e0 = sc.e0, e1 = sc.e1, ra = sc.ra, rb = sc.rb, W = sc.W, best = sc.best;
        // mean and principal axis (power iteration on the 4x4 covariance)
        m.fill(0); C.fill(0);
        for (let i = 0; i < 16; i++) for (let k = 0; k < 4; k++) m[k] += p[i * 4 + k];
        for (let k = 0; k < 4; k++) m[k] /= 16;
        for (let i = 0; i < 16; i++) {
            for (let a = 0; a < 4; a++) {
                const da = p[i * 4 + a] - m[a];
                for (let b = a; b < 4; b++) C[a * 4 + b] += da * (p[i * 4 + b] - m[b]);
            }
        }
        for (let a = 0; a < 4; a++) for (let b = 0; b < a; b++) C[a * 4 + b] = C[b * 4 + a];
        ax[0] = ax[1] = ax[2] = ax[3] = 0.5;
        for (let it = 0; it < 8; it++) {
            for (let a = 0; a < 4; a++) n[a] = C[a * 4] * ax[0] + C[a * 4 + 1] * ax[1] + C[a * 4 + 2] * ax[2] + C[a * 4 + 3] * ax[3];
            const len = Math.hypot(n[0], n[1], n[2], n[3]);
            if (len < 1e-9) break;
            for (let a = 0; a < 4; a++) ax[a] = n[a] / len;
        }
        let tmin = Infinity, tmax = -Infinity;
        for (let i = 0; i < 16; i++) {
            const t = (p[i * 4] - m[0]) * ax[0] + (p[i * 4 + 1] - m[1]) * ax[1] + (p[i * 4 + 2] - m[2]) * ax[2] + (p[i * 4 + 3] - m[3]) * ax[3];
            if (t < tmin) tmin = t;
            if (t > tmax) tmax = t;
        }
        for (let k = 0; k < 4; k++) { e0[k] = m[k] + ax[k] * tmin; e1[k] = m[k] + ax[k] * tmax; }

        best.err = Infinity;
        ActionTextureCodec._bc7Fit(p, e0, e1, sc);
        // least-squares refinement: given the chosen weights, solve for the endpoints that minimise the error. Skipped when the
        // first fit is already within about half a level per channel (squared error <= 16 over the block).
        if (best.err > 16) {
            let aa = 0, ab = 0, bb = 0;
            ra.fill(0); rb.fill(0);
            for (let i = 0; i < 16; i++) {
                const t = W[sc.bIdx[i]] / 64, s = 1 - t;
                aa += s * s; ab += s * t; bb += t * t;
                for (let k = 0; k < 4; k++) { ra[k] += s * p[i * 4 + k]; rb[k] += t * p[i * 4 + k]; }
            }
            const det = aa * bb - ab * ab;
            if (Math.abs(det) > 1e-6) {
                for (let k = 0; k < 4; k++) { e0[k] = (ra[k] * bb - rb[k] * ab) / det; e1[k] = (rb[k] * aa - ra[k] * ab) / det; }
                ActionTextureCodec._bc7Fit(p, e0, e1, sc, true);
            }
        }
        ActionTextureCodec._bc7Write(sc, out, off);
    }

    /** Quantise both endpoints and pick indices; keeps the fit if it beats sc.best. Each endpoint's p-bit is the one
     *  that rounds its four channels closest; `full` also tries the other three p-bit pairs (used on the final refinement).
     *  Each pixel is projected onto the endpoint line and only the nearest weight and its two neighbours are tested. */
    static _bc7Fit(p, e0, e1, sc, full) {
        const W = sc.W, near = sc.near, pal = sc.pal, c0 = sc.c0, c1 = sc.c1, idx = sc.idx, q0 = sc.q0, q1 = sc.q1, best = sc.best;
        const pbit = (e) => {
            let d0 = 0, d1 = 0;
            for (let k = 0; k < 4; k++) {
                const a = Math.max(0, Math.min(127, Math.round(e[k] / 2))) * 2, b = Math.max(0, Math.min(127, Math.round((e[k] - 1) / 2))) * 2 + 1;
                d0 += (e[k] - a) * (e[k] - a); d1 += (e[k] - b) * (e[k] - b);
            }
            return d1 < d0 ? 1 : 0;
        };
        const d0 = pbit(e0), d1 = pbit(e1);
        // the closest-rounding pair first; with `full`, the other three pairs as well
        for (let t = 0; t < (full ? 4 : 1); t++) {
            const p0 = d0 ^ (t & 1), p1 = d1 ^ (t >> 1);
            let dd = 0;
            for (let k = 0; k < 4; k++) {
                q0[k] = Math.max(0, Math.min(127, Math.round((e0[k] - p0) / 2)));
                q1[k] = Math.max(0, Math.min(127, Math.round((e1[k] - p1) / 2)));
                c0[k] = q0[k] * 2 + p0; c1[k] = q1[k] * 2 + p1;
                dd += (c1[k] - c0[k]) * (c1[k] - c0[k]);
            }
            for (let j = 0; j < 16; j++) for (let k = 0; k < 4; k++) pal[j * 4 + k] = ((64 - W[j]) * c0[k] + W[j] * c1[k] + 32) >> 6;
            let err = 0;
            for (let i = 0; i < 16; i++) {
                const o = i * 4;
                let c = 0;
                if (dd > 0) {
                    const t = ((p[o] - c0[0]) * (c1[0] - c0[0]) + (p[o + 1] - c0[1]) * (c1[1] - c0[1]) + (p[o + 2] - c0[2]) * (c1[2] - c0[2]) + (p[o + 3] - c0[3]) * (c1[3] - c0[3])) / dd;
                    c = near[Math.max(0, Math.min(64, Math.round(t * 64)))];
                }
                let bi = c, be = Infinity;
                for (let j = Math.max(0, c - 1); j <= Math.min(15, c + 1); j++) {
                    const d0 = p[o] - pal[j * 4], d1 = p[o + 1] - pal[j * 4 + 1], d2 = p[o + 2] - pal[j * 4 + 2], d3 = p[o + 3] - pal[j * 4 + 3];
                    const e = d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3;
                    if (e < be) { be = e; bi = j; }
                }
                idx[i] = bi; err += be;
                if (err >= best.err) break;
            }
            if (err < best.err) {
                best.err = err; best.p0 = p0; best.p1 = p1;
                sc.bq0.set(q0); sc.bq1.set(q1); sc.bIdx.set(idx);
                if (err === 0) return;
            }
        }
    }

    /** Pack the best mode 6 fit into 16 bytes. Pixel 0's index is the 3-bit anchor, so its top bit must be 0: if it
     *  isn't, swap the endpoints and mirror every index (same colours, legal encoding). */
    static _bc7Write(sc, out, off) {
        const swap = sc.bIdx[0] >= 8, q0 = swap ? sc.bq1 : sc.bq0, q1 = swap ? sc.bq0 : sc.bq1;
        const p0 = swap ? sc.best.p1 : sc.best.p0, p1 = swap ? sc.best.p0 : sc.best.p1;
        for (let i = 0; i < 16; i++) out[off + i] = 0;
        let pos = 0;
        const put = (v, n) => {
            for (let b = 0; b < n; b++, pos++) if ((v >> b) & 1) out[off + (pos >> 3)] |= 1 << (pos & 7);
        };
        put(1 << 6, 7);                                                  // mode 6: six 0 bits then a 1
        for (let k = 0; k < 4; k++) { put(q0[k], 7); put(q1[k], 7); }   // R0 R1 G0 G1 B0 B1 A0 A1
        put(p0, 1); put(p1, 1);
        put(swap ? 15 - sc.bIdx[0] : sc.bIdx[0], 3);
        for (let i = 1; i < 16; i++) put(swap ? 15 - sc.bIdx[i] : sc.bIdx[i], 4);
    }

    /** Decode BC7 mode 6 data back to RGBA8 (other modes decode as magenta). For tests and quality checks. */
    static decodeBC7(data, w, h) {
        const W = [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64];
        const bw = Math.ceil(w / 4), bh = Math.ceil(h / 4), px = new Uint8Array(w * h * 4);
        for (let by = 0; by < bh; by++) {
            for (let bx = 0; bx < bw; bx++) {
                const off = (by * bw + bx) * 16;
                let pos = 0;
                const get = (n) => { let v = 0; for (let b = 0; b < n; b++, pos++) v |= ((data[off + (pos >> 3)] >> (pos & 7)) & 1) << b; return v; };
                const mode = get(7);
                const c0 = [0, 0, 0, 0], c1 = [0, 0, 0, 0], idx = [];
                if (mode === 64) {
                    const q0 = [0, 0, 0, 0], q1 = [0, 0, 0, 0];
                    for (let k = 0; k < 4; k++) { q0[k] = get(7); q1[k] = get(7); }
                    const p0 = get(1), p1 = get(1);
                    for (let k = 0; k < 4; k++) { c0[k] = q0[k] * 2 + p0; c1[k] = q1[k] * 2 + p1; }
                    idx.push(get(3));
                    for (let i = 1; i < 16; i++) idx.push(get(4));
                }
                for (let i = 0; i < 16; i++) {
                    const x = bx * 4 + (i & 3), y = by * 4 + (i >> 2);
                    if (x >= w || y >= h) continue;
                    const o = (y * w + x) * 4;
                    if (mode !== 64) { px[o] = 255; px[o + 1] = 0; px[o + 2] = 255; px[o + 3] = 255; continue; }
                    const t = W[idx[i]];
                    for (let k = 0; k < 4; k++) px[o + k] = ((64 - t) * c0[k] + t * c1[k] + 32) >> 6;
                }
            }
        }
        return px;
    }
}
