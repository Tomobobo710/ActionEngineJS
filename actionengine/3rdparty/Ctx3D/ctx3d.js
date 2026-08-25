/*
 *  Ctx3D - the full Canvas2D API, rendered on a WebGL2 context. Drop-in.
 *
 *  var ctx = Ctx3D.getContext(canvas);   // returns a Canvas2D-style context on WebGL2
 *
 *  The "2D" is the API surface (CanvasRenderingContext2D); the "3D" is the engine
 *  underneath it. Both Ds are capital on purpose — they're dimensions, not typos.
 */

(function (window) {
  "use strict";

  var M_PI = Math.PI;
  var M_TWO_PI = 2 * Math.PI;

  // ---------------------------------------------------------------------------
  // mat3 (column-major; indices: col0=m0m1m2 col1=m3m4m5 col2=m6m7m8)
  // ---------------------------------------------------------------------------
  function mIdent() {
    return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  function mMul(a, b) {
    return [
      a[0] * b[0] + a[3] * b[1] + a[6] * b[2],
      a[1] * b[0] + a[4] * b[1] + a[7] * b[2],
      a[2] * b[0] + a[5] * b[1] + a[8] * b[2],
      a[0] * b[3] + a[3] * b[4] + a[6] * b[5],
      a[1] * b[3] + a[4] * b[4] + a[7] * b[5],
      a[2] * b[3] + a[5] * b[4] + a[8] * b[5],
      a[0] * b[6] + a[3] * b[7] + a[6] * b[8],
      a[1] * b[6] + a[4] * b[7] + a[7] * b[8],
      a[2] * b[6] + a[5] * b[7] + a[8] * b[8]
    ];
  }

  // Inverse of a column-major 3x3 (same layout as mMul / uMVP). Returns identity
  // if singular. Used to map user space back into a pattern's local space.
  function mInv3(m) {
    var a=m[0],b=m[1],c=m[2], d=m[3],e=m[4],f=m[5], g=m[6],h=m[7],i=m[8];
    var A = e*i - f*h, B = f*g - d*i, C = d*h - e*g;
    var det = a*A + b*B + c*C;
    if (Math.abs(det) < 1e-12) return mIdent();
    var id = 1/det;
    return [
      A*id, (c*h - b*i)*id, (b*f - c*e)*id,
      B*id, (a*i - c*g)*id, (c*d - a*f)*id,
      C*id, (b*g - a*h)*id, (a*e - b*d)*id
    ];
  }

  function Transform() {
    this.m = mIdent();
    this.stack = [];
  }
  Transform.prototype.save = function () {
    this.stack.push(this.m.slice());
  };
  Transform.prototype.restore = function () {
    if (this.stack.length) this.m = this.stack.pop();
  };
  Transform.prototype.translate = function (x, y) {
    var t = mIdent();
    t[6] = x;
    t[7] = y;
    this.m = mMul(this.m, t);
  };
  Transform.prototype.scale = function (x, y) {
    var s = mIdent();
    s[0] = x;
    s[4] = y;
    this.m = mMul(this.m, s);
  };
  Transform.prototype.rotate = function (ang) {
    var c = Math.cos(ang), s = Math.sin(ang), r = mIdent();
    r[0] = c; r[1] = s; r[3] = -s; r[4] = c;
    this.m = mMul(this.m, r);
  };
  Transform.prototype.raw = function (a, b, c, d, e, f) {
    var t = mIdent();
    t[0] = a; t[1] = b; t[3] = c; t[4] = d; t[6] = e; t[7] = f;
    this.m = mMul(this.m, t);
  };
  Transform.prototype.setRaw = function (a, b, c, d, e, f) {
    var t = mIdent();
    t[0] = a; t[1] = b; t[3] = c; t[4] = d; t[6] = e; t[7] = f;
    this.m = t;
  };
  Transform.prototype.current = function () {
    return this.m;
  };

  // ---------------------------------------------------------------------------
  // DOMMatrix (2D): column-major 3x3 like Transform.m (m[0]=a,m[1]=b,m[3]=c,m[4]=d,m[6]=e,m[7]=f).
  // Exposes the common DOMMatrix read/write API so getTransform() returns a real
  // matrix object rather than a bare {a,b,c,d,e,f}.
  // ---------------------------------------------------------------------------
  function DOMMatrix(a) {
    this.m = (a && a.m) ? a.m.slice() : mIdent();
    this.is2D = true;
    this.isIdentity = this.isIdentity2D();
  }
  DOMMatrix.prototype.isIdentity2D = function () {
    var m = this.m;
    return m[0] === 1 && m[1] === 0 && m[3] === 0 && m[4] === 1 && m[6] === 0 && m[7] === 0;
  };
  DOMMatrix.prototype.toString = function () {
    return "matrix(" + this.a + ", " + this.b + ", " + this.c + ", " + this.d + ", " + this.e + ", " + this.f + ")";
  };
  DOMMatrix.prototype.multiply = function (o) { return new DOMMatrix({ m: mMul(this.m, o.m) }); };
  DOMMatrix.prototype.multiplySelf = function (o) { this.m = mMul(this.m, o.m); this.isIdentity = this.isIdentity2D(); return this; };
  DOMMatrix.prototype.preMultiplySelf = function (o) { this.m = mMul(o.m, this.m); this.isIdentity = this.isIdentity2D(); return this; };
  DOMMatrix.prototype.translate = function (x, y) { var t = mIdent(); t[6] = x; t[7] = y; return new DOMMatrix({ m: mMul(this.m, t) }); };
  DOMMatrix.prototype.translateSelf = function (x, y) { this.m = mMul(this.m, (function () { var t = mIdent(); t[6] = x; t[7] = y; return t; })()); this.isIdentity = this.isIdentity2D(); return this; };
  DOMMatrix.prototype.scale = function (sx, sy) {
    var s = mIdent(); s[0] = sx; s[4] = (sy === undefined ? sx : sy);
    return new DOMMatrix({ m: mMul(this.m, s) });
  };
  DOMMatrix.prototype.scaleSelf = function (sx, sy) {
    var s = mIdent(); s[0] = sx; s[4] = (sy === undefined ? sx : sy);
    this.m = mMul(this.m, s); this.isIdentity = this.isIdentity2D(); return this;
  };
  DOMMatrix.prototype.rotate = function (ang) {
    var c = Math.cos(ang), s = Math.sin(ang), r = mIdent();
    r[0] = c; r[1] = s; r[3] = -s; r[4] = c;
    return new DOMMatrix({ m: mMul(this.m, r) });
  };
  DOMMatrix.prototype.rotateSelf = function (ang) {
    var c = Math.cos(ang), s = Math.sin(ang), r = mIdent();
    r[0] = c; r[1] = s; r[3] = -s; r[4] = c;
    this.m = mMul(this.m, r); this.isIdentity = this.isIdentity2D(); return this;
  };
  DOMMatrix.prototype.skewX = function (x) { var t = mIdent(); t[3] = Math.tan(x); return new DOMMatrix({ m: mMul(this.m, t) }); };
  DOMMatrix.prototype.skewY = function (y) { var t = mIdent(); t[1] = Math.tan(y); return new DOMMatrix({ m: mMul(this.m, t) }); };
  DOMMatrix.prototype.skewXSelf = function (x) { var t = mIdent(); t[3] = Math.tan(x); this.m = mMul(this.m, t); this.isIdentity = this.isIdentity2D(); return this; };
  DOMMatrix.prototype.skewYSelf = function (y) { var t = mIdent(); t[1] = Math.tan(y); this.m = mMul(this.m, t); this.isIdentity = this.isIdentity2D(); return this; };
  DOMMatrix.prototype.flipX = function () { return this.scale(-1, 1); };
  DOMMatrix.prototype.flipY = function () { return this.scale(1, -1); };
  DOMMatrix.prototype.invert = function () {
    var m = this.m, det = m[0] * m[4] - m[1] * m[3];
    if (det === 0) return new DOMMatrix();
    var t = mIdent();
    t[0] = m[4] / det; t[1] = -m[1] / det; t[3] = -m[3] / det; t[4] = m[0] / det;
    t[6] = (m[3] * m[7] - m[4] * m[6]) / det;
    t[7] = (m[1] * m[6] - m[0] * m[7]) / det;
    return new DOMMatrix({ m: t });
  };
  DOMMatrix.prototype.invertSelf = function () {
    var inv = this.invert(); this.m = inv.m; this.isIdentity = this.isIdentity2D(); return this;
  };
  DOMMatrix.prototype.transformPoint = function (p) {
    var m = this.m;
    return { x: m[0] * p.x + m[3] * p.y + m[6], y: m[1] * p.x + m[4] * p.y + m[7], z: 0, w: 1 };
  };
  DOMMatrix.prototype.toFloat32Array = function () {
    var m = this.m;
    return new Float32Array([m[0], m[1], 0, 0, m[3], m[4], 0, 0, 0, 0, 1, 0, m[6], m[7], 0, 1]);
  };
  DOMMatrix.prototype.toFloat64Array = function () {
    var m = this.m;
    return new Float64Array([m[0], m[1], 0, 0, m[3], m[4], 0, 0, 0, 0, 1, 0, m[6], m[7], 0, 1]);
  };
  // define read/write accessors for a..f
  (function () {
    var props = [["a", 0], ["b", 1], ["c", 3], ["d", 4], ["e", 6], ["f", 7]];
    props.forEach(function (p) {
      Object.defineProperty(DOMMatrix.prototype, p[0], {
        enumerable: true,
        get: function () { return this.m[p[1]]; },
        set: function (v) { this.m[p[1]] = +v; this.isIdentity = this.isIdentity2D(); }
      });
    });
  })();

  // ---------------------------------------------------------------------------
  // color parsing
  // ---------------------------------------------------------------------------
  var KEYWORDS = {
    "aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4",
    "azure":"#f0ffff","beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd",
    "blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887","cadetblue":"#5f9ea0",
    "chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed",
    "cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff","darkblue":"#00008b","darkcyan":"#008b8b",
    "darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkgrey":"#a9a9a9",
    "darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f","darkorange":"#ff8c00",
    "darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f",
    "darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkslategrey":"#2f4f4f","darkturquoise":"#00ced1",
    "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dimgrey":"#696969",
    "dodgerblue":"#1e90ff","firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22",
    "fuchsia":"#ff00ff","gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520",
    "gray":"#808080","green":"#008000","greenyellow":"#adff2f","grey":"#808080","honeydew":"#f0fff0",
    "hotpink":"#ff69b4","indianred":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
    "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd",
    "lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
    "lightgray":"#d3d3d3","lightgreen":"#90ee90","lightgrey":"#d3d3d3","lightpink":"#ffb6c1",
    "lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899",
    "lightslategrey":"#778899","lightsteelblue":"#b0c4de","lightyellow":"#ffffe0","lime":"#00ff00",
    "limegreen":"#32cd32","linen":"#faf0e6","magenta":"#ff00ff","maroon":"#800000",
    "mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8",
    "mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee","mediumspringgreen":"#00fa9a",
    "mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa",
    "mistyrose":"#ffe4e1","moccasin":"#ffdead","navajowhite":"#ffdead","navy":"#000080",
    "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500",
    "orchid":"#da70d6","palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee",
    "palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f",
    "pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080","rebeccapurple":"#663399",
    "red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1","saddlebrown":"#8b4513","salmon":"#fa8072",
    "sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0",
    "skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","slategrey":"#708090","snow":"#fffafa",
    "springgreen":"#00ff7f","steelblue":"#4682b4","tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8",
    "tomato":"#ff6347","turquoise":"#40e0d0","violet":"#ee82ee","wheat":"#f5deb3","white":"#ffffff",
    "whitesmoke":"#f5f5f5","yellow":"#ffff00","yellowgreen":"#9acd32"
  };

  // CSS system color keywords — resolved at runtime via getComputedStyle.
  var SYSTEM_COLORS = [
    "canvas", "canvastext", "linktext", "visitedtext", "activetext",
    "buttonface", "buttontext", "buttonborder", "field", "fieldtext",
    "highlight", "highlighttext", "mark", "marktext",
    "selecteditem", "selecteditemtext", "graytext",
    "accentcolor", "accentcolortext"
  ];

  // The canvas element currently being rendered, for resolving currentColor
  // and system colors. Set by the context facade.
  var _colorCanvas = null;

  function resolveSystemColor(name) {
    if (!_colorCanvas || typeof getComputedStyle !== "function") return [0, 0, 0, 1];
    var probe = document.createElement("div");
    probe.style.color = name;
    probe.style.display = "none";
    _colorCanvas.appendChild(probe);
    var computed = getComputedStyle(probe).color;
    _colorCanvas.removeChild(probe);
    return colorToVec(computed);
  }

  function resolveCurrentColor() {
    if (!_colorCanvas || typeof getComputedStyle !== "function") return [0, 0, 0, 1];
    return colorToVec(getComputedStyle(_colorCanvas).color);
  }

  // ---- color() function: predefined RGB color space conversion to sRGB ----
  // gamma decode (undo companding) for each color space
  function lin_srgb(rgb) {
    return rgb.map(function (v) {
      var s = v < 0 ? -1 : 1, a = Math.abs(v);
      return s * (a <= 0.04045 ? a / 12.92 : Math.pow((a + 0.055) / 1.055, 2.4));
    });
  }
  function gam_srgb(rgb) {
    return rgb.map(function (v) {
      var s = v < 0 ? -1 : 1, a = Math.abs(v);
      return s * (a <= 0.0031308 ? 12.92 * a : 1.055 * Math.pow(a, 1 / 2.4) - 0.055);
    });
  }
  function lin_p3(rgb)    { return lin_srgb(rgb); }      // same transfer as sRGB
  function lin_a98(rgb)   { return rgb.map(function (v) { var s = v < 0 ? -1 : 1; return s * Math.pow(Math.abs(v), 256 / 563); }); }
  function lin_2020(rgb)  {
    var a = 0.07849922, b = 0.12303777;
    return rgb.map(function (v) {
      var s = v < 0 ? -1 : 1, x = Math.abs(v);
      return s * (x <= b ? 4.5 * x : Math.pow((x + a) / (1 + a), 2.4));
    });
  }
  function lin_prophoto(rgb) {
    var Et = 16 / 512;
    return rgb.map(function (v) {
      var s = v < 0 ? -1 : 1, a = Math.abs(v);
      return s * (a <= Et ? a / 16 : Math.pow(a, 1.8));
    });
  }

  function mat3_mul(m, v) {
    return [
      m[0][0]*v[0] + m[0][1]*v[1] + m[0][2]*v[2],
      m[1][0]*v[0] + m[1][1]*v[1] + m[1][2]*v[2],
      m[2][0]*v[0] + m[2][1]*v[1] + m[2][2]*v[2]
    ];
  }

  // linear RGB → XYZ (D65 unless noted)
  var TO_XYZ = {
    "srgb":          [[0.4123908,0.3575843,0.1804808],[0.2126390,0.7151687,0.0721923],[0.0193308,0.1191948,0.9505322]],
    "srgb-linear":   [[0.4123908,0.3575843,0.1804808],[0.2126390,0.7151687,0.0721923],[0.0193308,0.1191948,0.9505322]],
    "display-p3":    [[0.4865709,0.2656677,0.1982173],[0.2289746,0.6917385,0.0792859],[0.0000000,0.0451134,1.0439444]],
    "display-p3-linear": [[0.4865709,0.2656677,0.1982173],[0.2289746,0.6917385,0.0792859],[0.0000000,0.0451134,1.0439444]],
    "a98-rgb":       [[0.5766690,0.1855593,0.1882286],[0.2973430,0.6273640,0.0752881],[0.0270313,0.0706885,0.9913375]],
    "rec2020":       [[0.6369580,0.1446169,0.1688810],[0.2627002,0.6779981,0.0594516],[0.0000000,0.0280727,1.0608987]],
  };
  // XYZ (D50) for prophoto-rgb
  var TO_XYZ_D50 = {
    "prophoto-rgb":  [[0.7977666,0.1351812,0.0313463],[0.2880748,0.7118762,0.0000841],[0.0000000,0.0000000,0.8251046]],
  };
  // XYZ (D65) → linear sRGB
  var XYZ_TO_SRGB = [[3.2409699,-1.5373832,-0.4986108],[-0.9692436,1.8759675,0.0415551],[0.0556300,-0.2039770,1.0569715]];
  // Bradford D50→D65
  var D50_TO_D65 = [[ 1.0479298,-0.0228869,0.0032115],[0.0295360,0.9904622,0.0063758],[-0.0092369,0.0150514,0.7367966]];

  function colorFunctionToVec(space, r, g, b, a) {
    var lin;
    if (space === "xyz" || space === "xyz-d65") {
      lin = mat3_mul(XYZ_TO_SRGB, [r, g, b]);
    } else if (space === "xyz-d50") {
      lin = mat3_mul(XYZ_TO_SRGB, mat3_mul(D50_TO_D65, [r, g, b]));
    } else {
      var decode = {
        "srgb": lin_srgb, "srgb-linear": function(x){return x;},
        "display-p3": lin_p3, "display-p3-linear": function(x){return x;},
        "a98-rgb": lin_a98, "rec2020": lin_2020, "prophoto-rgb": lin_prophoto
      };
      var dec = decode[space];
      if (!dec) return null;
      var linRGB = dec([r, g, b]);
      var toXYZ = TO_XYZ[space] || TO_XYZ_D50[space];
      if (!toXYZ) return null;
      var xyz = mat3_mul(toXYZ, linRGB);
      // prophoto uses D50; adapt to D65 before converting to sRGB
      if (space === "prophoto-rgb") xyz = mat3_mul(D50_TO_D65, xyz);
      lin = mat3_mul(XYZ_TO_SRGB, xyz);
    }
    var srgb = gam_srgb(lin);
    return [clamp(srgb[0]), clamp(srgb[1]), clamp(srgb[2]), a];
  }

  function chnum(s) { return s.charAt(s.length - 1) === "%" ? parseFloat(s) / 100 : parseFloat(s) / 255; }
  function anum(s) { return s.charAt(s.length - 1) === "%" ? parseFloat(s) / 100 : parseFloat(s); }

  function colorToVec(value) {
    if (typeof value !== "string") return [0, 0, 0, 1];
    var v = value.trim().toLowerCase();
    var m;

    if ((m = /^#([0-9a-f]{6})$/.exec(v))) {
      var n = parseInt(m[1], 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }
    if ((m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v))) {
      return colorToVec("#" + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]);
    }
    if ((m = /^#([0-9a-f]{4})$/.exec(v))) {
      // #rgba
      return [parseInt(m[1][0], 16) / 15, parseInt(m[1][1], 16) / 15, parseInt(m[1][2], 16) / 15, parseInt(m[1][3], 16) / 15];
    }
    if ((m = /^#([0-9a-f]{8})$/.exec(v))) {
      // #rrggbbaa
      var q = parseInt(m[1], 16);
      return [((q >> 24) & 255) / 255, ((q >> 16) & 255) / 255, ((q >> 8) & 255) / 255, (q & 255) / 255];
    }
    if ((m = /^rgba?\(\s*(-?[\d.]+%?)\s*,\s*(-?[\d.]+%?)\s*,\s*(-?[\d.]+%?)(?:\s*,\s*([\d.]+%?))?\s*\)$/.exec(v))) {
      return [clamp(chnum(m[1])), clamp(chnum(m[2])), clamp(chnum(m[3])), m[4] === undefined ? 1 : anum(m[4])];
    }
    if ((m = /^rgba?\(\s*(-?[\d.]+%?)\s+(-?[\d.]+%?)\s+(-?[\d.]+%?)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(v))) {
      // space/slash form, e.g. rgb(255 0 0 / .5) or rgb(100% 0% 0%)
      return [clamp(chnum(m[1])), clamp(chnum(m[2])), clamp(chnum(m[3])), m[4] === undefined ? 1 : anum(m[4])];
    }
    if ((m = /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*,\s*(-?[\d.]+)%\s*,\s*(-?[\d.]+)%(?:\s*,\s*([\d.]+%?))?\s*\)$/.exec(v))) {
      return hslToVec(+m[1], +m[2] / 100, +m[3] / 100, m[4] === undefined ? 1 : anum(m[4]));
    }
    if ((m = /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s+(-?[\d.]+)%\s+(-?[\d.]+)%(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(v))) {
      // space/slash hsl form, e.g. hsl(120 50% 50%) or hsl(120 50% 50% / .5)
      return hslToVec(+m[1], +m[2] / 100, +m[3] / 100, m[4] === undefined ? 1 : anum(m[4]));
    }
    if (v === "transparent") return [0, 0, 0, 0];
    if (v === "currentcolor") return resolveCurrentColor();
    if (SYSTEM_COLORS.indexOf(v) >= 0) return resolveSystemColor(v);
    if ((m = /^color\(\s*([\w-]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(v))) {
      var cv = colorFunctionToVec(m[1].toLowerCase(), +m[2], +m[3], +m[4], m[5] === undefined ? 1 : anum(m[5]));
      if (cv) return cv;
    }
    if (v in KEYWORDS) return colorToVec(KEYWORDS[v]);
    return [0, 0, 0, 1]; // default black on unknown
  }

  function clamp(x) {
    return x < 0 ? 0 : (x > 1 ? 1 : x);
  }

  function hslToVec(h, s, l, a) {
    h = ((h % 360) + 360) % 360 / 360;
    var r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r, g, b, clamp(a)];
  }
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function vecToColor(c) {
    return "rgba(" + Math.round(c[0] * 255) + ", " + Math.round(c[1] * 255) + ", " + Math.round(c[2] * 255) + ", " + c[3] + ")";
  }// ---------------------------------------------------------------------------
  // tessellation / geometry helpers
  // ---------------------------------------------------------------------------

  // Subdivide a curve/line into a flat vertex list of [x,y,...].
  // Each returned array is a list of points [ [x,y], [x,y], ... ].

  // Adaptive (flatness-based) tessellation. Recursively subdivide a curve until the
  // control points are within `tol` of the chord, so we use the minimum vertices that
  // look smooth at screen scale. tolerance is in the current (user-space) units.

  var CURVE_TOL = 0.5;

  function flatEnoughQuad(x0, y0, x1, y1, x2, y2, tol) {
    // distance of control point to the chord line
    var vx = x2 - x0, vy = y2 - y0;
    var len = Math.sqrt(vx * vx + vy * vy);
    if (len < 1e-9) return Math.hypot(x1 - x0, y1 - y0) < tol;
    var dist = Math.abs(vx * (y0 - y1) - vy * (x0 - x1)) / len;
    return dist < tol;
  }
  function flattenQuad(x0, y0, x1, y1, x2, y2, out, depth) {
    if (depth > 20 || flatEnoughQuad(x0, y0, x1, y1, x2, y2, CURVE_TOL)) {
      out.push([x2, y2]);
      return;
    }
    var mx = (x0 + 2 * x1 + x2) / 4, my = (y0 + 2 * y1 + y2) / 4; // midpoint on curve (de casteljau t=.5)
    // split control points
    var ax = (x0 + x1) / 2, ay = (y0 + y1) / 2;
    var bx = (x1 + x2) / 2, by = (y1 + y2) / 2;
    flattenQuad(x0, y0, ax, ay, mx, my, out, depth + 1);
    flattenQuad(mx, my, bx, by, x2, y2, out, depth + 1);
  }
  function quadraticToPoints(x0, y0, cx, cy, x1, y1) {
    var out = [[x0, y0]];
    flattenQuad(x0, y0, cx, cy, x1, y1, out, 0);
    return out;
  }

  function flatEnoughCubic(x0, y0, x1, y1, x2, y2, x3, y3, tol) {
    var vx = x3 - x0, vy = y3 - y0;
    var len = Math.sqrt(vx * vx + vy * vy);
    if (len < 1e-9) return Math.max(Math.hypot(x1 - x0, y1 - y0), Math.hypot(x2 - x0, y2 - y0)) < tol;
    var nx = -vy / len, ny = vx / len;   // unit normal to chord
    var d1 = Math.abs((x1 - x0) * nx + (y1 - y0) * ny);
    var d2 = Math.abs((x2 - x0) * nx + (y2 - y0) * ny);
    return Math.max(d1, d2) < tol;
  }
  function flattenCubic(x0, y0, x1, y1, x2, y2, x3, y3, out, depth) {
    if (depth > 22 || flatEnoughCubic(x0, y0, x1, y1, x2, y2, x3, y3, CURVE_TOL)) {
      out.push([x3, y3]);
      return;
    }
    // de Casteljau split at t=.5
    var a1x = (x0 + x1) / 2, a1y = (y0 + y1) / 2;
    var a2x = (x1 + x2) / 2, a2y = (y1 + y2) / 2;
    var a3x = (x2 + x3) / 2, a3y = (y2 + y3) / 2;
    var b1x = (a1x + a2x) / 2, b1y = (a1y + a2y) / 2;
    var b2x = (a2x + a3x) / 2, b2y = (a2y + a3y) / 2;
    var cx = (b1x + b2x) / 2, cy = (b1y + b2y) / 2;
    flattenCubic(x0, y0, a1x, a1y, b1x, b1y, cx, cy, out, depth + 1);
    flattenCubic(cx, cy, b2x, b2y, a3x, a3y, x3, y3, out, depth + 1);
  }
  function cubicToPoints(x0, y0, c1x, c1y, c2x, c2y, x1, y1) {
    var out = [[x0, y0]];
    flattenCubic(x0, y0, c1x, c1y, c2x, c2y, x1, y1, out, 0);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Skia GPU-tessellator arc resolution. Canvas arcs become cubic segments; the
  // resolved tessellation level comes from Wang's formula (see Skia's
  // gr/gpu/tessellate/WangsFormula.h) with kPrecision=4 ("worst-case 1/4 px error")
  // and kMaxResolveLevel=5. Each <=90deg cubic arc is emitted as 2^level segments,
  // sampled at dyadic t (identical to the curve evaluated at t=i/2^level), which is
  // exactly the inscribed polygon native Chrome rasterizes.
  // ---------------------------------------------------------------------------
  function wangNextLog2(x) {
    if (x <= 1) return 0;
    var f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
    f32[0] = x;
    var bits = u32[0] + ((1 << 23) - 1);
    var e = ((bits >>> 23) & 0xff) - 127;
    return e > 0 ? e : 0;
  }
  function wangNextLog16(x) { return (wangNextLog2(x) + 3) >> 2; }
  // Resolve level of the quarter-circle cubic with radius r (device px).
  function wangArcLevel(r) {
    var K = 0.5522847498307934;
    var q = [ [r, 0], [r, K * r], [K * r, r], [0, r] ];
    function vv(a, b, c) { var dx = -2 * b[0] + a[0] + c[0], dy = -2 * b[1] + a[1] + c[1]; return dx * dx + dy * dy; }
    var m = Math.max(vv(q[0], q[1], q[2]), vv(q[1], q[2], q[3]));
    var kk = (3 * 3 * 2 * 2) / 64 * (4 * 4); // length_term_p2<3>(kPrecision=4)
    var L = wangNextLog16(m * kk);
    if (L > 5) L = 5;   // kMaxResolveLevel
    return L;
  }
  // Number of segments to sample an arc of `sweep` radians at radius `r`.
  function wangArcSegments(r, sweep) {
    var L = wangArcLevel(r);
    var perQuarter = 1 << L;
    var quarters = Math.abs(sweep) / (Math.PI / 2);
    var n = Math.ceil(quarters) * perQuarter;
    return Math.max(4, n);
  }

  // Evaluate the cubic B(p0,p1,p2,p3) at t.
  function cubicEval(p0, p1, p2, p3, t) {
    var u = 1 - t;
    var a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
            a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  }

  // arc -> list of [x,y] sampled points. Faithful to Skia: each <=90deg piece of
  // the arc is turned into the equivalent circle cubic, and its tessellation level
  // is the Wang's resolve level; vertices are exactly B(i/2^level) -- the inscribed
  // polygon native renders.
  function arcToPointsCenter(x, y, r, start, end, anticlockwise) {
    if (anticlockwise) { while (end > start) end -= M_TWO_PI; }
    else { while (end < start) end += M_TWO_PI; }

    var sweep = end - start;
    var L = wangArcLevel(r);
    var seg = 1 << L;
    var dir = sweep < 0 ? -1 : 1;
    var total = Math.abs(sweep);
    var pts = [];
    var offset = 0;
    var first = true;
    while (offset < total - 1e-9) {
      var span = Math.min(Math.PI / 2, total - offset);
      var a0 = start + dir * offset, a1 = a0 + dir * span;
      var p0 = [x + r * Math.cos(a0), y + r * Math.sin(a0)];
      var p3 = [x + r * Math.cos(a1), y + r * Math.sin(a1)];
      var d = dir * (4 / 3) * r * Math.tan(span / 4);
      var p1 = [p0[0] - d * Math.sin(a0), p0[1] + d * Math.cos(a0)];
      var p2 = [p3[0] + d * Math.sin(a1), p3[1] - d * Math.cos(a1)];
      if (first) { pts.push(p0); first = false; }
      for (var i = 1; i <= seg; i++) {
        var P = cubicEval(p0, p1, p2, p3, i / seg);
        pts.push(P);
      }
      offset += span;
    }
    return pts;
  }

  // arcTo: given current point (x0,y0), points (x1,y1),(x2,y2), radius r,
  // returns { cx, cy, a0, a1 } or null if nothing to draw.
  function arcToGeometry(x0, y0, x1, y1, x2, y2, r) {
    var a0x = x0 - x1, a0y = y0 - y1;
    var a2x = x2 - x1, a2y = y2 - y1;
    var d01 = Math.sqrt(a0x * a0x + a0y * a0y);
    var d21 = Math.sqrt(a2x * a2x + a2y * a2y);
    if (d01 === 0 || d21 === 0 || r <= 0) return null;

    var u0x = a0x / d01, u0y = a0y / d01;
    var u2x = a2x / d21, u2y = a2y / d21;

    var dot = Math.max(-1, Math.min(1, u0x * u2x + u0y * u2y));
    var ang = Math.acos(dot);
    if (ang === 0 || Math.abs(ang - M_PI) < 1e-9) return null;

    var d = r / Math.tan(ang / 2); // distance from tangent-intersect to each tangent point

    var t0 = d / d01, t2 = d / d21;
    var px = x1 + u0x * t0 * d01, py = y1 + u0y * t0 * d01; // tangent point on (x0-x1) side
    // simpler: tangent points along the two lines from (x1,y1)
    var p1x = x1 + u0x * d, p1y = y1 + u0y * d;
    var p2x = x1 + u2x * d, p2y = y1 + u2y * d;

    // center: along the angle bisector, at distance so it is r from the tangent lines
    var bisx = u0x + u2x, bisy = u0y + u2y;
    var bl = Math.sqrt(bisx * bisx + bisy * bisy);
    if (bl === 0) return null;
    bisx /= bl; bisy /= bl;
    // center distance from (x1,y1) along bisector = r / sin(ang/2)
    var cdist = r / Math.sin(ang / 2);
    var cx = x1 + bisx * cdist, cy = y1 + bisy * cdist;

    var a0 = Math.atan2(p1y - cy, p1x - cx);
    var a1 = Math.atan2(p2y - cy, p2x - cx);
    return { cx: cx, cy: cy, a0: a0, a1: a1, ccw: false };
  }

  // rect -> list of [x,y]
  function rectPoints(x, y, w, h) {
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  }

  // ellipse -> list of sampled [x,y]; rotation in radians
  function ellipsePoints(x, y, rx, ry, rotation, start, end, anticlockwise) {
    if (anticlockwise) { while (end > start) end -= M_TWO_PI; }
    else { while (end < start) end += M_TWO_PI; }
    var sweep = end - start;
    var n = wangArcSegments(Math.max(rx, ry), sweep);
    var c = Math.cos(rotation), s = Math.sin(rotation);
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = start + sweep * i / n;
      var ct = Math.cos(t), st = Math.sin(t);
      pts.push([x + rx * ct * c - ry * st * s, y + rx * ct * s + ry * st * c]);
    }
    return pts;
  }

  // point-in-polygon (even-odd) for isPointInPath(x, y)
  function pointInPolygon(px, py, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      var intersect = ((yi > py) !== (yj > py)) &&
                      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // distance from point (px,py) to segment a->b
  function distToSegment(px, py, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay;
    var wx = px - ax, wy = py - ay;
    var len2 = vx * vx + vy * vy;
    var t = len2 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
    var qx = ax + t * vx, qy = ay + t * vy;
    return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
  }// ---------------------------------------------------------------------------
  // Renderer: WebGL2 pipeline
  // ---------------------------------------------------------------------------
  var MASK_SOLID = 0;
  var MASK_TEXT = 1;
  var MASK_CROP = 2;
  var MASK_GRAD = 4;
  var MASK_PATTERN = 8;
  var MASK_COV = 16; // OR'd into a fill mask: multiply output by a coverage mask
                     // (device-space alpha texture). Used for text: the fill's
                     // color comes from the base mask, the glyph shape from cov.

  // Transform a fill fragment source into its coverage variant: declare the
  // coverage sampler + its device-space rect, and multiply the final output's
  // alpha by the sampled coverage. Every fill shader writes its result to `o`
  // and is straight-alpha, so scaling o.a (and the premultiplied rgb*a stays
  // consistent because these shaders output straight color) applies coverage.
  function withCoverage(src) {
    // Sample the coverage mask by the quad's interpolated UV (vUV), which the
    // vertex shader carries through ANY CTM — rotation and skew included — so
    // rotated text works. (An earlier device-space gl_FragCoord approach only
    // handled translate+scale and collapsed under rotation.) The mask's V axis
    // is top-down (from getImageData); vUV.y is 0 at the box top, so no flip.
    // Declare `in vec2 vUV;` only if the base shader didn't already (TEXT does).
    if (src.indexOf("in vec2 vUV;") === -1) {
      src = src.replace(/(precision[^\n]*\n)/, "$1in vec2 vUV;\n");
    }
    src = src.replace(/(precision[^\n]*\n)/, "$1uniform sampler2D uCovTex;\n");
    src = src.replace(/\}\s*$/,
      "  float cov = (vUV.x < 0.0 || vUV.x > 1.0 || vUV.y < 0.0 || vUV.y > 1.0) ? 0.0 : texture(uCovTex, vUV).a;\n" +
      "  o *= cov;\n" +
      "}");
    return src;
  }

  // Fragment source for pattern (tiled image) fills. Like gradients, it samples
  // in user space (vPos), so the pattern transforms with the CTM. The pattern's
  // own setTransform() matrix (pattern space -> user space) is applied as its
  // inverse, then the position is divided by the texture size to get tile UVs.
  // wrap mode on the texture provides repeat; the non-repeating axis is clamped
  // and out-of-[0,1] samples on that axis are discarded (transparent).
  var PATTERN_FS = [
    "#version 300 es",
    "precision highp float;",
    "in vec2 vPos;",
    "uniform vec4 uColor;",         // globalAlpha multiplier
    "uniform sampler2D uPattern;",
    "uniform vec2 uPatSize;",       // texture size in px
    "uniform mat3 uPatInv;",        // inverse of pattern-space transform (user->pattern)
    "uniform int uRepeatX;",        // 1 if the pattern repeats on X, else 0
    "uniform int uRepeatY;",
    "out vec4 o;",
    "void main(){",
    "  vec3 pp = uPatInv * vec3(vPos, 1.0);",
    "  vec2 uv = pp.xy / uPatSize;",
    // On a non-repeating axis, anything outside one tile is fully transparent.
    "  if (uRepeatX == 0 && (uv.x < 0.0 || uv.x > 1.0)) { o = vec4(0.0); return; }",
    "  if (uRepeatY == 0 && (uv.y < 0.0 || uv.y > 1.0)) { o = vec4(0.0); return; }",
    "  o = texture(uPattern, uv) * uColor;",
    "}"
  ].join("\n");

  // Fragment source for gradient fills. Interpolates the gradient color from the
  // per-fragment user-space position (vPos), which is the CTM's domain, so the
  // gradient transforms together with the shape. handles both linear and radial
  // (including the general two-center cone case) via an analytic solve.
  // Lookup-texture resolution for the gradient color ramp (like native: the ramp is
  // baked into a 1D texture, so there is no fixed cap on the number of color stops).
  var GRAD_LUT_SIZE = 1024;
  var GRAD_FS = [
    "#version 300 es",
    "precision highp float;",
    "in vec2 vPos;",
    "uniform vec4 uColor;",
    "uniform int uGradType;",
    "uniform vec4 uGradA;",
    "uniform float uGradR0;",
    "uniform float uGradR1;",
    "uniform sampler2D uGradTex;",
    "out vec4 o;",
    "void main(){",
    "  float t;",
    "  if (uGradType == 0){",
    "    vec2 p0 = uGradA.xy, p1 = uGradA.zw;",
    "    vec2 d = p1 - p0;",
    "    float len2 = dot(d,d);",
    "    t = (len2 < 1e-6) ? 1.0 : dot(vPos - p0, d)/len2;",
    "    t = clamp(t, 0.0, 1.0);",
    "  } else if (uGradType == 2){",
    // conic: color by angle around center (uGradA.xy), measured clockwise from the
    // positive x-axis, starting at uGradA.z (startAngle). Wraps once around [0,1).
    "    vec2 rel = vPos - uGradA.xy;",
    "    t = (atan(rel.y, rel.x) - uGradA.z) * 0.159154943;", // / (2*pi)
    "    t = t - floor(t);",
    "  } else {",
    "    vec2 c0 = uGradA.xy, c1 = uGradA.zw;",
    "    float r0 = max(uGradR0, 0.0), r1 = max(uGradR1, 0.0);",
    "    vec2 f = c1 - c0;",
    "    float dr = r1 - r0;",
    "    float d2 = dot(f,f);",
    "    if (abs(dr) < 1e-6 && d2 > 1e-12){",
    // cylinder: equal radii, distinct centers -> nearest projection on the axis
    "      float denom = max(d2, 1e-12);",
    "      t = clamp(dot(vPos - c0, f)/denom, 0.0, 1.0);",
    "    } else if (d2 < 1e-12){",
    // concentric (or coincident centers)
    "      if (abs(dr) < 1e-6) t = 1.0;",
    "      else { float d = distance(vPos, c0); t = (d - r0)/dr; t = clamp(t, 0.0, 1.0); }",
    "    } else {",
    // general cone. Solve |p - t*f| = r0 + t*dr  (squared) for the interpolating
    // circle through the fragment. Prefer the SMALLER in-range root: that is the
    // front sheet of the frustum between the two circles (matches the browser).
    "      vec2 p = vPos - c0;",
    "      float A = d2 - dr*dr;",
    "      float B = -2.0*(dot(p,f) + r0*dr);",
    "      float C = dot(p,p) - r0*r0;",
    "      float det = B*B - 4.0*A*C;",
    "      if (det < 0.0) t = 1.0;",
    "      else if (abs(A) < 1e-9){ t = (abs(B) < 1e-9) ? 0.0 : clamp(-C/B, 0.0, 1.0); }",
    "      else {",
    "        float sq = sqrt(det);",
    "        float ta = (-B - sq)/(2.0*A);",
    "        float tb = (-B + sq)/(2.0*A);",
    "        bool inA = (ta >= 0.0 && ta <= 1.0);",
    "        bool inB = (tb >= 0.0 && tb <= 1.0);",
    "        if (inA && inB) t = min(ta, tb);",
    "        else if (inA) t = ta;",
    "        else if (inB) t = tb;",
    "        else t = clamp((ta + tb) * 0.5, 0.0, 1.0);",
    "      }",
    "      t = clamp(t, 0.0, 1.0);",
    "    }",
    "  }",
    "  o = texture(uGradTex, vec2(t, 0.5)) * uColor;",
    "}"
  ].join("\n");

  // float32 -> float16 (half) bit layout, used to build the gradient ramp texture.
  // Dot-product style, no rounding (precision is plenty for ramp colors).
  function f32tof16(f) {
    var buf = new ArrayBuffer(4), f32 = new Float32Array(buf), u32 = new Uint32Array(buf);
    f32[0] = f;
    var u = u32[0];
    var sign = (u >> 16) & 0x8000;
    var exp = ((u >> 23) & 0xff) - 127 + 15;
    var frac = u & 0x7fffff;
    if (((u >> 23) & 0xff) === 0) return sign;                    // zero/subnormal -> 0
    if (((u >> 23) & 0xff) === 0xff) return sign | 0x7c00;        // inf/nan -> inf
    if (exp >= 31) return sign | 0x7c00;                          // overflow -> inf
    if (exp <= 0) {                                               // subnormal half
      frac = frac | 0x800000;
      var s = 14 - exp;
      if (s >= 24) return sign;
      return sign | (frac >> s);
    }
    return sign | (exp << 10) | (frac >> 13);
  }
  // ---- OKLab color conversion (BjÃ¶rn Ottosson). sRGB (gamma-encoded) <-> OKLab.
  // Used to interpolate gradient color stops in the "oklab" color space, matching
  // the CSS/Canvas `interpolateColorSpace: "oklab"` behavior. Returns [r,g,b].
  function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function linearToSrgb(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function srgb2oklab(rgb) {
    var r = srgbToLinear(rgb[0]), g = srgbToLinear(rgb[1]), b = srgbToLinear(rgb[2]);
    var l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    var m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    var s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    var l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
    return [
      0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    ];
  }
  function oklab2srgb(lab) {
    var l_ = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2];
    var m_ = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2];
    var s_ = lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2];
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [
      clamp(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
      clamp(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
      clamp(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s))
    ];
  }
  // interpolate two RGBA colors at factor f in the given color space
  function lerpColor(a, b, f, space) {
    if (space === "oklab") {
      var la = srgb2oklab(a), lb = srgb2oklab(b);
      var r = [
        la[0] + (lb[0] - la[0]) * f,
        la[1] + (lb[1] - la[1]) * f,
        la[2] + (lb[2] - la[2]) * f,
        a[3] + (b[3] - a[3]) * f
      ];
      var rgb = oklab2srgb([r[0], r[1], r[2]]);
      return [rgb[0], rgb[1], rgb[2], r[3]];
    }
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f,
            a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
  }
  // color at ramp position t from the (sorted) stop list; nearest-stop for hard edges.
  function gradColorAt(stops, t, space) {
    if (!stops || stops.length === 0) return [0, 0, 0, 0];
    if (stops.length === 1) return stops[0].c;
    if (t <= stops[0].off) return stops[0].c;
    if (t >= stops[stops.length - 1].off) return stops[stops.length - 1].c;
    for (var k = 0; k < stops.length - 1; k++) {
      var o0 = stops[k].off, o1 = stops[k + 1].off;
      if (t < o1) {
        var f = (o1 - o0 === 0) ? 0 : (t - o0) / (o1 - o0);
        return lerpColor(stops[k].c, stops[k + 1].c, f, space);
      }
    }
    return stops[stops.length - 1].c;
  }

  function Renderer(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;

    this.transform = new Transform();

    this.shaderPool = {};
    this.rectVBO = gl.createBuffer();
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.smoothing = true;
    this._colorSpace = "srgb";

    // projection: canvas(px) -> clip space [-1,1], y-down
    this.proj = [
      2 / canvas.width, 0, 0,
      0, -2 / canvas.height, 0,
      -1, 1, 1
    ];
  }

  Renderer.prototype.shader = function (mask) {
    var gl = this.gl;
    var cached = this.shaderPool[mask];
    if (cached) return cached;

    var vsSource = [
      "#version 300 es",
      "layout(location=0) in vec2 aPos;",
      "layout(location=1) in vec2 aUV;",
      "uniform mat3 uMVP;",
      "out vec2 vUV;",
      "out vec2 vPos;",
      "void main(){",
      "  vUV = aUV;",
      "  vPos = aPos;",
      "  vec3 p = uMVP * vec3(aPos, 1.0);",
      "  gl_Position = vec4(p, 1.0);",
      "}"
    ].join("\n");

    var hasCov = !!(mask & MASK_COV);
    var base = mask & ~MASK_COV;
    var fsBody;
    if (base === MASK_SOLID) {
      fsBody = [
        "#version 300 es",
        "precision mediump float;",
        "uniform vec4 uColor;",
        "out vec4 o;",
        "void main(){ o = uColor; }"
      ].join("\n");
    } else if (base === MASK_GRAD) {
      fsBody = GRAD_FS;
    } else if (base === MASK_PATTERN) {
      fsBody = PATTERN_FS;
    } else {
      fsBody = [
        "#version 300 es",
        "precision mediump float;",
        "in vec2 vUV;",
        "uniform vec4 uColor;",
        "uniform sampler2D uSampler;",
        "out vec4 o;",
        base & MASK_CROP
          ? "uniform vec4 uCrop; void main(){ vec2 uv = vec2(vUV.x * uCrop.z, vUV.y * uCrop.w) + uCrop.xy; o = texture(uSampler, uv) * uColor; }"
          : "void main(){ o = texture(uSampler, vUV) * uColor; }"
      ].join("\n");
    }
    if (hasCov) fsBody = withCoverage(fsBody);

    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsBody);
    gl.compileShader(fs);

    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw "vs: " + gl.getShaderInfoLog(vs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw "fs: " + gl.getShaderInfoLog(fs);

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw "link: " + gl.getProgramInfoLog(prog);

    prog.uMVP = gl.getUniformLocation(prog, "uMVP");
    prog.uColor = gl.getUniformLocation(prog, "uColor");
    prog.uSampler = gl.getUniformLocation(prog, "uSampler");
    prog.uCrop = gl.getUniformLocation(prog, "uCrop");
    if (base === MASK_GRAD) {
      prog.uGradType = gl.getUniformLocation(prog, "uGradType");
      prog.uGradA = gl.getUniformLocation(prog, "uGradA");
      prog.uGradR0 = gl.getUniformLocation(prog, "uGradR0");
      prog.uGradR1 = gl.getUniformLocation(prog, "uGradR1");
      prog.uGradTex = gl.getUniformLocation(prog, "uGradTex");
    }
    if (base === MASK_PATTERN) {
      prog.uPattern = gl.getUniformLocation(prog, "uPattern");
      prog.uPatSize = gl.getUniformLocation(prog, "uPatSize");
      prog.uPatInv = gl.getUniformLocation(prog, "uPatInv");
      prog.uRepeatX = gl.getUniformLocation(prog, "uRepeatX");
      prog.uRepeatY = gl.getUniformLocation(prog, "uRepeatY");
    }
    if (hasCov) {
      prog.uCovTex = gl.getUniformLocation(prog, "uCovTex");
    }

    this.shaderPool[mask] = prog;
    return prog;
  };

  // Get (and lazily build) the 1D lookup texture for a gradient's color ramp.
  // The ramp is baked from however many color stops there are (unlimited) into a
  // half-float LUT, so resolution/precision don't depend on stop count. Interpolated
  // in the current color space (see _colorSpace); a gradient caches one LUT per space.
  Renderer.prototype.gradLUT = function (g) {
    var gl = this.gl;
    var n = GRAD_LUT_SIZE;
    var lab = this._colorSpace === "oklab";
    var key = lab ? "_lutLab" : "_lut";
    if (g[key]) return g[key];
    var data = new Uint16Array(n * 4);
    for (var i = 0; i < n; i++) {
      var c = gradColorAt(g.stops, (i + 0.5) / n, lab ? "oklab" : "srgb");
      data[i * 4] = f32tof16(c[0]);
      data[i * 4 + 1] = f32tof16(c[1]);
      data[i * 4 + 2] = f32tof16(c[2]);
      data[i * 4 + 3] = f32tof16(c[3]);
    }
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, n, 1, 0, gl.RGBA, gl.HALF_FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    g[key] = tex;
    return tex;
  };

  // Bind a gradient's params + ramp texture to a compiled gradient program `prog`.
Renderer.prototype.applyGrad = function (prog, g, unit) {
    var gl = this.gl;
    if (unit === undefined) unit = 0;
    gl.uniform1i(prog.uGradType, g.type === "radial" ? 1 : (g.type === "conic" ? 2 : 0));
    if (g.type === "radial") {
      gl.uniform4f(prog.uGradA, g.c0x, g.c0y, g.c1x, g.c1y);
      gl.uniform1f(prog.uGradR0, g.r0);
      gl.uniform1f(prog.uGradR1, g.r1);
    } else if (g.type === "conic") {
      gl.uniform4f(prog.uGradA, g.cx, g.cy, g.startAngle, 0);
    } else {
      gl.uniform4f(prog.uGradA, g.p0x, g.p0y, g.p1x, g.p1y);
    }
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.gradLUT(g));
    gl.uniform1i(prog.uGradTex, unit);
  };

  // Draw flat triangles filled with a gradient. color is the globalAlpha multiplier.
  Renderer.prototype.drawGrad = function (positions, grad, color) {
    var gl = this.gl;
    var count = positions.length / 2;
    if (!count) return;
    var data = new Float32Array(count * 4);
    for (var i = 0; i < count; i++) {
      data[i * 4] = positions[i * 2];
      data[i * 4 + 1] = positions[i * 2 + 1];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    var prog = this.shader(MASK_GRAD);
    gl.useProgram(prog);
    gl.enableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.uniformMatrix3fv(prog.uMVP, false, mMul(this.proj, this.transform.m));
    gl.uniform4f(prog.uColor, color[0], color[1], color[2], color[3]);
    this.applyGrad(prog, grad);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  };

  // Bind a CanvasPattern's texture + uniforms into a MASK_PATTERN program.
  Renderer.prototype.applyPattern = function (prog, pat, unit) {
    var gl = this.gl;
    if (unit === undefined) unit = 0;
    // pattern-space -> user-space affine, column-major 3x3 (identity if unset)
    var pm = pat.matrix
      ? [pat.matrix[0], pat.matrix[1], 0, pat.matrix[2], pat.matrix[3], 0, pat.matrix[4], pat.matrix[5], 1]
      : mIdent();
    gl.uniformMatrix3fv(prog.uPatInv, false, mInv3(pm));
    gl.uniform2f(prog.uPatSize, pat.w, pat.h);
    gl.uniform1i(prog.uRepeatX, (pat.repeat === "repeat" || pat.repeat === "repeat-x") ? 1 : 0);
    gl.uniform1i(prog.uRepeatY, (pat.repeat === "repeat" || pat.repeat === "repeat-y") ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, pat.tex);
    gl.uniform1i(prog.uPattern, unit);
  };

  // Draw flat triangles filled with a tiled pattern. color = globalAlpha multiplier.
  Renderer.prototype.drawPattern = function (positions, pat, color) {
    var gl = this.gl;
    var count = positions.length / 2;
    if (!count) return;
    var data = new Float32Array(count * 4);
    for (var i = 0; i < count; i++) {
      data[i * 4] = positions[i * 2];
      data[i * 4 + 1] = positions[i * 2 + 1];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    var prog = this.shader(MASK_PATTERN);
    gl.useProgram(prog);
    gl.enableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.uniformMatrix3fv(prog.uMVP, false, mMul(this.proj, this.transform.m));
    gl.uniform4f(prog.uColor, color[0], color[1], color[2], color[3]);
    this.applyPattern(prog, pat);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  };

  // getImageData readback: the drawing buffer holds premultiplied, bottom-up
  // pixels; ImageData needs straight alpha, top-down. Both the unpremultiply
  // divide and the Y-flip used to run as a per-pixel JS loop after readPixels;
  // doing them here as a fragment shader pass instead means readPixels reads
  // already-correct data straight into the output buffer, no CPU loop at all.
  Renderer.prototype.unpremultShader = function () {
    var gl = this.gl;
    if (this._unpremultProg) return this._unpremultProg;
    var vs = [
      "#version 300 es",
      "layout(location=0) in vec2 aPos;",
      "out vec2 vUV;",
      // flip V here so the shader reads bottom-up device pixels but writes
      // top-down into the output texture -- readPixels needs no further flip.
      "void main(){ vUV = vec2(aPos.x*0.5+0.5, 0.5-aPos.y*0.5); gl_Position = vec4(aPos,0,1); }"
    ].join("\n");
    var fs = [
      "#version 300 es",
      "precision highp float;",
      "uniform sampler2D uTex;",
      "in vec2 vUV;",
      "out vec4 o;",
      "void main(){",
      "  vec4 p = texture(uTex, vUV);",
      "  o = vec4(p.a > 0.0 ? min(vec3(1.0), p.rgb / p.a) : vec3(0.0), p.a);",
      "}"
    ].join("\n");
    var p = gl.createProgram();
    var v = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(v, vs); gl.compileShader(v);
    var f = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(f, fs); gl.compileShader(f);
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    p.uTex = gl.getUniformLocation(p, "uTex");
    this._unpremultProg = p;
    return p;
  };
  // Read back a (sx,sy,sw,sh) device-space region as straight-alpha, top-down
  // RGBA bytes -- ready to hand straight to an ImageData's .data.
  Renderer.prototype.readImageDataGPU = function (sx, sytop, sw, sh, out) {
    var gl = this.gl;
    if (!this._ridTex || this._ridW !== sw || this._ridH !== sh) {
      if (this._ridTex) gl.deleteTexture(this._ridTex);
      if (this._ridSrcTex) gl.deleteTexture(this._ridSrcTex);
      if (this._ridFBO) gl.deleteFramebuffer(this._ridFBO);
      this._ridSrcTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._ridSrcTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._ridTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._ridTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._ridFBO = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._ridFBO);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._ridTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this._ridW = sw; this._ridH = sh;
    }
    // Copy the requested region out of the drawing buffer (still premultiplied,
    // bottom-up) into a same-size texture we can sample from. copyTexSubImage2D
    // (not blitFramebuffer) because the default framebuffer here is implicitly
    // multisampled (antialias:true) and drivers vary on rejecting a multisample
    // resolve blit for very small regions -- copyTexSubImage2D has no such
    // restriction and implicitly resolves too.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, this._ridSrcTex);
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, sx, sytop, sw, sh);
    // run the unpremultiply+flip pass into the second texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._ridFBO);
    gl.viewport(0, 0, sw, sh);
    var wasBlend = gl.isEnabled(gl.BLEND);
    gl.disable(gl.BLEND);
    var prog = this.unpremultShader();
    gl.useProgram(prog);
    if (!this._ridVBO) this._ridVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._ridVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._ridSrcTex);
    gl.uniform1i(prog.uTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (wasBlend) gl.enable(gl.BLEND);
    // out is already straight-alpha, top-down -- hand straight to ImageData.data
    gl.readPixels(0, 0, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // the unpremultiply pass above set the viewport to sw x sh -- restore it to
    // the full canvas, or every draw call after a getImageData() renders into
    // that leftover small viewport instead of the real framebuffer size.
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };
  // Upload a text coverage mask (RGBA where alpha = glyph coverage) as a texture.
  Renderer.prototype.uploadCoverage = function (data, w, h) {
    var gl = this.gl;
    if (!this._covTex) this._covTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._covTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return this._covTex;
  };

  // Draw a text run: fill `positions` (the run's bounding-box triangles, in user
  // space) with `style` (color array / gradient / pattern), masked by the glyph
  // coverage texture. `covRect` = [x, y, w, h] of the mask in device px, with y
  // measured from the BOTTOM (to match gl_FragCoord). The coverage sampler lives
  // on texture unit 3 so it never clashes with gradient/pattern samplers.
  var COV_UNIT = 3;
  // `uv` is the per-vertex coverage UV (0..1 across the text box), same length
  // as positions. Sampling by interpolated UV makes rotated/skewed text work.
  Renderer.prototype.drawTextRun = function (positions, style, mult, covTex, uv) {
    var gl = this.gl;
    var count = positions.length / 2;
    if (!count) return;
    var isGrad = style && style._isGradient;
    var isPat = style && style._isPattern;
    var baseMask = isGrad ? MASK_GRAD : (isPat ? MASK_PATTERN : MASK_SOLID);
    var prog = this.shader(baseMask | MASK_COV);
    var data = new Float32Array(count * 4);
    for (var i = 0; i < count; i++) {
      data[i*4] = positions[i*2]; data[i*4+1] = positions[i*2+1];
      data[i*4+2] = uv[i*2]; data[i*4+3] = uv[i*2+1];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    gl.useProgram(prog);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.uniformMatrix3fv(prog.uMVP, false, mMul(this.proj, this.transform.m));
    // base color: for gradient/pattern this is the globalAlpha multiplier (mult);
    // for solid it's the fill color (already alpha-folded by the caller).
    var col = (isGrad || isPat) ? mult : style;
    gl.uniform4f(prog.uColor, col[0], col[1], col[2], col[3]);
    if (isGrad) this.applyGrad(prog, style, 0);
    else if (isPat) this.applyPattern(prog, style, 0);
    // coverage on its own unit
    gl.activeTexture(gl.TEXTURE0 + COV_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, covTex);
    gl.uniform1i(prog.uCovTex, COV_UNIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  };

  // --- Analytic edge antialiasing for fills ---
  // Fills are drawn as triangles tagged with which edges are TRUE shape-boundary
  // edges (see triangulateExt). The fragment shader fades coverage across those
  // edges over ~1px; internal ear-clipping diagonals get no fade, so there are no
  // soft seams inside a triangulated region. Coverage is (0.5 + signed distance to
  // the edge in device pixels), which mirrors native analytic AA closely.
  var AA_VS = [
    "#version 300 es",
    "layout(location=0) in vec2 aPos;",
    "layout(location=1) in vec2 aTA;",
    "layout(location=2) in vec2 aTB;",
    "layout(location=3) in vec2 aTC;",
    "layout(location=4) in vec3 aM;",
    "uniform mat3 uMVP;",
    "out vec2 vPos;",
    "flat out vec2 vA;",
    "flat out vec2 vB;",
    "flat out vec2 vC;",
    "flat out vec3 vM;",
    "void main(){",
    "  vPos = aPos;",
    "  vA = aTA;",
    "  vB = aTB;",
    "  vC = aTC;",
    "  vM = aM;",
    "  vec3 p = uMVP * vec3(aPos, 1.0);",
    "  gl_Position = vec4(p, 1.0);",
    "}"
  ].join("\n");
  var COV_HELPER = [
    "float ecov(vec2 a, vec2 b, vec2 c, vec2 P, float isb){",
    "  if (isb < 0.5) return 1.0;",
    "  vec2 e = b - a;",
    "  float len = max(length(e), 1e-6);",
    "  vec2 n = vec2(-e.y, e.x);",
    "  float d = dot(n, P - a) / len;",
    "  float ssign = dot(n, c - a) > 0.0 ? 1.0 : -1.0;",
    "  float ins = d * ssign;",
    "  return clamp(0.5 + ins, 0.0, 1.0);",
    "}",
    "float covOf(vec2 A, vec2 B, vec2 C, vec3 M){",
    "  vec2 Pg = vec2(gl_FragCoord.x, uViewport.y - gl_FragCoord.y);",
    "  float c = ecov(A,B,C,Pg,M.x);",
    "  c = min(c, ecov(B,C,A,Pg,M.y));",
    "  c = min(c, ecov(C,A,B,Pg,M.z));",
    "  return clamp(c, 0.0, 1.0);",
    "}"
  ].join("\n");
  Renderer.prototype.shaderAA = function (isGrad) {
    var gl = this.gl;
    var pool = this._aaPool = this._aaPool || {};
    if (pool[isGrad ? 1 : 0]) return pool[isGrad ? 1 : 0];
    var fsBody;
    if (isGrad) {
      var base = GRAD_FS;
      fsBody = base
        .replace("in vec2 vPos;", "in vec2 vPos;\nflat in vec2 vA; flat in vec2 vB; flat in vec2 vC; flat in vec3 vM;")
        .replace("uniform vec4 uColor;", "uniform vec4 uColor;\nuniform vec2 uViewport;\nuniform float uCovFloor;")
        .replace("void main(){", COV_HELPER + "\nvoid main(){\n  float cov = covOf(vA,vB,vC,vM);\n  if (cov <= uCovFloor) discard;")
        .replace("o = texture(uGradTex, vec2(t, 0.5)) * uColor;", "o = texture(uGradTex, vec2(t, 0.5)) * uColor * cov;");
    } else {
      fsBody = [
        "#version 300 es",
        "precision highp float;",
        "in vec2 vPos;",
        "flat in vec2 vA; flat in vec2 vB; flat in vec2 vC; flat in vec3 vM;",
        "uniform vec4 uColor;",
        "uniform vec2 uViewport;",
        "uniform float uCovFloor;",
        "out vec4 o;",
        COV_HELPER,
        "void main(){",
        "  float cov = covOf(vA,vB,vC,vM);",
        "  if (cov <= uCovFloor) discard;",
"  o = uColor * cov;",
        "}"
      ].join("\n");
    }
    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, AA_VS);
    gl.compileShader(vs);
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsBody);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw "aa vs: " + gl.getShaderInfoLog(vs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw "aa fs: " + gl.getShaderInfoLog(fs);
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw "aa link: " + gl.getProgramInfoLog(prog);
    prog.uMVP = gl.getUniformLocation(prog, "uMVP");
    prog.uColor = gl.getUniformLocation(prog, "uColor");
    prog.uViewport = gl.getUniformLocation(prog, "uViewport");
    prog.uCovFloor = gl.getUniformLocation(prog, "uCovFloor");
    if (isGrad) {
      prog.uGradType = gl.getUniformLocation(prog, "uGradType");
      prog.uGradA = gl.getUniformLocation(prog, "uGradA");
      prog.uGradR0 = gl.getUniformLocation(prog, "uGradR0");
      prog.uGradR1 = gl.getUniformLocation(prog, "uGradR1");
      prog.uGradTex = gl.getUniformLocation(prog, "uGradTex");
    }
    pool[isGrad ? 1 : 0] = prog;
    return prog;
  };
  // Build an extended vertex buffer for the AA shader from tagged triangles
  // (array of { v:[6], m }). Layout per vertex: [x,y, Ax,Ay, Bx,By, Cx,Cy, m0,m1,m2].
  Renderer.prototype.aavbo = function (tris) {
    var gl = this.gl;
    var data = new Float32Array(tris.length * 3 * 11);
    var k = 0;
    for (var i = 0; i < tris.length; i++) {
      var t = tris[i], v = t.v, m = t.m;
      var A0 = v[0], A1 = v[1], B0 = v[2], B1 = v[3], C0 = v[4], C1 = v[5];
      var m0 = m & 1 ? 1 : 0, m1v = m & 2 ? 1 : 0, m2 = m & 4 ? 1 : 0;
      var verts = [[v[0], v[1]], [v[2], v[3]], [v[4], v[5]]];
      for (var j = 0; j < 3; j++) {
        data[k++] = verts[j][0]; data[k++] = verts[j][1];
        data[k++] = A0; data[k++] = A1;
        data[k++] = B0; data[k++] = B1;
        data[k++] = C0; data[k++] = C1;
        data[k++] = m0; data[k++] = m1v; data[k++] = m2;
      }
    }
    if (!this._vboAA) this._vboAA = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vboAA);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    return tris.length * 3;
  };
  Renderer.prototype.bindAA = function (prog) {
    var gl = this.gl;
    var stride = 44;
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.enableVertexAttribArray(2);
    gl.enableVertexAttribArray(3);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 16);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 24);
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, stride, 32);
    gl.uniformMatrix3fv(prog.uMVP, false, mMul(this.proj, this.transform.m));
    gl.uniform2f(prog.uViewport, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(prog.uCovFloor, 0);
  };
  Renderer.prototype.drawAAF = function (tris, color) {
    var gl = this.gl;
    var count = this.aavbo(tris);
    if (!count) return;
    var prog = this.shaderAA(false);
    gl.useProgram(prog);
    this.bindAA(prog);
    gl.uniform4f(prog.uColor, color[0], color[1], color[2], color[3]);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  };
  // Draw one ring's AA triangles into the stencil buffer (no color), discarding
  // fragments whose analytic coverage is <= floor, so the resulting stencil
  // reflects the analytic "strictly inside" test (matches native's per-edge
  // even-odd decision) instead of a hard fan. Caller configures stencilFunc/Op.
  Renderer.prototype.drawStencilAA = function (tris, floor) {
    var gl = this.gl;
    var count = this.aavbo(tris);
    if (!count) return;
    var prog = this.shaderAA(false);
    gl.useProgram(prog);
    this.bindAA(prog);
    gl.uniform4f(prog.uColor, 1, 1, 1, 1);
    gl.uniform1f(prog.uCovFloor, floor);
    gl.colorMask(false, false, false, false);
    gl.drawArrays(gl.TRIANGLES, 0, count);
    gl.colorMask(true, true, true, true);
  };
  Renderer.prototype.drawAAGrad = function (tris, grad, color) {
    var gl = this.gl;
    var count = this.aavbo(tris);
    if (!count) return;
    var prog = this.shaderAA(true);
    gl.useProgram(prog);
    this.bindAA(prog);
    gl.uniform4f(prog.uColor, color[0], color[1], color[2], color[3]);
    this.applyGrad(prog, grad);
    gl.drawArrays(gl.TRIANGLES, 0, count);
  };

  // --- Even-odd coverage fill (supersampled parity) ---
  // Computes even-odd coverage by supersampling the point-in-polygon parity
  // across a grid inside each fragment. Rings are baked (device space) into
  // textures and tested with a ray-crossing point-in-polygon test that
  // naturally handles self-intersecting polygons.
  var EO_VS = [
    "#version 300 es",
    "layout(location=0) in vec2 aPos;",
    "uniform mat3 uMVP;",
    "out vec2 vPos;",
    "void main(){ vPos = aPos; gl_Position = vec4((uMVP * vec3(aPos,1.0)).xy, 0.0, 1.0); }"
  ].join("\n");
  var EO_FS = [
    "#version 300 es",
    "precision highp float;",
    "in vec2 vPos;",
    "uniform vec4 uColor;",
    "uniform float uSa;",
    "uniform int uRingCount;",
    "uniform sampler2D uPts;",
    "uniform sampler2D uInfo;",
    "out vec4 o;",
    "bool inRing(vec2 P, int start, int n){",
    "  float x = P.x, y = P.y;",
    "  bool inside = false;",
    "  for (int i = 0; i < 256; i++){",
    "    if (i >= n) break;",
    "    vec2 a = texelFetch(uPts, ivec2(start + i, 0), 0).rg;",
    "    int nxt = (i + 1 == n) ? start : start + i + 1;",
    "    vec2 b = texelFetch(uPts, ivec2(nxt, 0), 0).rg;",
    "    if ((a.y > y) != (b.y > y)){",
    "      float t = (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x;",
    "      if (x < t) inside = !inside;",
    "    }",
    "  }",
    "  return inside;",
    "}",
    "void main(){",
    "  vec2 base = vPos;",
    "  float total = uSa * uSa;",
    "  float oddc = 0.0;",
    "  for (int i = 0; i < 32; i++){",
    "    if (float(i) >= uSa) break;",
    "    for (int j = 0; j < 32; j++){",
    "      if (float(j) >= uSa) break;",
    "      vec2 P = base + vec2((float(i) + 0.5) / uSa - 0.5, (float(j) + 0.5) / uSa - 0.5);",
    "      int parity = 0;",
    "      for (int r = 0; r < 64; r++){",
    "        if (r >= uRingCount) break;",
    "        vec2 info = texelFetch(uInfo, ivec2(r, 0), 0).rg;",
    "        if (inRing(P, int(info.x), int(info.y))) parity ^= 1;",
    "      }",
    "      if (parity == 1) oddc += 1.0;",
    "    }",
    "  }",
    "  float cov = oddc / total;",
    "  o = vec4(uColor.rgb, uColor.a * cov);",
    "}"
  ].join("\n");
  // Gradient variant: same supersampled parity, gradient sampled at fragment
  // center and modulated by coverage.
  var EO_GFS = [
    "#version 300 es",
    "precision highp float;",
    "in vec2 vPos;",
    "uniform vec4 uColor;",
    "uniform int uGradType;",
    "uniform vec4 uGradA;",
    "uniform float uGradR0;",
    "uniform float uGradR1;",
    "uniform sampler2D uGradTex;",
    "uniform float uSa;",
    "uniform int uRingCount;",
    "uniform sampler2D uPts;",
    "uniform sampler2D uInfo;",
    "out vec4 o;",
    "bool inRing(vec2 P, int start, int n){",
    "  float x = P.x, y = P.y;",
    "  bool inside = false;",
    "  for (int i = 0; i < 256; i++){",
    "    if (i >= n) break;",
    "    vec2 a = texelFetch(uPts, ivec2(start + i, 0), 0).rg;",
    "    int nxt = (i + 1 == n) ? start : start + i + 1;",
    "    vec2 b = texelFetch(uPts, ivec2(nxt, 0), 0).rg;",
    "    if ((a.y > y) != (b.y > y)){",
    "      float t = (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x;",
    "      if (x < t) inside = !inside;",
    "    }",
    "  }",
    "  return inside;",
    "}",
    "void main(){",
    "  vec2 base = vPos;",
    "  float gt;",
    "  if (uGradType == 0){",
    "    vec2 p0 = uGradA.xy, p1 = uGradA.zw;",
    "    vec2 d = p1 - p0;",
    "    float len2 = dot(d,d);",
    "    gt = (len2 < 1e-6) ? 1.0 : dot(base - p0, d)/len2;",
    "    gt = clamp(gt, 0.0, 1.0);",
    "  } else if (uGradType == 2){",
    "    vec2 rel = base - uGradA.xy;",
    "    gt = (atan(rel.y, rel.x) - uGradA.z) * 0.159154943;",
    "    gt = gt - floor(gt);",
    "  } else {",
    "    vec2 c0 = uGradA.xy, c1 = uGradA.zw;",
    "    float r0 = max(uGradR0, 0.0), r1 = max(uGradR1, 0.0);",
    "    vec2 f = c1 - c0;",
    "    float dr = r1 - r0;",
    "    float d2 = dot(f,f);",
    "    if (abs(dr) < 1e-6 && d2 > 1e-12){",
    "      gt = clamp(dot(base - c0, f)/max(d2,1e-12), 0.0, 1.0);",
    "    } else if (d2 < 1e-12){",
    "      if (abs(dr) < 1e-6) gt = 1.0;",
    "      else { float d = distance(base, c0); gt = clamp((d - r0)/dr, 0.0, 1.0); }",
    "    } else {",
    "      vec2 p = base - c0;",
    "      float A = d2 - dr*dr;",
    "      float B = -2.0*(dot(p,f) + r0*dr);",
    "      float C = dot(p,p) - r0*r0;",
    "      float det = B*B - 4.0*A*C;",
    "      if (det < 0.0) gt = 1.0;",
    "      else if (abs(A) < 1e-9){ gt = (abs(B) < 1e-9) ? 0.0 : clamp(-C/B, 0.0, 1.0); }",
    "      else {",
    "        float sq = sqrt(det);",
    "        float ta = (-B - sq)/(2.0*A);",
    "        float tb = (-B + sq)/(2.0*A);",
    "        bool inA = (ta >= 0.0 && ta <= 1.0);",
    "        bool inB = (tb >= 0.0 && tb <= 1.0);",
    "        if (inA && inB) gt = min(ta, tb);",
    "        else if (inA) gt = ta;",
    "        else if (inB) gt = tb;",
    "        else gt = clamp((ta + tb) * 0.5, 0.0, 1.0);",
    "      }",
    "      gt = clamp(gt, 0.0, 1.0);",
    "    }",
    "  }",
    "  vec4 gc = texture(uGradTex, vec2(gt, 0.5));",
    "  float total = uSa * uSa;",
    "  float oddc = 0.0;",
    "  for (int i = 0; i < 32; i++){",
    "    if (float(i) >= uSa) break;",
    "    for (int j = 0; j < 32; j++){",
    "      if (float(j) >= uSa) break;",
    "      vec2 P = base + vec2((float(i) + 0.5) / uSa - 0.5, (float(j) + 0.5) / uSa - 0.5);",
    "      int parity = 0;",
    "      for (int r = 0; r < 64; r++){",
    "        if (r >= uRingCount) break;",
    "        vec2 info = texelFetch(uInfo, ivec2(r, 0), 0).rg;",
    "        if (inRing(P, int(info.x), int(info.y))) parity ^= 1;",
    "      }",
    "      if (parity == 1) oddc += 1.0;",
    "    }",
    "  }",
    "  float cov = oddc / total;",
    "  o = vec4(uColor.rgb * gc.rgb, uColor.a * gc.a * cov);",
    "}"
  ].join("\n");
Renderer.prototype.shaderEO = function (isGrad) {
    var gl = this.gl;
    function build(vsS, fsS) {
      var vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, vsS); gl.compileShader(vs);
      var fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, fsS); gl.compileShader(fs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw "eo vs: " + gl.getShaderInfoLog(vs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw "eo fs: " + gl.getShaderInfoLog(fs);
      var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw "eo link: " + gl.getProgramInfoLog(p);
      return p;
    }
    if (isGrad) {
      if (this._eoGradProg) return this._eoGradProg;
      var gprog = build(EO_VS, EO_GFS);
      gprog.uMVP = gl.getUniformLocation(gprog, "uMVP");
      gprog.uColor = gl.getUniformLocation(gprog, "uColor");
      gprog.uSa = gl.getUniformLocation(gprog, "uSa");
      gprog.uRingCount = gl.getUniformLocation(gprog, "uRingCount");
      gprog.uPts = gl.getUniformLocation(gprog, "uPts");
      gprog.uInfo = gl.getUniformLocation(gprog, "uInfo");
      gprog.uGradType = gl.getUniformLocation(gprog, "uGradType");
      gprog.uGradA = gl.getUniformLocation(gprog, "uGradA");
      gprog.uGradR0 = gl.getUniformLocation(gprog, "uGradR0");
      gprog.uGradR1 = gl.getUniformLocation(gprog, "uGradR1");
      gprog.uGradTex = gl.getUniformLocation(gprog, "uGradTex");
      this._eoGradProg = gprog;
      return gprog;
    }
    if (this._eoProg) return this._eoProg;
    var prog = build(EO_VS, EO_FS);
    prog.uMVP = gl.getUniformLocation(prog, "uMVP");
    prog.uColor = gl.getUniformLocation(prog, "uColor");
    prog.uSa = gl.getUniformLocation(prog, "uSa");
    prog.uRingCount = gl.getUniformLocation(prog, "uRingCount");
    prog.uPts = gl.getUniformLocation(prog, "uPts");
    prog.uInfo = gl.getUniformLocation(prog, "uInfo");
    this._eoProg = prog;
    return prog;
  };
  // Bake device-space rings into the point/info textures. Returns nothing.
  Renderer.prototype.ringTextures = function (rings, transform) {
    var gl = this.gl;
    var pts = [], info = [], off = 0;
    var m = transform;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var r = 0; r < rings.length; r++) {
      var ring = rings[r];
      info.push(off, ring.length, 0, 0);
      for (var k = 0; k < ring.length; k++) {
        var x = ring[k][0], y = ring[k][1];
        // m is column-major [a,b,0, c,d,0, e,f,1] (m[0..1]=col0, m[3..4]=col1,
        // m[6..7]=translation) -- NOT row-major. This previously read m[0..2]/
        // m[3..5] as if it were, which happened to work for translate/scale-only
        // transforms (their off-diagonal terms are 0) but gave wrong device
        // coordinates for any rotated/skewed evenodd fill.
        var wx = m[0] * x + m[3] * y + m[6];
        var wy = m[1] * x + m[4] * y + m[7];
        pts.push(wx, wy, 0, 0);
        if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
        if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
      }
      off += ring.length;
    }
    this._eoBounds = rings.length ? [minX, minY, maxX, maxY] : null;
    if (!this._eoPts) this._eoPts = gl.createTexture();
    if (!this._eoInfo) this._eoInfo = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._eoPts);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, Math.max(1, pts.length / 4), 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(pts));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, this._eoInfo);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, Math.max(1, info.length / 4), 1, 0, gl.RGBA, gl.FLOAT, new Float32Array(info));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return rings.length;
  };
  // Draw the even-odd fill by supersampling parity per fragment over a device-space
  // fullscreen quad. Applies the clip stencil (EQUAL 2*depth) when depth>0.
Renderer.prototype.drawEvenOdd = function (rings, color, depth, samples, grad) {
    var gl = this.gl;
    var n = this.ringTextures(rings, this.transform.m);
    if (!n) return;
    var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    // Only the shape's own device-space bounding box needs the (expensive,
    // per-fragment supersampled) parity test -- draw a tight quad instead of
    // a full-canvas one so cost scales with shape size, not canvas size.
    var b = this._eoBounds;
    var x0 = Math.max(0, Math.floor(b[0]) - 1), y0 = Math.max(0, Math.floor(b[1]) - 1);
    var x1 = Math.min(w, Math.ceil(b[2]) + 1), y1 = Math.min(h, Math.ceil(b[3]) + 1);
    var FS = [x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1];
    if (!this._eoVBO) this._eoVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._eoVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(FS), gl.STREAM_DRAW);
    var prog = this.shaderEO(!!grad);
    gl.useProgram(prog);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    if (depth > 0) {
      gl.enable(gl.STENCIL_TEST);
      gl.stencilMask(0xFF);
      gl.stencilFunc(gl.EQUAL, depth * 2, 0xFF);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    } else {
      gl.disable(gl.STENCIL_TEST);
    }
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // device space -> clip (proj maps 0..W,0..H to [-1,1])
    gl.uniformMatrix3fv(prog.uMVP, false, this.proj);
    gl.uniform4f(prog.uColor, color[0], color[1], color[2], color[3]);
    gl.uniform1f(prog.uSa, samples);
    gl.uniform1i(prog.uRingCount, n);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._eoPts);
    gl.uniform1i(prog.uPts, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._eoInfo);
    gl.uniform1i(prog.uInfo, 1);
    if (grad) this.applyGrad(prog, grad, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  // positions: flat [x0,y0, x1,y1, ...]
  // uv: optional flat [u0,v0,...] same length; else zeros
  Renderer.prototype.draw = function (positions, uv, mask, color, crop) {
    var gl = this.gl;
    var count = positions.length / 2;
    if (!count) return;

    var data = new Float32Array(count * 4);
    for (var i = 0; i < count; i++) {
      data[i * 4] = positions[i * 2];
      data[i * 4 + 1] = positions[i * 2 + 1];
      var u = uv ? uv[i * 2] : 0;
      var v = uv ? uv[i * 2 + 1] : 0;
      data[i * 4 + 2] = u;
      data[i * 4 + 3] = v;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);

    var prog = this.shader(mask);
    gl.useProgram(prog);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

    gl.uniformMatrix3fv(prog.uMVP, false, mMul(this.proj, this.transform.m));
    gl.uniform4f(prog.uColor, color[0], color[1], color[2], color[3]);

    if (mask !== MASK_SOLID) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, crop.t);
      gl.uniform1i(prog.uSampler, 0);
      if (mask & MASK_CROP) {
        gl.uniform4f(prog.uCrop, crop.c[0], crop.c[1], crop.c[2], crop.c[3]);
      }
    }

    gl.drawArrays(gl.TRIANGLES, 0, count);
  };

  // Draw triangles into the stencil buffer only (no color output). Used to build
  // clip regions. Caller configures stencilFunc/Op around it as needed.
  Renderer.prototype.drawStencil = function (positions) {
    var gl = this.gl;
    var count = positions.length / 2;
    if (!count) return;
    var data = new Float32Array(count * 4);
    for (var i = 0; i < count; i++) {
      data[i * 4] = positions[i * 2];
      data[i * 4 + 1] = positions[i * 2 + 1];
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    var prog = this.shader(MASK_SOLID);
    gl.useProgram(prog);
    gl.enableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.uniformMatrix3fv(prog.uMVP, false, mMul(this.proj, this.transform.m));
    gl.uniform4f(prog.uColor, 1, 1, 1, 1);
    gl.colorMask(false, false, false, false);
    gl.drawArrays(gl.TRIANGLES, 0, count);
    gl.colorMask(true, true, true, true);
  };

  // Build an even-odd parity mask in stencil bit0 (respecting the 2N clip encoding),
  // run `draw` masked to the even-odd âˆ© clip region, then clear the mask and restore
  // the clip test. Works for any fill primitive (solid/gradient) and any composite op,
  // because the callback runs with the stencil mask active.
  Renderer.prototype.withEvenOddMask = function (subpathRings, depth, draw) {
    var gl = this.gl;
    // fullscreen quad in clip space (identity proj/transform -> uMVP = identity)
    var FS = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
    var savedT = this.transform.m, savedP = this.proj;
    gl.enable(gl.STENCIL_TEST);
    gl.disable(gl.DEPTH_TEST);
    // no active clip -> clean stencil; otherwise bit0 is already 0 (clips are 2N, even)
    if (depth === 0) {
      gl.stencilMask(0xFF);
      gl.clearStencil(0);
      gl.clear(gl.STENCIL_BUFFER_BIT);
    }
    // 1) parity in bit0 (real transform/proj: path tris are in device space). Each
    // ring is counted with an analytic "strictly inside (coverage > 0.5)" discard,
    // so a subpath-boundary pixel follows native's strict-edges even-odd rule.
    gl.stencilMask(0x01);
    gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
    for (var s = 0; s < subpathRings.length; s++) {
      var rings = subpathRings[s];
      for (var r = 0; r < rings.length; r++) {
        // Threshold at ~0 (not 0.5): any pixel with positive analytic coverage on
        // this ring counts toward parity, and the fill pass supplies the fractional
        // AA value. Native does the same (no half-coverage cutoff at edges).
        this.drawStencilAA(rings[r], 0.001);
      }
    }
    // 2) activate mask: even-odd(bit0) âˆ© clip (2N) == 2N+1
    gl.stencilMask(0xFF);
    gl.stencilFunc(gl.EQUAL, depth * 2 + 1, 0xFF);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    draw();
    // 3) clear parity bit0 and restore the clip test
    this.transform.m = mIdent();
    this.proj = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    gl.stencilMask(0x01);
    gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
    this.drawStencil(FS);
    gl.stencilMask(0xFF);
    this.transform.m = savedT;
    this.proj = savedP;
    if (depth > 0) {
      gl.stencilFunc(gl.EQUAL, depth * 2, 0xFF);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    } else {
      gl.disable(gl.STENCIL_TEST);
    }
  };

  Renderer.prototype.uploadTexture = function (image, quality) {
    var gl = this.gl;
    var src = image;
    if (image.width > this.maxTextureSize || image.height > this.maxTextureSize) {
      var c = document.createElement("canvas");
      c.width = Math.min(image.width, this.maxTextureSize);
      c.height = Math.min(image.height, this.maxTextureSize);
      c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
      src = c;
    }
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.smoothing && quality !== "snap") {
      // quality: "low" = bilinear, "medium" = linear+mip, "high" = mip+linear
      if (quality === "high" || quality === "medium") {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    return { t: tex, w: src.width, h: src.height, q: quality };
  };

  // Upload an image as a pattern texture. WebGL2 allows REPEAT on NPOT textures,
  // so the wrap mode encodes the repeat behavior directly; the axis that does not
  // repeat is CLAMP_TO_EDGE and the shader discards samples outside [0,1] there.
  Renderer.prototype.uploadPatternTexture = function (image, repeat, quality) {
    var gl = this.gl;
    var src = image;
    if (image.width > this.maxTextureSize || image.height > this.maxTextureSize) {
      var c = document.createElement("canvas");
      c.width = Math.min(image.width, this.maxTextureSize);
      c.height = Math.min(image.height, this.maxTextureSize);
      c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
      src = c;
    }
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    var wrapS = (repeat === "repeat" || repeat === "repeat-x") ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    var wrapT = (repeat === "repeat" || repeat === "repeat-y") ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    if (this.smoothing && quality !== "snap") {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    return { t: tex, w: src.width, h: src.height };
  };

  // -------------------------------------------------------------------------
  // Composite ops (all 19 W3C globalCompositeOperation values), implemented by
  // rendering the source into an offscreen texture and blending against the
  // current canvas contents in a fullscreen pass. gl's fixed blend funcs cannot
  // express destination-*, the blend modes, or the HSL (nonseparable) modes.
  // -------------------------------------------------------------------------
  // Ops whose result at a pixel depends only on that pixel's own src+dst values
  // (not on anything happening elsewhere on the canvas) -- safe to scope the
  // final composite draw to the source shape's own bounding box. The rest
  // (destination-*, xor, copy) can clear/replace pixels the source doesn't
  // touch, so they must still walk the whole canvas.
  var COMP_OP_LOCAL = {
    "source-over": 1, "source-atop": 1, "lighter": 1, "plus": 1,
    "multiply": 1, "screen": 1, "overlay": 1, "darken": 1, "lighten": 1,
    "color-dodge": 1, "color-burn": 1, "hard-light": 1, "soft-light": 1,
    "difference": 1, "exclusion": 1, "hue": 1, "saturation": 1, "color": 1, "luminosity": 1,
    "source-in": 1, "source-out": 1 // dst-only pixels go transparent either way (already 0 alpha there)
  };
  Renderer.prototype.composite = function (srcPositions, srcUV, srcMask, srcColor, srcCrop, op, srcGrad, filterOps, shadow, cov) {
    var gl = this.gl;
    var count = srcPositions.length / 2;
    if (!count) return;
    var w = this.canvas.width, h = this.canvas.height;

    // shape's own device-space bbox, expanded for filter blur / shadow blur
    // bleed -- only meaningful for the final-draw scoping below, not the
    // (still full-canvas) intermediate passes. srcPositions are USER-space
    // (the CTM is applied in the shader via uMVP, not baked into the points),
    // so each point needs this.transform.m applied here to land in device space.
    var tm = this.transform.m;
    var bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (var bi = 0; bi < count; bi++) {
      var ux = srcPositions[bi * 2], uy = srcPositions[bi * 2 + 1];
      var px = tm[0] * ux + tm[3] * uy + tm[6];
      var py = tm[1] * ux + tm[4] * uy + tm[7];
      if (px < bx0) bx0 = px; if (px > bx1) bx1 = px;
      if (py < by0) by0 = py; if (py > by1) by1 = py;
    }
    var bleed = 2;
    if (filterOps) {
      // filter: blur(px) sigma = px directly (unlike shadow's blur/2), applied
      // in device pixels regardless of CTM scale (applyFilters uses the raw
      // parsed value) -- so bleed must scale with the largest blur() in the
      // chain, not a flat guess: a flat constant is only ever right for one
      // specific radius and silently clips the Gaussian tail for anything larger.
      var maxBlurPx = 0;
      for (var fi = 0; fi < filterOps.length; fi++) {
        if (filterOps[fi].name === "blur") {
          var bpx = parseFloat(filterOps[fi].args[0]) || 0;
          if (bpx > maxBlurPx) maxBlurPx = bpx;
        }
      }
      bleed += Math.ceil(maxBlurPx * 3);
    }
    // shadow's Gaussian sigma = blur/2 (buildShadow's convention); the visible
    // tail needs ~3 sigma, matching gaussKernel's own taps = ceil(sigma*3).
    if (shadow) bleed += Math.ceil(((shadow.blur || 0) / 2) * 3) + Math.max(Math.abs(shadow.offsetX || 0), Math.abs(shadow.offsetY || 0));
    var qx0 = Math.max(0, Math.floor(bx0) - bleed), qy0 = Math.max(0, Math.floor(by0) - bleed);
    var qx1 = Math.min(w, Math.ceil(bx1) + bleed), qy1 = Math.min(h, Math.ceil(by1) + bleed);
    var canScope = COMP_OP_LOCAL[op] === 1 && qx1 > qx0 && qy1 > qy0;

    // ---- ensure offscreen resources ----
    if (!this._csTex) {
      this._csTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._csTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._csFBO = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._csFBO);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._csTex, 0);
      // destination copy texture
      this._dstTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this._dstTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this._dstFBO = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._dstFBO);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._dstTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // ---- 1) copy current canvas -> dstTex ----
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._dstFBO);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._csFBO);
    gl.viewport(0, 0, w, h);

    // ---- 2) render source into csTex ----
    var stencilWas = gl.isEnabled(gl.STENCIL_TEST);
    if (stencilWas) gl.disable(gl.STENCIL_TEST);
    var prevBlend = gl.isEnabled(gl.BLEND);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    var data = new Float32Array(count * 4);
    for (var i = 0; i < count; i++) {
      data[i * 4] = srcPositions[i * 2];
      data[i * 4 + 1] = srcPositions[i * 2 + 1];
      var u = srcUV ? srcUV[i * 2] : 0;
      var v = srcUV ? srcUV[i * 2 + 1] : 0;
      data[i * 4 + 2] = u;
      data[i * 4 + 3] = v;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    var prog = this.shader(srcMask);
    gl.useProgram(prog);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.uniformMatrix3fv(prog.uMVP, false, mMul(this.proj, this.transform.m));
    gl.uniform4f(prog.uColor, srcColor[0], srcColor[1], srcColor[2], srcColor[3]);
    var baseMask = srcMask & ~MASK_COV;
    if (baseMask === MASK_GRAD) {
      this.applyGrad(prog, srcGrad);
    } else if (baseMask === MASK_PATTERN) {
      this.applyPattern(prog, srcGrad); // srcGrad carries the CanvasPattern here
    } else if (baseMask !== MASK_SOLID) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcCrop.t);
      gl.uniform1i(prog.uSampler, 0);
      if (baseMask & MASK_CROP) gl.uniform4f(prog.uCrop, srcCrop.c[0], srcCrop.c[1], srcCrop.c[2], srcCrop.c[3]);
    }
    if (srcMask & MASK_COV) {
      gl.activeTexture(gl.TEXTURE0 + COV_UNIT);
      gl.bindTexture(gl.TEXTURE_2D, cov.tex);
      gl.uniform1i(prog.uCovTex, COV_UNIT);
      // coverage UV is carried in srcUV (interleaved at offset 8); no rect needed
    }
    gl.drawArrays(gl.TRIANGLES, 0, count);

    // ---- 2b) apply CSS filter passes to the source texture ----
    var compositeSrcTex = this._csTex;
    if (filterOps) {
      compositeSrcTex = this.applyFilters(this._csTex, filterOps, w, h);
    }

    // ---- 2c) shadow: paint the (unfiltered) source alpha as a tinted, offset,
    // blurred layer BEHIND the shape. Per spec the shadow is composited with the
    // current op, then the shape over it. We composite shadow-over-dst into a
    // scratch texture and use that as the dst for step 3, giving shape over
    // (shadow over dst). ----
    var dstTex = this._dstTex;
    if (shadow) {
      var shadowTex = this.buildShadow(this._csTex, shadow, w, h);
      // composite shadow over dst -> _shadTex2 (scratch not used by the shadow
      // result, which lives in _shadTex after an odd number of blur swaps)
      var scratch = (shadowTex === this._shadTex2) ? this._shadTex : this._shadTex2;
      var scratchFBO = (scratch === this._shadTex) ? this._shadFBO : this._shadFBO2;
      gl.bindFramebuffer(gl.FRAMEBUFFER, scratchFBO);
      gl.viewport(0, 0, w, h);
      var sprog = this.compShader();
      gl.useProgram(sprog);
      gl.enableVertexAttribArray(0);
      gl.disableVertexAttribArray(1);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]), gl.STREAM_DRAW);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this._dstTex);
      gl.uniform1i(sprog.uSrc, 0);
      gl.uniform1i(sprog.uDst, 1);
      gl.uniform1i(sprog.uOp, compOpId(op));
      gl.disable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      dstTex = scratch;
    }

    // ---- 3) composite src over dst into the default framebuffer ----
    // compShader samples uSrc/uDst by texelFetch(gl_FragCoord) -- absolute
    // device pixels, independent of the quad's own extent -- so shrinking the
    // quad (and scissoring to match) to the shape's bbox is correctness-free
    // for ops whose result at a pixel only depends on that pixel (COMP_OP_LOCAL);
    // it just skips evaluating the (expensive, per-pixel blend-mode) shader
    // for canvas area the shape never touched.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    if (canScope) {
      gl.enable(gl.SCISSOR_TEST);
      // qy0/qy1 are canvas Y-down (0 = top); gl.scissor's y origin is the
      // bottom of the framebuffer, so the box needs the same flip the clip-
      // space quad below gets.
      gl.scissor(qx0, h - qy1, qx1 - qx0, qy1 - qy0);
    }
    var bprog = this.compShader();
    gl.useProgram(bprog);
    gl.enableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    // device px (y-down, y=0 at top) -> clip space (y-up): matches this.proj's
    // own -2/height flip, so gl_FragCoord.xy lookups in the shader land on the
    // same absolute pixels the quad's screen-space footprint actually covers.
    var qL, qR, qB, qT;
    if (canScope) {
      qL = (qx0 / w) * 2 - 1; qR = (qx1 / w) * 2 - 1;
      qT = 1 - (qy0 / h) * 2; qB = 1 - (qy1 / h) * 2;
    } else {
      qL = -1; qR = 1; qB = -1; qT = 1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      qL, qB, qR, qB, qR, qT, qL, qB, qR, qT, qL, qT
    ]), gl.STREAM_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, compositeSrcTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, dstTex);
    gl.uniform1i(bprog.uSrc, 0);
    gl.uniform1i(bprog.uDst, 1);
    gl.uniform1i(bprog.uOp, compOpId(op));
    if (prevBlend) gl.enable(gl.BLEND);
    if (stencilWas) gl.enable(gl.STENCIL_TEST);
    gl.disable(gl.BLEND); // o2 is the complete premultiplied result; replace dst (no double-add)
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    if (canScope) gl.disable(gl.SCISSOR_TEST);
    if (prevBlend) gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  };

  // map op string -> id for the composite shader
  var COMP_OP_MAP = {
    "source-over": 0, "source-in": 1, "source-out": 2, "source-atop": 3,
    "destination-over": 4, "destination-in": 5, "destination-out": 6, "destination-atop": 7,
    "lighter": 8, "plus": 8, "copy": 9, "xor": 10,
    "multiply": 11, "screen": 12, "overlay": 13, "darken": 14, "lighten": 15,
    "color-dodge": 16, "color-burn": 17, "hard-light": 18, "soft-light": 19,
    "difference": 20, "exclusion": 21,
    "hue": 22, "saturation": 23, "color": 24, "luminosity": 25
  };
  function compOpId(op) { return COMP_OP_MAP[op] !== undefined ? COMP_OP_MAP[op] : COMP_OP_MAP["source-over"]; }

  function buildCompShader(gl) {
    var vs = [
      "#version 300 es",
      "layout(location=0) in vec2 aPos;",
      "void main(){ gl_Position = vec4(aPos,0,1); }"
    ].join("\n");
    var fs = [
      "#version 300 es",
      "precision highp float;",
      "uniform sampler2D uSrc; uniform sampler2D uDst; uniform int uOp;",
      "out vec4 o;",
      // ---- helpers for nonseparable (HSL) blends ----
      "float lum(vec3 c){ return 0.3*c.r + 0.59*c.g + 0.11*c.b; }",
      "float min3(vec3 c){ return min(min(c.r,c.g),c.b); }",
      "float max3(vec3 c){ return max(max(c.r,c.g),c.b); }",
      "vec3 setSat(vec3 c, float s){",
      "  float mn = min3(c), mx = max3(c);",
      "  if (mn == mx) return vec3(0,0,0);",
      "  float mid = c.r;",
      "  if (c.g != mn && c.g != mx) mid = c.g; else if (c.b != mn && c.b != mx) mid = c.b;",
      "  vec3 r;",
      "  r.r = (c.r == mn) ? 0.0 : (c.r == mx) ? s : ((mid - mn) * s / (mx - mn));",
      "  r.g = (c.g == mn) ? 0.0 : (c.g == mx) ? s : ((mid - mn) * s / (mx - mn));",
      "  r.b = (c.b == mn) ? 0.0 : (c.b == mx) ? s : ((mid - mn) * s / (mx - mn));",
      "  return r;",
      "}",
      "vec3 clipColor(vec3 c){",
      "  float L = lum(c);",
      "  float n = min3(c), x = max3(c);",
      "  if (n < 0.0) c = L + (c - L) * L / (L - n);",
      "  if (x > 1.0) c = L + (c - L) * (1.0 - L) / (x - L);",
      "  return c;",
      "}",
      "vec3 setLum(vec3 c, float l){",
      "  float d = l - lum(c);",
      "  return clipColor(c + d);",
      "}",
      "float satv(vec3 c){ return max3(c) - min3(c); }",
      // blend function B(Cb,Cs) for the separable blend modes
      "vec3 blendFunc(int m, vec3 cb, vec3 cs){",
      "  if (m==0) return cb*cs;",                                  // multiply
      "  if (m==1) return cb + cs - cb*cs;",                        // screen
      "  if (m==2) return vec3(",                                  // overlay
      "    (cb.r<=0.5)? 2.0*cb.r*cs.r : 1.0-2.0*(1.0-cb.r)*(1.0-cs.r),",
      "    (cb.g<=0.5)? 2.0*cb.g*cs.g : 1.0-2.0*(1.0-cb.g)*(1.0-cs.g),",
      "    (cb.b<=0.5)? 2.0*cb.b*cs.b : 1.0-2.0*(1.0-cb.b)*(1.0-cs.b));",
      "  if (m==3) return min(cb, cs);",                            // darken
      "  if (m==4) return max(cb, cs);",                            // lighten
      "  if (m==5) return vec3(",                                  // color-dodge
      "    (cb.r<0.001)?0.0:((cs.r>=1.0)?1.0:clamp(cb.r/(1.0-cs.r),0.0,1.0)),",
      "    (cb.g<0.001)?0.0:((cs.g>=1.0)?1.0:clamp(cb.g/(1.0-cs.g),0.0,1.0)),",
      "    (cb.b<0.001)?0.0:((cs.b>=1.0)?1.0:clamp(cb.b/(1.0-cs.b),0.0,1.0)));",
      "  if (m==6) return vec3(",                                  // color-burn
      "    (cb.r>=1.0)?1.0:((cs.r<0.001)?0.0:1.0-clamp((1.0-cb.r)/cs.r,0.0,1.0)),",
      "    (cb.g>=1.0)?1.0:((cs.g<0.001)?0.0:1.0-clamp((1.0-cb.g)/cs.g,0.0,1.0)),",
      "    (cb.b>=1.0)?1.0:((cs.b<0.001)?0.0:1.0-clamp((1.0-cb.b)/cs.b,0.0,1.0)));",
      "  if (m==7) return vec3(",                                  // hard-light
      "    (cs.r<=0.5)?2.0*cb.r*cs.r : 1.0-2.0*(1.0-cb.r)*(1.0-cs.r),",
      "    (cs.g<=0.5)?2.0*cb.g*cs.g : 1.0-2.0*(1.0-cb.g)*(1.0-cs.g),",
      "    (cs.b<=0.5)?2.0*cb.b*cs.b : 1.0-2.0*(1.0-cb.b)*(1.0-cs.b));",
      "  if (m==8){",                                            // soft-light
      "    vec3 r;",
      "    for (int k=0;k<3;k++){",
      "      float cbk = (k==0)?cb.r:(k==1)?cb.g:cb.b;",
      "      float csk = (k==0)?cs.r:(k==1)?cs.g:cs.b;",
      "      float D = (cbk<=0.25)?((16.0*cbk-12.0)*cbk+4.0)*cbk : sqrt(cbk);",
      "      r.x = (k==0)?((csk<=0.5)?cbk-(1.0-2.0*csk)*cbk*(1.0-cbk):cbk+(2.0*csk-1.0)*(D-cbk)):r.x;",
      "      r.y = (k==1)?((csk<=0.5)?cbk-(1.0-2.0*csk)*cbk*(1.0-cbk):cbk+(2.0*csk-1.0)*(D-cbk)):r.y;",
      "      r.z = (k==2)?((csk<=0.5)?cbk-(1.0-2.0*csk)*cbk*(1.0-cbk):cbk+(2.0*csk-1.0)*(D-cbk)):r.z;",
      "    }",
      "    return r;",
      "  }",
      "  if (m==9) return abs(cb - cs);",                            // difference
      "  if (m==10) return cb + cs - 2.0*cb*cs;",                    // exclusion
      "  return cb*cs;",
      "}",
      "void main(){",
      "  vec4 csA = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0);",
      "  vec4 cdA = texelFetch(uDst, ivec2(gl_FragCoord.xy), 0);",
      "  vec3 cs = csA.rgb;",
      "  vec3 cb = (cdA.a > 0.001) ? cdA.rgb / cdA.a : vec3(0.0);",
      "  float as = csA.a, ad = cdA.a;",
      "  vec4 o2;",
      "  int op = uOp;",
      // ---- Porter-Duff compositing (straight source/dest, factors) ----
      "  float fas=0.0, fab=0.0;",
      "  if (op==0)  { fas=1.0;       fab=1.0-as; }",
      "  else if (op==1) { fas=ad;    fab=0.0;    }",
      "  else if (op==2) { fas=1.0-ad; fab=0.0;   }",
      "  else if (op==3) { fas=ad;    fab=1.0-as; }",
      "  else if (op==4) { fas=1.0-ad; fab=1.0;   }",
      "  else if (op==5) { fas=0.0;   fab=as;     }",
      "  else if (op==6) { fas=0.0;   fab=1.0-as; }",
      "  else if (op==7) { fas=1.0-ad; fab=as;    }",
      "  else if (op==8) { fas=1.0;   fab=1.0;    }",
      "  else if (op==9) { fas=1.0;   fab=0.0;    }",
      "  else if (op==10){ fas=1.0-ad; fab=1.0-as;}",               // xor
      "  if (op <= 10){",
      "    vec3 preS = cs*as, preD = cb*ad;",
"    vec3 preCo = fas*preS + fab*preD;",
    "    float ao = fas*as + fab*ad;",
    "    o2 = (ao<0.001)? vec4(0,0,0,0) : vec4(preCo, ao);",
    "  } else {",
      // ---- blend modes: B(Cb,Cs) then compositing: Co = (1-ab)*as*Cs + ab*((1-as)*Cb + as*B) ----
      "    int b; vec3 B = vec3(0.0);",
      "    if (op==11) b=0; else if (op==12) b=1; else if (op==13) b=2; else if (op==14) b=3;",
      "    else if (op==15) b=4; else if (op==16) b=5; else if (op==17) b=6; else if (op==18) b=7;",
      "    else if (op==19) b=8; else if (op==20) b=9; else b=10;",
      "    if (op >= 22) {",
      "      if (op == 22) B = setLum(setSat(cs, satv(cb)), lum(cb));",      // hue
      "      else if (op == 23) B = setLum(setSat(cb, satv(cs)), lum(cb));", // saturation
      "      else if (op == 24) B = setLum(cs, lum(cb));",                  // color
      "      else B = setLum(cb, lum(cs));",                                // luminosity
      "    } else {",
      "      B = blendFunc(b, cb, cs);",
      "    }",
"    vec3 preCo = (1.0-ad)*as*cs + ad*((1.0-as)*cb + as*B);",
    "    float ao = as + ad - as*ad;",
    "    o2 = (ao<0.001)? vec4(0,0,0,0) : vec4(preCo, ao);",
    "  }",
      "  o = o2;",
      "}"
    ].join("\n");
    var vs2 = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs2, vs); gl.compileShader(vs2);
    var fs2 = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs2, fs); gl.compileShader(fs2);
    if (!gl.getShaderParameter(vs2, gl.COMPILE_STATUS)) throw "compVS: " + gl.getShaderInfoLog(vs2);
    if (!gl.getShaderParameter(fs2, gl.COMPILE_STATUS)) throw "compFS: " + gl.getShaderInfoLog(fs2);
    var prog = gl.createProgram();
    gl.attachShader(prog, vs2); gl.attachShader(prog, fs2);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw "compLink: " + gl.getProgramInfoLog(prog);
    prog.uSrc = gl.getUniformLocation(prog, "uSrc");
    prog.uDst = gl.getUniformLocation(prog, "uDst");
    prog.uOp = gl.getUniformLocation(prog, "uOp");
    return prog;
  }

  Renderer.prototype.compShader = function () {
    var gl = this.gl;
    if (!this._compShader) this._compShader = buildCompShader(gl);
    return this._compShader;
  };
  // ---------------------------------------------------------------------------
  // CSS filter pipeline: parse filter string, apply as shader passes
  // ---------------------------------------------------------------------------
  function parseFilter(str) {
    if (!str || str === "none" || str === "") return null;
    var ops = [];
    var re = /(\w+(?:-\w+)*)\s*\(([^)]*)\)/g;
    var m;
    while ((m = re.exec(str))) {
      var name = m[1];
      // drop-shadow is handled through the shadow pass (see parseDropShadow), not
      // the per-fragment color-filter shader — skip it here.
      if (name === "drop-shadow") continue;
      var args = m[2].split(/\s*,\s*|\s+/).filter(function (s) { return s.length > 0; });
      ops.push({ name: name, args: args });
    }
    return ops.length ? ops : null;
  }

  // Parse a filter: drop-shadow(offx offy [blur] [color]) into a shadow object
  // matching shadowParams()'s shape, or null if there's no drop-shadow. Offsets
  // and blur are lengths in px; color defaults to black. The blur RADIUS R maps
  // to a Gaussian stdDeviation = R (like filter: blur()), but buildShadow uses
  // sigma = blur/2, so we return blur = 2R for the correct spread.
  // Note: a color written as rgb()/hsl() (with its own parens) isn't supported
  // here because the filter tokenizer splits on ')'; hex and named colors work.
  function parseDropShadow(str) {
    if (!str || str.indexOf("drop-shadow") === -1) return null;
    var m = /drop-shadow\s*\(([^)]*)\)/.exec(str);
    if (!m) return null;
    var toks = m[1].trim().split(/\s+/).filter(function (s) { return s.length; });
    var lens = [], color = null;
    for (var i = 0; i < toks.length; i++) {
      // a token that starts like a number (optionally signed/px) is a length
      if (/^[+-]?\.?\d/.test(toks[i])) lens.push(parseFloat(toks[i]));
      else color = toks[i];
    }
    if (lens.length < 2) return null; // offx and offy are required
    var c = color ? colorToVec(color) : [0, 0, 0, 1];
    if (!c) c = [0, 0, 0, 1];
    var blurR = lens.length >= 3 ? Math.max(0, lens[2]) : 0;
    return {
      color: [c[0], c[1], c[2], c[3]],
      offsetX: lens[0],
      offsetY: lens[1],
      blur: blurR * 2 // buildShadow sigma = blur/2, CSS drop-shadow sigma = R
    };
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

  // A CSS filter <number-percentage> amount. "50%" -> 0.5, "0.5" -> 0.5.
  // An omitted arg falls back to the filter's identity default.
  function filterAmount(a, dflt) {
    if (a == null || a === "") return dflt;
    if (a.charAt(a.length - 1) === "%") {
      var p = parseFloat(a);
      return isNaN(p) ? dflt : p / 100;
    }
    var n = parseFloat(a);
    return isNaN(n) ? dflt : n;
  }

  // A CSS <angle> for hue-rotate, in radians. Supports deg/grad/rad/turn;
  // a bare number is degrees. Omitted -> 0.
  function filterAngle(a) {
    if (a == null || a === "") return 0;
    var n = parseFloat(a);
    if (isNaN(n)) return 0;
    if (/rad$/.test(a)) return /grad$/.test(a) ? n * Math.PI / 200 : n;
    if (/turn$/.test(a)) return n * 2 * Math.PI;
    return n * Math.PI / 180; // deg or bare number
  }

  function buildFilterShader(gl) {
    var vs = [
      "#version 300 es",
      "layout(location=0) in vec2 aPos;",
      "out vec2 vUV;",
      "void main(){ vUV = aPos*0.5+0.5; gl_Position = vec4(aPos,0,1); }"
    ].join("\n");
    var fs = [
      "#version 300 es",
      "precision highp float;",
      "uniform sampler2D uTex;",
      // filter params (all 0 = identity)
      "uniform float uBrightness;",   // multiply, 1=identity
      "uniform float uContrust;",     // (c-0.5)*n+0.5, 1=identity
      "uniform float uGrayscale;",    // lerp(lum), 0=identity
      "uniform float uInvert;",       // lerp(1-c), 0=identity
      "uniform float uOpacity;",      // multiply alpha, 1=identity
      "uniform float uSaturate;",     // lerp(lum,color), 1=identity
      "uniform float uSepia;",        // sepia matrix lerp, 0=identity
      "uniform float uHueRotate;",    // radians, 0=identity
      "in vec2 vUV;",
      "out vec4 o;",
      // Luminance coefficients per the SVG/CSS filter spec (feColorMatrix),
      // used by saturate, grayscale, and hue-rotate. Rec.709, not 601.
      "const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);",
      // saturate(s): spec feColorMatrix type=\"saturate\" matrix (rows).",
      "vec3 saturateMat(vec3 c, float s){",
      "  mat3 m = mat3(",
      "    0.2126+0.7874*s, 0.2126-0.2126*s, 0.2126-0.2126*s,",
      "    0.7152-0.7152*s, 0.7152+0.2848*s, 0.7152-0.7152*s,",
      "    0.0722-0.0722*s, 0.0722-0.0722*s, 0.0722+0.9278*s);",
      "  return m * c;",  // GLSL mat3 is column-major; columns above = output rows
      "}",
      // hue-rotate(a): spec matrix = LUM_base + cos*COS_part + sin*SIN_part.",
      "vec3 hueRotate(vec3 c, float a){",
      "  float ca = cos(a), sa = sin(a);",
      "  mat3 m = mat3(",
      "    0.213+ca*0.787-sa*0.213, 0.213-ca*0.213+sa*0.143, 0.213-ca*0.213-sa*0.787,",
      "    0.715-ca*0.715-sa*0.715, 0.715+ca*0.285+sa*0.140, 0.715-ca*0.715+sa*0.715,",
      "    0.072-ca*0.072+sa*0.928, 0.072-ca*0.072-sa*0.283, 0.072+ca*0.928+sa*0.072);",
      "  return m * c;",
      "}",
      "void main(){",
      "  vec4 c = texture(uTex, vUV);",
      "  vec3 rgb = c.rgb;",
      "  if (uBrightness != 1.0) rgb *= uBrightness;",
      "  if (uContrust != 1.0) rgb = (rgb - 0.5) * uContrust + 0.5;",
      "  if (uSaturate != 1.0) rgb = saturateMat(rgb, uSaturate);",
      "  if (uGrayscale > 0.0){ float l = dot(rgb, LUM); rgb = mix(rgb, vec3(l), uGrayscale); }",
      "  if (uSepia > 0.0){",
      "    vec3 s = vec3(dot(rgb,vec3(0.393,0.769,0.189)), dot(rgb,vec3(0.349,0.686,0.168)), dot(rgb,vec3(0.272,0.534,0.131)));",
      "    rgb = mix(rgb, s, uSepia);",
      "  }",
      "  if (uHueRotate != 0.0) rgb = hueRotate(rgb, uHueRotate);",
      "  if (uInvert > 0.0) rgb = mix(rgb, 1.0 - rgb, uInvert);",
      "  float a = c.a;",
      "  if (uOpacity != 1.0) a *= uOpacity;",
      "  o = vec4(rgb, a);",
      "}"
    ].join("\n");
    var p = gl.createProgram();
    var v = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(v, vs); gl.compileShader(v);
    var f = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(f, fs); gl.compileShader(f);
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    p.uTex = gl.getUniformLocation(p, "uTex");
    p.uBrightness = gl.getUniformLocation(p, "uBrightness");
    p.uContrust = gl.getUniformLocation(p, "uContrust");
    p.uGrayscale = gl.getUniformLocation(p, "uGrayscale");
    p.uInvert = gl.getUniformLocation(p, "uInvert");
    p.uOpacity = gl.getUniformLocation(p, "uOpacity");
    p.uSaturate = gl.getUniformLocation(p, "uSaturate");
    p.uSepia = gl.getUniformLocation(p, "uSepia");
    p.uHueRotate = gl.getUniformLocation(p, "uHueRotate");
    return p;
  }

  // Separable Gaussian blur — one axis per pass
  function buildBlurShader(gl) {
    var vs = [
      "#version 300 es",
      "layout(location=0) in vec2 aPos;",
      "out vec2 vUV;",
      "void main(){ vUV = aPos*0.5+0.5; gl_Position = vec4(aPos,0,1); }"
    ].join("\n");
    var MAX_TAPS = 25;
    var fs = [
      "#version 300 es",
      "precision highp float;",
      "uniform sampler2D uTex;",
      "uniform vec2 uDir;",        // (1/w, 0) or (0, 1/h)
      "uniform int uTaps;",        // taps per side
      "uniform float uWeights[" + (MAX_TAPS * 2 + 1) + "];",
      "uniform float uOffsets[" + MAX_TAPS + "];", // offsets for linear-sampling trick
      "in vec2 vUV;",
      "out vec4 o;",
      "void main(){",
      "  vec4 sum = texture(uTex, vUV) * uWeights[0];",
      "  for (int i = 1; i <= " + MAX_TAPS + "; i++) {",
      "    if (i > uTaps) break;",
      "    vec2 off = uDir * uOffsets[i-1];",
      "    sum += texture(uTex, vUV + off) * uWeights[i];",
      "    sum += texture(uTex, vUV - off) * uWeights[i];",
      "  }",
      "  o = sum;",
      "}"
    ].join("\n");
    var p = gl.createProgram();
    var v = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(v, vs); gl.compileShader(v);
    var f = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(f, fs); gl.compileShader(f);
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    p.uTex = gl.getUniformLocation(p, "uTex");
    p.uDir = gl.getUniformLocation(p, "uDir");
    p.uTaps = gl.getUniformLocation(p, "uTaps");
    p.uWeights = gl.getUniformLocation(p, "uWeights");
    p.uOffsets = gl.getUniformLocation(p, "uOffsets");
    return p;
  }

  // Build a Gaussian kernel for a given blur radius. CSS blur(r) maps to a
  // Gaussian with stdDeviation = r, so sigma = radius (not radius/2). We need
  // taps out to ~3 sigma to capture the tail; clamp to the shader's MAX_TAPS.
  function gaussKernel(radius) {
    var sigma = Math.max(radius, 0.5);
    var taps = Math.min(Math.ceil(sigma * 3), 25);
    if (taps < 1) taps = 1;
    var weights = [0], offsets = [];
    // Discrete weights at integer offsets 0..taps. Weight[k] is applied at
    // offset k on BOTH sides in the shader, so normalize over the full symmetric
    // kernel: center once + each side weight twice. (A linear-sampling offset
    // trick was tried here and double-counted interior taps; integer taps are
    // correct and, at ~19 samples/pass for blur(3px), plenty fast.)
    var g0 = 1; // exp(0)
    var side = [];
    var total = g0;
    for (var k = 1; k <= taps; k++) {
      var g = Math.exp(-(k * k) / (2 * sigma * sigma));
      side.push(g);
      total += 2 * g;
    }
    weights[0] = g0 / total;
    for (var k2 = 1; k2 <= taps; k2++) {
      weights[k2] = side[k2 - 1] / total;
      offsets.push(k2); // integer pixel offset
    }
    return { taps: taps, weights: weights, offsets: offsets };
  }

  // Apply a filter chain to a texture, ping-ponging between two textures.
  // Returns the GL texture name of the result.
  Renderer.prototype.applyFilters = function (srcTex, ops, w, h) {
    var gl = this.gl;
    // ensure filter resources
    if (!this._filterTex) {
      this._filterTex = gl.createTexture();
      this._filterTex2 = gl.createTexture();
      this._filterFBO = gl.createFramebuffer();
      this._filterFBO2 = gl.createFramebuffer();
      this._filterW = 0; this._filterH = 0;
    }
    if (this._filterW !== w || this._filterH !== h) {
      gl.bindTexture(gl.TEXTURE_2D, this._filterTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._filterFBO);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._filterTex, 0);
      gl.bindTexture(gl.TEXTURE_2D, this._filterTex2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._filterFBO2);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._filterTex2, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this._filterW = w; this._filterH = h;
    }

    if (!this._filterShader) this._filterShader = buildFilterShader(gl);
    if (!this._blurShader) this._blurShader = buildBlurShader(gl);

    // fullscreen quad
    var quad = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);

    // Color ops batch into one shader pass for efficiency, but the shader
    // applies them in a fixed internal order (see COLOR_SLOT). Color filters
    // do NOT commute, so we may only merge ops that arrive in ascending slot
    // order; an op whose slot is <= the highest already pending forces a flush
    // first, so `sepia() hue-rotate()` and `hue-rotate() sepia()` differ
    // exactly as the spec requires. blur always flushes (separate pipeline).
    var readTex = srcTex;
    var hasColor = false;
    var maxSlot = -1; // highest shader slot accumulated in the current batch
    var bright = 1, contr = 1, gray = 0, inv = 0, opac = 1, sat = 1, sep = 0, hue = 0;

    function flushColor() {
      if (!hasColor) return;
      // ping-pong
      var tmp = readTex === this._filterTex ? this._filterTex2 : this._filterTex;
      var fbo = readTex === this._filterTex ? this._filterFBO2 : this._filterFBO;
      if (readTex === srcTex) { fbo = this._filterFBO; tmp = this._filterTex; }

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.BLEND);
      gl.useProgram(this._filterShader);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
      gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readTex);
      gl.uniform1i(this._filterShader.uTex, 0);
      gl.uniform1f(this._filterShader.uBrightness, bright);
      gl.uniform1f(this._filterShader.uContrust, contr);
      gl.uniform1f(this._filterShader.uGrayscale, gray);
      gl.uniform1f(this._filterShader.uInvert, inv);
      gl.uniform1f(this._filterShader.uOpacity, opac);
      gl.uniform1f(this._filterShader.uSaturate, sat);
      gl.uniform1f(this._filterShader.uSepia, sep);
      gl.uniform1f(this._filterShader.uHueRotate, hue);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      readTex = tmp;
      hasColor = false;
      maxSlot = -1;
      bright = 1; contr = 1; gray = 0; inv = 0; opac = 1; sat = 1; sep = 0; hue = 0;
    }

    // Slot = position in the shader's fixed internal apply order. Adding an op
    // at a slot <= one already pending would reorder it, so we flush first.
    var COLOR_SLOT = {
      brightness: 0, contrast: 1, saturate: 2, grayscale: 3,
      sepia: 4, "hue-rotate": 5, invert: 6, opacity: 7
    };

    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (op.name === "blur") {
        var px = parseFloat(op.args[0]);
        if (px <= 0) continue;
        flushColor.call(this);
        var kern = gaussKernel(px);
        // horizontal pass
        var src = readTex;
        var dst = (readTex === this._filterTex || readTex === srcTex) ? this._filterTex2 : this._filterTex;
        var dstFBO = (dst === this._filterTex) ? this._filterFBO : this._filterFBO2;
        this._blurPass(src, dstFBO, kern, [1 / w, 0], w, h, quad);
        readTex = dst;
        // vertical pass
        var dst2 = (readTex === this._filterTex) ? this._filterTex2 : this._filterTex;
        var dstFBO2 = (dst2 === this._filterTex) ? this._filterFBO : this._filterFBO2;
        this._blurPass(readTex, dstFBO2, kern, [0, 1 / h], w, h, quad);
        readTex = dst2;
        continue;
      }

      var slot = COLOR_SLOT[op.name];
      if (slot === undefined) continue; // drop-shadow / url() not yet supported
      // If this op can't be appended without reordering, flush the batch first.
      if (hasColor && slot <= maxSlot) flushColor.call(this);

      if (op.name === "brightness") {
        bright *= filterAmount(op.args[0], 1);
      } else if (op.name === "contrast") {
        contr *= filterAmount(op.args[0], 1);
      } else if (op.name === "grayscale") {
        gray = clamp01(filterAmount(op.args[0], 1));
      } else if (op.name === "invert") {
        inv = clamp01(filterAmount(op.args[0], 1));
      } else if (op.name === "opacity") {
        opac *= clamp01(filterAmount(op.args[0], 1));
      } else if (op.name === "saturate") {
        sat *= filterAmount(op.args[0], 1);
      } else if (op.name === "sepia") {
        sep = clamp01(filterAmount(op.args[0], 1));
      } else if (op.name === "hue-rotate") {
        hue += filterAngle(op.args[0]);
      }
      hasColor = true;
      maxSlot = Math.max(maxSlot, slot);
    }
    flushColor.call(this);
    return readTex;
  };

  Renderer.prototype._blurPass = function (srcTex, dstFBO, kern, dir, w, h, quad) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dstFBO);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.useProgram(this._blurShader);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this._blurShader.uTex, 0);
    gl.uniform2f(this._blurShader.uDir, dir[0], dir[1]);
    gl.uniform1i(this._blurShader.uTaps, kern.taps);
    var flatW = new Float32Array(kern.weights);
    gl.uniform1fv(this._blurShader.uWeights, flatW);
    var flatO = new Float32Array(kern.offsets);
    gl.uniform1fv(this._blurShader.uOffsets, flatO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  // Shadow tint + offset shader. Samples the source alpha at an offset UV and
  // paints it in a single flat shadow color. The source texture is straight-
  // alpha, but the shadow's RGB is constant, so blurring the result afterward
  // smears only the alpha — no color bleed. Output is straight-alpha to match
  // what the composite shader expects (cs = rgb, as = a).
  function buildShadowShader(gl) {
    var vs = [
      "#version 300 es",
      "layout(location=0) in vec2 aPos;",
      "out vec2 vUV;",
      "void main(){ vUV = aPos*0.5+0.5; gl_Position = vec4(aPos,0,1); }"
    ].join("\n");
    var fs = [
      "#version 300 es",
      "precision highp float;",
      "uniform sampler2D uTex;",
      "uniform vec4 uShadowColor;", // straight rgb + alpha (globalAlpha folded in)
      "uniform vec2 uOffset;",      // offset in UV space (device px / dimension)
      "in vec2 vUV;",
      "out vec4 o;",
      "void main(){",
      "  vec2 src = vUV - uOffset;",
      "  float a = 0.0;",
      // outside the source rect contributes nothing (CLAMP would smear the edge)
      "  if (src.x >= 0.0 && src.x <= 1.0 && src.y >= 0.0 && src.y <= 1.0) {",
      "    a = texture(uTex, src).a;",
      "  }",
      "  o = vec4(uShadowColor.rgb, a * uShadowColor.a);",
      "}"
    ].join("\n");
    var p = gl.createProgram();
    var v = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(v, vs); gl.compileShader(v);
    var f = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(f, fs); gl.compileShader(f);
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    p.uTex = gl.getUniformLocation(p, "uTex");
    p.uShadowColor = gl.getUniformLocation(p, "uShadowColor");
    p.uOffset = gl.getUniformLocation(p, "uOffset");
    return p;
  }

  // Build the tinted, offset, blurred shadow layer from a source alpha texture.
  // Returns the GL texture holding the finished shadow (straight-alpha).
  Renderer.prototype.buildShadow = function (srcTex, shadow, w, h) {
    var gl = this.gl;
    if (!this._shadowShader) this._shadowShader = buildShadowShader(gl);
    if (!this._blurShader) this._blurShader = buildBlurShader(gl); // shadow blur may run without a filter
    // dedicated ping-pong textures so we never clobber the filter's textures
    if (!this._shadTex || this._shadW !== w || this._shadH !== h) {
      if (!this._shadTex) {
        this._shadTex = gl.createTexture();
        this._shadTex2 = gl.createTexture();
        this._shadFBO = gl.createFramebuffer();
        this._shadFBO2 = gl.createFramebuffer();
      }
      var mk = function (tex, fbo) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      };
      mk(this._shadTex, this._shadFBO);
      mk(this._shadTex2, this._shadFBO2);
      this._shadW = w; this._shadH = h;
    }
    var quad = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);

    // ---- tint + offset pass: srcTex -> _shadTex ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._shadFBO);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.useProgram(this._shadowShader);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STREAM_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this._shadowShader.uTex, 0);
    gl.uniform4f(this._shadowShader.uShadowColor,
      shadow.color[0], shadow.color[1], shadow.color[2], shadow.color[3]);
    // +offset in device px shifts the shadow toward +x/+y on screen. Screen y is
    // top-down but the framebuffer's V axis is bottom-up, so negate y in UV.
    gl.uniform2f(this._shadowShader.uOffset, shadow.offsetX / w, -shadow.offsetY / h);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    var shadowTex = this._shadTex;

    // ---- blur pass (separable), sigma = shadowBlur/2 ----
    if (shadow.blur > 0) {
      var kern = gaussKernel(shadow.blur / 2);
      this._blurPass(this._shadTex, this._shadFBO2, kern, [1 / w, 0], w, h, quad);
      this._blurPass(this._shadTex2, this._shadFBO, kern, [0, 1 / h], w, h, quad);
      shadowTex = this._shadTex; // horizontal->_shadTex2, vertical->_shadTex
    }
    return shadowTex;
  };

  // Draw a texture as a fullscreen quad onto the current framebuffer with alpha blending
  Renderer.prototype.drawTexture = function (tex, w, h) {
    var gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STREAM_DRAW);
    gl.useProgram(this._filterShader);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(this._filterShader.uTex, 0);
    gl.uniform1f(this._filterShader.uBrightness, 1);
    gl.uniform1f(this._filterShader.uContrust, 1);
    gl.uniform1f(this._filterShader.uGrayscale, 0);
    gl.uniform1f(this._filterShader.uInvert, 0);
    gl.uniform1f(this._filterShader.uOpacity, 1);
    gl.uniform1f(this._filterShader.uSaturate, 1);
    gl.uniform1f(this._filterShader.uSepia, 0);
    gl.uniform1f(this._filterShader.uHueRotate, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  // ---------------------------------------------------------------------------
  // self-intersection decomposer (Bentley-Ottmann sweep + edge classification)
  // so contours that cross themselves (e.g. two consecutive arc() calls with no
  // moveTo between them, which the spec merges into ONE subpath) still fill
  // correctly under both nonzero and even-odd rules.
  // ---------------------------------------------------------------------------
  function polySignedArea(pts) {
    var area = 0;
    for (var i = 0, n = pts.length; i < n; i++) {
      var j = (i + 1) % n;
      area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
    }
    return area / 2;
  }
  function crossZ(x0, y0, x1, y1, x2, y2) {
    return (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  }
  function pointInTri(a, b, c, p) {
    var d1 = crossZ(a[0], a[1], b[0], b[1], p[0], p[1]);
    var d2 = crossZ(b[0], b[1], c[0], c[1], p[0], p[1]);
    var d3 = crossZ(c[0], c[1], a[0], a[1], p[0], p[1]);
    var hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    var hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(hasNeg && hasPos);
  }

  // returns flat [x0,y0, x1,y1, ...] triangle list (ear clipping, simple polygons)
  function triangulate(pts) {
    var n = pts.length;
    if (n < 3) return [];
    var p = pts.slice();
    if (polySignedArea(p) > 0) p.reverse(); // CCW for our crossZ convention

    var out = [];
    while (p.length > 3) {
      var cut = false;
      for (var i = 0; i < p.length; i++) {
        var i0 = (i - 1 + p.length) % p.length;
        var i1 = i;
        var i2 = (i + 1) % p.length;
        var a = p[i0], b = p[i1], c = p[i2];
        if (crossZ(a[0], a[1], b[0], b[1], c[0], c[1]) >= 0) continue;
        var contains = false;
        for (var k = 0; k < p.length; k++) {
          if (k === i0 || k === i1 || k === i2) continue;
          if (pointInTri(a, b, c, p[k])) { contains = true; break; }
        }
        if (contains) continue;
        out.push(a[0], a[1], b[0], b[1], c[0], c[1]);
        p.splice(i1, 1);
        cut = true;
        break;
      }
      if (!cut) break;
    }
    if (p.length === 3) out.push(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1]);
    return out;
  }

  // Like triangulate, but returns per-triangle boundary-edge metadata for edge
  // antialiasing. Each result is { v:[x0,y0,x1,y1,x2,y2], m } where m is a 3-bit
  // mask: bit0 = edge(vertex0,vertex1) lies on the ring outline, bit1 = edge
  // (vertex1,vertex2), bit2 = edge(vertex2,vertex0). Internal ear-clipping
  // diagonals have those bits unset, so a fragment shader can fade only the true
  // shape boundary (no soft seams on interior triangulation edges).
  function triangulateExt(pts) {
    var n = pts.length;
    if (n < 3) return [];
    var p = pts.slice();
    if (polySignedArea(p) > 0) p.reverse(); // CCW for our crossZ convention
    var B = {};
    for (var i = 0; i < pts.length; i++) {
      var ea = pts[i], eb = pts[(i + 1) % pts.length];
      B[ea[0] + "," + ea[1] + ">" + eb[0] + "," + eb[1]] = true;
    }
    function isB(x1, y1, x2, y2) {
      return !!(B[x1 + "," + y1 + ">" + x2 + "," + y2] || B[x2 + "," + y2 + ">" + x1 + "," + y1]);
    }
    function emitPoly(poly) {
      var a = poly[0], b = poly[1], c = poly[2];
      var m = 0;
      if (isB(a[0], a[1], b[0], b[1])) m |= 1;
      if (isB(b[0], b[1], c[0], c[1])) m |= 2;
      if (isB(c[0], c[1], a[0], a[1])) m |= 4;
      return { v: [a[0], a[1], b[0], b[1], c[0], c[1]], m: m };
    }
    var out = [];
    while (p.length > 3) {
      var cut = false;
      for (var k = 0; k < p.length; k++) {
        var i0 = (k - 1 + p.length) % p.length;
        var i1 = k;
        var i2 = (k + 1) % p.length;
        var a = p[i0], b = p[i1], c = p[i2];
        if (crossZ(a[0], a[1], b[0], b[1], c[0], c[1]) >= 0) continue;
        var contains = false;
        for (var mm = 0; mm < p.length; mm++) {
          if (mm === i0 || mm === i1 || mm === i2) continue;
          if (pointInTri(a, b, c, p[mm])) { contains = true; break; }
        }
        if (contains) continue;
        out.push(emitPoly([a, b, c]));
        p.splice(i1, 1);
        cut = true;
        break;
      }
      if (!cut) break;
    }
    if (p.length === 3) out.push(emitPoly(p));
    return out;
  }

  // ---------------------------------------------------------------------------
  // Self-intersecting contour decomposition (Bentley-Ottmann + edge classify,
  // after the Mapbox polygon-clipping approach). Splits a self-crossing ring
  // into simple rings whose signed area sums to the original. The caller then
  // applies winding (nonzero) or parity (evenodd) semantics per ring.
  // ---------------------------------------------------------------------------
  function orient(pts) {
    var n = pts.length;
    if (n < 3) return [];
    var a = polySignedArea(pts);
    var out = [], i;
    if (a > 0) { // positive -> reverse to CW (negative)
      for (i = n - 1; i >= 0; i--) out.push(pts[i]);
    } else {
      for (i = 0; i < n; i++) out.push(pts[i]);
    }
    return out;
  }

  // Given a ring (array of [x,y]) that may self-intersect, decompose into simple
  // rings (each an array of [x,y], CW = negative signed area). Splits edges at all
  // proper crossings, then walks the planar graph with the standard "sharpest left
  // turn" rule, which yields non-self-intersecting face boundaries. Resulting ring
  // areas sum (algebraically) to the original contour's signed area.
  // mode: "nonzero" (default) decomposes into planar faces via the sharpest-turn
  // walk (correct for nonzero winding, which sums signed areas). "evenodd" instead
  // follows the ORIGINAL curve through each crossing (continue on the same source
  // edge), producing simple loops whose per-pixel containment count equals the
  // even-odd parity (pixel filled iff inside an odd number of loops).
  function decomposeRing(ring, mode) {
    var n = ring.length;
    if (n < 3) return [];
    // fast path: no self-intersections -> already simple
    var hasSelf = false;
    for (var i = 0; i < n && !hasSelf; i++) {
      for (var j = i + 2; j < n && !hasSelf; j++) {
        if (i === 0 && j === n - 1) continue; // adjacent via wrap
        if (properIntersection(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) hasSelf = true;
      }
    }
    if (!hasSelf) return [orient(ring)];

    // Build planar graph: vertices = original points + intersection points.
    var verts = [];
    var vIndex = {};
    function vid(x, y) {
      var k = x + "," + y;
      if (!(k in vIndex)) { vIndex[k] = verts.length; verts.push([x, y]); }
      return vIndex[k];
    }
    var origIds = [];
    for (var i = 0; i < n; i++) origIds.push(vid(ring[i][0], ring[i][1]));

    // Split each original edge at its proper intersection points.
    var subEdges = []; // {a: vid, b: vid, oi: original edge index}
    function addSub(a, b, oi) { if (a !== b) subEdges.push({ a: a, b: b, oi: oi }); }

    for (var i = 0; i < n; i++) {
      var p1 = ring[i], p2 = ring[(i + 1) % n];
      var id1 = origIds[i], id2 = origIds[(i + 1) % n];
      var hits = [];
      // check ALL non-adjacent edges (both directions; a crossing with edge j
      // must split BOTH i and j)
      for (var j = 0; j < n; j++) {
        if (j === i || j === (i + 1) % n || j === (i - 1 + n) % n) continue;
        var pt = properIntersection(p1, p2, ring[j], ring[(j + 1) % n]);
        if (pt) hits.push(pt);
      }
      hits.sort(function (a, b) { return a[2] - b[2]; });
      var prev = id1;
      for (var h = 0; h < hits.length; h++) {
        var hv = vid(hits[h][0], hits[h][1]);
        addSub(prev, hv, i);
        prev = hv;
      }
      addSub(prev, id2, i);
    }

    // Adjacency: at each vertex, list outgoing directed sub-edges sorted by angle.
    // Each undirected split-edge is walkable in BOTH directions -- nonzero's
    // face tracer needs both sides available to find every face of the planar
    // subdivision (including inner faces like the lens between two circles),
    // not just the one direction the original path happened to traverse it in.
    var adj = [];
    for (var v = 0; v < verts.length; v++) adj.push([]);
    var dirEdges = []; // {a, b, oi, fwd} -- fwd=true is subEdges' own direction
    for (var e = 0; e < subEdges.length; e++) {
      var se = subEdges[e];
      dirEdges.push({ a: se.a, b: se.b, oi: se.oi, fwd: true });
      dirEdges.push({ a: se.b, b: se.a, oi: se.oi, fwd: false });
    }
    for (var de = 0; de < dirEdges.length; de++) {
      adj[dirEdges[de].a].push({ to: dirEdges[de].b, idx: de, oi: dirEdges[de].oi });
    }
    for (v = 0; v < verts.length; v++) {
      adj[v].sort(function (a, b) { return angleOf(v, a.to) - angleOf(v, b.to); });
    }

    function angleOf(v, to) {
      var dx = verts[to][0] - verts[v][0];
      var dy = verts[to][1] - verts[v][1];
      return Math.atan2(dy, dx);
    }

    var evenOdd = mode === "evenodd";
    var used = new Array(dirEdges.length).fill(false);
    var rings = [];
    // evenodd only needs to retrace the original curve once per direction
    // (its subEdges, not the synthetic reverse copies) to reproduce it as-is;
    // nonzero needs every directed edge walked once to find every face.
    var startCount = evenOdd ? subEdges.length : dirEdges.length;
    for (var e0 = 0; e0 < startCount; e0++) {
      if (used[e0]) continue;
      var cur = dirEdges[e0].a, next = dirEdges[e0].b;
      var oiIn = dirEdges[e0].oi;
      used[e0] = true;
      var path = [cur];
      var guard = 0, maxGuard = dirEdges.length * 2 + 4;
      while (guard++ < maxGuard) {
        path.push(next);
        var options = adj[next];
        var best = -1, bestTurn = null;
        if (evenOdd) {
          // Follow the SAME original edge through the crossing: the continuation
          // is the (unused) outgoing sub-edge sharing our source edge id. This is
          // unique, so it reproduces the original curve instead of a face loop.
          for (var k = 0; k < options.length; k++) {
            var o = options[k];
            if (o.to === cur) continue;
            if (used[o.idx]) continue;
            if (o.oi === oiIn) { best = o.to; break; }
          }
          if (best < 0) break;
          // continuation's source edge: after a crossing we switch to the id of
          // the edge we just stepped onto.
          for (k = 0; k < options.length; k++) if (options[k].to === best) { oiIn = options[k].oi; break; }
        } else {
          // incoming direction at `next`: from cur to next
          var inAng = angleOf(cur, next);
          for (k = 0; k < options.length; k++) {
            var o2 = options[k];
            if (o2.to === cur) continue;
            if (used[o2.idx]) continue;
            var outAng = angleOf(next, o2.to);
            var d = outAng - inAng;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            // SHARPEST RIGHT TURN = most negative (clockwise) turn. This yields
            // non-self-intersecting face boundaries of the planar subdivision.
            if (bestTurn === null || d < bestTurn) { bestTurn = d; best = o2.to; }
          }
          if (best < 0) break;
        }
        var realIdx = -1;
        for (k = 0; k < options.length; k++) if (options[k].to === best) { realIdx = options[k].idx; break; }
        used[realIdx] = true;
        cur = next; next = best;
        if (next === path[0]) { path.pop(); break; }
      }
      if (path.length >= 3) rings.push(path.map(function (id) { return verts[id]; }));
    }
    // Face-tracing finds every face of the planar subdivision, but only the
    // ones actually "inside" per the fill rule should be kept -- test each
    // face's centroid against the ORIGINAL (un-split) ring's winding number.
    var kept = [];
    for (var r = 0; r < rings.length; r++) {
      var c = polyCentroid(rings[r]);
      var w = windingNumber(ring, c);
      var inside = evenOdd ? (Math.abs(w) % 2 === 1) : (w !== 0);
      if (inside) kept.push(orient(rings[r]));
    }
    return kept;
  }

  // signed winding number of `ring` around point p (standard crossing-number
  // method: count each edge that crosses the horizontal ray at p.y, signed by
  // which way it crosses). Used to test which faces of a self-intersecting
  // ring's planar subdivision are actually "inside" under the nonzero/evenodd
  // rule, since face-tracing alone finds every face, filled or not.
  function windingNumber(ring, p) {
    var w = 0, n = ring.length;
    var px = p[0], py = p[1];
    for (var i = 0; i < n; i++) {
      var a = ring[i], b = ring[(i + 1) % n];
      if (a[1] <= py) {
        if (b[1] > py && crossZ(a[0], a[1], b[0], b[1], px, py) > 0) w++;
      } else {
        if (b[1] <= py && crossZ(a[0], a[1], b[0], b[1], px, py) < 0) w--;
      }
    }
    return w;
  }
  function polyCentroid(pts) {
    var n = pts.length, x = 0, y = 0;
    for (var i = 0; i < n; i++) { x += pts[i][0]; y += pts[i][1]; }
    return [x / n, y / n];
  }

  // returns [x, y, t] with t in (0,1) along a->b, or null
  function properIntersection(a, b, c, d) {
    var d1x = b[0] - a[0], d1y = b[1] - a[1];
    var d2x = d[0] - c[0], d2y = d[1] - c[1];
    var den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) return null;
    var t = ((c[0] - a[0]) * d2y - (c[1] - a[1]) * d2x) / den;
    var u = ((c[0] - a[0]) * d1y - (c[1] - a[1]) * d1x) / den;
    if (t > 1e-9 && t < 1 - 1e-9 && u > 1e-9 && u < 1 - 1e-9) {
      return [a[0] + t * d1x, a[1] + t * d1y, t];
    }
    return null;
  }

  // Decompose a list of subpath point-lists into simple rings with semantics:
  //   rule "nonzero": all rings (each subpath decomposed), caller triangulates each.
  //   rule "evenodd": same, but caller applies parity by counting rings per pixel.
  // Returns array of simple rings ([[x,y],...]).
  function decomposeForFill(subpaths, mode) {
    var out = [];
    for (var i = 0; i < subpaths.length; i++) {
      var pts = subpaths[i];
      if (!pts || pts.length < 3) continue;
      // drop consecutive duplicates
      var clean = [];
      for (var k = 0; k < pts.length; k++) {
        var lastPt = clean[clean.length - 1];
        if (!lastPt || lastPt[0] !== pts[k][0] || lastPt[1] !== pts[k][1]) clean.push(pts[k]);
      }
      // closed subpath: first==last is dropped (we treat ring as cyclic)
      if (clean.length > 1 && clean[0][0] === clean[clean.length - 1][0] && clean[0][1] === clean[clean.length - 1][1]) {
        clean.pop();
      }
      if (clean.length < 3) continue;
      var rings = decomposeRing(clean, mode);
      for (var r = 0; r < rings.length; r++) out.push(rings[r]);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Stroke widening -> flat triangle list
  // ---------------------------------------------------------------------------
  // Stroke widening -> flat triangle list. Handles caps at endpoints of open
  // polylines and joins at every interior vertex (open or closed). miterLimit is
  // honored: miters whose length exceeds the limit degrade to bevel.
  function strokePoints(pts, closed, halfWidth, cap, join, miterLimit) {
    var out = [];
    var n = pts.length;
    if (n < 2) return out;
    miterLimit = miterLimit == null ? 10 : miterLimit;

    function quad(x1, y1, x2, y2, x3, y3, x4, y4) {
      out.push(x1, y1, x2, y2, x3, y3, x1, y1, x3, y3, x4, y4);
    }
    function fan(cx, cy, r, a0, a1) {
      if (a1 < a0) { var t = a0; a0 = a1; a1 = t; }
      var steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (M_PI / 6)));
      for (var s = 0; s < steps; s++) {
        out.push(cx, cy,
          cx + r * Math.cos(a0 + (a1 - a0) * s / steps), cy + r * Math.sin(a0 + (a1 - a0) * s / steps),
          cx + r * Math.cos(a0 + (a1 - a0) * (s + 1) / steps), cy + r * Math.sin(a0 + (a1 - a0) * (s + 1) / steps));
      }
    }
    function miter(ax, ay, ux1, uy1, bx, by, ux2, uy2) {
      var den = ux1 * uy2 - uy1 * ux2;
      if (Math.abs(den) < 1e-9) return null;
      var t = ((bx - ax) * uy2 - (by - ay) * ux2) / den;
      return [ax + t * ux1, ay + t * uy1];
    }

    // per-vertex normals & segment directions
    var S = [];
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var p0 = pts[i], p1 = pts[j];
      var dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 1e-12;
      S.push({ ux: dx / len, uy: dy / len, nx: -dy / len, ny: dx / len, ax: p0[0], ay: p0[1], bx: p1[0], by: p1[1] });
    }
    var bodySegs = closed ? n : n - 1;

    // body quads
    for (i = 0; i < bodySegs; i++) {
      var s = S[i];
      quad(s.ax + s.nx * halfWidth, s.ay + s.ny * halfWidth,
           s.bx + s.nx * halfWidth, s.by + s.ny * halfWidth,
           s.bx - s.nx * halfWidth, s.by - s.ny * halfWidth,
           s.ax - s.nx * halfWidth, s.ay - s.ny * halfWidth);
    }

    // join (extend) a vertex shared by segments s0 (outgoing) and s1 (incoming at v).
    // The "left normal" (nx,ny) only faces the exterior/convex side of the joint when
    // the path turns one particular way there; on the other turn it faces the interior,
    // where the two body quads already overlap and a join drawn there is invisible while
    // the real exterior corner is left with a gap. cross(s0.dir, s1.dir) > 0 is exactly
    // the case where the left normal faces inward, so the join is built on -n instead.
    function doJoin(vx, vy, s0, s1) {
      var cross = s0.ux * s1.uy - s0.uy * s1.ux;
      var sign = cross > 0 ? -1 : 1;
      var s0nx = s0.nx * sign, s0ny = s0.ny * sign;
      var s1nx = s1.nx * sign, s1ny = s1.ny * sign;
      var L0 = [vx + s0nx * halfWidth, vy + s0ny * halfWidth];
      var L1 = [vx + s1nx * halfWidth, vy + s1ny * halfWidth];
      var M = miter(vx + s0nx * halfWidth, vy + s0ny * halfWidth, s0.ux, s0.uy,
                    vx + s1nx * halfWidth, vy + s1ny * halfWidth, s1.ux, s1.uy);
      var miterLen = M ? Math.hypot(M[0] - vx, M[1] - vy) : Infinity;
      var useMiter = M && (miterLen <= halfWidth * miterLimit);
      if (join === "round") {
        // L0/L1 sit at angles a0/a1 from the vertex (that's what nx,ny encode) --
        // the round join fans directly between them, taking the shorter way around.
        var a0 = Math.atan2(s0ny, s0nx), a1 = Math.atan2(s1ny, s1nx);
        var d = a1 - a0;
        while (d > M_PI) d -= M_TWO_PI;
        while (d < -M_PI) d += M_TWO_PI;
        fan(vx, vy, halfWidth, a0, a0 + d);
      } else if (join === "bevel") {
        out.push(vx, vy, L0[0], L0[1], L1[0], L1[1]);
      } else { // miter
        if (useMiter) {
          out.push(vx, vy, L0[0], L0[1], M[0], M[1], vx, vy, M[0], M[1], L1[0], L1[1]);
        } else {
          // miter too long -> bevel
          out.push(vx, vy, L0[0], L0[1], L1[0], L1[1]);
        }
      }
    }

    var k;
    if (closed) {
      for (k = 0; k < n; k++) doJoin(S[k].bx, S[k].by, S[k], S[(k + 1) % n]);
    } else {
      // interior joins at vertices 1..n-2
      for (k = 1; k < n - 1; k++) doJoin(S[k].ax, S[k].ay, S[k - 1], S[k]);
      // end caps at the two endpoints
      var fs = S[0];
      var fa = Math.atan2(fs.ny, fs.nx);
      if (cap === "round") {
        fan(fs.ax, fs.ay, halfWidth, fa, fa + Math.PI);
      } else if (cap === "square") {
        var ex = fs.ax - fs.ux * halfWidth, ey = fs.ay - fs.uy * halfWidth;
        quad(ex + fs.nx * halfWidth, ey + fs.ny * halfWidth,
             fs.ax + fs.nx * halfWidth, fs.ay + fs.ny * halfWidth,
             fs.ax - fs.nx * halfWidth, fs.ay - fs.ny * halfWidth,
             ex - fs.nx * halfWidth, ey - fs.ny * halfWidth);
      }
      var es = S[n - 2];
      var ea = Math.atan2(es.ny, es.nx);
      if (cap === "round") {
        fan(es.bx, es.by, halfWidth, ea + Math.PI, ea + 2 * Math.PI);
      } else if (cap === "square") {
        var ex2 = es.bx + es.ux * halfWidth, ey2 = es.by + es.uy * halfWidth;
        quad(ex2 + es.nx * halfWidth, ey2 + es.ny * halfWidth,
             es.ax + es.nx * halfWidth, es.ay + es.ny * halfWidth,
             ex2 - es.nx * halfWidth, ey2 - es.ny * halfWidth,
             ex2 - es.nx * halfWidth, ey2 - es.ny * halfWidth);
      }
    }
    return out;
  }
// ---------------------------------------------------------------------------
  // Path2D-like internal path storage
  // ---------------------------------------------------------------------------
  // Path2D-compatible: can be constructed on its own or cloned from another path
  function Path(other) {
    this.subpaths = [];   // each: { pts: [[x,y],...], closed: bool }
    this.cur = null;
    if (typeof other === "string") {
      this.addSvg(other);
    } else if (other instanceof Path) {
      for (var i = 0; i < other.subpaths.length; i++) {
        var s = other.subpaths[i];
        this.subpaths.push({ pts: s.pts.map(function (p) { return p.slice(); }), closed: s.closed });
      }
    }
  }

  // ---- SVG path `d` parsing (Path2D(svgString)) ----
  function svgTokenize(d) {
    var toks = [], i = 0, n = d.length;
    var CMD = "MmLlHhVvCcSsQqTtAaZz";
    while (i < n) {
      var c = d[i];
      if (CMD.indexOf(c) >= 0) { toks.push(["c", c]); i++; continue; }
      if (c === " " || c === "," || c === "\t" || c === "\n" || c === "\r") { i++; continue; }
      if ((c >= "0" && c <= "9") || c === "." || c === "-" || c === "+") {
        var s = "";
        while (i < n) {
          var cc = d[i];
          if (cc === "+" || cc === "-") {
            if (s.length > 0 && !/[eE]$/.test(s)) break; // adjacent new number
            s += cc; i++; continue;
          }
          if (/[0-9eE.]/.test(cc)) { s += cc; i++; continue; }
          break;
        }
        toks.push(["n", parseFloat(s)]);
        continue;
      }
      i++;
    }
    return toks;
  }
  // SVG arc endpoint -> center parameterization (SVG spec F.6.5), then sample points.
  function svgArcPoints(x1, y1, rx, ry, phiDeg, largeArc, sweep, x2, y2) {
    var phi = phiDeg * Math.PI / 180;
    var cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
    var dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2;
    var x1p = cosPhi * dx2 + sinPhi * dy2;
    var y1p = -sinPhi * dx2 + cosPhi * dy2;
    rx = Math.abs(rx); ry = Math.abs(ry);
    var lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { var sr = Math.sqrt(lam); rx *= sr; ry *= sr; }
    var sign = (largeArc === sweep) ? -1 : 1;
    var num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    var den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    var coef = sign * Math.sqrt(Math.max(0, num / den));
    var cxp = coef * (rx * y1p / ry);
    var cyp = coef * (-ry * x1p / rx);
    var cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
    var cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
    var th1 = Math.atan2((y1p - cyp) / ry, (x1p - cxp) / rx);
    var th2 = Math.atan2((-y1p - cyp) / ry, (-x1p - cxp) / rx);
    var dth = th2 - th1;
    if (!sweep && dth > 0) dth -= M_TWO_PI;
    else if (sweep && dth < 0) dth += M_TWO_PI;
    var segs = Math.max(2, Math.ceil(Math.abs(dth) / (Math.PI / 12)));
    var pts = [];
    for (var k2 = 0; k2 <= segs; k2++) {
      var t = th1 + dth * k2 / segs;
      var ct = Math.cos(t), st = Math.sin(t);
      pts.push([cx + rx * ct * cosPhi - ry * st * sinPhi,
                cy + rx * ct * sinPhi + ry * st * cosPhi]);
    }
    return pts;
  }
  function addSvgPath(path, d) {
    var toks = svgTokenize(d);
    var k = 0;
    function num() { return toks[k++][1]; }
    var cmd = "M", cur = [0, 0], needMove = false, lastCtl = [0, 0], lastCtl2 = [0, 0];
    function rel(x, y) { cur = [x, y]; }
    while (k < toks.length) {
      if (toks[k][0] === "c") { cmd = toks[k++][1]; }
      var abs = cmd === cmd.toUpperCase();
      switch (cmd.toUpperCase()) {
        case "M": {
          while (k < toks.length && toks[k][0] === "n") {
            var mx = num(), my = num();
            if (abs) { cur = [mx, my]; } else { cur = [cur[0] + mx, cur[1] + my]; }
            if (needMove) { path.moveTo(cur[0], cur[1]); needMove = false; }
            else { path.moveTo(cur[0], cur[1]); }
          }
          cmd = abs ? "L" : "l"; // implicit lineto after moveto
          break;
        }
        case "L": {
          while (k < toks.length && toks[k][0] === "n") {
            var lx = num(), ly = num();
            if (needMove) { path.moveTo(cur[0], cur[1]); needMove = false; }
            if (abs) { path.lineTo(lx, ly); cur = [lx, ly]; }
            else { path.lineTo(cur[0] + lx, cur[1] + ly); cur = [cur[0] + lx, cur[1] + ly]; }
          }
          break;
        }
        case "H": {
          while (k < toks.length && toks[k][0] === "n") {
            var hx = num();
            if (needMove) { path.moveTo(cur[0], cur[1]); needMove = false; }
            var nx = abs ? hx : cur[0] + hx;
            path.lineTo(nx, cur[1]); cur = [nx, cur[1]];
          }
          break;
        }
        case "V": {
          while (k < toks.length && toks[k][0] === "n") {
            var vy = num();
            if (needMove) { path.moveTo(cur[0], cur[1]); needMove = false; }
            var ny = abs ? vy : cur[1] + vy;
            path.lineTo(cur[0], ny); cur = [cur[0], ny];
          }
          break;
        }
        case "C": {
          while (k < toks.length && toks[k][0] === "n") {
            var c1x = num(), c1y = num(), c2x = num(), c2y = num(), cx2 = num(), cy2 = num();
            if (needMove) { path.moveTo(cur[0], cur[1]); needMove = false; }
            var c1 = abs ? [c1x, c1y] : [cur[0] + c1x, cur[1] + c1y];
            var c2 = abs ? [c2x, c2y] : [cur[0] + c2x, cur[1] + c2y];
            var e = abs ? [cx2, cy2] : [cur[0] + cx2, cur[1] + cy2];
            path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
            lastCtl = c2; cur = e;
          }
          break;
        }
        case "S": {
          while (k < toks.length && toks[k][0] === "n") {
            var s2x = num(), s2y = num(), sx2 = num(), sy2 = num();
            if (needMove) { path.moveTo(cur[0], cur[1]); needMove = false; }
            var c1 = (cmd.toUpperCase() === "S") ? [2 * cur[0] - lastCtl[0], 2 * cur[1] - lastCtl[1]] : [0, 0];
            var c2 = abs ? [s2x, s2y] : [cur[0] + s2x, cur[1] + s2y];
            var e = abs ? [sx2, sy2] : [cur[0] + sx2, cur[1] + sy2];
            path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
            lastCtl = c2; cur = e;
          }
          break;
        }
        case "Q": {
          while (k < toks.length && toks[k][0] === "n") {
            var q1x = num(), q1y = num(), qx2 = num(), qy2 = num();
            if (needMove) { path.moveTo(cur[0], cur[1]); needMove = false; }
            var c1 = abs ? [q1x, q1y] : [cur[0] + q1x, cur[1] + q1y];
            var e = abs ? [qx2, qy2] : [cur[0] + qx2, cur[1] + qy2];
            path.quadraticCurveTo(c1[0], c1[1], e[0], e[1]);
            lastCtl = c1; cur = e;
          }
          break;
        }
        case "T": {
          while (k < toks.length && toks[k][0] === "n") {
            var tx2 = num(), ty2 = num();
            if (needMove) { path.moveTo(cur[0], cur[1]); needMove = false; }
            var c1 = (cmd.toUpperCase() === "T") ? [2 * cur[0] - lastCtl[0], 2 * cur[1] - lastCtl[1]] : [cur[0], cur[1]];
            var e = abs ? [tx2, ty2] : [cur[0] + tx2, cur[1] + ty2];
            path.quadraticCurveTo(c1[0], c1[1], e[0], e[1]);
            lastCtl = c1; cur = e;
          }
          break;
        }
        case "A": {
          while (k < toks.length && toks[k][0] === "n") {
            var arx = num(), ary = num(), arot = num(), lf = num(), sf = num(), ax = num(), ay = num();
            if (needMove) { path.moveTo(cur[0], cur[1]); needMove = false; }
            var e = abs ? [ax, ay] : [cur[0] + ax, cur[1] + ay];
            var pts = svgArcPoints(cur[0], cur[1], arx, ary, arot, lf !== 0, sf !== 0, e[0], e[1]);
            path.arcToPiecewise(pts.slice(1));
            cur = e;
          }
          break;
        }
        case "Z": {
          path.closePath(); needMove = true; cur = path.subpaths.length ? [path.subpaths[path.subpaths.length - 1].pts[0][0], path.subpaths[path.subpaths.length - 1].pts[0][1]] : cur;
          break;
        }
        default: break;
      }
    }
  }
  Path.prototype.addSvg = function (d) { addSvgPath(this, d); };
  Path.prototype.moveTo = function (x, y) {
    this.cur = { pts: [[x, y]], closed: false };
    this.subpaths.push(this.cur);
  };
  Path.prototype.lineTo = function (x, y) {
    if (!this.cur) { this.moveTo(x, y); return; }
    this.cur.pts.push([x, y]);
  };
  Path.prototype.closePath = function () {
    if (this.cur) this.cur.closed = true;
  };
  Path.prototype.rect = function (x, y, w, h) {
    var p = this;
    p.moveTo(x, y); p.lineTo(x + w, y); p.lineTo(x + w, y + h); p.lineTo(x, y + h); p.closePath();
  };
  // roundRect with CSS radii: number or array (1-4). Defaults to 0. Clamps to half-side.
  Path.prototype.roundRect = function (x, y, w, h, radii) {
    var r;
    if (radii === undefined || radii === null || radii === 0) r = [0, 0, 0, 0];
    else if (typeof radii === "number") r = [radii, radii, radii, radii];
    else if (radii instanceof Array) {
      // spec: expand 1-3 entries then clamp negatives to 0
      var v = [];
      for (var i = 0; i < 4; i++) v[i] = Math.max(0, +radii[Math.min(i, radii.length - 1)] || 0);
      if (radii.length === 1) r = [v[0], v[0], v[0], v[0]];
      else if (radii.length === 2) r = [v[0], v[1], v[0], v[1]];
      else if (radii.length === 3) r = [v[0], v[1], v[2], v[1]];
      else r = v;
    } else r = [0, 0, 0, 0];
    var max = Math.min(Math.abs(w), Math.abs(h)) / 2;
    var tl = Math.min(r[0], max), tr = Math.min(r[1], max),
        br = Math.min(r[2], max), bl = Math.min(r[3], max);
    // Normalize so w,h are positive extents in world space.
    var x0 = Math.min(x, x + w), y0 = Math.min(y, y + h);
    var x2 = Math.max(x, x + w), y2 = Math.max(y, y + h);
    var W = Math.abs(w), H = Math.abs(h);
    var corner = function (cx, cy, rad, a0, a1) { // ccw arc around center (cx,cy)
      var n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / (M_PI / 12)));
      for (var i = 1; i <= n; i++) {
        var t = a0 + (a1 - a0) * i / n;
        this.cur.pts.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t)]);
      }
    };
    this.moveTo(x0 + tl, y0);
    this.lineTo(x2 - tr, y0);
    if (tr > 0) corner.call(this, x2 - tr, y0 + tr, tr, -M_PI / 2, 0);   // top-right
    this.lineTo(x2, y2 - br);
    if (br > 0) corner.call(this, x2 - br, y2 - br, br, 0, M_PI / 2);    // bottom-right
    this.lineTo(x0 + bl, y2);
    if (bl > 0) corner.call(this, x0 + bl, y2 - bl, bl, M_PI / 2, M_PI); // bottom-left
    this.lineTo(x0, y0 + tl);
    if (tl > 0) corner.call(this, x0 + tl, y0 + tl, tl, M_PI, M_PI * 3 / 2); // top-left
    this.cur.closed = true;
  };
  Path.prototype.arc = function (x, y, r, start, end, anticlockwise) {
    this.arcToPiecewise(arcToPointsCenter(x, y, r, start, end, anticlockwise));
  };
  Path.prototype.ellipse = function (x, y, rx, ry, rotation, start, end, anticlockwise) {
    this.arcToPiecewise(ellipsePoints(x, y, rx, ry, rotation, start, end, anticlockwise));
  };
  Path.prototype.quadraticCurveTo = function (cx, cy, x, y) {
    var last = this.cur ? this.cur.pts[this.cur.pts.length - 1] : [0, 0];
    this.arcToPiecewise(quadraticToPoints(last[0], last[1], cx, cy, x, y));
  };
  Path.prototype.bezierCurveTo = function (c1x, c1y, c2x, c2y, x, y) {
    var last = this.cur ? this.cur.pts[this.cur.pts.length - 1] : [0, 0];
    this.arcToPiecewise(cubicToPoints(last[0], last[1], c1x, c1y, c2x, c2y, x, y));
  };
  Path.prototype.arcTo = function (x1, y1, x2, y2, r) {
    if (!this.cur) { this.moveTo(x1, y1); return; }
    var last = this.cur.pts[this.cur.pts.length - 1];
    var res = arcToGeometry(last[0], last[1], x1, y1, x2, y2, r);
    if (!res) { this.lineTo(x1, y1); return; }
    this.arcToPiecewise(arcToPointsCenter(res.cx, res.cy, r, res.a0, res.a1, false));
  };
  Path.prototype.arcToPiecewise = function (pts) {
    if (!this.cur) this.moveTo(pts[0][0], pts[0][1]);
    var last = this.cur.pts[this.cur.pts.length - 1];
    var i0 = (last && last[0] === pts[0][0] && last[1] === pts[0][1]) ? 1 : 0;
    for (var i = i0; i < pts.length; i++) this.cur.pts.push([pts[i][0], pts[i][1]]);
  };
  Path.prototype.addPath = function (path) {
    if (!(path instanceof Path)) return;
    for (var i = 0; i < path.subpaths.length; i++) {
      var s = path.subpaths[i];
      this.subpaths.push({ pts: s.pts.slice(), closed: s.closed });
    }
  };

  // Triangulate ONE subpath's points. Self-intersecting contours (e.g. two
  // consecutive arc() calls with no moveTo between) are decomposed into simple
  // rings first; each ring is ear-clipped independently. For nonzero fills the
  // union of all resulting triangles equals the winding fill of the original
  // contour (verified: area-preserving decomposition).
  Path.prototype.triangulateSubpath = function (pts) {
    var out = [];
    var rings = decomposeForFill([pts]);
    for (var i = 0; i < rings.length; i++) out = out.concat(triangulate(rings[i]));
    return out;
  };
  // triangles for fill. nonzero (default): union of all subpaths (self-crossing
  // contours decomposed into simple rings first). evenodd: same triangulation —
  // the caller combines per-subpath lists with stencil parity, which is correct
  // because each subpath's triangles now cover exactly its winding region.
  Path.prototype.toFillTriangles = function (fillRule) {
    var out = [];
    for (var i = 0; i < this.subpaths.length; i++)
      out = out.concat(this.triangulateSubpath(this.subpaths[i].pts));
    return out;
  };
  // Per-subpath triangle lists, used by the stencil even-odd fill.
  Path.prototype.toEvenOddTriangles = function () {
    var tris = [];
    for (var i = 0; i < this.subpaths.length; i++) {
      tris.push(this.triangulateSubpath(this.subpaths[i].pts));
    }
    return tris;
  };
  // Triangles (with boundary-edge masks) for the AA fill pass. Decomposes each
  // subpath into simple rings then tags which triangle edges are ring outlines.
  Path.prototype.toFillTrianglesExt = function () {
    var out = [];
    for (var i = 0; i < this.subpaths.length; i++) {
      var pts = this.subpaths[i].pts;
      if (!pts || pts.length < 3) continue;
      var rings = decomposeForFill([pts]);
      for (var r = 0; r < rings.length; r++) out = out.concat(triangulateExt(rings[r]));
    }
    return out;
  };
  // Simple-ring point lists for per-subpixel even-odd coverage. Each subpath is
  // decomposed into simple rings; parity = (# rings containing the pixel) mod 2.
  Path.prototype.toEvenOddRings = function () {
    var rings = [];
    for (var i = 0; i < this.subpaths.length; i++) {
      var pts = this.subpaths[i].pts;
      if (!pts || pts.length < 3) continue;
      // For even-odd fill, pass the raw subpath points as a single ring.
      // The shader's inRing() ray-crossing test naturally gives even-odd
      // parity for self-intersecting polygons, so no decomposition is needed.
      // Decomposing with the "evenodd" mode produced broken rings (the
      // follow-same-edge walk loses coverage at crossings).
      var clean = [];
      for (var k = 0; k < pts.length; k++) {
        var last = clean[clean.length - 1];
        if (!last || last[0] !== pts[k][0] || last[1] !== pts[k][1]) clean.push(pts[k]);
      }
      if (clean.length > 1 && clean[0][0] === clean[clean.length - 1][0] && clean[0][1] === clean[clean.length - 1][1]) {
        clean.pop();
      }
      if (clean.length >= 3) rings.push(clean);
    }
    return rings;
  };
  // Per-subpath, per-ring AA triangles (with boundary masks). Used by the even-odd
  // stencil: each ring is counted independently (strictly-inside) so the parity at
  // subpath boundaries matches native instead of the hard-fan binary test.
  Path.prototype.toEvenOddRingExt = function () {
    var all = [];
    for (var i = 0; i < this.subpaths.length; i++) {
      var pts = this.subpaths[i].pts;
      if (!pts || pts.length < 3) continue;
      var rings = decomposeForFill([pts], "evenodd");
      var ringTris = [];
      for (var r = 0; r < rings.length; r++) ringTris.push(triangulateExt(rings[r]));
      all.push(ringTris);
    }
    return all;
  };
  // split a polyline into dash/space runs given a dash pattern (array of lengths) and
  // a starting offset. Returns array of { pts, closed } sub-polylines each being a dash run.
  function dashSubpaths(pts, closed, lineDash, lineDashOffset) {
    if (!lineDash || lineDash.length === 0) return [{ pts: pts, closed: closed }];
    var pattern = lineDash;
    var patLen = 0, i;
    for (i = 0; i < pattern.length; i++) patLen += pattern[i];
    if (patLen <= 0) return [{ pts: pts, closed: closed }];
    // walk parametric distance t along the polyline
    var segs = [];                     // {x0,y0,x1,y1,len,ax,ay}
    var total = 0, j;
    for (j = 0; j < pts.length - 1; j++) {
      var ax = pts[j + 1][0] - pts[j][0], ay = pts[j + 1][1] - pts[j][1];
      var len = Math.sqrt(ax * ax + ay * ay);
      segs.push({ x0: pts[j][0], y0: pts[j][1], ax: ax, ay: ay, len: len });
      total += len;
    }
    if (closed && pts.length > 0) {
      var lx = pts[0][0] - pts[pts.length - 1][0], ly = pts[0][1] - pts[pts.length - 1][1];
      var llen = Math.sqrt(lx * lx + ly * ly);
      segs.push({ x0: pts[pts.length - 1][0], y0: pts[pts.length - 1][1], ax: lx, ay: ly, len: llen });
      total += llen;
    }
    if (total === 0) return [];
    // normalize offset into [0, patLen)
    var off = lineDashOffset % patLen;
    if (off < 0) off += patLen;
    var out = [];
    // find first segment in pattern at distance (off within [0,patLen)); pattern index:
    var pi = 0, patStart = 0; // offset into pattern start of current pattern entry
    // iterate: travel total distance; toggle drawing on/off by pattern entries
    var d = -off;               // signed distance; start already consumed `off` into pattern
    // We'll emit runs. Current run buffer:
    var curRun = null;
    var running = false;
    var addPt = function (sx, sy) {
      if (!curRun) { curRun = { pts: [[sx, sy]], closed: false }; out.push(curRun); }
      else curRun.pts.push([sx, sy]);
    };
    for (var s = 0; s < segs.length; s++) {
      var sg = segs[s];
      var segLen = sg.len;
      var pos = 0;
      while (pos < segLen - 1e-9) {
        // find current pattern entry by moving forward from last pattern position
        // normalize current place: distance into pattern = (d mod patLen)
        var nd = d % patLen; if (nd < 0) nd += patLen;
        // find pattern index whose interval contains nd
        var acc = 0, idx = 0;
        for (idx = 0; idx < pattern.length; idx++) { if (nd < acc + pattern[idx]) break; acc += pattern[idx]; }
        var dash = pattern[idx];           // length of current entry
        var entryStart = acc;              // start of current entry within pattern
        var remain = dash - (nd - entryStart);  // remaining length in this entry
        var take = Math.min(remain, segLen - pos);
        if (idx % 2 === 0) {               // dash (draw)
          if (!running) { addPt(sg.x0 + sg.ax * pos / segLen, sg.y0 + sg.ay * pos / segLen); running = true; }
          addPt(sg.x0 + sg.ax * (pos + take) / segLen, sg.y0 + sg.ay * (pos + take) / segLen);
        } else {                            // gap
          if (running) { running = false; curRun = null; }
        }
        pos += take;
        d += take;
      }
    }
    return out;
  }
  Path.prototype.toStrokeTriangles = function (lineWidth, lineCap, lineJoin, lineDash, lineDashOffset, miterLimit) {
    var out = [];
    var half = lineWidth / 2;
    for (var i = 0; i < this.subpaths.length; i++) {
      var sp = this.subpaths[i];
      var runs = dashSubpaths(sp.pts, sp.closed, lineDash, lineDashOffset);
      for (var k = 0; k < runs.length; k++) {
        out = out.concat(strokePoints(runs[k].pts, runs[k].closed, half, lineCap, lineJoin, miterLimit));
      }
    }
    return out;
  };
  Path.prototype.isPointInPath = function (x, y, fillRule) {
    // evenodd: toggle parity across subpaths; nonzero: union
    if (fillRule === "evenodd") {
      var inside = false;
      for (var i = 0; i < this.subpaths.length; i++) {
        if (pointInPolygon(x, y, this.subpaths[i].pts)) inside = !inside;
      }
      return inside;
    }
    for (var j = 0; j < this.subpaths.length; j++) {
      if (pointInPolygon(x, y, this.subpaths[j].pts)) return true;
    }
    return false;
  };// ---------------------------------------------------------------------------
  // Canvas2D context facade bound to a WebGL2 context
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // CanvasGradient
  // ---------------------------------------------------------------------------
  function CanvasGradient(type, a, b, c, d, e, f) {
    this._isGradient = true;
    this.type = type;
    this.stops = [];
    if (type === "linear") { this.p0x = a; this.p0y = b; this.p1x = c; this.p1y = d; }
    else if (type === "conic") { this.cx = a; this.cy = b; this.startAngle = c; }
    else {
      this.c0x = a; this.c0y = b; this.c1x = d; this.c1y = e;
      // degenerate radii: negative clamped to 0, non-finite treated as 0
      this.r0 = isFinite(c) && c >= 0 ? c : 0;
      this.r1 = isFinite(f) && f >= 0 ? f : 0;
    }
  }
  CanvasGradient.prototype.addColorStop = function (offset, color) {
    var off = +offset;
    // spec: invalid (non-finite or out of [0,1]) offsets throw IndexSizeError
    if (!isFinite(off) || off < 0 || off > 1) throw "IndexSizeError";
    this.stops.push({ off: off, c: colorToVec(color) });
    this.stops.sort(function (x, y) { return x.off - y.off; });
  };

  // ---------------------------------------------------------------------------
  // CanvasPattern — a tiled image fill. Holds the uploaded texture, its pixel
  // size, the repeat mode, and an optional pattern-space DOMMatrix (setTransform).
  // The renderer samples it in user space (see MASK_PATTERN), so it honors the CTM.
  // ---------------------------------------------------------------------------
  function CanvasPattern(tex, w, h, repeat) {
    this._isPattern = true;
    this.tex = tex;       // GL texture, uploaded with wrap mode per `repeat`
    this.w = w;           // source width in px
    this.h = h;           // source height in px
    this.repeat = repeat; // "repeat" | "repeat-x" | "repeat-y" | "no-repeat"
    this.matrix = null;   // pattern-space transform (a,b,c,d,e,f) or null
  }
  CanvasPattern.prototype.setTransform = function (m) {
    // Accepts a DOMMatrix(-like) or a plain {a,b,c,d,e,f}. Stored as the pattern
    // space -> user space transform; the shader applies its inverse.
    if (!m) { this.matrix = null; return; }
    this.matrix = [
      m.a != null ? m.a : 1, m.b != null ? m.b : 0,
      m.c != null ? m.c : 0, m.d != null ? m.d : 1,
      m.e != null ? m.e : 0, m.f != null ? m.f : 0
    ];
  };

  // ---------------------------------------------------------------------------
  // TextRasterizer — turns a text run into a coverage mask using the browser's
  // own font engine (an offscreen 2D canvas). We draw the glyphs in solid white
  // on transparent, so the result's alpha channel IS the glyph coverage; color
  // comes later from fillStyle (through paintStyle), so pattern/gradient/shadow/
  // filter all compose with text. The mask is rasterized at DEVICE scale (the
  // CTM's scale) so text stays crisp when the transform scales it up, instead of
  // being rasterized at nominal size and stretched (the "bitmap stamp" failure).
  //
  // Note: fully-covered glyph pixels reproduce native exactly; the 1px anti-
  // aliased rim differs by a pixel or two because Chrome's text AA is contrast-
  // adaptive (its edge coverage depends on text-vs-background contrast, which is
  // unknowable at mask-raster time). That rim difference is the documented
  // boundary — see todo.txt "Text: coverage vs native AA".
  // ---------------------------------------------------------------------------
  function TextRasterizer() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1; this.canvas.height = 1;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
  }
  // Measure a run in the given font. Returns native TextMetrics (perfect, since
  // it's the same font engine native canvas uses).
  TextRasterizer.prototype.measure = function (text, font, textProps) {
    var c = this.ctx;
    c.font = font;
    applyTextProps(c, textProps);
    return c.measureText(text);
  };
  function applyTextProps(c, p) {
    if (!p) return;
    if (p.direction) c.direction = p.direction;
    if (p.letterSpacing != null) c.letterSpacing = p.letterSpacing;
    if (p.wordSpacing != null) c.wordSpacing = p.wordSpacing;
    if (p.fontKerning) c.fontKerning = p.fontKerning;
    if (p.fontStretch) c.fontStretch = p.fontStretch;
    if (p.fontVariantCaps) c.fontVariantCaps = p.fontVariantCaps;
    if (p.textRendering) c.textRendering = p.textRendering;
    if (p.lang) c.lang = p.lang;
  }
  // Rasterize `text` into an alpha coverage mask at `scale` device px per user
  // unit. `stroke` (optional) = {width, join, cap} strokes the glyphs instead of
  // filling them. Returns { data: Uint8ClampedArray RGBA, w, h, ox, oy } where
  // (ox, oy) is the pen origin (the text's alphabetic-baseline anchor) within the
  // mask, in device px. The mask is padded so AA and strokes aren't clipped.
  TextRasterizer.prototype.rasterize = function (text, font, scale, stroke, textProps) {
    var c = this.ctx;
    c.font = font;
    applyTextProps(c, textProps);
    var m = c.measureText(text);
    // metrics are in CSS px at nominal size; we render at `scale`.
    var ascent = m.actualBoundingBoxAscent || m.fontBoundingBoxAscent || 0;
    var descent = m.actualBoundingBoxDescent || m.fontBoundingBoxDescent || 0;
    var left = m.actualBoundingBoxLeft || 0;
    var right = m.actualBoundingBoxRight != null ? m.actualBoundingBoxRight : m.width;
    var strokePad = stroke ? Math.ceil(stroke.width) : 0;
    var pad = 2 + strokePad; // px of slack for AA + stroke overhang, in device space
    // mask size in device px
    var w = Math.max(1, Math.ceil((left + right) * scale) + pad * 2);
    var h = Math.max(1, Math.ceil((ascent + descent) * scale) + pad * 2);
    if (this.canvas.width < w) this.canvas.width = w;
    if (this.canvas.height < h) this.canvas.height = h;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.font = font; // font (and other props) reset when canvas is resized
    applyTextProps(c, textProps);
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    // pen origin inside the mask: left slack + the ink's left bearing, and the
    // baseline sits `ascent` below the top slack.
    var ox = pad + left * scale;
    var oy = pad + ascent * scale;
    c.setTransform(scale, 0, 0, scale, ox, oy); // draw at device scale
    if (stroke) {
      c.lineWidth = stroke.width;
      c.lineJoin = stroke.join || "miter";
      c.lineCap = stroke.cap || "butt";
      c.strokeStyle = "#fff";
      c.strokeText(text, 0, 0);
    } else {
      c.fillStyle = "#fff";
      c.fillText(text, 0, 0);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    var img = c.getImageData(0, 0, w, h);
    return { data: img.data, w: w, h: h, ox: ox, oy: oy,
             ascent: ascent, descent: descent, left: left, right: right, advance: m.width };
  };

  function createContext2D(gl, canvas) {
    _colorCanvas = canvas; // for resolving currentColor and system colors
    var renderer = new Renderer(gl, canvas);
    var transform = renderer.transform;

    function defaultState() {
      return {
        fillStyle: [0, 0, 0, 1],
        strokeStyle: [0, 0, 0, 1],
        lineWidth: 1,
        lineCap: "butt",
        lineJoin: "miter",
        miterLimit: 10,
        globalAlpha: 1,
        globalCompositeOperation: "source-over",
        lineDash: [],
        lineDashOffset: 0,
        shadowColor: [0, 0, 0, 0],
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        font: "10px sans-serif",
        textAlign: "start",
        textBaseline: "alphabetic",
        direction: "inherit",
        letterSpacing: "0px",
        wordSpacing: "0px",
        fontKerning: "auto",
        fontStretch: "normal",
        fontVariantCaps: "normal",
        textRendering: "auto",
        lang: "inherit",
        imageSmoothingQuality: "low",
        interpolateColorSpace: "srgb",
        filter: "none",
        clipStack: []
      };
    }
    var state = defaultState();
    var stateStack = [];

    var ctx = gl; // we patch the gl object itself with canvas2d API
    // note: gl already exposes .canvas natively (getter returning the canvas)

    // A shadow contributes iff its color is non-transparent AND at least one of
    // blur/offsetX/offsetY is set (per spec — a shadowColor alone draws nothing).
    function shadowActive() {
      return state.shadowColor[3] > 0 &&
        (state.shadowBlur !== 0 || state.shadowOffsetX !== 0 || state.shadowOffsetY !== 0);
    }
    // Package the shadow for the renderer, or null when inactive. The offset is
    // in canvas (device) pixels and is NOT transformed by the CTM; shadowBlur
    // maps to a Gaussian with sigma = shadowBlur/2 (unlike filter: blur(), which
    // uses sigma = radius). globalAlpha is already baked into the source texture
    // alpha the shadow is derived from, so we must NOT re-apply it here.
    function shadowParams() {
      if (!shadowActive()) {
        // filter: drop-shadow() produces a shadow too. It reuses the same pass;
        // its blur radius R is a Gaussian stdDeviation = R, but buildShadow uses
        // sigma = blur/2, so we pass blur = 2R to get the right spread.
        return parseDropShadow(state.filter);
      }
      var c = state.shadowColor;
      return {
        color: [c[0], c[1], c[2], c[3]],
        offsetX: state.shadowOffsetX,
        offsetY: state.shadowOffsetY,
        blur: state.shadowBlur
      };
    }

    // composite routing: source-over uses the cheap direct path, everything else
    // (filter, non-source-over, or an active shadow) goes through the offscreen
    // composite engine.
    function drawSolid(tris, color) {
      var fops = parseFilter(state.filter);
      var shad = shadowParams();
      if (state.globalCompositeOperation === "source-over" && !fops && !shad) {
        applyClip();
        renderer.draw(tris, null, MASK_SOLID, color);
      } else {
        applyClip();
        renderer.composite(tris, null, MASK_SOLID, color, null, state.globalCompositeOperation, null, fops, shad);
      }
    }
    // single entry point for solid colors, gradients, and patterns. `style` is
    // an RGBA color array (globalAlpha folded in), a CanvasGradient, or a
    // CanvasPattern.
    function paintStyle(tris, style) {
      var mult = [1, 1, 1, state.globalAlpha];
      var fops = parseFilter(state.filter);
      var shad = shadowParams();
      if (style && style._isGradient) {
        if (state.globalCompositeOperation === "source-over" && !fops && !shad) {
          applyClip();
          renderer.drawGrad(tris, style, mult);
        } else {
          applyClip();
          renderer.composite(tris, null, MASK_GRAD, mult, null, state.globalCompositeOperation, style, fops, shad);
        }
      } else if (style && style._isPattern) {
        if (state.globalCompositeOperation === "source-over" && !fops && !shad) {
          applyClip();
          renderer.drawPattern(tris, style, mult);
        } else {
          applyClip();
          renderer.composite(tris, null, MASK_PATTERN, mult, null, state.globalCompositeOperation, style, fops, shad);
        }
      } else {
        drawSolid(tris, style);
      }
    }
    function drawTextured(pos, uv, color, crop) {
      var fops = parseFilter(state.filter);
      var shad = shadowParams();
      if (state.globalCompositeOperation === "source-over" && !fops && !shad) {
        applyClip();
        renderer.draw(pos, uv, MASK_TEXT, color, { t: crop.t });
      } else {
        applyClip();
        renderer.composite(pos, uv, MASK_TEXT, color, { t: crop.t }, state.globalCompositeOperation, null, fops, shad);
      }
    }

    function applyComposite(op) {
      // base state; the actual per-op math happens in the composite engine.
      // source-over (and alpha) is handled natively for speed.
      if (op === "source-over")
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    function def(prop, get, set) {
      Object.defineProperty(ctx, prop, { enumerable: true, get: get, set: set });
    }
    def("fillStyle", function () {
      return state.fillStyle instanceof Array ? vecToColor(state.fillStyle) : state.fillStyle;
    }, function (v) {
      if (typeof v === "string") { var c = colorToVec(v); if (c) state.fillStyle = c; }
      else if (v && (v._isGradient || v._isPattern)) state.fillStyle = v;
    });
    def("strokeStyle", function () {
      return state.strokeStyle instanceof Array ? vecToColor(state.strokeStyle) : state.strokeStyle;
    }, function (v) {
      if (typeof v === "string") { var c = colorToVec(v); if (c) state.strokeStyle = c; }
      else if (v && (v._isGradient || v._isPattern)) state.strokeStyle = v;
    });
    def("lineWidth", function () { return state.lineWidth; }, function (v) {
      // spec: non-finite or non-positive lineWidth is treated as 1.0
      var n = +v;
      state.lineWidth = (!isFinite(n) || n <= 0) ? 1.0 : n;
    });
    def("lineCap", function () { return state.lineCap; }, function (v) { state.lineCap = v; });
    def("lineJoin", function () { return state.lineJoin; }, function (v) { state.lineJoin = v; });
    def("miterLimit", function () { return state.miterLimit; }, function (v) { state.miterLimit = +v; });
    def("globalAlpha", function () { return state.globalAlpha; }, function (v) { state.globalAlpha = +v; });
    def("globalCompositeOperation", function () { return state.globalCompositeOperation; }, function (v) {
      state.globalCompositeOperation = v; applyComposite(v);
    });
    def("lineDashOffset", function () { return state.lineDashOffset; }, function (v) { state.lineDashOffset = +v; });
    def("shadowOffsetX", function () { return state.shadowOffsetX; }, function (v) { state.shadowOffsetX = +v; });
    def("shadowOffsetY", function () { return state.shadowOffsetY; }, function (v) { state.shadowOffsetY = +v; });
    def("shadowBlur", function () { return state.shadowBlur; }, function (v) { state.shadowBlur = +v; });
    def("shadowColor", function () { return vecToColor(state.shadowColor); }, function (v) {
      if (typeof v === "string") { var c = colorToVec(v); if (c) state.shadowColor = c; }
    });
    def("font", function () { return state.font; }, function (v) { state.font = v; });
    def("textAlign", function () { return state.textAlign; }, function (v) { state.textAlign = v; });
    def("textBaseline", function () { return state.textBaseline; }, function (v) { state.textBaseline = v; });
    def("direction", function () { return state.direction; }, function (v) {
      if (v === "ltr" || v === "rtl" || v === "inherit") state.direction = v;
    });
    def("letterSpacing", function () { return state.letterSpacing; }, function (v) { state.letterSpacing = v; });
    def("wordSpacing", function () { return state.wordSpacing; }, function (v) { state.wordSpacing = v; });
    def("fontKerning", function () { return state.fontKerning; }, function (v) {
      if (v === "auto" || v === "normal" || v === "none") state.fontKerning = v;
    });
    var FONT_STRETCH_VALUES = ["ultra-condensed", "extra-condensed", "condensed", "semi-condensed",
      "normal", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded"];
    def("fontStretch", function () { return state.fontStretch; }, function (v) {
      if (FONT_STRETCH_VALUES.indexOf(v) >= 0) state.fontStretch = v;
    });
    def("fontVariantCaps", function () { return state.fontVariantCaps; }, function (v) { state.fontVariantCaps = v; });
    def("textRendering", function () { return state.textRendering; }, function (v) { state.textRendering = v; });
    def("lang", function () { return state.lang; }, function (v) { state.lang = v; });
    def("imageSmoothingEnabled", function () { return renderer.smoothing; }, function (v) { renderer.smoothing = !!v; });
    def("imageSmoothingQuality", function () { return state.imageSmoothingQuality; }, function (v) { state.imageSmoothingQuality = v; });
    def("interpolateColorSpace", function () { return state.interpolateColorSpace; }, function (v) {
      // spec: only "srgb" and "oklab" are valid; invalid values are ignored.
      if (v === "srgb" || v === "oklab") {
        state.interpolateColorSpace = v;
        renderer._colorSpace = v;
      }
    });
    def("filter", function () { return state.filter; }, function (v) {
      // spec: invalid filter strings are ignored (property unchanged)
      if (typeof v !== "string") return;
      if (v === "none" || v === "") { state.filter = "none"; return; }
      // Accept if it has color/blur ops OR a drop-shadow (parseFilter skips the
      // latter since it's handled through the shadow pass, so check it too).
      var ops = parseFilter(v);
      if (ops || parseDropShadow(v)) state.filter = v;
    });

    function cloneStyle(st) { return st instanceof Array ? st.slice() : st; }
    function cloneState(s) {
      var clips = [], i;
      for (i = 0; i < s.clipStack.length; i++) clips.push({ tris: s.clipStack[i].tris.slice() });
      return {
        fillStyle: cloneStyle(s.fillStyle), strokeStyle: cloneStyle(s.strokeStyle),
        lineWidth: s.lineWidth, lineCap: s.lineCap, lineJoin: s.lineJoin, miterLimit: s.miterLimit,
        globalAlpha: s.globalAlpha, globalCompositeOperation: s.globalCompositeOperation,
        lineDash: s.lineDash.slice(), lineDashOffset: s.lineDashOffset,
        shadowColor: s.shadowColor.slice(), shadowBlur: s.shadowBlur,
        shadowOffsetX: s.shadowOffsetX, shadowOffsetY: s.shadowOffsetY,
        font: s.font, textAlign: s.textAlign, textBaseline: s.textBaseline,
        direction: s.direction, letterSpacing: s.letterSpacing, wordSpacing: s.wordSpacing,
        fontKerning: s.fontKerning, fontStretch: s.fontStretch,
        fontVariantCaps: s.fontVariantCaps, textRendering: s.textRendering, lang: s.lang,
        imageSmoothingQuality: s.imageSmoothingQuality,
        interpolateColorSpace: s.interpolateColorSpace,
        filter: s.filter,
        clipStack: clips
      };
    }

    // Stencil-backed clip. The clip stack is rebuilt into the stencil buffer whenever
    // it changes (clip/save/restore). A pixel inside N clips is written 2N (always
    // even), so the LSB (bit0) stays free for the even-odd fill parity mask. Nonzero
    // clips add +2 by incrementing twice; evenodd clips build their parity in bit0 and
    // then add +2 only where inside (the INCR carries clear bit0 again).
    function buildStencil() {
      var stack = state.clipStack;
      var FS = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
      // fullscreen identity draw (clip-space quad) that leaves transform/proj intact
      function fsDraw() {
        var t = transform.m, p = renderer.proj;
        transform.m = mIdent();
        renderer.proj = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        renderer.drawStencil(FS);
        renderer.proj = p;
        transform.m = t;
      }
      gl.enable(gl.STENCIL_TEST);
      gl.clearStencil(0);
      gl.clear(gl.STENCIL_BUFFER_BIT);
      gl.colorMask(false, false, false, false);
      gl.stencilMask(0xFF);
      gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      for (var i = 0; i < stack.length; i++) {
        var c = stack[i];
        if (c.rule === "evenodd") {
          // parity of this evenodd region in bit0
          gl.stencilMask(0x01);
          gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
          gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
          fsDraw(); // clear bit0
          gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
          for (var s = 0; s < c.subpaths.length; s++) renderer.drawStencil(c.subpaths[s]);
          // add +2 where inside (INCR carries out of the set bit0, clearing it again)
          gl.stencilMask(0xFF);
          gl.stencilFunc(gl.EQUAL, 0x01, 0x01);
          gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
          fsDraw();
        } else {
          renderer.drawStencil(c.tris);
          renderer.drawStencil(c.tris);
        }
      }
      gl.colorMask(true, true, true, true);
      if (stack.length) {
        gl.stencilFunc(gl.EQUAL, stack.length * 2, 0xFF);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      } else {
        gl.disable(gl.STENCIL_TEST);
      }
    }
    function applyClip() {
      // configure stencil test for normal drawing based on current clip depth
      if (state.clipStack.length) {
        gl.enable(gl.STENCIL_TEST);
        gl.stencilFunc(gl.EQUAL, state.clipStack.length * 2, 0xFF);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      } else {
        gl.disable(gl.STENCIL_TEST);
      }
    }
    ctx.save = function () {
      transform.save();
      stateStack.push(state);
      state = cloneState(state);
      applyClip();
    };
    ctx.restore = function () {
      transform.restore();
      if (stateStack.length) { state = stateStack.pop(); }
      renderer._colorSpace = state.interpolateColorSpace;
      applyComposite(state.globalCompositeOperation);
      buildStencil();
    };

    ctx.translate = function (x, y) { transform.translate(x, y); };
    ctx.rotate = function (a) { transform.rotate(a); };
    ctx.scale = function (x, y) { transform.scale(x, y); };
    function unpackTransformArgs(a, b, c, d, e, f) {
      if (a && typeof a === "object" && "m" in a) {
        // ctx3d DOMMatrix: m is column-major [a,b,0,c,d,0,e,f,0,0,1,...]
        var m = a.m;
        return [m[0], m[1], m[3], m[4], m[6], m[7]];
      }
      if (a && typeof a === "object" && "a" in a) {
        // native DOMMatrix or {a,b,c,d,e,f}
        return [a.a, a.b, a.c, a.d, a.e, a.f];
      }
      return [a, b, c, d, e, f];
    }
    ctx.transform = function (a, b, c, d, e, f) {
      var t = unpackTransformArgs(a, b, c, d, e, f);
      transform.raw(t[0], t[1], t[2], t[3], t[4], t[5]);
    };
    ctx.setTransform = function (a, b, c, d, e, f) {
      var t = unpackTransformArgs(a, b, c, d, e, f);
      transform.setRaw(t[0], t[1], t[2], t[3], t[4], t[5]);
    };
    ctx.resetTransform = function () { transform.setRaw(1, 0, 0, 1, 0, 0); };
    ctx.reset = function () {
      // reset drawing state, clip, path, and clear the canvas to transparent black
      transform.setRaw(1, 0, 0, 1, 0, 0);
      state = defaultState();
      stateStack.length = 0;
      renderer._colorSpace = "srgb";
      ctx._path = new Path();
      applyComposite("source-over");
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.STENCIL_TEST);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    };
    ctx.getContextAttributes = function () {
      // spec: CanvasRenderingContext2DSettings, not the underlying WebGL context's attributes.
      // colorSpace is the drawing buffer's storage space (fixed at creation) -- not to be
      // confused with interpolateColorSpace, which controls gradient interpolation and can
      // change at any time.
      return {
        alpha: true,
        desynchronized: false,
        colorSpace: "srgb",
        willReadFrequently: false
      };
    };
    ctx.getTransform = function () {
      return new DOMMatrix({ m: transform.current().slice() });
    };
    // Capture the native method before overwriting it — ctx IS gl, so a naive
    // wrapper that calls gl.isContextLost() would call itself (infinite loop).
    var nativeIsContextLost = gl.isContextLost.bind(gl);
    ctx.isContextLost = function () {
      return nativeIsContextLost();
    };
    ctx.drawFocusIfNeeded = function (arg1, arg2) {
      var path, element;
      if (arg1 instanceof Path) { path = arg1; element = arg2; }
      else { path = ctx._path; element = arg1; }
      if (!element) return;
      // Spec: if element is not focused, or is not a descendant of the canvas, return.
      if (document.activeElement !== element) return;
      if (!canvas.contains(element)) return;
      // Draw a focus ring along the path.
      ctx.save();
      ctx.strokeStyle = "#0000ff";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      if (path) ctx.stroke(path);
      ctx.restore();
    };
    ctx.scrollPathIntoView = function (arg) {
      var p = (arg instanceof Path) ? arg : ctx._path;
      if (!p || !p.subpaths.length) return;
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (var i = 0; i < p.subpaths.length; i++) {
        var pts = p.subpaths[i].pts;
        for (var j = 0; j < pts.length; j++) {
          if (pts[j][0] < minX) minX = pts[j][0];
          if (pts[j][1] < minY) minY = pts[j][1];
          if (pts[j][0] > maxX) maxX = pts[j][0];
          if (pts[j][1] > maxY) maxY = pts[j][1];
        }
      }
      var rect = canvas.getBoundingClientRect();
      var el = document.elementFromPoint(rect.left + minX, rect.top + minY);
      if (el) {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    ctx.createLinearGradient = function (x0, y0, x1, y1) {
      return new CanvasGradient("linear", x0, y0, x1, y1);
    };
    ctx.createConicGradient = function (startAngle, x, y) {
      return new CanvasGradient("conic", +x, +y, +startAngle);
    };
    ctx.createRadialGradient = function (x0, y0, r0, x1, y1, r1) {
      return new CanvasGradient("radial", x0, y0, r0, x1, y1, r1);
    };
    ctx.createPattern = function (image, repeat) {
      if (!image) return null;
      // spec: null/"" repeat means "repeat"; anything else must be one of the four
      if (repeat === "" || repeat == null) repeat = "repeat";
      if (repeat !== "repeat" && repeat !== "repeat-x" &&
          repeat !== "repeat-y" && repeat !== "no-repeat") {
        throw "SyntaxError";
      }
      var up = renderer.uploadPatternTexture(image, repeat, state.imageSmoothingQuality);
      return new CanvasPattern(up.t, up.w, up.h, repeat);
    };
    ctx.setLineDash = function (v) {
      // spec: round each to nearest integer; non-finite/negative -> 0; if odd count, duplicate.
      if (!(v instanceof Array)) return;
      var arr = v.map(function (n) { n = Math.round(+n); return (n <= 0 || !isFinite(n)) ? 0 : n; });
      if (arr.length % 2) arr = arr.concat(arr.slice());
      state.lineDash = arr;
    };
    ctx.getLineDash = function () { return state.lineDash.slice(); };

    function alpha(color) {
      if (color && (color._isGradient || color._isPattern)) return color;
      if (state.globalAlpha === 1) return color;
      return [color[0], color[1], color[2], color[3] * state.globalAlpha];
    }

    ctx.beginPath = function () { ctx._path = new Path(); };
    ctx.moveTo = function (x, y) { (ctx._path || (ctx._path = new Path())).moveTo(x, y); };
    ctx.lineTo = function (x, y) { (ctx._path || (ctx._path = new Path())).lineTo(x, y); };
    ctx.closePath = function () { if (ctx._path) ctx._path.closePath(); };
    ctx.rect = function (x, y, w, h) {
      var p = ctx._path || (ctx._path = new Path());
      p.moveTo(x, y); p.lineTo(x + w, y); p.lineTo(x + w, y + h); p.lineTo(x, y + h); p.closePath();
    };
    ctx.arc = function (x, y, r, start, end, anticlockwise) {
      var p = ctx._path || (ctx._path = new Path());
      var pts = arcToPointsCenter(x, y, r, start, end, anticlockwise);
      p.arcToPiecewise(pts);
    };
    ctx.ellipse = function (x, y, rx, ry, rotation, start, end, anticlockwise) {
      var p = ctx._path || (ctx._path = new Path());
      p.arcToPiecewise(ellipsePoints(x, y, rx, ry, rotation, start, end, anticlockwise));
    };
    ctx.roundRect = function (x, y, w, h, radii) {
      var p = ctx._path || (ctx._path = new Path());
      p.roundRect(x, y, w, h, radii);
    };
    ctx.arcTo = function (x1, y1, x2, y2, r) {
      var p = ctx._path || (ctx._path = new Path());
      if (!p.cur) { p.moveTo(x1, y1); return; }
      var last = p.cur.pts[p.cur.pts.length - 1];
      var res = arcToGeometry(last[0], last[1], x1, y1, x2, y2, r);
      if (!res) { p.lineTo(x1, y1); return; }
      var pts = arcToPointsCenter(res.cx, res.cy, r, res.a0, res.a1, false);
      p.arcToPiecewise(pts);
    };
    ctx.quadraticCurveTo = function (cx, cy, x, y) {
      var p = ctx._path || (ctx._path = new Path());
      var last = p.cur ? p.cur.pts[p.cur.pts.length - 1] : [0, 0];
      var pts = quadraticToPoints(last[0], last[1], cx, cy, x, y);
      p.arcToPiecewise(pts);
    };
    ctx.bezierCurveTo = function (c1x, c1y, c2x, c2y, x, y) {
      var p = ctx._path || (ctx._path = new Path());
      var last = p.cur ? p.cur.pts[p.cur.pts.length - 1] : [0, 0];
      var pts = cubicToPoints(last[0], last[1], c1x, c1y, c2x, c2y, x, y);
      p.arcToPiecewise(pts);
    };

    // choose path: fill(arg?) / stroke(arg?) may take a Path2D or (for fill) a fill rule
    function pickPath(a, b) {
      if (a instanceof Path) return a;
      return ctx._path;
    }
    function pickRule(a, b) {
      if (a === "nonzero" || a === "evenodd") return a;
      if (b === "nonzero" || b === "evenodd") return b;
      return "nonzero";
    }

    ctx.fill = function (arg1, arg2) {
      var p = pickPath(arg1, arg2);
      if (!p) return;
      var rule = pickRule(arg1, arg2);
      var style = alpha(state.fillStyle);
      if (rule === "evenodd") {
        var depth = state.clipStack.length;
        if (state.globalCompositeOperation === "source-over" && !(style && style._isPattern)) {
          // Per-subpixel even-odd coverage: supersample parity across each fragment
          // so overlapping rings give native-equivalent AA edges (no stencil center
          // approximation). Clip stencil applied via the depth mask.
          var rings = p.toEvenOddRings();
var mult = [1, 1, 1, state.globalAlpha];
          if (style && style._isGradient) {
            renderer.drawEvenOdd(rings, mult, depth, 16, style);
          } else {
            renderer.drawEvenOdd(rings, style, depth, 16);
          }
          return;
        }
        // Patterns (and every non-source-over op) route through the parity mask --
        // these need the full triangulated fill (tris/trisAA), unlike the fast
        // path above which only needs raw ring points for its shader test.
        var tris = p.toFillTriangles("evenodd");
        var trisAA = p.toFillTrianglesExt();
        renderer.withEvenOddMask(p.toEvenOddRingExt(), depth, function () {
          var mult = [1, 1, 1, state.globalAlpha];
          if (style && style._isPattern) {
            if (state.globalCompositeOperation === "source-over") renderer.drawPattern(tris, style, mult);
            else renderer.composite(tris, null, MASK_PATTERN, mult, null, state.globalCompositeOperation, style);
          } else if (style && style._isGradient) {
            if (state.globalCompositeOperation === "source-over") renderer.drawAAGrad(trisAA, style, mult);
            else renderer.composite(tris, null, MASK_GRAD, mult, null, state.globalCompositeOperation, style);
          } else {
            if (state.globalCompositeOperation === "source-over") renderer.drawAAF(trisAA, style);
            else renderer.composite(tris, null, MASK_SOLID, style, null, state.globalCompositeOperation);
          }
        });
        return;
      }
      paintStyle(p.toFillTriangles(rule), style);
    };
    ctx.stroke = function (arg1) {
      var p = pickPath(arg1);
      if (!p) return;
      paintStyle(p.toStrokeTriangles(state.lineWidth, state.lineCap, state.lineJoin, state.lineDash, state.lineDashOffset, state.miterLimit), alpha(state.strokeStyle));
    };
    ctx.strokeRect = function (x, y, w, h) {
      var p = new Path();
      p.moveTo(x, y); p.lineTo(x + w, y); p.lineTo(x + w, y + h); p.lineTo(x, y + h); p.closePath();
      var tris = p.toStrokeTriangles(state.lineWidth, state.lineCap, state.lineJoin, state.lineDash, state.lineDashOffset, state.miterLimit);
      paintStyle(tris, alpha(state.strokeStyle));
    };
    ctx.fillRect = function (x, y, w, h) {
      var pts = rectPoints(x, y, w, h);
      var tris = triangulate(pts);
      paintStyle(tris, alpha(state.fillStyle));
    };
    ctx.clip = function (arg1, arg2) {
      var p = pickPath(arg1);
      if (!p) return;
      var rule = pickRule(arg1, arg2);
      // snapshot the path so later mutation doesn't affect the clip; for evenodd clips
      // we also keep per-subpath triangles so the build can produce holes.
      state.clipStack.push({
        tris: p.toFillTriangles(rule),
        subpaths: (rule === "evenodd" ? p.toEvenOddTriangles() : null),
        rule: rule
      });
      buildStencil();
    };
    ctx.isPointInPath = function (x, y, arg1, arg2) {
      var p = pickPath(arg1);
      if (!p) return false;
      var rule = pickRule(arg1, arg2);
      return p.isPointInPath(x, y, rule);
    };
    ctx.isPointInStroke = function (x, y, arg1) {
      var p = pickPath(arg1);
      if (!p) return false;
      var half = state.lineWidth / 2;
      for (var s = 0; s < p.subpaths.length; s++) {
        var pts = p.subpaths[s].pts;
        for (var i = 0; i < pts.length - 1; i++) {
          var a = pts[i], b = pts[i + 1];
          if (distToSegment(x, y, a[0], a[1], b[0], b[1]) <= half + 0.5) return true;
        }
      }
      return false;
    };
    ctx.clearRect = function (x, y, w, h) {
      if (state.clipStack.length) {
        // with an active clip we cannot use gl.clear (it bypasses stencil). Draw a
        // transparent quad, blend disabled, so clips are honored.
        applyClip();
        var x2 = x + w, y2 = y + h;
        var pos = [x, y, x2, y, x2, y2, x, y, x2, y2, x, y2];
        var wasBlend = gl.isEnabled(gl.BLEND);
        gl.disable(gl.BLEND);
        renderer.draw(pos, null, MASK_SOLID, [0, 0, 0, 0]);
        if (wasBlend) gl.enable(gl.BLEND);
        return;
      }
      // destination-independent clear via scissor + clear
      var was = gl.isEnabled(gl.SCISSOR_TEST);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(Math.round(x), Math.round(canvas.height - y - h), Math.round(w), Math.round(h));
      var pc = [0, 0, 0, 0];
      gl.clearColor(0, 0, 0, 0);
      var prevBlend = state.globalCompositeOperation;
      gl.colorMask(true, true, true, true);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      applyComposite(prevBlend);
      if (!was) gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.STENCIL_TEST);
    };

    // images
    var textureCache = new Map();
    function getTex(image) {
      var entry = textureCache.get(image);
      if (!entry) {
        var t = renderer.uploadTexture(image, state.imageSmoothingQuality);
        textureCache.set(image, t);
        try { image.gl2dTex = t; } catch (e) {}
        return t;
      }
      if (entry.q !== state.imageSmoothingQuality) {
        var t2 = renderer.uploadTexture(image, state.imageSmoothingQuality);
        renderer.gl.deleteTexture(entry.t); // replacing this entry -- free the old texture
        textureCache.set(image, t2);
        try { image.gl2dTex = t2; } catch (e) {}
        return t2;
      }
      return entry;
    }
    ctx.drawImage = function (image, a, b, c, d, e, f, g, h) {
      if (!image) return;
      var tex = getTex(image);
      var w = tex.w, h = tex.h;
      var dx, dy, dw, dh, us, vs, uw, uh;
      if (arguments.length === 3) { dx = a; dy = b; dw = w; dh = h; us = 0; vs = 0; uw = 1; uh = 1; }
      else if (arguments.length === 5) { dx = a; dy = b; dw = c; dh = d; us = 0; vs = 0; uw = 1; uh = 1; }
      else { us = a / w; vs = b / h; uw = c / w; uh = d / h; dx = e; dy = f; dw = g; dh = h; }
      // negative dw/dh flip (mirror) per spec
      if (dw < 0) { dx += dw; dw = -dw; us += uw; uw = -uw; }
      if (dh < 0) { dy += dh; dh = -dh; vs += uh; uh = -uh; }
      var x1 = dx, y1 = dy, x2 = dx + dw, y2 = dy + dh;
      var pos = [x1, y1, x2, y1, x2, y2, x1, y1, x2, y2, x1, y2];
      var uv = [us, vs, us + uw, vs, us + uw, vs + uh, us, vs, us + uw, vs + uh, us, vs + uh];
      drawTextured(pos, uv, [1, 1, 1, state.globalAlpha], { t: tex.t });
    };

    // ---- Text -------------------------------------------------------------
    // One rasterizer per context, reusing its offscreen canvas across calls.
    var textRaster = new TextRasterizer();

    // The CTM's uniform scale (for rasterizing glyphs at device resolution so
    // they stay crisp under scale). Uses the geometric mean of the axis lengths;
    // exact for translation+scale, a good scalar for mild rotation/skew.
    function ctmScale() {
      var m = transform.m; // column-major [a,b,_, c,d,_, e,f,_]
      var sx = Math.hypot(m[0], m[1]);
      var sy = Math.hypot(m[3], m[4]);
      var s = Math.sqrt(sx * sy) || 1;
      return s < 1e-3 ? 1e-3 : s;
    }

    // Shared core for fillText/strokeText. `stroke` is null (fill) or a stroke
    // spec. Rasterizes the glyph coverage at device scale, computes the run's
    // user-space bounding box from align/baseline, and draws it masked so the
    // fill style (solid/gradient/pattern) + shadow + filter all compose.
    function resolveDirection() {
      if (state.direction === "ltr" || state.direction === "rtl") return state.direction;
      // "inherit": resolve from the canvas element's CSS/attribute direction.
      var d = getComputedStyle ? getComputedStyle(canvas).direction : null;
      return d === "rtl" ? "rtl" : "ltr";
    }
    function resolveLang() {
      // "inherit": walk up from the canvas element to find the nearest lang attribute.
      var el = canvas.closest ? canvas.closest("[lang]") : null;
      return (el && el.lang) || (document.documentElement && document.documentElement.lang) || "en";
    }
    function textProps() {
      return {
        direction: state.direction === "inherit" ? resolveDirection() : state.direction,
        letterSpacing: state.letterSpacing, wordSpacing: state.wordSpacing,
        fontKerning: state.fontKerning, fontStretch: state.fontStretch,
        fontVariantCaps: state.fontVariantCaps, textRendering: state.textRendering,
        lang: state.lang === "inherit" ? resolveLang() : state.lang
      };
    }
    function drawText(text, x, y, maxWidth, stroke) {
      text = String(text);
      if (!text.length) return;
      var scale = ctmScale();
      var tp = textProps();
      var m = textRaster.rasterize(text, state.font, scale, stroke, tp);
      if (!m.w || !m.h) return;

      // maxWidth: horizontally squeeze the run to fit (spec) by scaling x extent.
      var squeeze = 1;
      if (maxWidth != null && isFinite(maxWidth) && m.advance > maxWidth && m.advance > 0) {
        squeeze = maxWidth / m.advance;
      }

      // align shift (in user px): move the pen so the run aligns to x.
      var align = state.textAlign;
      var dir = tp.direction;
      var shift = 0;
      if (align === "center") shift = -m.advance / 2;
      else if (align === "right" || (align === "end" && dir === "ltr") || (align === "start" && dir === "rtl")) shift = -m.advance;
      // "start"/"left" -> 0

      // baseline shift (user px): the rasterizer anchored at the alphabetic
      // baseline; move y so the requested baseline lands at the given y.
      var by = 0;
      switch (state.textBaseline) {
        case "top": by = m.ascent; break;
        case "hanging": by = m.ascent * 0.8; break;
        case "middle": by = (m.ascent - m.descent) / 2; break;
        case "bottom": by = -m.descent; break;
        case "ideographic": by = -m.descent; break;
        default: by = 0; // alphabetic
      }

      // The mask's top-left in USER space. The pen (baseline origin) sits at
      // (x + shift, y + by); inside the mask that origin is at (ox, oy) device px
      // = (ox/scale, oy/scale) user px from the mask's top-left.
      var penX = x + shift;
      var penY = y + by;
      var uLeft = penX - m.ox / scale;
      var uTop = penY - m.oy / scale;
      var uW = (m.w / scale) * squeeze;
      var uH = m.h / scale;
      var x2 = uLeft + uW, y2 = uTop + uH;
      var quad = [uLeft, uTop, x2, uTop, x2, y2, uLeft, uTop, x2, y2, uLeft, y2];

      // Per-vertex coverage UV matching the quad corners: TL(0,0) TR(1,0)
      // BR(1,1) BL(0,1). Sampling the mask by interpolated UV means it rides the
      // CTM through rotation and skew, not just translate+scale.
      var uv = [0,0, 1,0, 1,1, 0,0, 1,1, 0,1];

      var style = stroke ? state.strokeStyle : state.fillStyle;
      var col = style instanceof Array ? alpha(style) : style;
      var mult = [1, 1, 1, state.globalAlpha];
      var covTex = renderer.uploadCoverage(m.data, m.w, m.h);

      var fops = parseFilter(state.filter);
      var shad = shadowParams();
      applyClip();
      if (state.globalCompositeOperation === "source-over" && !fops && !shad) {
        renderer.drawTextRun(quad, col, mult, covTex, uv);
      } else {
        // Route through the composite engine so shadow/filter/blend compose with
        // text: the coverage-masked fill renders into the offscreen source, then
        // the existing filter (2b) / shadow (2c) / composite (3) tail runs.
        var isGrad = style && style._isGradient;
        var isPat = style && style._isPattern;
        var baseMask = isGrad ? MASK_GRAD : (isPat ? MASK_PATTERN : MASK_SOLID);
        var srcColor = (isGrad || isPat) ? mult : col;
        var srcStyle = (isGrad || isPat) ? style : null;
        renderer.composite(quad, uv, baseMask | MASK_COV, srcColor, null,
          state.globalCompositeOperation, srcStyle, fops, shad,
          { tex: covTex });
      }
    }

    ctx.fillText = function (text, x, y, maxWidth) { drawText(text, x, y, maxWidth, null); };
    ctx.strokeText = function (text, x, y, maxWidth) {
      drawText(text, x, y, maxWidth, {
        width: state.lineWidth, join: state.lineJoin, cap: state.lineCap
      });
    };
    ctx.measureText = function (text) {
      return textRaster.measure(String(text), state.font, textProps());
    };

    // image data
    var off2d = canvas.getContext("2d") || document.createElement("canvas").getContext("2d");
    ctx.createImageData = function (w, h) {
      return off2d.createImageData(Math.round(w), Math.round(h));
    };
    ctx.getImageData = function (sx, sy, sw, sh) {
      sw = Math.round(sw); sh = Math.round(sh);
      var imgData = off2d.createImageData(sw, sh);
      var ytop = canvas.height - sy - sh;
      // unpremultiply + Y-flip run as a GPU shader pass (see readImageDataGPU)
      // instead of a per-pixel JS loop -- readPixels lands data already in the
      // straight-alpha, top-down layout ImageData needs.
      renderer.readImageDataGPU(Math.round(sx), Math.round(ytop), sw, sh, imgData.data);
      return imgData;
    };
    ctx.putImageData = function (imgData, dx, dy, dirtyX, dirtyY, dirtyW, dirtyH) {
      if (!imgData) return;
      // spec: putImageData is not affected by the current transform or compositing.
      var sw = imgData.width, sh = imgData.height;
      var dX = dirtyX === undefined ? 0 : dirtyX;
      var dY = dirtyY === undefined ? 0 : dirtyY;
      var dW = (dirtyW === undefined ? sw : dirtyW);
      var dH = (dirtyH === undefined ? sh : dirtyH);
      // clamp dirty rect to image bounds
      var rX = Math.max(0, dX), rY = Math.max(0, dY);
      var rW = Math.min(sw - rX, dW), rH = Math.min(sh - rY, dH);
      if (rW <= 0 || rH <= 0) return;
      var tex = renderer.uploadTexture(imgData, "snap");
      var x1 = dx + rX, y1 = dy + rY, x2 = x1 + rW, y2 = y1 + rH;
      var pos = [x1, y1, x2, y1, x2, y2, x1, y1, x2, y2, x1, y2];
      var u0 = rX / sw, v0 = rY / sh, u1 = (rX + rW) / sw, v1 = (rY + rH) / sh;
      var uv = [u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1];
      // bypass transform & blending: direct pixel replacement
      var saved = transform.m;
      transform.m = mIdent();
      var wasBlend = gl.isEnabled(gl.BLEND);
      gl.disable(gl.BLEND);
      renderer.draw(pos, uv, MASK_TEXT, [1, 1, 1, 1], { t: tex.t });
      if (wasBlend) gl.enable(gl.BLEND);
      transform.m = saved;
      // one-shot texture, drawn once above -- free it immediately or every
      // putImageData call leaks a GPU texture for the life of the context.
      gl.deleteTexture(tex.t);
    };

    return ctx;
  }
  function getContext(canvas) {
    if (!canvas) return null;
    if (canvas.__ctx3d) return canvas.__ctx3d;
    var gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, stencil: true });
    if (!gl) return null;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    var ctx = canvas.__ctx3d = createContext2D(gl, canvas);
    return ctx;
  }

  window.Ctx3D = { getContext: getContext, Path2D: Path };
})(typeof window !== "undefined" ? window : this);
