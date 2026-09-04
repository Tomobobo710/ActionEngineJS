// actionengine/sound/soundfont/timgm6mb/SF2IndexInline.js
// Bundle-only counterpart to SF2Index.js. Used by build.js, which concatenates this
// right after all 40 chunk_*.js files, so window.TimGM6mb_CHUNKS is already fully
// populated by the time this runs. Registers with an empty chunkPaths list, so
// SF2Loader.load() has nothing to fetch and just reads what's already in memory.

(function () {
  SF2Loader.registerPackage("TimGM6mb", [], {
    dataUrlPrefix: "data:application/octet-stream;base64,"
  }, "");
})();
