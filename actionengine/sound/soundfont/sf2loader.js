//actionengine/sound/soundfont/sf2loader.js
/**
 * SF2Loader - Chainloads a split soundfont (many small base64 chunk .js files)
 * and reassembles it into the original SF2 bytes. Mirrors
 * ActionModelPackageLoader's manifest/lazy-load/dedupe pattern for .glb models.
 *
 * LOADING MODEL - lazy, on demand:
 *   A generated SF2Index.js does NOT fetch any chunk on page load. It only calls
 *   registerPackage(name, chunkPaths, options, baseDir) to record a manifest (cheap -
 *   no fetches, no decoding). The chunk sub-scripts are pulled in later, the first
 *   time something calls load(name) - e.g. ActionSoundFont wiring up a MIDI player.
 */
class SF2Loader {
  /** @type {Map<string, {chunkPaths: string[], options: Object, baseDir: string}>} */
  static #manifests = new Map();

  /** @type {Map<string, Promise<Uint8Array>>} */
  static #loadPromises = new Map();

  /** @type {Map<string, Uint8Array>} */
  static #loaded = new Map();

  /**
   * Record a package manifest. Called by a generated SF2Index.js on page load.
   * @param {string} name
   * @param {string[]} chunkPaths - ["chunks/chunk_000.js", ...], relative to baseDir
   * @param {Object} [options] - {dataUrlPrefix} e.g. "data:application/octet-stream;base64,"
   * @param {string} [baseDir] - directory the SF2Index.js lives in
   */
  static registerPackage(name, chunkPaths, options = {}, baseDir = "") {
    if (typeof name !== "string" || !name.trim()) {
      throw new Error("SF2Loader.registerPackage: name must be a non-empty string");
    }
    this.#manifests.set(name, {
      chunkPaths: chunkPaths || [],
      options: options || {},
      baseDir: baseDir || ""
    });
  }

  static listPackageNames() {
    return Array.from(this.#manifests.keys());
  }

  static hasPackage(name) {
    return this.#manifests.has(name) || this.#loaded.has(name);
  }

  /**
   * Load a package on demand: chainload its chunk sub-scripts, concatenate their
   * base64 text, and decode once into the original SF2 bytes. Idempotent and
   * concurrency-safe like ActionModelPackageLoader.load().
   * @param {string} name
   * @param {Function} [onProgress] - called with a fraction 0..1 as chunks load
   * @returns {Promise<Uint8Array>} the reassembled SF2 file bytes
   */
  static async load(name, onProgress = null) {
    if (this.#loaded.has(name)) {
      if (onProgress) onProgress(1);
      return this.#loaded.get(name);
    }
    if (this.#loadPromises.has(name)) {
      const p = this.#loadPromises.get(name);
      if (onProgress) p.then(() => onProgress(1), () => {});
      return p;
    }

    const manifest = this.#manifests.get(name);
    if (!manifest) {
      throw new Error(`SF2Loader.load: no package registered as "${name}"`);
    }

    const promise = this.#loadManifest(name, manifest, onProgress);
    this.#loadPromises.set(name, promise);
    try {
      const bytes = await promise;
      this.#loaded.set(name, bytes);
      return bytes;
    } finally {
      this.#loadPromises.delete(name);
    }
  }

  /**
   * @private
   */
  static async #loadManifest(name, manifest, onProgress) {
    const { chunkPaths, options, baseDir } = manifest;
    const t0 = performance.now();

    let doneUnits = 0;
    const totalUnits = chunkPaths.length + 1; // +1 for the decode step
    const report = () => { if (onProgress) onProgress(doneUnits / totalUnits); };
    report(); // 0

    window.TimGM6mb_CHUNKS = window.TimGM6mb_CHUNKS || [];

    for (const chunkPath of chunkPaths) {
      await this.#loadScript(baseDir + chunkPath);
      doneUnits++;
      report();
    }

    // chunkPaths empty (bundled/inline case) means the chunks already ran and
    // populated TimGM6mb_CHUNKS before registerPackage was even called - just use them.
    const base64 = window.TimGM6mb_CHUNKS.join("");
    const bytes = Uint8Array.fromBase64
      ? Uint8Array.fromBase64(base64)
      : SF2Loader.#legacyDecode(base64);

    doneUnits++;
    report(); // 1

    console.log(
      `SF2Loader: lazy-loaded "${name}" (${chunkPaths.length} chunks, ${bytes.length} bytes) in ${(performance.now() - t0).toFixed(0)}ms`
    );
    return bytes;
  }

  /**
   * @private
   * Fallback base64 decode for browsers without Uint8Array.fromBase64.
   */
  static #legacyDecode(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * @private
   * Inject a <script> and resolve when it has loaded. Same approach as
   * ActionModelPackageLoader.#loadScript.
   */
  static #loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load: " + src));
      document.head.appendChild(script);
    });
  }
}

window.SF2Loader = SF2Loader;
