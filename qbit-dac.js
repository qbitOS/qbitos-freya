// Copyright (c) 2026 qbitOS / ugrad.ai. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Source: https://github.com/qbitOS/compliance
// Provenance: ai-created-control-envelope
// DAC/Prefix/Steno/Iron-Line/Preflight/search-history controls
// Runtime Path: DAC -> Iron Line -> Prefixes -> Quantum Gutter -> .qbit -> preflight
// beyondBINARY quantum-prefixed | uvspeed | {n, +1, -n, +0, 0, -1, +n, +2, -0, +3, 1}
// qbit-dac.js — Prefix DAC (Dimensional Addressing Codec) + .qbit codec
// Author: Tad R. Ericson
// Licensing contact: license@qbitos.ai | license@ugrad.ai
// Copyright (c) 2026 qbitOS / ugrad.ai. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Source: https://github.com/qbitOS/uvmis-evolution-agent
// Provenance: build=<sha> artifact=<sha256>
// Shared module: <script src="qbit-dac.js"></script> AFTER quantum-prefixes.js
// Provides: window.prefixDAC, window.dacAnsiLine, window.dacStats, window.qbitCodec

(function initQbitDAC(root) {
  'use strict';
  var _isBrowser = typeof window !== 'undefined';
  var QP = _isBrowser ? root.QuantumPrefixes : (typeof require === 'function' ? require('./quantum-prefixes.js') : null);
  var _perf = typeof performance !== 'undefined' ? performance : { now: Date.now.bind(Date) };
  var DAC_STATS = { calls: 0, lines: 0, t0: _perf.now(), classifications: {}, sources: {} };

  var GATE_MAP = {
    '+1:': 'H', '1:': 'CNOT', '-1:': 'X', '+0:': 'Rz', '0:': 'I',
    '-0:': 'S', '+n:': 'T', 'n:': 'SWAP', '-n:': 'M', '+2:': 'CZ',
    '+3:': 'Y', ' ': '·'
  };

  var SYM_COLOR = {
    'n:': '#c9a84c', '+1:': '#6e7681', '-n:': '#58a6ff', '+0:': '#a78bfa',
    '0:': '#56d4dd', '-1:': '#f85149', '+n:': '#34d399', '+2:': '#f0883e',
    '-0:': '#3fb950', '+3:': '#ff6b6b', '1:': '#e6edf3', ' ': '#30363d'
  };

  var SYM_ANSI = {
    'n:': '178', '+1:': '245', '-n:': '75', '+0:': '141',
    '0:': '86', '-1:': '196', '+n:': '82', '+2:': '208',
    '-0:': '82', '+3:': '196', '1:': '255', ' ': '240'
  };

  function classifyLine(line, language) {
    if (QP && QP.classifyLine) {
      var r = QP.classifyLine(line, language || 'auto');
      return (r && r.sym) ? r.sym : ' ';
    }
    return ' ';
  }

  function prefixDAC(content, language, source) {
    if (!content) return { raw: content, prefixed: content, meta: null };
    DAC_STATS.calls++;
    var src = source || 'unknown';
    DAC_STATS.sources[src] = (DAC_STATS.sources[src] || 0) + 1;
    var lines = String(content).split('\n');
    DAC_STATS.lines += lines.length;
    var prefixed = [], counts = {};
    for (var i = 0; i < lines.length; i++) {
      var sym = classifyLine(lines[i], language);
      if (sym !== ' ') counts[sym] = (counts[sym] || 0) + 1;
      prefixed.push(sym.padEnd(4) + lines[i]);
    }
    var total = 0; for (var k in counts) total += counts[k];
    var coverage = lines.length > 0 ? total / lines.length : 0;
    for (var k in counts) DAC_STATS.classifications[k] = (DAC_STATS.classifications[k] || 0) + counts[k];
    var meta = {
      totalLines: lines.length, classified: total, coverage: coverage,
      counts: counts, source: src, ts: Date.now()
    };
    return { raw: content, prefixed: prefixed.join('\n'), meta: meta };
  }

  function dacAnsiLine(line, lineNum, language) {
    var sym = classifyLine(line, language);
    var col = SYM_ANSI[sym] || '245';
    var gate = GATE_MAP[sym] || ' ';
    var num = lineNum !== undefined ? '\x1b[38;5;240m' + String(lineNum).padStart(4) + '\x1b[0m ' : '';
    return num + '\x1b[38;5;' + col + 'm' + sym.padEnd(3) + '\x1b[0m ' + line;
  }

  function dacHtmlLine(line, lineNum, language) {
    var sym = classifyLine(line, language);
    var col = SYM_COLOR[sym] || '#30363d';
    var gate = GATE_MAP[sym] || '·';
    var numStr = lineNum !== undefined ? '<span style="color:#30363d">' + String(lineNum).padStart(4) + '</span> ' : '';
    return numStr + '<span style="color:' + col + '">' + sym.padEnd(3) + '</span> ' + escHTML(line);
  }

  function escHTML(s) {
    if (_isBrowser) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Block-opening prefixes — these start a new structural track
  var BLOCK_OPEN = { '+0:': 1, '0:': 1, '+n:': 1, '+2:': 1, '-1:': 1 };

  function dacTracks(content, language) {
    if (!content) return [];
    var lines = String(content).split('\n');
    var n = lines.length;
    var syms = new Array(n);
    var indents = new Array(n);
    for (var i = 0; i < n; i++) {
      syms[i] = classifyLine(lines[i], language);
      var m = lines[i].match(/^(\s*)/);
      indents[i] = m ? m[1].replace(/\t/g, '    ').length : 0;
    }

    var stack = [];
    var tracks = new Array(n);

    for (var i = 0; i < n; i++) {
      var sym = syms[i];
      var indent = indents[i];

      while (stack.length > 0 && indent <= stack[stack.length - 1].indent
             && lines[i].trim().length > 0) {
        stack.pop();
      }

      var depth = stack.length;
      var cols = '';
      for (var d = 0; d < depth; d++) {
        var last = (d === depth - 1);
        var isClosing = (i + 1 < n && indents[i + 1] < stack[d].indent + 2
                         && d === depth - 1 && lines[i].trim().length > 0);
        var ch, trackSym = stack[d].sym;
        var col = SYM_COLOR[trackSym] || '#30363d';
        if (isClosing && d === depth - 1) {
          ch = '\u2514';
        } else {
          ch = '\u2502';
        }
        cols += ch;
      }

      if (sym in BLOCK_OPEN && lines[i].trim().length > 0) {
        stack.push({ sym: sym, indent: indent, line: i });
        cols += '\u252C';
      }

      tracks[i] = { track: cols, depth: depth + ((sym in BLOCK_OPEN) ? 1 : 0),
                     sym: sym, stack: stack.map(function(s) { return s.sym; }) };
    }
    return tracks;
  }

  function dacTrackAnsi(content, language) {
    var lines = String(content).split('\n');
    var tracks = dacTracks(content, language);
    var maxDepth = 0;
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].depth > maxDepth) maxDepth = tracks[i].depth;
    }
    var pad = Math.max(maxDepth + 1, 2);
    var result = [];
    for (var i = 0; i < lines.length; i++) {
      var t = tracks[i];
      var trackStr = '';
      var chars = Array.from(t.track);
      for (var c = 0; c < chars.length; c++) {
        var stackSym = t.stack[c] || t.sym;
        var col = SYM_ANSI[stackSym] || '240';
        trackStr += '\x1b[38;5;' + col + 'm' + chars[c] + '\x1b[0m';
      }
      var padded = t.track + ' '.repeat(Math.max(0, pad - chars.length));
      var sym = t.sym;
      var symCol = SYM_ANSI[sym] || '240';
      var num = '\x1b[38;5;240m' + String(i + 1).padStart(4) + '\x1b[0m';
      result.push(num + ' ' + trackStr + ' '.repeat(Math.max(0, pad - chars.length))
        + ' \x1b[38;5;' + symCol + 'm' + sym.padEnd(3) + '\x1b[0m ' + lines[i]);
    }
    return result.join('\n');
  }

  function dacTrackHtml(content, language, opts) {
    var o = opts || {};
    var showDots = o.dots !== false;
    var lines = String(content).split('\n');
    var tracks = dacTracks(content, language);
    var maxDepth = 0;
    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].depth > maxDepth) maxDepth = tracks[i].depth;
    }
    var pad = Math.max(maxDepth + 1, 2);
    var result = [];
    for (var i = 0; i < lines.length; i++) {
      var t = tracks[i];
      var trackStr = '';
      var chars = Array.from(t.track);
      for (var c = 0; c < chars.length; c++) {
        var stackSym = (t.stack && t.stack[c]) ? t.stack[c] : t.sym;
        var col = SYM_COLOR[stackSym] || '#30363d';
        var ch = chars[c];
        if (showDots && ch === '\u252C') {
          trackStr += '<span style="color:' + col + ';font-size:0.7em">\u25CF</span>';
        } else {
          trackStr += '<span style="color:' + col + '">' + ch + '</span>';
        }
      }
      var spaces = pad - chars.length;
      if (spaces > 0) trackStr += ' '.repeat(spaces);
      var sym = t.sym;
      var symCol = SYM_COLOR[sym] || '#30363d';
      var gate = GATE_MAP[sym] || '\u00B7';
      var num = '<span style="color:#484f58">' + String(i + 1).padStart(4) + '</span>';
      var gateStr = o.gates ? '<span style="color:' + symCol + ';opacity:0.5">'
        + gate.padEnd(5) + '</span>' : '';
      result.push(num + ' ' + trackStr
        + ' <span style="color:' + symCol + '">' + sym.padEnd(3) + '</span> '
        + gateStr + escHTML(lines[i]));
    }
    return '<pre style="font-family:monospace;line-height:1.5;background:#0d1117;color:#e6edf3;padding:12px;border-radius:8px;overflow-x:auto">'
      + result.join('\n') + '</pre>';
  }

  var TRACK_CHARS = { vert: '\u2502', branch: '\u251C', last: '\u2514', horiz: '\u2500',
    split: '\u252C', dot: '\u25CF', merge: '\u2534', cross: '\u253C' };

  function dacComplexity(content, language) {
    var tracks = dacTracks(content, language);
    var lines = String(content).split('\n');
    var maxDepth = 0, maxLine = 0, hotspots = [], scopes = [];
    var depthHisto = {};
    for (var i = 0; i < tracks.length; i++) {
      var d = tracks[i].depth;
      depthHisto[d] = (depthHisto[d] || 0) + 1;
      if (d > maxDepth) { maxDepth = d; maxLine = i + 1; }
      if (d >= 4) hotspots.push({ line: i + 1, depth: d, text: lines[i].trim(), sym: tracks[i].sym });
    }
    var returns_in_try = [], prints_in_loops = [];
    for (var i = 0; i < tracks.length; i++) {
      var t = tracks[i];
      if (t.sym === '-0:' && t.stack.indexOf('-1:') >= 0)
        returns_in_try.push({ line: i + 1, text: lines[i].trim() });
      if (t.sym === '+3:' && t.stack.indexOf('+2:') >= 0)
        prints_in_loops.push({ line: i + 1, text: lines[i].trim() });
    }
    return {
      maxDepth: maxDepth, maxLine: maxLine, totalLines: lines.length,
      depthHistogram: depthHisto, hotspots: hotspots,
      returnsInTry: returns_in_try, printsInLoops: prints_in_loops,
      avgDepth: tracks.reduce(function(a, t) { return a + t.depth; }, 0) / (tracks.length || 1),
      score: maxDepth <= 3 ? 'clean' : maxDepth <= 5 ? 'moderate' : 'complex'
    };
  }

  function dacTrackContext(content, language, lineNum) {
    var tracks = dacTracks(content, language);
    if (lineNum < 1 || lineNum > tracks.length) return null;
    var t = tracks[lineNum - 1];
    var SCOPE_NAMES = { '+0:': 'class', '0:': 'function', '+n:': 'if/else',
      '+2:': 'loop', '-1:': 'try/catch', 'n:': 'entry' };
    return {
      line: lineNum, sym: t.sym, depth: t.depth,
      scope: t.stack.map(function(s) { return SCOPE_NAMES[s] || s; }),
      scopePath: t.stack.map(function(s) { return SCOPE_NAMES[s] || s; }).join(' > ') || '(top-level)',
      quantum: [GATE_MAP[t.sym] || '·', t.depth, lineNum]
    };
  }

  function dacStats() {
    var elapsed = (_perf.now() - DAC_STATS.t0) / 1000;
    var lps = elapsed > 0 ? Math.round(DAC_STATS.lines / elapsed) : 0;
    var t5info = _getT5();
    return {
      calls: DAC_STATS.calls, lines: DAC_STATS.lines,
      elapsed: elapsed.toFixed(1) + 's', lps: lps,
      engine: t5info.available ? 'T5-native' : 'JS-regex',
      t5: { available: t5info.available, speed: t5info.available ? '3.2ns/line' : null, tier: t5info.available ? 'T5' : 'T0' },
      classifications: Object.assign({}, DAC_STATS.classifications),
      sources: Object.assign({}, DAC_STATS.sources)
    };
  }

  var FONT_BLOCK_RANGES = {
    basic_latin: [0x0020, 0x007E],
    latin_1_supplement: [0x00A0, 0x00FF],
    latin_extended_a: [0x0100, 0x017F],
    latin_extended_b: [0x0180, 0x024F],
    latin_extended_additional: [0x1E00, 0x1EFF],
    greek_coptic: [0x0370, 0x03FF],
    greek_extended: [0x1F00, 0x1FFF],
    cyrillic: [0x0400, 0x04FF],
    arrows: [0x2190, 0x21FF],
    letterlike_symbols: [0x2100, 0x214F],
    number_forms: [0x2150, 0x218F],
    math_operators: [0x2200, 0x22FF],
    misc_math_symbols_a: [0x27C0, 0x27EF],
    supplemental_math_operators: [0x2A00, 0x2AFF]
  };

  var FONT_CORE_PROFILES = {
    qbit_roman_core: {
      id: 'qbit_roman_core',
      name: 'qbit roman core',
      ranges: [
        [0x0020, 0x007E],
        [0x00A0, 0x00FF],
        [0x0100, 0x017F],
        [0x0180, 0x024F]
      ],
      tags: ['roman', 'latin', 'core']
    },
    qbit_roman_math_core: {
      id: 'qbit_roman_math_core',
      name: 'qbit roman + math core',
      ranges: [
        [0x0020, 0x007E],
        [0x00A0, 0x00FF],
        [0x0100, 0x017F],
        [0x0180, 0x024F],
        [0x2190, 0x21FF],
        [0x2200, 0x22FF],
        [0x27C0, 0x27EF],
        [0x2A00, 0x2AFF]
      ],
      tags: ['roman', 'latin', 'math', 'core']
    }
  };

  var FONT_BLOCK_ALIASES = {
    roman: ['basic_latin', 'latin_1_supplement', 'latin_extended_a', 'latin_extended_b', 'latin_extended_additional'],
    latin: ['basic_latin', 'latin_1_supplement', 'latin_extended_a', 'latin_extended_b', 'latin_extended_additional'],
    greek: ['greek_coptic', 'greek_extended'],
    cyrillic: ['cyrillic'],
    arrows: ['arrows'],
    math: ['math_operators', 'misc_math_symbols_a', 'supplemental_math_operators', 'letterlike_symbols', 'number_forms']
  };

  var FONT_BLOCK_SAMPLES = {
    basic_latin: [0x0041, 0x0061, 0x0030],
    latin_1_supplement: [0x00C1, 0x00E9, 0x00F1],
    latin_extended_a: [0x0100, 0x010D, 0x017E],
    latin_extended_b: [0x0186, 0x01A0, 0x0247],
    latin_extended_additional: [0x1E0A, 0x1E63, 0x1EF3],
    greek_coptic: [0x03B1, 0x03C0, 0x03A9],
    greek_extended: [0x1F00, 0x1F10, 0x1F70],
    cyrillic: [0x0410, 0x0436, 0x044F],
    arrows: [0x2190, 0x2192, 0x21D2],
    letterlike_symbols: [0x2102, 0x2115, 0x2124],
    number_forms: [0x2153, 0x215B, 0x2189],
    math_operators: [0x2200, 0x221A, 0x2260],
    misc_math_symbols_a: [0x27C2, 0x27D2, 0x27E9],
    supplemental_math_operators: [0x2A00, 0x2A2F, 0x2AFF]
  };

  var FONT_DEFAULT_FALLBACKS = {
    roman: ['Inter', 'SF Pro Text', 'Noto Sans', 'Segoe UI', 'Arial'],
    latin_extended: ['Noto Sans', 'Source Sans 3', 'DejaVu Sans'],
    greek: ['Noto Sans', 'STIX Two Text', 'Times New Roman'],
    cyrillic: ['Noto Sans', 'Roboto', 'DejaVu Sans'],
    math: ['STIX Two Math', 'Cambria Math', 'Noto Sans Math', 'Latin Modern Math'],
    arrows: ['STIX Two Math', 'Noto Sans Symbols 2']
  };

  var _fontRegistry = Object.create(null);
  _fontRegistry.qbit_roman_core = _clone(FONT_CORE_PROFILES.qbit_roman_core);
  _fontRegistry.qbit_roman_math_core = _clone(FONT_CORE_PROFILES.qbit_roman_math_core);

  function _clone(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  }

  function _parseHexCodePoint(token) {
    var t = String(token || '').trim().toUpperCase();
    if (!t) return NaN;
    t = t.replace(/^U\+/, '').replace(/^0X/, '');
    return parseInt(t, 16);
  }

  function _normalizeRange(rangeLike) {
    if (!rangeLike && rangeLike !== 0) return null;
    if (Array.isArray(rangeLike) && rangeLike.length >= 2) {
      var a = Number(rangeLike[0]), b = Number(rangeLike[1]);
      if (!isFinite(a) || !isFinite(b)) return null;
      if (a > b) { var t = a; a = b; b = t; }
      return [Math.max(0, Math.floor(a)), Math.max(0, Math.floor(b))];
    }
    var raw = String(rangeLike || '').trim();
    if (!raw) return null;
    var parts = raw.split('-');
    if (parts.length === 1) {
      var cp = _parseHexCodePoint(parts[0]);
      if (!isFinite(cp)) return null;
      return [cp, cp];
    }
    var start = _parseHexCodePoint(parts[0]);
    var end = _parseHexCodePoint(parts[1]);
    if (!isFinite(start) || !isFinite(end)) return null;
    if (start > end) { var x = start; start = end; end = x; }
    return [start, end];
  }

  function _normalizeCodepoints(codepoints) {
    var out = [];
    var seen = Object.create(null);
    (codepoints || []).forEach(function (value) {
      var cp = Number(value);
      if (!isFinite(cp)) cp = _parseHexCodePoint(value);
      cp = Math.floor(cp);
      if (!isFinite(cp) || cp < 0) return;
      if (seen[cp]) return;
      seen[cp] = true;
      out.push(cp);
    });
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function _normalizeRanges(ranges) {
    var out = [];
    (ranges || []).forEach(function (r) {
      var nr = _normalizeRange(r);
      if (nr) out.push(nr);
    });
    return out;
  }

  function _expandBlockAliases(blocks) {
    var out = [];
    var seen = Object.create(null);
    (blocks || []).forEach(function (name) {
      var key = String(name || '').trim().toLowerCase().replace(/\s+/g, '_');
      if (!key) return;
      var expanded = FONT_BLOCK_ALIASES[key] || [key];
      expanded.forEach(function (item) {
        if (!FONT_BLOCK_RANGES[item] || seen[item]) return;
        seen[item] = true;
        out.push(item);
      });
    });
    return out;
  }

  function _manifestFromBlocks(blocks) {
    var expanded = _expandBlockAliases(blocks);
    return {
      blocks: expanded,
      ranges: expanded.map(function (b) { return FONT_BLOCK_RANGES[b]; })
    };
  }

  function _isInRanges(cp, ranges) {
    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      if (cp >= r[0] && cp <= r[1]) return true;
    }
    return false;
  }

  function _codePointsFromText(content) {
    var cps = [];
    var seen = Object.create(null);
    var txt = String(content || '');
    for (var i = 0; i < txt.length; i++) {
      var cp = txt.codePointAt(i);
      if (cp > 0xFFFF) i++;
      if (cp <= 0x20) continue;
      if (seen[cp]) continue;
      seen[cp] = true;
      cps.push(cp);
    }
    cps.sort(function (a, b) { return a - b; });
    return cps;
  }

  function _blockNameForCodePoint(cp) {
    var names = Object.keys(FONT_BLOCK_RANGES);
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      var r = FONT_BLOCK_RANGES[n];
      if (cp >= r[0] && cp <= r[1]) return n;
    }
    return 'other';
  }

  function _formatCodePoint(cp) {
    var hex = cp.toString(16).toUpperCase();
    return 'U+' + '0000'.slice(Math.min(4, hex.length)) + hex;
  }

  function _sampleCharsForBlocks(blocks) {
    var samples = [];
    var seen = Object.create(null);
    (blocks || []).forEach(function (b) {
      var pts = FONT_BLOCK_SAMPLES[b] || [];
      for (var i = 0; i < pts.length; i++) {
        var cp = pts[i];
        if (seen[cp]) continue;
        seen[cp] = true;
        samples.push({ codePoint: cp, token: _formatCodePoint(cp), char: String.fromCodePoint(cp), block: b });
      }
    });
    return samples;
  }

  function _normalizeFontManifest(input, fallbackName) {
    var src = input || {};
    var out = {
      id: String(src.id || fallbackName || 'font-manifest').trim(),
      name: String(src.name || src.id || fallbackName || 'font-manifest').trim(),
      ranges: _normalizeRanges(src.ranges || []),
      codepoints: _normalizeCodepoints(src.codepoints || []),
      blocks: _expandBlockAliases(src.blocks || []),
      tags: Array.isArray(src.tags) ? src.tags.slice() : []
    };
    if (out.blocks.length > 0) {
      var fromBlocks = _manifestFromBlocks(out.blocks);
      out.ranges = out.ranges.concat(fromBlocks.ranges);
    }
    if (!out.ranges.length && !out.codepoints.length && FONT_CORE_PROFILES[out.id]) {
      var preset = FONT_CORE_PROFILES[out.id];
      out.ranges = _normalizeRanges(preset.ranges || []);
      out.codepoints = _normalizeCodepoints(preset.codepoints || []);
      out.blocks = _expandBlockAliases(preset.blocks || []);
      out.tags = (preset.tags || []).slice();
      out.name = preset.name || out.name;
    }
    return out;
  }

  function _resolveFontManifest(fontRef) {
    if (!fontRef) return _normalizeFontManifest(FONT_CORE_PROFILES.qbit_roman_math_core, 'qbit_roman_math_core');
    if (typeof fontRef === 'string') {
      var key = String(fontRef).trim();
      var k2 = key.toLowerCase();
      var hit = _fontRegistry[k2] || FONT_CORE_PROFILES[k2];
      if (!hit) return _normalizeFontManifest({ id: key, name: key }, key);
      return _normalizeFontManifest(hit, key);
    }
    return _normalizeFontManifest(fontRef, fontRef.id || 'font-manifest');
  }

  function _fallbackPlan(requiredBlocks) {
    var plan = [];
    var pushUnique = function (name) { if (plan.indexOf(name) === -1) plan.push(name); };
    if ((requiredBlocks || []).indexOf('math_operators') >= 0 || (requiredBlocks || []).indexOf('supplemental_math_operators') >= 0 || (requiredBlocks || []).indexOf('misc_math_symbols_a') >= 0) {
      FONT_DEFAULT_FALLBACKS.math.forEach(pushUnique);
    }
    if ((requiredBlocks || []).indexOf('arrows') >= 0) FONT_DEFAULT_FALLBACKS.arrows.forEach(pushUnique);
    if ((requiredBlocks || []).indexOf('greek_coptic') >= 0 || (requiredBlocks || []).indexOf('greek_extended') >= 0) FONT_DEFAULT_FALLBACKS.greek.forEach(pushUnique);
    if ((requiredBlocks || []).indexOf('cyrillic') >= 0) FONT_DEFAULT_FALLBACKS.cyrillic.forEach(pushUnique);
    if ((requiredBlocks || []).indexOf('latin_extended_a') >= 0 || (requiredBlocks || []).indexOf('latin_extended_b') >= 0 || (requiredBlocks || []).indexOf('latin_extended_additional') >= 0) {
      FONT_DEFAULT_FALLBACKS.latin_extended.forEach(pushUnique);
    }
    FONT_DEFAULT_FALLBACKS.roman.forEach(pushUnique);
    return plan;
  }

  // .qbit codec — encode/decode content with prefix gutter
  // === .QBIT UNIFIED CODEC ===
  // Entry point for ALL encode/decode. Wires DAC + Steno + Prefix into one call.
  // qbitCodec.encode() → classify + DAC + steno-encode whitespace
  // qbitCodec.decode() → steno-decode + extract metadata
  // qbitCodec.strip()  → remove all steno, return clean source
  // qbitCodec.extract() → save steno metadata before formatter runs
  // qbitCodec.reinject() → re-encode steno metadata after formatter finishes
  // qbitCodec.map()    → generate .steno.map sidecar for production deploy
  var _stenoMode = 'full'; // 'full' | 'prefix-only' | 'off'
  // Hybrid runtime migration policy (A+C):
  // A) auto-normalize legacy outputs on generate/save
  // C) allow temporary legacy with warning tags until confidence gates pass
  var _runtimePolicy = {
    autoNormalize: true,
    allowLegacyWarning: true,
    hardBlock: false,
    warningTag: 'legacy-runtime-warning'
  };
  var _runtimeConfidence = {
    profile: 'dev',
    testsPassed: 0,
    testsFailed: 0,
    ibmVerifiedRuns: 0,
    minPassRate: 0.95,
    minTests: 50,
    minIbmRuns: 6,
    autoPromoteHardBlock: false,
    status: 'warning',
    lastEvaluated: null
  };

  function _getSteno() {
    return _isBrowser ? root.QbitSteno : (typeof require === 'function' ? (function(){try{return require('./qbit-steno.js')}catch(e){return null}})() : null);
  }

  function _getPreflight() {
    return _isBrowser ? root.QbitPreflight : (typeof require === 'function' ? (function(){try{return require('./qbit-preflight.js')}catch(e){return null}})() : null);
  }

  function _getQpack() {
    if (_isBrowser) return null;
    if (typeof require !== 'function') return null;
    return (function () {
      try { return require('../qbit/09-tools/qbit-pack.js'); }
      catch (e) { return null; }
    })();
  }

  function _isLegacyContent(content) {
    if (!content) return false;
    var s = String(content);
    // Legacy markers: line-prefixed gutter format or historical header variants.
    return /^[+\-]?(?:[0-9]|n):\s/m.test(s) ||
      /beyondBINARY\s+quantum-prefixed/i.test(s) ||
      /QUANTUM PREFIX LIVE SYNC/i.test(s);
  }

  function _normalizeRuntime(content, language, source, opts) {
    opts = opts || {};
    var normalized = false;
    var warnings = [];
    var code = String(content || '');
    var isLegacy = _isLegacyContent(code);
    if (isLegacy && _runtimePolicy.allowLegacyWarning) {
      warnings.push({
        tag: _runtimePolicy.warningTag,
        message: 'Legacy format detected. Auto-normalized through qbit runtime surface.'
      });
    }
    if (isLegacy && _runtimePolicy.autoNormalize) {
      // Normalize by decoding legacy/prefixed content to clean code first,
      // then re-encode through unified qbitCodec path.
      var dec = qbitCodec.decode(code);
      var clean = dec && dec.code ? dec.code : code;
      var enc = qbitCodec.encode(clean, language || 'auto', source || 'runtime-normalizer', opts);
      code = enc.stenoCode || enc.prefixed || clean;
      normalized = true;
    }
    if (isLegacy && _runtimePolicy.hardBlock) {
      return {
        blocked: true,
        code: null,
        normalized: false,
        isLegacy: true,
        warnings: warnings.concat([{ tag: 'legacy-runtime-block', message: 'Legacy output blocked by runtime policy.' }]),
        gate: _evaluateRuntimeConfidence()
      };
    }
    return { blocked: false, code: code, normalized: normalized, isLegacy: isLegacy, warnings: warnings, gate: _evaluateRuntimeConfidence() };
  }

  function _runtimeSnapshot() {
    return {
      testsPassed: _runtimeConfidence.testsPassed,
      testsFailed: _runtimeConfidence.testsFailed,
      ibmVerifiedRuns: _runtimeConfidence.ibmVerifiedRuns,
      minPassRate: _runtimeConfidence.minPassRate,
      minTests: _runtimeConfidence.minTests,
      minIbmRuns: _runtimeConfidence.minIbmRuns,
      autoPromoteHardBlock: _runtimeConfidence.autoPromoteHardBlock,
      status: _runtimeConfidence.status,
      lastEvaluated: _runtimeConfidence.lastEvaluated
    };
  }

  function _evaluateRuntimeConfidence() {
    var total = _runtimeConfidence.testsPassed + _runtimeConfidence.testsFailed;
    var passRate = total > 0 ? _runtimeConfidence.testsPassed / total : 0;
    var eligible = total >= _runtimeConfidence.minTests &&
      passRate >= _runtimeConfidence.minPassRate &&
      _runtimeConfidence.ibmVerifiedRuns >= _runtimeConfidence.minIbmRuns;
    _runtimeConfidence.status = eligible ? 'eligible' : 'warning';
    _runtimeConfidence.lastEvaluated = Date.now();
    if (eligible && _runtimeConfidence.autoPromoteHardBlock) {
      _runtimePolicy.hardBlock = true;
      _runtimePolicy.allowLegacyWarning = false;
      _runtimeConfidence.status = 'enforced';
    }
    return {
      totalTests: total,
      passRate: +passRate.toFixed(4),
      eligible: eligible,
      enforced: !!_runtimePolicy.hardBlock,
      thresholds: {
        minPassRate: _runtimeConfidence.minPassRate,
        minTests: _runtimeConfidence.minTests,
        minIbmRuns: _runtimeConfidence.minIbmRuns
      },
      counters: {
        testsPassed: _runtimeConfidence.testsPassed,
        testsFailed: _runtimeConfidence.testsFailed,
        ibmVerifiedRuns: _runtimeConfidence.ibmVerifiedRuns
      },
      status: _runtimeConfidence.status,
      lastEvaluated: _runtimeConfidence.lastEvaluated
    };
  }

  function _recordRuntimeEvidence(passed, meta) {
    if (passed) _runtimeConfidence.testsPassed += 1;
    else _runtimeConfidence.testsFailed += 1;
    if (meta && meta.ibmVerified) _runtimeConfidence.ibmVerifiedRuns += 1;
    return _evaluateRuntimeConfidence();
  }

  function _setRuntimeProfile(profile) {
    var p = String(profile || 'dev').toLowerCase();
    if (p === 'prod') {
      _runtimePolicy.autoNormalize = true;
      _runtimePolicy.allowLegacyWarning = false;
      _runtimePolicy.hardBlock = true;
      _runtimeConfidence.minPassRate = 0.99;
      _runtimeConfidence.minTests = 200;
      _runtimeConfidence.minIbmRuns = 12;
      _runtimeConfidence.autoPromoteHardBlock = true;
    } else if (p === 'stage') {
      _runtimePolicy.autoNormalize = true;
      _runtimePolicy.allowLegacyWarning = true;
      _runtimePolicy.hardBlock = false;
      _runtimeConfidence.minPassRate = 0.97;
      _runtimeConfidence.minTests = 100;
      _runtimeConfidence.minIbmRuns = 8;
      _runtimeConfidence.autoPromoteHardBlock = true;
    } else {
      _runtimePolicy.autoNormalize = true;
      _runtimePolicy.allowLegacyWarning = true;
      _runtimePolicy.hardBlock = false;
      _runtimeConfidence.minPassRate = 0.95;
      _runtimeConfidence.minTests = 50;
      _runtimeConfidence.minIbmRuns = 6;
      _runtimeConfidence.autoPromoteHardBlock = false;
      p = 'dev';
    }
    _runtimeConfidence.profile = p;
    return {
      profile: p,
      policy: Object.assign({}, _runtimePolicy),
      confidence: _runtimeSnapshot(),
      evaluation: _evaluateRuntimeConfidence()
    };
  }

  var _t5 = null;
  function _getT5() {
    if (_t5 !== undefined && _t5 !== null) return _t5;
    if (typeof require === 'function') {
      try {
        var cp = require('child_process');
        var p = require('path');
        var fs = require('fs');
        var root = p.join(__dirname, '..');
        var candidates = [
          p.join(root, 'target', 'release', 'uvspeed'),
          p.join(root, 'crates', 'prefix-engine', 'target', 'release', 'uvspeed')
        ];
        for (var i = 0; i < candidates.length; i++) {
          try { fs.accessSync(candidates[i]); _t5 = { bin: candidates[i], cp: cp, available: true, speed: '3.2ns/line' }; break; }
          catch (e) {}
        }
        if (!_t5 || !_t5.available) _t5 = { available: false };
      } catch (e) { _t5 = { available: false }; }
    } else { _t5 = { available: false }; }
    return _t5;
  }

  function _normalizeSym(sym) {
    var s = String(sym || '').trim();
    if (!s || s === ' ') return ' ';
    return s.endsWith(':') ? s : (s + ':');
  }

  // ── .qbit_musica.Engine — code/music bridge for DAW + quantum pipeline ──
  var qbitMusicaEngine = {
    VERSION: 'qbit_musica.Engine/v1',
    qCalibrate: function (nsPerLine) {
      var ns = Math.max(0.001, Number(nsPerLine) || 0.001);
      var qHz = 1e9 / ns;
      var qBPM = qHz * 60;
      return {
        nsPerLine: +ns.toFixed(3),
        qHz: +qHz.toFixed(2),
        qBPM: +qBPM.toFixed(2),
        lane: qBPM >= 1e8 ? 'beyond-bpm' : 'linear-bpm'
      };
    },
    blochNavigation: function (musica) {
      var m = musica || {};
      var qHz = Math.max(0.000001, Number(m.qHz || 0));
      var qBPM = Math.max(0.000001, Number(m.qBPM || (qHz * 60)));
      var theta = ((qBPM % 360000) / 360000) * (Math.PI * 2);
      var phi = ((qHz % 360000) / 360000) * (Math.PI * 2);
      var r = Math.max(0.05, Math.min(1, Math.log10(qBPM + 1) / 9));
      var st = Math.sin(theta), ct = Math.cos(theta), sp = Math.sin(phi), cp = Math.cos(phi);
      var x = r * st * cp;
      var y = r * st * sp;
      var z = r * ct;
      return {
        thetaRad: +theta.toFixed(6),
        phiRad: +phi.toFixed(6),
        r: +r.toFixed(6),
        vector: { x: +x.toFixed(6), y: +y.toFixed(6), z: +z.toFixed(6) }
      };
    },
    gisSphereMap: function (bloch) {
      var b = bloch || { vector: { x: 0, y: 0, z: 0 }, r: 0 };
      var x = Number((b.vector || {}).x || 0);
      var y = Number((b.vector || {}).y || 0);
      var z = Number((b.vector || {}).z || 0);
      var lat = Math.max(-90, Math.min(90, z * 90));
      var lon = Math.atan2(y, x) * (180 / Math.PI);
      var alt = Math.max(0, Number(b.r || 0) * 1000);
      return {
        lat: +lat.toFixed(5),
        lon: +lon.toFixed(5),
        altM: +alt.toFixed(2),
        sphere: 'gis'
      };
    },
    waveformTrajectory: function (musica, bloch, gis) {
      var m = musica || {};
      var qHz = Math.max(0.000001, Number(m.qHz || 0));
      var ns = Math.max(0.001, Number(m.nsPerLine || 0.001));
      var g = gis || { lat: 0, lon: 0 };
      var b = bloch || { r: 0 };
      var v = Math.min(3e8, qHz); // bounded to c-scale for trajectory visualization
      var e = Math.max(-89.99, Math.min(89.99, Number(g.lat || 0)));
      var az = Number(g.lon || 0);
      var t1 = ns * 1e-9;
      var dist = v * t1;
      return {
        mode: 'ballistic-waveform',
        azimuthDeg: +az.toFixed(4),
        elevationDeg: +e.toFixed(4),
        velocity: +v.toFixed(2),
        horizonStepM: +dist.toFixed(4),
        curvature: +(1 - Math.max(0, Math.min(1, Number(b.r || 0)))).toFixed(6)
      };
    },
    atmosField: function (bloch, trajectory) {
      var b = bloch || { vector: { x: 0, y: 0, z: 0 }, r: 0 };
      var t = trajectory || { elevationDeg: 0, azimuthDeg: 0 };
      var x = Math.abs(Number((b.vector || {}).x || 0));
      var y = Math.abs(Number((b.vector || {}).y || 0));
      var z = Math.abs(Number((b.vector || {}).z || 0));
      var l = Math.max(0, Math.min(1, (x + 0.1)));
      var r = Math.max(0, Math.min(1, (y + 0.1)));
      var c = Math.max(0, Math.min(1, (z + 0.15)));
      var ls = Math.max(0, Math.min(1, (x * 0.8)));
      var rs = Math.max(0, Math.min(1, (y * 0.8)));
      var lfe = Math.max(0, Math.min(1, (1 - Number(b.r || 0)) * 0.9));
      var top = Math.max(0, Math.min(1, Math.abs(Number(t.elevationDeg || 0)) / 90));
      return {
        format: 'atmos-7.1.2',
        channels: {
          L: +l.toFixed(4), R: +r.toFixed(4), C: +c.toFixed(4), LFE: +lfe.toFixed(4),
          Ls: +ls.toFixed(4), Rs: +rs.toFixed(4), Ltf: +top.toFixed(4), Rtf: +top.toFixed(4)
        }
      };
    },
    ironCompass: function (musica) {
      var m = musica || {};
      var lane = m.calibrationLane || 'linear-bpm';
      var profile = m.profile || 'steady';
      var heading = lane === 'beyond-bpm' ? 'NNE' : (profile === 'lightspeed' ? 'ENE' : 'E');
      var bloch = this.blochNavigation(m);
      var gis = this.gisSphereMap(bloch);
      var wave = this.waveformTrajectory(m, bloch, gis);
      var atmos = this.atmosField(bloch, wave);
      return {
        name: 'iron-compass',
        heading: heading,
        lane: lane,
        route: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'],
        points: {
          N: 'L7 Persona/Security',
          E: 'L3 Quantum',
          S: 'L0 Super Speed',
          W: 'L2 Commander'
        },
        active: lane === 'beyond-bpm' ? ['L0', 'L3', 'L4', 'L7'] : ['L0', 'L2', 'L4'],
        bloch: bloch,
        gisSphere: gis,
        waveform: wave,
        atmosField: atmos,
        note: lane === 'beyond-bpm'
          ? 'Beyond-BPM lane uses qHz/ns routing on Iron Line.'
          : 'Linear BPM lane uses musical-tempo routing.'
      };
    },
    explainCalibration: function (musica) {
      var m = musica || {};
      var bpm = Number(m.bpm || 0);
      var qBPM = Number(m.qBPM || 0);
      var qHz = Number(m.qHz || 0);
      var ns = Number(m.nsPerLine || 0);
      var lane = m.calibrationLane || 'linear-bpm';
      return {
        lane: lane,
        summary: 'BPM is musical calibration; qBPM is compute-derived calibration (QHz*60).',
        formulas: {
          qHz_from_nsPerLine: 'qHz = 1e9 / nsPerLine',
          qBPM_from_qHz: 'qBPM = qHz * 60',
          bpm_to_hz: 'Hz = BPM / 60'
        },
        values: { bpm: +bpm.toFixed(2), qBPM: +qBPM.toFixed(2), qHz: +qHz.toFixed(2), nsPerLine: +ns.toFixed(3) },
        interpretation: lane === 'beyond-bpm'
          ? 'Performance exceeds musically meaningful linear BPM calibration; use qHz/ns-per-line lane.'
          : 'Performance is within linear BPM calibration lane.'
      };
    },
    profileFromBpm: function (bpm) {
      if (bpm >= 180) return 'lightspeed';
      if (bpm >= 130) return 'fast';
      return 'steady';
    },
    fromCode: function (content, language, source, opts) {
      opts = opts || {};
      var bm = qbitCodec.contrailBenchmark(content || '', language || 'auto', source || 'qbit-musica', opts);
      var lines = Math.max(1, bm.totalLines || 1);
      var density = Math.min(1, (bm.coverage || 0));
      var bpm = Math.max(72, Math.min(240, 108 + density * 80 + Math.min(40, lines / 40)));
      var nsPerLine = (Number(bm.elapsedMs || 0) > 0) ? ((Number(bm.elapsedMs) * 1e6) / lines) : 0;
      var qcal = this.qCalibrate(nsPerLine);
      var profile = this.profileFromBpm(bpm);
      var style = Object.entries(bm.prefixCounts || {})
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, 16)
        .map(function (kv) { return kv[0] + 'x' + kv[1]; })
        .join(' ');
      return {
        engine: this.VERSION,
        source: source || 'qbit-musica',
        bpm: +bpm.toFixed(2),
        qBPM: qcal.qBPM,
        qHz: qcal.qHz,
        nsPerLine: qcal.nsPerLine,
        calibrationLane: qcal.lane,
        profile: profile,
        calibrationLegend: this.explainCalibration({
          bpm: +bpm.toFixed(2),
          qBPM: qcal.qBPM,
          qHz: qcal.qHz,
          nsPerLine: qcal.nsPerLine,
          calibrationLane: qcal.lane
        }),
        ironCompass: this.ironCompass({
          bpm: +bpm.toFixed(2),
          qBPM: qcal.qBPM,
          qHz: qcal.qHz,
          nsPerLine: qcal.nsPerLine,
          profile: profile,
          calibrationLane: qcal.lane
        }),
        notes: (bm.noteCounts || {}),
        contrail: bm.contrail || '',
        t5: bm.t5 || { requested: !!opts.useT5, available: false, used: false, fallback: 'JS-regex' },
        codeStyleAsMusic: style,
        daw: {
          webMIDI: !!(typeof navigator !== 'undefined' && navigator.requestMIDIAccess),
          webAudio: !!(typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined'),
          oscBridge: true,
          abletonLinkBridge: true,
          midiClockBridge: true,
          pluginSurface: ['vst3-bridge', 'au-bridge', 'aax-bridge']
        },
        levels: this.baseLevels(content || ''),
        ts: Date.now()
      };
    },
    baseLevels: function (content) {
      var text = String(content || '');
      var bytes = 0;
      for (var i = 0; i < text.length; i++) bytes += (text.charCodeAt(i) > 255 ? 2 : 1);
      return {
        binaryBits: bytes * 8,
        decimalUnits: text.length,
        hexNibbles: bytes * 2
      };
    },
    toDawPayload: function (musica, opts) {
      opts = opts || {};
      var m = musica || {};
      return {
        type: 'musica-daw-payload',
        source: opts.source || 'qbitCodec',
        bpm: m.bpm || 120,
        qBPM: m.qBPM || 0,
        qHz: m.qHz || 0,
        nsPerLine: m.nsPerLine || 0,
        calibrationLane: m.calibrationLane || 'linear-bpm',
        profile: m.profile || 'steady',
        calibrationLegend: m.calibrationLegend || null,
        ironCompass: m.ironCompass || this.ironCompass(m),
        style: m.codeStyleAsMusic || '',
        contrail: m.contrail || '',
        notes: m.notes || {},
        t5: m.t5 || { requested: false, available: false, used: false, fallback: 'JS-regex' },
        daw: m.daw || {},
        levels: m.levels || {},
        ts: Date.now()
      };
    },
    sphereVegasPacket: function (musica, opts) {
      opts = opts || {};
      var m = musica || {};
      var ic = m.ironCompass || this.ironCompass(m);
      var bloch = ic.bloch || this.blochNavigation(m);
      var gis = ic.gisSphere || this.gisSphereMap(bloch);
      var wave = ic.waveform || this.waveformTrajectory(m, bloch, gis);
      var atmos = ic.atmosField || this.atmosField(bloch, wave);
      return {
        type: 'sphere-vegas-nav',
        source: opts.source || m.source || 'qbitCodec',
        lane: m.calibrationLane || 'linear-bpm',
        qBPM: Number(m.qBPM || 0),
        qHz: Number(m.qHz || 0),
        nsPerLine: Number(m.nsPerLine || 0),
        compass: { heading: ic.heading || 'E', route: ic.route || ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] },
        bloch: bloch,
        gis: gis,
        waveform: wave,
        atmos: atmos,
        ts: Date.now()
      };
    },
    publishSphereVegas: function (musica, opts) {
      if (typeof BroadcastChannel === 'undefined') return null;
      var packet = this.sphereVegasPacket(musica, opts || {});
      try {
        var bc = new BroadcastChannel('sphere-vegas');
        bc.postMessage(packet);
      } catch (_) {}
      return packet;
    }
  };

  var qbitCodec = {
    encode: function (content, language, source, opts) {
      opts = opts || {};
      var lang = language || 'auto';
      var dac = prefixDAC(content, lang, source || 'qbit-codec');
      var ST = _getSteno();
      if (ST && _stenoMode === 'full') {
        var stenoResult = (opts.useStenoReplace && ST.stenoReplace)
          ? ST.stenoReplace(content, lang, {
              layer: opts.layer || 0,
              upgrades: opts.upgrades || {},
              onLowConfidence: opts.onLowConfidence || null,
              confidenceThreshold: opts.confidenceThreshold
            })
          : ST.stenoEncode(content, lang, { layer: opts.layer || 0 });
        dac.steno = stenoResult.stats;
        dac.stenoCode = stenoResult.code;
        dac.stenoMeta = stenoResult.meta;
      }
      var PF = _getPreflight();
      if (PF && (lang === 'qasm' || lang === 'quil' || lang === 'qsharp' || (lang === 'auto' && /OPENQASM|qreg|creg|qubit|measure/.test(String(content).slice(0, 500))))) {
        var backend = (opts && opts.backend) || 'ibm_torino';
        dac.preflight = PF.preflight(content, backend, { shots: opts.shots || 4096 });
      }
      if (opts.fontSupport) {
        var fontTarget = opts.fontTarget || opts.fontRef || 'qbit_roman_math_core';
        dac.fontSupport = this.fontSupportManifest(content, {
          language: lang,
          source: source || 'qbit-codec',
          target: fontTarget
        });
        if (opts.fontRef || opts.fontManifest) {
          dac.fontCoverage = this.fontCoverage(content, opts.fontManifest || opts.fontRef, { language: lang, source: source || 'qbit-codec' });
        }
      }
      return dac;
    },
    decode: function (content) {
      if (!content) return { code: '', meta: null, steno: null };
      var ST = _getSteno();
      var stenoData = null, cleanCode = content;
      if (ST) {
        var dec = ST.stenoDecode(content);
        stenoData = dec.meta;
        cleanCode = dec.code;
      }
      var stripped = String(cleanCode).split('\n').map(function (line) {
        return line.replace(/^[+\-]?[0-9n]:?\s{0,3}/, '');
      }).join('\n');
      return { code: stripped, rawCode: cleanCode, steno: stenoData };
    },
    strip: function (content) {
      if (!content) return '';
      var ST = _getSteno();
      return ST ? ST.stenoStrip(content) : content;
    },
    extract: function (content) {
      var ST = _getSteno();
      if (!ST || !content) return { code: content, saved: null };
      var dec = ST.stenoDecode(content);
      return { code: dec.code, saved: dec.meta };
    },
    reinject: function (formattedCode, savedMeta, language) {
      var ST = _getSteno();
      if (!ST || !savedMeta) return formattedCode;
      var lines = formattedCode.split('\n');
      var encoded = [];
      for (var i = 0; i < lines.length; i++) {
        var meta = (i < savedMeta.length && savedMeta[i]) ? savedMeta[i] : null;
        if (meta && meta.sym) {
          var positions = ST.findSpaces(lines[i]);
          if (positions.length >= 5) {
            var stenoChars = ST.encodeRecord(meta.sym, meta.gate, meta.depth, meta.layer, meta.category);
            var chars = lines[i].split('');
            for (var j = 0; j < 5 && j < positions.length; j++) {
              chars[positions[j]] = stenoChars[j];
            }
            encoded.push(chars.join(''));
          } else {
            encoded.push(lines[i]);
          }
        } else {
          encoded.push(lines[i]);
        }
      }
      return encoded.join('\n');
    },
    map: function (content, language, source, opts) {
      var mapOpts = opts || {};
      var result = this.encode(content, language, source, mapOpts);
      var stripped = this.strip(content);
      return {
        version: 1,
        source: source || 'qbit-codec',
        language: language || 'auto',
        lines: (result.meta || {}).totalLines || 0,
        coverage: (result.meta || {}).coverage || 0,
        stenoStats: result.steno || null,
        dacMeta: result.meta,
        strippedSize: stripped.length,
        fullSize: (result.stenoCode || content).length,
        stenoMeta: result.stenoMeta || null,
        fontSupport: result.fontSupport || null,
        fontCoverage: result.fontCoverage || null,
        ts: Date.now()
      };
    },
    header: function (meta) {
      if (!meta) return '';
      return '# beyondBINARY quantum-prefixed | ' + (meta.source || 'uvspeed') +
        ' | coverage: ' + Math.round(meta.coverage * 100) + '% | ' +
        meta.totalLines + ' lines | {n, +1, -n, +0, 0, -1, +n, +2, -0, +3, 1}';
    },
    wrap: function (content, language, source, opts) {
      var result = this.encode(content, language, source, opts);
      if (!result.meta) return content;
      var out = this.header(result.meta);
      if (result.preflight) {
        out += '\n# PREFLIGHT: ' + result.preflight.verdict + ' (' + result.preflight.scorePct + '% · ~' + result.preflight.estimatedFidelity.toFixed(0) + '% fidelity)';
      }
      return out + '\n' + (result.stenoCode || result.prefixed);
    },
    checkpointProfile: function () {
      return {
        id: 'qpth',
        version: '0.1',
        language: 'transcript',
        extension: '.qpth',
        mime: 'application/x-qpth'
      };
    },
    encodeCheckpointManifest: function (manifest, opts) {
      opts = opts || {};
      var profile = this.checkpointProfile();
      var src = opts.source || 'pth-ingest';
      var content = '';
      if (typeof manifest === 'string') {
        content = manifest;
      } else {
        var keys = Object.keys(manifest || {});
        var rows = [];
        rows.push('# qbit checkpoint ingest manifest');
        rows.push('format: pth-fast-v1');
        for (var i = 0; i < keys.length; i++) rows.push(keys[i] + ': ' + String(manifest[keys[i]]));
        content = rows.join('\n') + '\n';
      }
      var encoded = this.encode(content, profile.language, src, opts);
      return {
        profile: profile,
        source: src,
        content: encoded.stenoCode || encoded.prefixed || content,
        map: this.map(content, profile.language, src),
        meta: encoded.meta || null,
        steno: encoded.steno || null,
        stenoMeta: encoded.stenoMeta || null,
        ts: Date.now()
      };
    },
    decodeCheckpointManifest: function (checkpointContent) {
      var dec = this.decode(checkpointContent || '');
      var txt = String(dec.code || '');
      var out = {};
      txt.split('\n').forEach(function (line) {
        var m = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
        if (m) out[m[1]] = m[2];
      });
      return {
        profile: this.checkpointProfile(),
        manifest: out,
        text: txt,
        steno: dec.steno || null,
        ts: Date.now()
      };
    },
    qmdProfile: function () {
      return {
        id: 'qmd',
        version: '0.1',
        language: 'markdown',
        extension: '.qmd.qbit',
        restoreExtension: '.md'
      };
    },
    qjsonProfile: function () {
      return {
        id: 'qjson',
        version: '0.1',
        language: 'json',
        extension: '.qjson.qbit',
        restoreExtension: '.json'
      };
    },
    encodeQmd: function (markdown, opts) {
      opts = opts || {};
      var source = opts.source || 'qmd-profile';
      var encoded = this.encode(markdown || '', 'markdown', source, opts);
      var payload = encoded.stenoCode || encoded.prefixed || String(markdown || '');
      return {
        profile: this.qmdProfile(),
        source: source,
        content: payload,
        map: this.map(markdown || '', 'markdown', source),
        meta: encoded.meta || null,
        steno: encoded.steno || null,
        stenoMeta: encoded.stenoMeta || null,
        ts: Date.now()
      };
    },
    decodeQmd: function (qmdContent, opts) {
      opts = opts || {};
      var ST = _getSteno();
      var markdown = String(qmdContent || '');
      var stenoMeta = null;
      if (ST) {
        var dec = ST.stenoDecode(markdown);
        markdown = dec.code;
        stenoMeta = dec.meta || null;
      }
      return {
        profile: this.qmdProfile(),
        markdown: markdown,
        rawCode: markdown,
        steno: stenoMeta,
        ts: Date.now()
      };
    },
    encodeQjson: function (jsonText, opts) {
      opts = opts || {};
      var source = opts.source || 'qjson-profile';
      var encoded = this.encode(jsonText || '', 'json', source, opts);
      var payload = encoded.stenoCode || encoded.prefixed || String(jsonText || '');
      return {
        profile: this.qjsonProfile(),
        source: source,
        content: payload,
        map: this.map(jsonText || '', 'json', source),
        meta: encoded.meta || null,
        steno: encoded.steno || null,
        stenoMeta: encoded.stenoMeta || null,
        ts: Date.now()
      };
    },
    decodeQjson: function (qjsonContent, opts) {
      opts = opts || {};
      var ST = _getSteno();
      var jsonText = String(qjsonContent || '');
      var stenoMeta = null;
      if (ST) {
        var dec = ST.stenoDecode(jsonText);
        jsonText = dec.code;
        stenoMeta = dec.meta || null;
      }
      var parsed = null;
      try {
        parsed = JSON.parse(jsonText);
      } catch (_e) {
        parsed = null;
      }
      return {
        profile: this.qjsonProfile(),
        jsonText: jsonText,
        parsed: parsed,
        steno: stenoMeta,
        ts: Date.now()
      };
    },
    preflight: function (content, backend, opts) {
      var PF = _getPreflight();
      if (!PF) return null;
      return PF.preflight(content, backend || 'ibm_torino', opts || { shots: 4096 });
    },
    preflightValidateResults: function (results, backend) {
      var PF = _getPreflight();
      if (!PF) return null;
      return PF.validateResults(results, backend || 'ibm_torino');
    },
    systemDirectory: function () {
      var PF = _getPreflight();
      return PF ? PF.systemDirectory() : null;
    },
    packContainer: function (inputPath, opts) {
      var QPK = _getQpack();
      if (!QPK || !QPK.packContainer) return { ok: false, error: 'qbit-pack module unavailable in this runtime' };
      try {
        var out = QPK.packContainer(inputPath, Object.assign({ silent: true }, opts || {}));
        return { ok: true, result: out };
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },
    unpackContainer: function (containerPath, opts) {
      var QPK = _getQpack();
      if (!QPK || !QPK.unpackContainer) return { ok: false, error: 'qbit-pack module unavailable in this runtime' };
      try {
        var out = QPK.unpackContainer(containerPath, Object.assign({ silent: true }, opts || {}));
        return { ok: true, result: out };
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },
    verifyContainer: function (containerPath, opts) {
      var QPK = _getQpack();
      if (!QPK || !QPK.verifyContainer) return { ok: false, error: 'qbit-pack module unavailable in this runtime' };
      try {
        var out = QPK.verifyContainer(containerPath, Object.assign({ silent: true }, opts || {}));
        return { ok: true, result: out };
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },
    inspectContainer: function (containerPath, opts) {
      var QPK = _getQpack();
      if (!QPK || !QPK.inspectContainer) return { ok: false, error: 'qbit-pack module unavailable in this runtime' };
      try {
        var out = QPK.inspectContainer(containerPath, Object.assign({ silent: true }, opts || {}));
        return { ok: true, result: out };
      } catch (e) {
        return { ok: false, error: String(e && e.message ? e.message : e) };
      }
    },
    mode: function (m) { if (m) _stenoMode = m; return _stenoMode; },
    registerFontSupport: function (name, manifest) {
      var key = String(name || (manifest && manifest.id) || '').trim().toLowerCase();
      if (!key) return { ok: false, error: 'missing font support name' };
      var normalized = _normalizeFontManifest(Object.assign({}, manifest || {}, { id: key }), key);
      _fontRegistry[key] = normalized;
      return { ok: true, id: key, manifest: _clone(normalized) };
    },
    getFontSupport: function (name) {
      var key = String(name || '').trim().toLowerCase();
      if (!key) return null;
      var hit = _fontRegistry[key] || FONT_CORE_PROFILES[key];
      return hit ? _clone(_normalizeFontManifest(hit, key)) : null;
    },
    listFontSupport: function () {
      return Object.keys(_fontRegistry).sort().map(function (k) {
        var v = _fontRegistry[k];
        return {
          id: k,
          name: v.name || k,
          ranges: (v.ranges || []).length,
          codepoints: (v.codepoints || []).length,
          blocks: (v.blocks || []).slice()
        };
      });
    },
    fontSupportManifest: function (content, opts) {
      opts = opts || {};
      var cps = _codePointsFromText(content || '');
      var blockCounts = Object.create(null);
      for (var i = 0; i < cps.length; i++) {
        var bn = _blockNameForCodePoint(cps[i]);
        blockCounts[bn] = (blockCounts[bn] || 0) + 1;
      }
      var requiredBlocks = Object.keys(blockCounts).sort(function (a, b) { return blockCounts[b] - blockCounts[a]; });
      var samples = _sampleCharsForBlocks(requiredBlocks);
      var target = _resolveFontManifest(opts.target || 'qbit_roman_math_core');
      var coverage = this.fontCoverage(content, target, opts);
      return {
        version: 1,
        source: opts.source || 'qbit-codec',
        language: opts.language || 'auto',
        requiredCodePoints: cps.length,
        requiredBlocks: requiredBlocks,
        blockCounts: blockCounts,
        samples: samples,
        target: {
          id: target.id || null,
          name: target.name || null,
          ranges: (target.ranges || []).length,
          codepoints: (target.codepoints || []).length
        },
        fallbackPlan: _fallbackPlan(requiredBlocks),
        coverage: coverage,
        ts: Date.now()
      };
    },
    fontCoverage: function (content, fontRef, opts) {
      opts = opts || {};
      var cps = _codePointsFromText(content || '');
      var manifest = _resolveFontManifest(fontRef || opts.target || 'qbit_roman_math_core');
      var ranges = manifest.ranges || [];
      var direct = manifest.codepoints || [];
      var directLookup = Object.create(null);
      for (var i = 0; i < direct.length; i++) directLookup[direct[i]] = 1;
      var supported = [];
      var missing = [];
      for (var j = 0; j < cps.length; j++) {
        var cp = cps[j];
        if (directLookup[cp] || _isInRanges(cp, ranges)) supported.push(cp);
        else missing.push(cp);
      }
      var missingBlocks = Object.create(null);
      for (var m = 0; m < missing.length; m++) {
        var b = _blockNameForCodePoint(missing[m]);
        missingBlocks[b] = (missingBlocks[b] || 0) + 1;
      }
      var pct = cps.length ? (supported.length / cps.length) : 1;
      return {
        font: {
          id: manifest.id || null,
          name: manifest.name || manifest.id || 'font-manifest'
        },
        required: cps.length,
        supported: supported.length,
        missing: missing.length,
        coverage: pct,
        coveragePct: Number((pct * 100).toFixed(2)),
        missingBlocks: missingBlocks,
        missingCodePoints: missing.slice(0, opts.maxMissing || 128).map(function (cp) {
          return { codePoint: cp, token: _formatCodePoint(cp), char: String.fromCodePoint(cp), block: _blockNameForCodePoint(cp) };
        }),
        ts: Date.now()
      };
    },
    blockizeMulticast: function (content, opts) {
      opts = opts || {};
      var text = String(content || '');
      var language = opts.language || 'auto';
      var lines = text.split('\n');
      var blocks = [];
      var counts = Object.create(null);
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var sym = classifyLine(line, language);
        var gate = GATE_MAP[sym] || '·';
        var clean = String(line || '').trim();
        var words = clean ? clean.split(/\s+/).filter(Boolean) : [];
        if (sym !== ' ') counts[sym] = (counts[sym] || 0) + 1;
        blocks.push({
          idx: i,
          sym: sym,
          gate: gate,
          text: line,
          words: words.slice(0, 16),
          chars: line.length
        });
      }
      var payload = {
        type: 'qbios-blockize',
        source: opts.source || 'qbitCodec',
        language: language,
        blocks: blocks,
        stats: {
          lines: lines.length,
          classified: Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0),
          counts: counts
        },
        ts: Date.now()
      };
      var channels = Array.isArray(opts.channels) && opts.channels.length
        ? opts.channels.slice()
        : ['iron-line', 'quantum-prefixes', 'kbatch-training'];
      var routed = [];
      if (typeof BroadcastChannel !== 'undefined' && opts.broadcast !== false) {
        for (var c = 0; c < channels.length; c++) {
          var ch = String(channels[c] || '').trim();
          if (!ch) continue;
          try {
            var bc = new BroadcastChannel(ch);
            bc.postMessage(payload);
            routed.push(ch);
          } catch (_) {}
        }
      }
      return {
        payload: payload,
        channels: channels,
        routed: routed,
        ts: Date.now()
      };
    },
    compileFontPack: function (payload, opts) {
      opts = opts || {};
      var p = payload || {};
      var text = String(p.text || p.sample || '');
      var language = opts.language || p.language || 'text';
      var fontRef = p.fontRef || p.target || opts.target || 'qbit_roman_math_core';
      var coverage = this.fontCoverage(text, fontRef, { language: language, source: opts.source || p.source || 'font-compiler', maxMissing: opts.maxMissing || 256 });
      var manifest = this.fontSupportManifest(text, { language: language, source: opts.source || p.source || 'font-compiler', target: fontRef, maxMissing: opts.maxMissing || 256 });
      var cpList = _codePointsFromText(text);
      var glyphs = [];
      var layoutStrokeMap = p.layoutStrokeMap || {};
      var layoutIds = (p.layouts && p.layouts.length) ? p.layouts.slice() : Object.keys(layoutStrokeMap);
      var layoutStats = [];
      var layoutCharCount = Object.create(null);
      for (var li = 0; li < layoutIds.length; li++) {
        var lid = String(layoutIds[li] || '');
        var strokes = Array.isArray(layoutStrokeMap[lid]) ? layoutStrokeMap[lid] : [];
        var pointCount = 0;
        var chars = Object.create(null);
        for (var si = 0; si < strokes.length; si++) {
          var stroke = Array.isArray(strokes[si]) ? strokes[si] : [];
          pointCount += stroke.length;
          for (var pi = 0; pi < stroke.length; pi++) {
            var ch = String(stroke[pi] && stroke[pi].char || '').toLowerCase();
            if (!ch) continue;
            chars[ch] = (chars[ch] || 0) + 1;
          }
        }
        layoutCharCount[lid] = chars;
        layoutStats.push({
          id: lid,
          strokes: strokes.length,
          points: pointCount,
          chars: Object.keys(chars).length
        });
      }
      for (var i = 0; i < cpList.length; i++) {
        var cp = cpList[i];
        var ch = String.fromCodePoint(cp);
        var perLayout = {};
        for (var lj = 0; lj < layoutIds.length; lj++) {
          var layoutId = String(layoutIds[lj] || '');
          var hit = (layoutCharCount[layoutId] && layoutCharCount[layoutId][ch.toLowerCase()]) || 0;
          if (hit > 0) perLayout[layoutId] = hit;
        }
        glyphs.push({
          char: ch,
          codePoint: cp,
          token: _formatCodePoint(cp),
          block: _blockNameForCodePoint(cp),
          layoutHits: perLayout
        });
      }
      var multicast = this.blockizeMulticast(text, {
        source: opts.source || p.source || 'font-compiler',
        language: language,
        channels: opts.channels || ['iron-line', 'quantum-prefixes', 'kbatch-training', 'hexterm'],
        broadcast: opts.broadcast !== false
      });
      var safetyVerdict = coverage.missing === 0 ? 'PASS' : (coverage.coveragePct >= 85 ? 'WARN' : 'FAIL');
      return {
        type: 'qbit-font-pack',
        id: String(p.id || opts.id || ('font-pack-' + Date.now())),
        name: String(p.name || opts.name || 'qbit-font-pack'),
        source: opts.source || p.source || 'qbitCodec',
        language: language,
        glyphs: glyphs,
        font: {
          target: (typeof fontRef === 'string') ? { id: fontRef, name: fontRef } : { id: fontRef.id || null, name: fontRef.name || fontRef.id || null },
          manifest: manifest,
          coverage: coverage
        },
        layouts: layoutStats,
        multicast: multicast,
        pipeline: {
          dac: true,
          ironLine: opts.ironLine || 'L4',
          quantumGutter: true,
          prefixes: true,
          steno: !!_getSteno(),
          t5Available: this.t5Available ? !!this.t5Available() : false,
          safetyVerdict: safetyVerdict
        },
        ts: Date.now()
      };
    },
    analyze: function (content) {
      var ST = _getSteno();
      return ST ? ST.stenoAnalyze(content) : null;
    },
    hex: function (original, encoded) {
      var ST = _getSteno();
      return ST ? ST.stenoHex(original, encoded) : null;
    },
    pipeline: function (content, language) {
      var ST = _getSteno();
      return ST ? ST.stenoPipeline(content, language) : null;
    },
    t5Classify: function (content, opts) {
      var t5 = _getT5();
      if (!t5 || !t5.available) return { available: false, fallback: 'JS-regex' };
      opts = opts || {};
      try {
        var args = ['--stdin'];
        if (opts.json) args.push('--json');
        if (opts.binary) args.push('--binary');
        var result = t5.cp.execSync(t5.bin + ' ' + args.join(' '), {
          input: content, encoding: opts.binary ? 'buffer' : 'utf8', timeout: 5000, maxBuffer: 50 * 1024 * 1024
        });
        if (opts.json) {
          try { return { available: true, engine: 'T5-native', speed: '3.2ns/line', data: JSON.parse(result) }; }
          catch (pe) { return { available: true, engine: 'T5-native', raw: result }; }
        }
        if (opts.binary) return { available: true, engine: 'T5-native', speed: '3.2ns/line', binary: result };
        var lines = String(result).trim().split('\n');
        return { available: true, engine: 'T5-native', speed: '3.2ns/line', lines: lines, count: lines.length };
      } catch (e) { return { available: false, error: String(e), fallback: 'JS-regex' }; }
    },
    t5Available: function () {
      var t5 = _getT5();
      return t5 && t5.available;
    },
    runtimePolicy: function (nextPolicy) {
      if (nextPolicy && typeof nextPolicy === 'object') {
        _runtimePolicy = Object.assign({}, _runtimePolicy, nextPolicy);
      }
      return Object.assign({}, _runtimePolicy);
    },
    runtimeConfidence: function (nextConfidence) {
      if (nextConfidence && typeof nextConfidence === 'object') {
        _runtimeConfidence = Object.assign({}, _runtimeConfidence, nextConfidence);
      }
      return _runtimeSnapshot();
    },
    runtimeProfile: function (profileName) {
      if (!profileName) return _runtimeConfidence.profile || 'dev';
      return _setRuntimeProfile(profileName);
    },
    runtimeRecordTest: function (passed, meta) {
      return _recordRuntimeEvidence(!!passed, meta || {});
    },
    runtimeEvaluate: function () {
      return _evaluateRuntimeConfidence();
    },
    normalizeLegacy: function (content, language, source, opts) {
      return _normalizeRuntime(content, language, source, opts);
    },
    guardLegacy: function (content, language, source, opts) {
      var res = _normalizeRuntime(content, language, source, opts);
      if (res.blocked) {
        throw new Error((res.warnings && res.warnings.length ? res.warnings[res.warnings.length - 1].message : 'Legacy output blocked') || 'Legacy output blocked');
      }
      return res;
    },
    scanEncode: function (cloud, modality, opts) {
      opts = opts || {};
      if (!cloud || !cloud.length) return null;
      var header = '# .qbit-scan | modality: ' + (modality || 'auto') + ' | points: ' + cloud.length;
      var bandwidth = {
        photogrammetry: '500MB/s PLY 10M pts/s', sam2: '250MB/s JSON 2M faces/s',
        gsplat: '1.2GB/s splat 50M splats/s', wifi3d: '10MB/s DensePose 30fps',
        lidar: '800MB/s XYZ 1.2M pts/s', irflir: '30MB/s 16bit-PNG 60fps',
        audio: '1.4MB/s WAV 44.1kHz', contrail: '50KB/s BroadcastChannel 60fps',
        qpu: '1KB/s IBM-REST 4096shots/run'
      };
      var bw = bandwidth[modality] || 'unknown';
      header += ' | bandwidth: ' + bw;
      if (opts.ironCondor) header += ' | iron-condor: lo=' + opts.ironCondor.lo + ' hi=' + opts.ironCondor.hi + ' J=' + opts.ironCondor.J + ' a=' + opts.ironCondor.a;
      var lines = [header];
      var limit = Math.min(cloud.length, opts.maxPoints || 5000);
      for (var i = 0; i < limit; i++) {
        var pt = cloud[i];
        lines.push([pt.x.toFixed(6), pt.y.toFixed(6), pt.z.toFixed(6), pt.v.toFixed(2), pt.theta.toFixed(4), pt.phi.toFixed(4), pt.src || modality, pt.idx].join(' '));
      }
      var content = lines.join('\n');
      return this.encode(content, 'transcript', opts.source || 'scan-pipeline', opts);
    },
    scanDecode: function (content) {
      if (!content) return null;
      var decoded = this.decode(content);
      var lines = decoded.code.split('\n');
      var header = lines[0] || '';
      var cloud = [];
      for (var i = 1; i < lines.length; i++) {
        var parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 6) {
          cloud.push({ x: +parts[0], y: +parts[1], z: +parts[2], v: +parts[3], theta: +parts[4], phi: +parts[5], src: parts[6] || 'unknown', idx: +parts[7] || i });
        }
      }
      return { header: header, cloud: cloud, meta: decoded.meta, steno: decoded.steno };
    },
    strokeAnalyze: function (strokes, opts) {
      opts = opts || {};
      var input = Array.isArray(strokes) ? strokes : [];
      var grouped = input.length && Array.isArray(input[0]) ? input : (input.length ? [input] : []);
      var normalized = grouped.map(function (stroke, idx) {
        var pts = Array.isArray(stroke) ? stroke : [];
        return pts.map(function (pt, i) {
          var p = pt || {};
          return {
            x: Number(p.x || 0),
            y: Number(p.y || 0),
            z: Number(p.z || 0),
            t: isFinite(Number(p.t)) ? Number(p.t) : (idx * 1e6 + i * 16),
            pressure: isFinite(Number(p.pressure)) ? Math.max(0, Number(p.pressure)) : 0.5,
            tiltX: isFinite(Number(p.tiltX)) ? Number(p.tiltX) : 0,
            tiltY: isFinite(Number(p.tiltY)) ? Number(p.tiltY) : 0
          };
        });
      }).filter(function (s) { return s.length >= 2; });
      if (!normalized.length) {
        return {
          strokeCount: 0,
          pointCount: 0,
          style: { label: 'unknown', score: 0, scores: { calligraphy: 0, painting: 0, drawing: 0 } },
          metrics: {},
          ts: Date.now()
        };
      }
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      var totalLength = 0;
      var totalDuration = 0;
      var totalPressure = 0;
      var totalPressureSq = 0;
      var pressureN = 0;
      var totalCurvature = 0;
      var totalCurvatureN = 0;
      var tiltEnergy = 0;
      var pointCount = 0;
      for (var s = 0; s < normalized.length; s++) {
        var stroke = normalized[s];
        pointCount += stroke.length;
        var t0 = stroke[0].t;
        var t1 = stroke[stroke.length - 1].t;
        totalDuration += Math.max(1, (t1 - t0));
        for (var i = 0; i < stroke.length; i++) {
          var p = stroke[i];
          if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
          totalPressure += p.pressure;
          totalPressureSq += p.pressure * p.pressure;
          pressureN++;
          tiltEnergy += Math.abs(p.tiltX) + Math.abs(p.tiltY);
          if (i > 0) {
            var prev = stroke[i - 1];
            var dx = p.x - prev.x, dy = p.y - prev.y;
            totalLength += Math.sqrt(dx * dx + dy * dy);
          }
          if (i > 1) {
            var p0 = stroke[i - 2], p1 = stroke[i - 1], p2 = stroke[i];
            var a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
            var a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            var da = Math.abs(a2 - a1);
            if (da > Math.PI) da = 2 * Math.PI - da;
            totalCurvature += da;
            totalCurvatureN++;
          }
        }
      }
      var w = Math.max(1e-6, maxX - minX);
      var h = Math.max(1e-6, maxY - minY);
      var area = w * h;
      var meanPressure = totalPressure / Math.max(1, pressureN);
      var pressureVar = (totalPressureSq / Math.max(1, pressureN)) - meanPressure * meanPressure;
      var avgCurvature = totalCurvature / Math.max(1, totalCurvatureN);
      var avgSpeed = totalLength / Math.max(1, totalDuration);
      var density = pointCount / Math.max(1, area);
      var calligraphyScore = Math.min(1, (Math.abs(pressureVar) * 2.2) + (tiltEnergy / Math.max(1, pointCount * 45)) + (avgCurvature / 1.2));
      var paintingScore = Math.min(1, (meanPressure * 0.8) + ((1 / Math.max(0.2, avgSpeed)) * 0.12) + Math.min(0.25, density * 0.2));
      var drawingScore = Math.min(1, ((1 - Math.min(1, Math.abs(pressureVar) * 3)) * 0.5) + Math.min(0.5, avgSpeed * 0.8));
      var scores = { calligraphy: calligraphyScore, painting: paintingScore, drawing: drawingScore };
      var label = 'drawing';
      if (scores.calligraphy >= scores.painting && scores.calligraphy >= scores.drawing) label = 'calligraphy';
      else if (scores.painting >= scores.calligraphy && scores.painting >= scores.drawing) label = 'painting';
      return {
        strokeCount: normalized.length,
        pointCount: pointCount,
        bbox: { minX: minX, minY: minY, maxX: maxX, maxY: maxY, width: w, height: h, area: area },
        metrics: {
          totalLength: Number(totalLength.toFixed(4)),
          durationMs: Math.round(totalDuration),
          avgSpeedPxPerMs: Number(avgSpeed.toFixed(6)),
          meanPressure: Number(meanPressure.toFixed(4)),
          pressureVariance: Number(pressureVar.toFixed(6)),
          avgCurvatureRad: Number(avgCurvature.toFixed(6)),
          pointDensity: Number(density.toFixed(6)),
          tiltEnergy: Number(tiltEnergy.toFixed(3))
        },
        style: {
          label: label,
          score: Number(scores[label].toFixed(4)),
          scores: {
            calligraphy: Number(scores.calligraphy.toFixed(4)),
            painting: Number(scores.painting.toFixed(4)),
            drawing: Number(scores.drawing.toFixed(4))
          }
        },
        normalized: normalized,
        ts: Date.now()
      };
    },
    strokeToToolpath: function (strokes, opts) {
      opts = opts || {};
      var device = String(opts.device || 'plotter').toLowerCase();
      var analysis = this.strokeAnalyze(strokes, opts);
      var data = analysis.normalized || [];
      var feed = Number(opts.feedRate || (device === 'printer3d' ? 1800 : 2400));
      var safeZ = Number(opts.safeZ != null ? opts.safeZ : 5);
      var drawZ = Number(opts.drawZ != null ? opts.drawZ : 0);
      var layerHeight = Number(opts.layerHeight != null ? opts.layerHeight : 0.2);
      var extrusionScale = Number(opts.extrusionScale != null ? opts.extrusionScale : 0.045);
      var g = [];
      var svgSegs = [];
      var eAcc = 0;
      g.push('; .qbit fabrication toolpath');
      g.push('; device=' + device + ' strokes=' + analysis.strokeCount + ' points=' + analysis.pointCount);
      g.push('G21');
      g.push('G90');
      if (device === 'printer3d') {
        g.push('M82');
        g.push('G92 E0');
      } else {
        g.push('M5');
      }
      for (var s = 0; s < data.length; s++) {
        var stroke = data[s];
        if (!stroke.length) continue;
        var p0 = stroke[0];
        g.push('G0 X' + p0.x.toFixed(3) + ' Y' + p0.y.toFixed(3) + ' Z' + safeZ.toFixed(3) + ' F' + feed);
        if (device === 'printer3d') g.push('G0 Z' + (drawZ + layerHeight).toFixed(3) + ' F' + feed);
        else g.push('M3 S255');
        var svg = ['M' + p0.x.toFixed(2) + ',' + p0.y.toFixed(2)];
        for (var i = 1; i < stroke.length; i++) {
          var p = stroke[i], q = stroke[i - 1];
          var dx = p.x - q.x, dy = p.y - q.y;
          var seg = Math.sqrt(dx * dx + dy * dy);
          var fSeg = Math.max(120, feed * (0.75 + 0.5 * Math.max(0.05, Math.min(1.5, p.pressure))));
          if (device === 'printer3d') {
            eAcc += seg * extrusionScale * Math.max(0.1, p.pressure);
            g.push('G1 X' + p.x.toFixed(3) + ' Y' + p.y.toFixed(3) + ' Z' + (drawZ + layerHeight).toFixed(3) + ' E' + eAcc.toFixed(5) + ' F' + fSeg.toFixed(0));
          } else {
            g.push('G1 X' + p.x.toFixed(3) + ' Y' + p.y.toFixed(3) + ' Z' + drawZ.toFixed(3) + ' F' + fSeg.toFixed(0));
          }
          svg.push('L' + p.x.toFixed(2) + ',' + p.y.toFixed(2));
        }
        if (device === 'printer3d') g.push('G0 Z' + safeZ.toFixed(3) + ' F' + feed);
        else g.push('M5');
        svgSegs.push(svg.join(' '));
      }
      if (device === 'printer3d') g.push('G92 E0');
      return {
        device: device,
        gcode: g.join('\n'),
        lines: g.length,
        svgPath: svgSegs.join(' '),
        analysis: analysis,
        ts: Date.now()
      };
    },
    repipeFabrication: function (payload, opts) {
      opts = opts || {};
      var p = payload || {};
      var strokes = p.strokes || p.normalized || [];
      var devices = Array.isArray(opts.devices) ? opts.devices : [opts.device || 'plotter'];
      var out = { routed: [], packets: {}, ts: Date.now() };
      for (var i = 0; i < devices.length; i++) {
        var d = String(devices[i] || '').toLowerCase();
        if (!d) continue;
        var route = this.strokeToToolpath(strokes, Object.assign({}, opts, { device: d }));
        out.packets[d] = route;
        if (typeof BroadcastChannel !== 'undefined' && opts.broadcast !== false) {
          var channel = d === 'printer3d' ? 'fabrication-3d-printer' : 'fabrication-plotter';
          try {
            var bc = new BroadcastChannel(channel);
            bc.postMessage({
              type: 'qbit-fabrication-toolpath',
              device: d,
              source: opts.source || p.source || 'qbitCodec',
              gcode: route.gcode,
              svgPath: route.svgPath,
              analysis: route.analysis,
              ts: Date.now()
            });
            out.routed.push(channel);
          } catch (_) {}
        }
      }
      if (typeof BroadcastChannel !== 'undefined' && opts.broadcast !== false) {
        try {
          var iron = new BroadcastChannel('iron-line');
          iron.postMessage({
            type: 'fabrication-repipe',
            source: opts.source || p.source || 'qbitCodec',
            devices: devices,
            routed: out.routed,
            ts: Date.now()
          });
        } catch (_) {}
      }
      return out;
    },
    liveFontFaceAnalyze: function (payload, opts) {
      opts = opts || {};
      var p = payload || {};
      var text = String(p.text || p.sample || '');
      var fontRef = p.fontRef || p.target || opts.target || 'qbit_roman_math_core';
      var strokes = p.strokes || [];
      var fontManifest = this.fontSupportManifest(text, {
        language: opts.language || 'auto',
        source: opts.source || p.source || 'live-font-face',
        target: fontRef
      });
      var fontCoverage = this.fontCoverage(text, fontRef, {
        language: opts.language || 'auto',
        source: opts.source || p.source || 'live-font-face',
        maxMissing: opts.maxMissing || 128
      });
      var stroke = this.strokeAnalyze(strokes, opts);
      var contrail = this.contrailBenchmark(text, opts.language || 'auto', opts.source || 'live-font-face', { useT5: !!opts.useT5 });
      var packet = {
        type: 'qbit-live-font-face-analysis',
        source: opts.source || p.source || 'qbitCodec',
        textLength: text.length,
        font: { manifest: fontManifest, coverage: fontCoverage },
        stroke: stroke,
        contrail: {
          dominantCategory: contrail.dominantCategory,
          entropy: contrail.entropy,
          qBPM: contrail.qBPM,
          qHz: contrail.qHz,
          lane: contrail.calibrationLane
        },
        ts: Date.now()
      };
      if (typeof BroadcastChannel !== 'undefined' && opts.broadcast !== false) {
        try {
          var bc = new BroadcastChannel('font-live-analysis');
          bc.postMessage(packet);
        } catch (_) {}
      }
      if (opts.fabricate && strokes && strokes.length) {
        packet.fabrication = this.repipeFabrication(
          { source: packet.source, strokes: stroke.normalized },
          {
            source: packet.source,
            devices: opts.devices || ['plotter', 'printer3d'],
            broadcast: opts.broadcast !== false,
            feedRate: opts.feedRate,
            layerHeight: opts.layerHeight,
            extrusionScale: opts.extrusionScale
          }
        );
      }
      return packet;
    },
    SCAN_BANDWIDTH: {
      photogrammetry: { speed: '500MB/s', code: 'PLY/OBJ', bandwidth: '10M pts/s' },
      sam2: { speed: '250MB/s', code: 'JSON mesh', bandwidth: '2M faces/s' },
      gsplat: { speed: '1.2GB/s', code: 'splat', bandwidth: '50M splats/s' },
      wifi3d: { speed: '10MB/s', code: 'DensePose JSON', bandwidth: '30fps' },
      lidar: { speed: '800MB/s', code: 'XYZ/LAS', bandwidth: '1.2M pts/s' },
      irflir: { speed: '30MB/s', code: '16-bit PNG', bandwidth: '60fps' },
      audio: { speed: '1.4MB/s', code: 'WAV PCM', bandwidth: '44.1kHz' },
      contrail: { speed: '50KB/s', code: 'BroadcastChannel', bandwidth: '60fps' },
      qpu: { speed: '1KB/s', code: 'IBM REST', bandwidth: '4096 shots/run' },
      catmri: { speed: '200MB/s', code: 'DICOM/NIfTI', bandwidth: '512×512×slices' },
      exr: { speed: '2GB/s', code: 'OpenEXR', bandwidth: '4K@32bit/channel' },
      prores: { speed: '1.5GB/s', code: 'ProRes 4444 XQ', bandwidth: '4K@60fps' }
    },
    BODY_SYSTEMS: {
      endocrine:{name:'Endocrine',color:'#f0883e',organs:['pituitary','thyroid','adrenal','pancreas','pineal','hypothalamus','parathyroid','ovaries','testes'],blochAxis:'theta'},
      neural:{name:'Neural',color:'#a78bfa',organs:['brain','spinal_cord','cerebellum','brainstem','cortex','hippocampus','amygdala','thalamus'],blochAxis:'phi'},
      nerve:{name:'Peripheral Nerve',color:'#ffe138',organs:['sciatic','vagus','brachial_plexus','cranial_nerves','autonomic','sympathetic','parasympathetic'],blochAxis:'r'},
      vascular:{name:'Vascular',color:'#f85149',organs:['heart','aorta','carotid','pulmonary','hepatic_portal','renal','coronary','vena_cava'],blochAxis:'theta'},
      respiratory:{name:'Respiratory',color:'#56d4dd',organs:['lungs','bronchi','alveoli','diaphragm','trachea','larynx','pharynx','pleura'],blochAxis:'phi'},
      skeletal:{name:'Skeletal',color:'#c9d1d9',organs:['skull','spine','ribs','pelvis','femur','humerus','scapula','clavicle'],blochAxis:'r'},
      muscular:{name:'Muscular',color:'#3fb950',organs:['cardiac','skeletal_muscle','smooth_muscle','diaphragm_m','intercostals','psoas','deltoid','gluteus'],blochAxis:'theta'},
      lymphatic:{name:'Lymphatic',color:'#bc8cff',organs:['spleen','thymus','lymph_nodes','tonsils','bone_marrow','MALT','Peyer_patches'],blochAxis:'phi'},
      digestive:{name:'Digestive',color:'#d29922',organs:['stomach','liver','intestine','pancreas_d','esophagus','gallbladder','colon','rectum'],blochAxis:'r'},
      integumentary:{name:'Integumentary',color:'#ff7b72',organs:['skin','hair','nails','sweat_glands','sebaceous','melanocytes','dermis','epidermis'],blochAxis:'theta'}
    },
    mediaEncode: function (frames, mediaType, opts) {
      opts = opts || {};
      var header = '# H.qbit Universal Media | type:' + mediaType + ' | frames:' + frames.length +
        ' | ts:' + Date.now() + ' | res:' + (opts.resolution || 'native') +
        ' | depth:' + (opts.bitDepth || 8) + ' | channels:' + (opts.channels || 3) +
        (opts.bodySystem ? ' | body:' + opts.bodySystem : '') + '\n';
      var content = header;
      for (var i = 0; i < frames.length; i++) {
        var f = frames[i];
        if (f.type === 'point') content += f.x + ' ' + f.y + ' ' + f.z + ' ' + (f.v || 0) + ' ' + (f.theta || 0) + ' ' + (f.phi || 0) + ' ' + (f.channel || mediaType) + ' ' + i + '\n';
        else if (f.type === 'pixel') content += f.r + ' ' + f.g + ' ' + f.b + ' ' + (f.a || 255) + ' ' + f.x + ' ' + f.y + ' ' + (f.layer || 0) + ' ' + i + '\n';
        else if (f.type === 'sample') content += f.left + ' ' + (f.right || f.left) + ' ' + (f.freq || 0) + ' ' + (f.time || i / 44100) + ' ' + (f.channel || 0) + '\n';
        else if (f.type === 'voxel') content += f.x + ' ' + f.y + ' ' + f.z + ' ' + f.density + ' ' + (f.system || 'unknown') + ' ' + (f.organ || 'unknown') + ' ' + i + '\n';
        else content += JSON.stringify(f) + '\n';
      }
      return this.encode(content, 'transcript', opts.source || 'h.qbit-media', opts);
    },
    mediaDecode: function (content) {
      if (!content) return null;
      var decoded = this.decode(content);
      var lines = decoded.code.split('\n');
      var header = lines[0] || '';
      var meta = {};
      header.replace(/(\w+):([^\s|]+)/g, function (m, k, v) { meta[k] = v; });
      var frames = [];
      for (var i = 1; i < lines.length; i++) {
        var l = lines[i].trim(); if (!l) continue;
        if (l.charAt(0) === '{') { try { frames.push(JSON.parse(l)); } catch (e) {} }
        else { var p = l.split(/\s+/); frames.push({ raw: p, idx: i }); }
      }
      return { header: header, meta: meta, frames: frames, decoded: decoded };
    },
    bodyMap: function (voxels, system) {
      var sys = this.BODY_SYSTEMS[system];
      if (!sys) return { error: 'unknown system: ' + system };
      var mapped = [];
      for (var i = 0; i < voxels.length; i++) {
        var v = voxels[i];
        var r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 0.001;
        var theta = Math.acos(v.z / r);
        var phi = Math.atan2(v.y, v.x);
        var blochPt = { x: Math.sin(theta) * Math.cos(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(theta) };
        var organIdx = Math.floor(((theta / Math.PI) * sys.organs.length)) % sys.organs.length;
        mapped.push({ bloch: blochPt, organ: sys.organs[organIdx], density: v.density || v.v || 0, system: system, color: sys.color, original: v });
      }
      return { system: sys.name, color: sys.color, axis: sys.blochAxis, organs: sys.organs, mapped: mapped, total: mapped.length };
    },
    CONTRAIL_SYMS: '→←↔⇒⊞⊟∀∃⊤⊥⊢∘⊕⊗□◇○●▶■∩∪⊂⊃∈≡τσπ⊙',
    CONTRAIL_CONCEPTS: ['pipe','source','bidir','implies','module','collapse','forall','exists','true','false','entails','compose','merge','tensor','box','maybe','async','active','run','stop','intersect','union','sub','super','member','identical','type','sum','product','hadamard'],
    CONTRAIL_GATE: {'→':'SWAP','←':'M','↔':'CZ','⇒':'Rz(π/4)','⊞':'H','⊟':'X','∀':'T','∃':'S','⊤':'I','⊥':'X',
      '⊢':'CNOT','∘':'Rz(π/2)','⊕':'CZ','⊗':'SWAP','□':'Rz(0)','◇':'Ry(π/4)','○':'H','●':'CNOT','▶':'H','■':'M',
      '∩':'CZ','∪':'SWAP','⊂':'Ry(π/8)','⊃':'Ry(-π/8)','∈':'T','≡':'I','τ':'Rz(θ)','σ':'X','π':'Ry(π)','⊙':'H'},
    GATE_NOTE: {H:'C4',CNOT:'E4',X:'G4','Rz':'D4','Ry':'A3',I:'rest',S:'A4',T:'B4',M:'G3',SWAP:'D5',CZ:'E3'},
    NOTE_FREQ: {C3:130.81,D3:146.83,E3:164.81,F3:174.61,G3:196.00,A3:220.00,B3:246.94,
      C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392.00,A4:440.00,B4:493.88,
      C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880.00,B5:987.77,rest:0},
    NOTE_SOLFEGE: {C3:'Do₃',D3:'Re₃',E3:'Mi₃',F3:'Fa₃',G3:'Sol₃',A3:'La₃',B3:'Si₃',
      C4:'Do₄',D4:'Re₄',E4:'Mi₄',F4:'Fa₄',G4:'Sol₄',A4:'La₄',B4:'Si₄',
      C5:'Do₅',D5:'Re₅',E5:'Mi₅',F5:'Fa₅',G5:'Sol₅',A5:'La₅',B5:'Si₅',rest:'𝄾'},

    contrailPipeline: function (seq, opts) {
      opts = opts || {};
      var syms = seq.split('');
      var CG = this.CONTRAIL_GATE;
      var GN = this.GATE_NOTE;
      var NF = this.NOTE_FREQ;
      var CS = this.CONTRAIL_SYMS;
      var CC = this.CONTRAIL_CONCEPTS;
      var gates = [], notes = [], freqs = [], concepts = [];
      var qasm = 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[' + Math.min(syms.length, 11) + '];\ncreg c[' + Math.min(syms.length, 11) + '];\n';
      for (var i = 0; i < syms.length; i++) {
        var s = syms[i];
        var gate = CG[s] || 'I';
        var baseGate = gate.replace(/\(.*\)/, '');
        var qi = i % 11;
        if (baseGate === 'H') qasm += 'h q[' + qi + '];\n';
        else if (baseGate === 'X') qasm += 'x q[' + qi + '];\n';
        else if (baseGate === 'CNOT') qasm += 'cx q[' + qi + '],q[' + ((qi + 1) % 11) + '];\n';
        else if (baseGate === 'SWAP') qasm += 'swap q[' + qi + '],q[' + ((qi + 1) % 11) + '];\n';
        else if (baseGate === 'CZ') qasm += 'cz q[' + qi + '],q[' + ((qi + 1) % 11) + '];\n';
        else if (baseGate === 'S') qasm += 's q[' + qi + '];\n';
        else if (baseGate === 'T') qasm += 't q[' + qi + '];\n';
        else if (baseGate === 'M') qasm += 'measure q[' + qi + '] -> c[' + qi + '];\n';
        else if (gate.indexOf('Rz') === 0) qasm += 'rz(' + (gate.match(/\((.+)\)/) || ['', 'pi/4'])[1] + ') q[' + qi + '];\n';
        else if (gate.indexOf('Ry') === 0) qasm += 'ry(' + (gate.match(/\((.+)\)/) || ['', 'pi/4'])[1] + ') q[' + qi + '];\n';
        else qasm += 'id q[' + qi + '];\n';
        var note = GN[baseGate] || 'C4';
        var freq = NF[note] || 261.63;
        gates.push(gate); notes.push(note); freqs.push(freq);
        var cIdx = CS.indexOf(s); concepts.push(cIdx >= 0 ? CC[cIdx] : s);
      }
      var staffContent = syms.map(function (s, i) { return s + ' ' + gates[i] + ' ' + notes[i] + ' ' + freqs[i].toFixed(1) + 'Hz'; }).join('\n');
      var encoded = this.encode(staffContent, 'qasm', 'contrail-pipeline');
      var LANGS = {
        english: function (c) { return c.join(' → '); },
        español: function (c) { return c.map(function (w) { return ({pipe:'tubería',source:'fuente',bidir:'bidireccional',implies:'implica',module:'módulo',collapse:'colapsar',forall:'para todo',exists:'existe',true:'verdadero',false:'falso',entails:'implica',compose:'componer',merge:'fusionar',tensor:'tensor',box:'constante',maybe:'quizás',async:'asíncrono',active:'activo',run:'ejecutar',stop:'detener',intersect:'intersección',union:'unión',sub:'subtipo',super:'supertipo',member:'miembro',identical:'idéntico',type:'tipo',sum:'suma',product:'producto',hadamard:'hadamard'})[w] || w; }).join(' → '); },
        français: function (c) { return c.map(function (w) { return ({pipe:'tuyau',source:'source',bidir:'bidirectionnel',implies:'implique',module:'module',collapse:'réduire',forall:'pour tout',exists:'il existe',true:'vrai',false:'faux',entails:'entraîne',compose:'composer',merge:'fusionner',tensor:'tenseur',box:'constante',maybe:'peut-être',async:'asynchrone',active:'actif',run:'exécuter',stop:'arrêter',intersect:'intersection',union:'union',sub:'sous-type',super:'super-type',member:'membre',identical:'identique',type:'type',sum:'somme',product:'produit',hadamard:'hadamard'})[w] || w; }).join(' → '); },
        日本語: function (c) { return c.map(function (w) { return ({pipe:'パイプ',source:'ソース',bidir:'双方向',implies:'意味する',module:'モジュール',collapse:'折畳み',forall:'すべて',exists:'存在',true:'真',false:'偽',entails:'含意',compose:'合成',merge:'統合',tensor:'テンソル',box:'定数',maybe:'多分',async:'非同期',active:'有効',run:'実行',stop:'停止',intersect:'交差',union:'合併',sub:'サブ',super:'スーパー',member:'要素',identical:'同一',type:'型',sum:'和型',product:'積型',hadamard:'アダマール'})[w] || w; }).join('→'); },
        العربية: function (c) { return c.map(function (w) { return ({pipe:'أنبوب',source:'مصدر',bidir:'ثنائي',implies:'يعني',module:'وحدة',collapse:'طي',forall:'لكل',exists:'يوجد',true:'صح',false:'خطأ',entails:'يستلزم',compose:'تركيب',merge:'دمج',tensor:'موتر',box:'ثابت',maybe:'ربما',async:'غير متزامن',active:'نشط',run:'تشغيل',stop:'إيقاف',intersect:'تقاطع',union:'اتحاد',sub:'نوع فرعي',super:'نوع أصلي',member:'عنصر',identical:'مطابق',type:'نوع',sum:'مجموع',product:'حاصل ضرب',hadamard:'هادامار'})[w] || w; }).join(' ← '); },
        한국어: function (c) { return c.map(function (w) { return ({pipe:'파이프',source:'소스',bidir:'양방향',implies:'함축',module:'모듈',collapse:'접기',forall:'모든',exists:'존재',true:'참',false:'거짓',entails:'수반',compose:'합성',merge:'병합',tensor:'텐서',box:'상수',maybe:'아마',async:'비동기',active:'활성',run:'실행',stop:'정지',intersect:'교집합',union:'합집합',sub:'하위',super:'상위',member:'원소',identical:'동일',type:'타입',sum:'합타입',product:'곱타입',hadamard:'아다마르'})[w] || w; }).join('→'); },
        русский: function (c) { return c.map(function (w) { return ({pipe:'поток',source:'источник',bidir:'двусторонний',implies:'подразумевает',module:'модуль',collapse:'свернуть',forall:'для всех',exists:'существует',true:'истина',false:'ложь',entails:'влечёт',compose:'композиция',merge:'слияние',tensor:'тензор',box:'константа',maybe:'может быть',async:'асинхронный',active:'активный',run:'запуск',stop:'стоп',intersect:'пересечение',union:'объединение',sub:'подтип',super:'супертип',member:'элемент',identical:'тождественный',type:'тип',sum:'сумма',product:'произведение',hadamard:'адамар'})[w] || w; }).join(' → '); },
        हिन्दी: function (c) { return c.map(function (w) { return ({pipe:'पाइप',source:'स्रोत',bidir:'द्विदिशा',implies:'तात्पर्य',module:'मॉड्यूल',collapse:'समेटना',forall:'सभी के लिए',exists:'अस्तित्व',true:'सत्य',false:'असत्य',entails:'अनुमान',compose:'रचना',merge:'विलय',tensor:'टेंसर',box:'स्थिरांक',maybe:'शायद',async:'अतुल्यकालिक',active:'सक्रिय',run:'चलाना',stop:'रोकना',intersect:'प्रतिच्छेद',union:'संघ',sub:'उपप्रकार',super:'अधिप्रकार',member:'सदस्य',identical:'समरूप',type:'प्रकार',sum:'योग',product:'गुणन',hadamard:'हदामार्ड'})[w] || w; }).join('→'); },
        中文: function (c) { return c.map(function (w) { return ({pipe:'管道',source:'源',bidir:'双向',implies:'蕴含',module:'模块',collapse:'折叠',forall:'全称',exists:'存在',true:'真',false:'假',entails:'推出',compose:'组合',merge:'合并',tensor:'张量',box:'常量',maybe:'可能',async:'异步',active:'激活',run:'运行',stop:'停止',intersect:'交集',union:'并集',sub:'子类型',super:'超类型',member:'成员',identical:'恒等',type:'类型',sum:'和类型',product:'积类型',hadamard:'阿达马'})[w] || w; }).join('→'); },
        Deutsch: function (c) { return c.map(function (w) { return ({pipe:'Rohr',source:'Quelle',bidir:'bidirektional',implies:'impliziert',module:'Modul',collapse:'Reduktion',forall:'für alle',exists:'es gibt',true:'wahr',false:'falsch',entails:'beinhaltet',compose:'komponieren',merge:'verschmelzen',tensor:'Tensor',box:'Konstante',maybe:'vielleicht',async:'asynchron',active:'aktiv',run:'ausführen',stop:'stoppen',intersect:'Schnittmenge',union:'Vereinigung',sub:'Untertyp',super:'Obertyp',member:'Element',identical:'identisch',type:'Typ',sum:'Summe',product:'Produkt',hadamard:'Hadamard'})[w] || w; }).join(' → '); },
        português: function (c) { return c.map(function (w) { return ({pipe:'tubo',source:'fonte',bidir:'bidirecional',implies:'implica',module:'módulo',collapse:'colapsar',forall:'para todo',exists:'existe',true:'verdadeiro',false:'falso',entails:'acarreta',compose:'compor',merge:'fundir',tensor:'tensor',box:'constante',maybe:'talvez',async:'assíncrono',active:'ativo',run:'executar',stop:'parar',intersect:'interseção',union:'união',sub:'subtipo',super:'supertipo',member:'membro',identical:'idêntico',type:'tipo',sum:'soma',product:'produto',hadamard:'hadamard'})[w] || w; }).join(' → '); }
      };
      var text = {};
      for (var lang in LANGS) { text[lang] = LANGS[lang](concepts); }
      return {
        contrail: seq,
        symbols: syms,
        concepts: concepts,
        gates: gates,
        qasm: qasm,
        notes: notes,
        freqs: freqs,
        staff: syms.map(function (s, i) { return { sym: s, gate: gates[i], note: notes[i], freq: freqs[i], solfege: (this.NOTE_SOLFEGE || {})[notes[i]] || notes[i] }; }.bind(this)),
        encoded: encoded,
        text: text,
        ts: Date.now()
      };
    },
    contrailToStaff: function (seq) {
      var pipe = this.contrailPipeline(seq);
      var lines = ['𝄞'];
      var STAFF_GLYPHS = ['♩','♪','♫','𝅗𝅥','𝅘𝅥','𝅘𝅥𝅮','𝅘𝅥𝅯'];
      for (var i = 0; i < pipe.notes.length; i++) {
        var n = pipe.notes[i];
        var sol = (this.NOTE_SOLFEGE || {})[n] || n;
        lines.push(STAFF_GLYPHS[i % STAFF_GLYPHS.length] + ' ' + sol + ' ' + pipe.freqs[i].toFixed(0) + 'Hz');
      }
      lines.push('𝄂');
      return lines.join('\n');
    },
    contrailToText: function (seq, lang) {
      var pipe = this.contrailPipeline(seq);
      return pipe.text[lang] || pipe.text.english || pipe.concepts.join(' → ');
    },
    PREFIX_TO_CONTRAIL: {
      'n:':'▶','n':'▶','+1:':'⊤','+1':'⊤','-n:':'←','-n':'←','+0:':'⊞','+0':'⊞',
      '0:':'○','0':'○','-1:':'⊥','-1':'⊥','+n:':'◇','+n':'◇','+2:':'∀','+2':'∀',
      '-0:':'→','-0':'→','+3:':'⊙','+3':'⊙','1:':'□','1':'□',' ':'∘','':'∘'
    },
    CONTRAIL_CATEGORY: {
      '▶':'entry','⊤':'docs','←':'import','⊞':'structure','○':'function',
      '⊥':'error','◇':'branch','∀':'loop','→':'return','⊙':'output','□':'assign','∘':'blank'
    },
    contrailBenchmark: function (content, language, source, opts) {
      opts = opts || {};
      var t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      var lines = String(content).split('\n');
      var PTC = this.PREFIX_TO_CONTRAIL;
      var seq = [];
      var symCounts = {};
      var contrailCounts = {};
      var gateCounts = {};
      var noteCounts = {};
      var CG = this.CONTRAIL_GATE;
      var GN = this.GATE_NOTE;
      var NF = this.NOTE_FREQ;
      var CC = this.CONTRAIL_CATEGORY;
      var t5Info = { requested: !!opts.useT5, available: false, used: false, fallback: 'JS-regex' };
      var t5Syms = null;
      if (opts.useT5) {
        var t5 = this.t5Classify(String(content || ''), { json: true });
        t5Info.available = !!(t5 && t5.available);
        if (t5Info.available && t5.data && Array.isArray(t5.data.gutter) && t5.data.gutter.length) {
          t5Syms = t5.data.gutter.map(function (g) { return _normalizeSym(g && g.symbol); });
          t5Info.used = true;
          t5Info.fallback = null;
        }
      }
      for (var i = 0; i < lines.length; i++) {
        var sym = (t5Syms && i < t5Syms.length) ? t5Syms[i] : classifyLine(lines[i], language || 'auto');
        symCounts[sym] = (symCounts[sym] || 0) + 1;
        var cs = PTC[sym] || '∘';
        seq.push(cs);
        contrailCounts[cs] = (contrailCounts[cs] || 0) + 1;
        var gate = CG[cs] || 'I';
        var baseGate = gate.replace(/\(.*\)/, '');
        gateCounts[baseGate] = (gateCounts[baseGate] || 0) + 1;
        var note = GN[baseGate] || 'C4';
        noteCounts[note] = (noteCounts[note] || 0) + 1;
      }
      var contrailSeq = seq.join('');
      var chunked = [];
      var chunkSize = 64;
      for (var c = 0; c < seq.length; c += chunkSize) {
        chunked.push(seq.slice(c, c + chunkSize).join(''));
      }
      var encoded = this.encode(content, language || 'auto', source || 'contrail-benchmark');
      var freqProfile = {};
      for (var n in noteCounts) {
        freqProfile[n] = { count: noteCounts[n], freq: NF[n] || 0, pct: (noteCounts[n] / lines.length * 100).toFixed(1) };
      }
      var sorted = Object.entries(contrailCounts).sort(function (a, b) { return b[1] - a[1]; });
      var dominant = sorted[0] ? sorted[0][0] : '∘';
      var dominantCat = CC[dominant] || 'unknown';
      var entropy = 0;
      sorted.forEach(function (e) {
        var p = e[1] / lines.length;
        if (p > 0) entropy -= p * Math.log2(p);
      });
      var t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      return {
        source: source || 'benchmark',
        language: language || 'auto',
        totalLines: lines.length,
        contrail: contrailSeq,
        chunked: chunked,
        prefixCounts: symCounts,
        contrailCounts: contrailCounts,
        gateCounts: gateCounts,
        noteCounts: noteCounts,
        freqProfile: freqProfile,
        dominant: { sym: dominant, category: dominantCat, count: sorted[0] ? sorted[0][1] : 0, pct: sorted[0] ? (sorted[0][1] / lines.length * 100).toFixed(1) : '0' },
        entropy: entropy.toFixed(3),
        maxEntropy: Math.log2(Object.keys(contrailCounts).length).toFixed(3),
        encodedSize: encoded.prefixed ? encoded.prefixed.length : 0,
        coverage: encoded.meta ? encoded.meta.coverage : 0,
        elapsedMs: (t1 - t0).toFixed(2),
        linesPerMs: (lines.length / Math.max(t1 - t0, 0.01)).toFixed(0),
        t5: t5Info,
        ts: Date.now()
      };
    },
    musicaEngine: function (content, language, source, opts) {
      return qbitMusicaEngine.fromCode(content, language, source, opts);
    },
    musicaDawPayload: function (content, language, source, opts) {
      var m = qbitMusicaEngine.fromCode(content, language, source, opts);
      return qbitMusicaEngine.toDawPayload(m, { source: source || 'qbitCodec' });
    },
    calibrationLegend: function (content, language, source, opts) {
      var m = qbitMusicaEngine.fromCode(content, language, source, opts);
      return qbitMusicaEngine.explainCalibration(m);
    },
    ironCompass: function (content, language, source, opts) {
      var m = qbitMusicaEngine.fromCode(content, language, source, opts);
      return qbitMusicaEngine.ironCompass(m);
    },
    navigationMap: function (content, language, source, opts) {
      var m = qbitMusicaEngine.fromCode(content, language, source, opts);
      var ic = qbitMusicaEngine.ironCompass(m);
      return {
        calibrationLegend: qbitMusicaEngine.explainCalibration(m),
        ironCompass: ic,
        bloch: ic.bloch || qbitMusicaEngine.blochNavigation(m),
        gisSphere: ic.gisSphere || null,
        waveform: ic.waveform || null,
        atmosField: ic.atmosField || null
      };
    },
    sphereVegasPacket: function (content, language, source, opts) {
      var m = qbitMusicaEngine.fromCode(content, language, source, opts);
      return qbitMusicaEngine.sphereVegasPacket(m, { source: source || 'qbitCodec' });
    },
    publishSphereVegas: function (content, language, source, opts) {
      var m = qbitMusicaEngine.fromCode(content, language, source, opts);
      return qbitMusicaEngine.publishSphereVegas(m, { source: source || 'qbitCodec' });
    },
    VOWEL_FORMANTS: {
      a: [730, 1090, 2440], e: [530, 1840, 2480], i: [270, 2290, 3010],
      o: [570, 840, 2410], u: [300, 870, 2240]
    },
    GATE_VOWEL: { H:'a', CNOT:'e', X:'i', Rz:'o', Ry:'u', I:'a', S:'e', T:'i', M:'o', SWAP:'a', CZ:'u' },
    GATE_CONSONANT: { H:'h', CNOT:'n', X:'k', Rz:'r', Ry:'l', I:'', S:'s', T:'t', M:'m', SWAP:'w', CZ:'z' },
    PERSONA_TRAITS: {
      assign:    { pitch: 0.9, rate: 1.0, warmth: 'steady',    role: 'builder' },
      branch:    { pitch: 1.1, rate: 1.2, warmth: 'curious',   role: 'questioner' },
      loop:      { pitch: 0.8, rate: 0.9, warmth: 'patient',   role: 'iterator' },
      func:      { pitch: 1.0, rate: 1.0, warmth: 'creative',  role: 'maker' },
      docs:      { pitch: 1.2, rate: 0.8, warmth: 'wise',      role: 'teacher' },
      error:     { pitch: 0.7, rate: 1.3, warmth: 'cautious',  role: 'guardian' },
      entry:     { pitch: 1.3, rate: 1.1, warmth: 'bold',      role: 'initiator' },
      'return':  { pitch: 1.0, rate: 0.9, warmth: 'resolute',  role: 'resolver' },
      import:    { pitch: 0.9, rate: 1.1, warmth: 'connected', role: 'gatherer' },
      structure: { pitch: 1.1, rate: 0.8, warmth: 'grounded',  role: 'architect' },
      output:    { pitch: 1.2, rate: 1.0, warmth: 'expressive', role: 'speaker' },
      blank:     { pitch: 1.0, rate: 1.0, warmth: 'quiet',     role: 'listener' }
    },

    voiceSynth: function (contrailSeq, opts) {
      opts = opts || {};
      var CG = this.CONTRAIL_GATE;
      var GN = this.GATE_NOTE;
      var NF = this.NOTE_FREQ;
      var GV = this.GATE_VOWEL;
      var GC = this.GATE_CONSONANT;
      var VF = this.VOWEL_FORMANTS;
      var CC = this.CONTRAIL_CATEGORY;
      var syms = contrailSeq.split('');
      var phonemes = [];
      var formantTrack = [];
      var syllables = [];
      var currSyllable = '';
      for (var i = 0; i < syms.length; i++) {
        var s = syms[i];
        var gate = (CG[s] || 'Rz').replace(/\(.*\)/, '');
        var vowel = GV[gate] || 'a';
        var consonant = GC[gate] || '';
        var note = GN[gate] || 'C4';
        var freq = NF[note] || 261.63;
        var formants = VF[vowel] || VF.a;
        var syllable = consonant + vowel;
        phonemes.push({ sym: s, gate: gate, consonant: consonant, vowel: vowel, syllable: syllable, freq: freq, formants: formants, note: note });
        formantTrack.push(formants);
        currSyllable += syllable;
        if ((i + 1) % 3 === 0 || i === syms.length - 1) {
          syllables.push(currSyllable);
          currSyllable = '';
        }
      }
      var word = syllables.join('-');
      var avgFreq = phonemes.reduce(function (s, p) { return s + p.freq; }, 0) / (phonemes.length || 1);
      var avgF1 = formantTrack.reduce(function (s, f) { return s + f[0]; }, 0) / (formantTrack.length || 1);
      var avgF2 = formantTrack.reduce(function (s, f) { return s + f[1]; }, 0) / (formantTrack.length || 1);
      var timbre = avgF2 > 1500 ? 'bright' : avgF2 > 1000 ? 'warm' : 'dark';
      var register = avgFreq > 400 ? 'soprano' : avgFreq > 300 ? 'alto' : avgFreq > 200 ? 'tenor' : 'bass';
      return {
        contrail: contrailSeq,
        phonemes: phonemes,
        syllables: syllables,
        word: word,
        formantTrack: formantTrack,
        avgFreq: avgFreq,
        avgFormants: [avgF1, avgF2],
        timbre: timbre,
        register: register,
        duration: phonemes.length * (opts.tempo || 0.15),
        ts: Date.now()
      };
    },

    personaFromCode: function (content, language, source) {
      var bm = this.contrailBenchmark(content, language, source);
      var PT = this.PERSONA_TRAITS;
      var CC_CAT = this.CONTRAIL_CATEGORY;
      var sorted = Object.entries(bm.contrailCounts).sort(function (a, b) { return b[1] - a[1]; });
      var traits = [];
      var roles = [];
      for (var i = 0; i < Math.min(sorted.length, 5); i++) {
        var cat = CC_CAT[sorted[i][0]] || 'blank';
        var trait = PT[cat] || PT.blank;
        traits.push({ category: cat, sym: sorted[i][0], count: sorted[i][1], pct: (sorted[i][1] / bm.totalLines * 100).toFixed(1), trait: trait });
        if (roles.indexOf(trait.role) < 0) roles.push(trait.role);
      }
      var avgPitch = traits.reduce(function (s, t) { return s + t.trait.pitch; }, 0) / (traits.length || 1);
      var avgRate = traits.reduce(function (s, t) { return s + t.trait.rate; }, 0) / (traits.length || 1);
      var dominant = traits[0] || { trait: PT.blank, category: 'blank' };
      var dominantSeq = sorted.slice(0, 8).map(function (e) { return e[0]; }).join('');
      var voice = this.voiceSynth(dominantSeq);
      return {
        source: source || 'unknown',
        totalLines: bm.totalLines,
        entropy: bm.entropy,
        traits: traits,
        roles: roles,
        voice: {
          pitch: avgPitch,
          rate: avgRate,
          timbre: voice.timbre,
          register: voice.register,
          word: voice.word,
          syllables: voice.syllables,
          warmth: dominant.trait.warmth
        },
        persona: {
          name: dominant.trait.role + '-' + voice.register,
          role: dominant.trait.role,
          warmth: dominant.trait.warmth,
          description: 'A ' + voice.timbre + ' ' + voice.register + ' voice, ' + dominant.trait.warmth + ' in character, shaped by ' + bm.totalLines + ' lines of ' + dominant.category + '-dominant code'
        },
        contrail: dominantSeq,
        benchmark: bm,
        ts: Date.now()
      };
    },

    stats: dacStats,
    GATE_MAP: GATE_MAP,
    SYM_COLOR: SYM_COLOR,
    SYM_ANSI: SYM_ANSI
  };

  // === DAC MODE SYSTEM ===
  // T5-native=3.2ns/classify | raw=0μs | prefix=0.25μs/line | tracks=1.5μs/line | stripe=3-5μs/line
  var DAC_MODE = 'tracks';
  function dacMode(mode) {
    if (mode) DAC_MODE = mode;
    return DAC_MODE;
  }

  // === WORD STRIPE ENGINE (nightwatch data striping) ===
  var TOKEN_KW_CONTROL = /^(if|else|elif|elsif|while|for|foreach|switch|case|match|when|unless|try|catch|except|finally|break|continue|do|in|of|where)$/;
  var TOKEN_KW_DECL = /^(class|struct|enum|interface|trait|fn|def|func|function|const|let|var|pub|private|protected|static|async|await|import|from|use|require|include|module|package|namespace|type|abstract|override|extern|virtual|inline|volatile|register|typedef|template|extends|implements|new|delete|sizeof|typeof|instanceof|yield|return|throw|raise|export|default|as)$/;
  var TOKEN_LITERAL = /^(true|false|null|undefined|None|nil|NaN|Infinity|self|this|super|void|True|False)$/;
  var TOKEN_NUMBER = /^-?[\d][\d._]*[fFuUlLdDeE]?$/;
  var TOKEN_OP = /^[+\-*\/%=<>!&|^~?@#]+$/;
  var TOKEN_DELIM = /^[(){}\[\]:;,.]$/;

  var STRIPE_COLOR = {
    control:  { fg: '#34d399', bg: '#34d39915', ansi: '82',  ansi_bg: '22'  },
    decl:     { fg: '#a78bfa', bg: '#a78bfa15', ansi: '141', ansi_bg: '54'  },
    literal:  { fg: '#f0883e', bg: '#f0883e15', ansi: '208', ansi_bg: '94'  },
    number:   { fg: '#f0883e', bg: '#f0883e10', ansi: '208', ansi_bg: '94'  },
    string:   { fg: '#a5d6ff', bg: '#a5d6ff10', ansi: '117', ansi_bg: '24'  },
    operator: { fg: '#ff7b72', bg: '#ff7b7210', ansi: '203', ansi_bg: '52'  },
    delim:    { fg: '#8b949e', bg: '#8b949e08', ansi: '245', ansi_bg: '236' },
    ident:    { fg: '#e6edf3', bg: 'transparent', ansi: '255', ansi_bg: '0' },
    ws:       { fg: '#21262d', bg: '#21262d',    ansi: '236', ansi_bg: '236' }
  };

  function tokenize(line) {
    var tokens = [];
    var i = 0, len = line.length;
    while (i < len) {
      var ch = line[i];
      if (ch === ' ' || ch === '\t') {
        var start = i;
        while (i < len && (line[i] === ' ' || line[i] === '\t')) i++;
        tokens.push({ type: 'ws', text: line.substring(start, i) });
      } else if (ch === '"' || ch === "'" || ch === '`') {
        var q = ch, start = i; i++;
        while (i < len && line[i] !== q) { if (line[i] === '\\') i++; i++; }
        if (i < len) i++;
        tokens.push({ type: 'string', text: line.substring(start, i) });
      } else if (ch === '/' && i + 1 < len && line[i + 1] === '/') {
        tokens.push({ type: 'comment', text: line.substring(i) }); i = len;
      } else if (ch === '#' && (i === 0 || line[i - 1] === ' ')) {
        tokens.push({ type: 'comment', text: line.substring(i) }); i = len;
      } else if (TOKEN_OP.test(ch)) {
        var start = i;
        while (i < len && TOKEN_OP.test(line[i])) i++;
        tokens.push({ type: 'operator', text: line.substring(start, i) });
      } else if (TOKEN_DELIM.test(ch)) {
        tokens.push({ type: 'delim', text: ch }); i++;
      } else if (/[\d]/.test(ch) || (ch === '-' && i + 1 < len && /\d/.test(line[i + 1]))) {
        var start = i;
        while (i < len && /[\w.]/.test(line[i])) i++;
        var word = line.substring(start, i);
        tokens.push({ type: TOKEN_NUMBER.test(word) ? 'number' : 'ident', text: word });
      } else if (/[\w$_]/.test(ch)) {
        var start = i;
        while (i < len && /[\w$_]/.test(line[i])) i++;
        var word = line.substring(start, i);
        var type = 'ident';
        if (TOKEN_KW_CONTROL.test(word)) type = 'control';
        else if (TOKEN_KW_DECL.test(word)) type = 'decl';
        else if (TOKEN_LITERAL.test(word)) type = 'literal';
        tokens.push({ type: type, text: word });
      } else {
        tokens.push({ type: 'ident', text: ch }); i++;
      }
    }
    return tokens;
  }

  function dacStripe(content, language) {
    if (!content) return { raw: content, tokens: [], meta: null };
    var lines = String(content).split('\n');
    var allTokens = [];
    var typeCounts = {};
    var totalTokens = 0;
    for (var i = 0; i < lines.length; i++) {
      var toks = tokenize(lines[i]);
      allTokens.push(toks);
      for (var j = 0; j < toks.length; j++) {
        var tp = toks[j].type;
        if (tp !== 'ws') { typeCounts[tp] = (typeCounts[tp] || 0) + 1; totalTokens++; }
      }
    }
    return {
      raw: content, lines: lines, tokens: allTokens,
      meta: { totalLines: lines.length, totalTokens: totalTokens, typeCounts: typeCounts }
    };
  }

  function dacStripeHtml(content, language, opts) {
    var o = opts || {};
    var stripe = dacStripe(content, language);
    var tracks = (o.tracks !== false && DAC_MODE !== 'prefix') ? dacTracks(content, language) : null;
    var maxDepth = 0;
    if (tracks) for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].depth > maxDepth) maxDepth = tracks[i].depth;
    }
    var pad = Math.max((maxDepth || 0) + 1, 2);
    var result = [];
    for (var i = 0; i < stripe.lines.length; i++) {
      var toks = stripe.tokens[i];
      var sym = classifyLine(stripe.lines[i], language);
      var symCol = SYM_COLOR[sym] || '#30363d';
      var num = '<span style="color:#484f58">' + String(i + 1).padStart(4) + '</span>';
      var trackStr = '';
      if (tracks) {
        var t = tracks[i];
        var chars = Array.from(t.track);
        for (var c = 0; c < chars.length; c++) {
          var stackSym = (t.stack && t.stack[c]) ? t.stack[c] : sym;
          var col = SYM_COLOR[stackSym] || '#30363d';
          trackStr += '<span style="color:' + col + '">' + chars[c] + '</span>';
        }
        trackStr += ' '.repeat(Math.max(0, pad - chars.length));
      }
      var tokenStr = '';
      for (var j = 0; j < toks.length; j++) {
        var tok = toks[j];
        var sc = STRIPE_COLOR[tok.type] || STRIPE_COLOR.ident;
        if (tok.type === 'ws') {
          var prevType = (j > 0) ? toks[j - 1].type : 'ident';
          var nextType = (j + 1 < toks.length) ? toks[j + 1].type : 'ident';
          var bridgeType = (prevType !== 'ws' && prevType !== 'ident') ? prevType
                         : (nextType !== 'ws' && nextType !== 'ident') ? nextType : null;
          if (bridgeType && o.bridge !== false) {
            var bc = STRIPE_COLOR[bridgeType] || STRIPE_COLOR.ws;
            tokenStr += '<span style="border-bottom:1px solid ' + bc.fg + '30">' + escHTML(tok.text) + '</span>';
          } else {
            tokenStr += escHTML(tok.text);
          }
        } else if (tok.type === 'comment') {
          tokenStr += '<span style="color:#6e7681;font-style:italic">' + escHTML(tok.text) + '</span>';
        } else {
          tokenStr += '<span style="color:' + sc.fg + '">' + escHTML(tok.text) + '</span>';
        }
      }
      result.push(num + ' ' + trackStr + ' <span style="color:' + symCol + '">'
        + sym.padEnd(3) + '</span> ' + tokenStr);
    }
    return '<pre style="font-family:monospace;line-height:1.5;background:#0d1117;color:#e6edf3;padding:12px;border-radius:8px;overflow-x:auto">'
      + result.join('\n') + '</pre>';
  }

  function dacStripeAnsi(content, language) {
    var stripe = dacStripe(content, language);
    var tracks = (DAC_MODE === 'stripe' || DAC_MODE === 'tracks') ? dacTracks(content, language) : null;
    var maxDepth = 0;
    if (tracks) for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].depth > maxDepth) maxDepth = tracks[i].depth;
    }
    var pad = Math.max((maxDepth || 0) + 1, 2);
    var result = [];
    for (var i = 0; i < stripe.lines.length; i++) {
      var toks = stripe.tokens[i];
      var sym = classifyLine(stripe.lines[i], language);
      var symCol = SYM_ANSI[sym] || '240';
      var num = '\x1b[38;5;240m' + String(i + 1).padStart(4) + '\x1b[0m';
      var trackStr = '';
      if (tracks) {
        var t = tracks[i];
        var chars = Array.from(t.track);
        for (var c = 0; c < chars.length; c++) {
          var stackSym = (t.stack && t.stack[c]) ? t.stack[c] : sym;
          var col = SYM_ANSI[stackSym] || '240';
          trackStr += '\x1b[38;5;' + col + 'm' + chars[c] + '\x1b[0m';
        }
        trackStr += ' '.repeat(Math.max(0, pad - chars.length));
      }
      var tokenStr = '';
      for (var j = 0; j < toks.length; j++) {
        var tok = toks[j];
        var sc = STRIPE_COLOR[tok.type] || STRIPE_COLOR.ident;
        if (tok.type === 'ws') {
          var prevType = (j > 0) ? toks[j - 1].type : 'ident';
          var nextType = (j + 1 < toks.length) ? toks[j + 1].type : 'ident';
          var bridgeType = (prevType !== 'ws' && prevType !== 'ident') ? prevType
                         : (nextType !== 'ws' && nextType !== 'ident') ? nextType : null;
          if (bridgeType) {
            var bc = STRIPE_COLOR[bridgeType] || STRIPE_COLOR.ws;
            tokenStr += '\x1b[48;5;' + bc.ansi_bg + 'm' + tok.text + '\x1b[0m';
          } else {
            tokenStr += tok.text;
          }
        } else if (tok.type === 'comment') {
          tokenStr += '\x1b[38;5;245;3m' + tok.text + '\x1b[0m';
        } else {
          tokenStr += '\x1b[38;5;' + sc.ansi + 'm' + tok.text + '\x1b[0m';
        }
      }
      result.push(num + ' ' + trackStr + ' \x1b[38;5;' + symCol + 'm' + sym.padEnd(3) + '\x1b[0m ' + tokenStr);
    }
    return result.join('\n');
  }

  // BroadcastChannel sync — browser only
  if (_isBrowser) {
    try {
      var dacBC = new BroadcastChannel('qbit-dac');
      setInterval(function () {
        dacBC.postMessage({ type: 'dac-stats', stats: dacStats(), source: document.title, ts: Date.now() });
      }, 5000);
      dacBC.addEventListener('message', function (e) {
        if (e.data && e.data.type === 'dac-request') {
          dacBC.postMessage({ type: 'dac-stats', stats: dacStats(), source: document.title, ts: Date.now() });
        }
      });
    } catch (e) {}

    try {
      var ironBC = new BroadcastChannel('iron-line');
      ironBC.addEventListener('message', function (e) {
        if (e.data && e.data.stage === 'classify' && e.data.content) {
          var result = prefixDAC(e.data.content, e.data.language, 'iron-line');
          ironBC.postMessage({
            type: 'classify-result', data_id: e.data.data_id,
            meta: result.meta, source: document.title, ts: Date.now()
          });
        }
      });
    } catch (e) {}
  }

  var DAC_API = {
    prefixDAC: prefixDAC,
    dacAnsiLine: dacAnsiLine,
    dacHtmlLine: dacHtmlLine,
    dacTracks: dacTracks,
    dacTrackAnsi: dacTrackAnsi,
    dacTrackHtml: dacTrackHtml,
    dacComplexity: dacComplexity,
    dacTrackContext: dacTrackContext,
    dacStripe: dacStripe,
    dacStripeHtml: dacStripeHtml,
    dacStripeAnsi: dacStripeAnsi,
    dacMode: dacMode,
    dacStats: dacStats,
    qbitCodec: qbitCodec,
    qbit_musica: { Engine: qbitMusicaEngine },
    classifyLine: classifyLine,
    GATE_MAP: GATE_MAP,
    SYM_COLOR: SYM_COLOR,
    SYM_ANSI: SYM_ANSI,
    TRACK_CHARS: TRACK_CHARS,
    STRIPE_COLOR: STRIPE_COLOR,
    _dacStats: DAC_STATS
  };

  root.QbitDAC = DAC_API;
  if (_isBrowser) {
    for (var _k in DAC_API) root[_k] = DAC_API[_k];
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DAC_API;
  }

  if (_isBrowser) {
    var _t5s = _getT5();
    console.debug('%c{.qbit} DAC loaded — mode:' + DAC_MODE + ' · engine:' + (_t5s.available ? 'T5-native(3.2ns)' : 'JS-regex(~246ns)') + ' — prefixDAC · dacTracks · dacStripe · qbitCodec', 'color:#a78bfa;font-weight:bold');
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
