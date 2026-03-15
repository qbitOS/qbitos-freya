// qbit-strict: supports .qbit via qbit-convert --from-qjson
// beyondBINARY quantum-prefixed | uvspeed | {n, +1, -n, +0, 0, -1, +n, +2, -0, +3, 1}
// History Search Engine — shared module for extension + PWA + hexterm
// Usage: <script src="history-search-engine.js"></script> then window.HistorySearch.search(query)
'use strict';

(function(root) {

const VERSION = '2.5.0';
const _IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);
let _NODE_FS = null, _NODE_PATH = null, _NODE_CP = null;
if (_IS_NODE && typeof require === 'function') {
    try { _NODE_FS = require('fs'); } catch (_) {}
    try { _NODE_PATH = require('path'); } catch (_) {}
    try { _NODE_CP = require('child_process'); } catch (_) {}
}

const SRC_COLORS = {
    local: '#34d399', wikipedia: '#3b82f6', openlibrary: '#f97316',
    wayback: '#fb7185', 'sacred-texts': '#a78bfa', yale: '#fbbf24',
    arda: '#ef4444', arxiv: '#8b5cf6', pubchem: '#06b6d4',
    genbank: '#22d3ee', 'lgbtq-archives': '#d946ef', 'meta-research': '#6366f1',
    hathitrust: '#84cc16', 'internet-archive': '#f59e0b',
    fred: '#e11d48', worldbank: '#0ea5e9', coingecko: '#10b981',
    wiktionary: '#9333ea', datamuse: '#d946ef', youtube: '#ff0000',
    'video-transcript': '#f59e0b', 'kbatch-live': '#22a06b',
};

/* ══════════════════════════════════════════════════════
   CONNECTORS
   ══════════════════════════════════════════════════════ */
const CONNECTORS = [
    {
        name: 'Wikipedia', icon: 'W', enabled: true,
        search: q => fetch('https://en.wikipedia.org/w/api.php?action=opensearch&search=' + encodeURIComponent(q) + '&limit=6&format=json&origin=*')
            .then(r => r.json())
            .then(d => (d[1] || []).map((t, i) => ({ title: t, source: 'wikipedia', url: d[3][i], snippet: d[2][i] })))
            .catch(() => [])
    },
    {
        name: 'Open Library', icon: 'OL', enabled: true,
        search: q => fetch('https://openlibrary.org/search.json?q=' + encodeURIComponent(q) + '&limit=5')
            .then(r => r.json())
            .then(d => (d.docs || []).slice(0, 5).map(doc => ({
                title: doc.title, source: 'openlibrary',
                snippet: (doc.author_name || []).join(', ') + (doc.first_publish_year ? ' (' + doc.first_publish_year + ')' : ''),
                url: 'https://openlibrary.org' + doc.key
            }))).catch(() => [])
    },
    {
        name: 'Wayback Machine', icon: 'WB', enabled: true,
        search: q => fetch('https://web.archive.org/cdx/search/cdx?url=*' + encodeURIComponent(q) + '*&output=json&limit=5&fl=original,timestamp')
            .then(r => r.json())
            .then(d => d.slice(1).map(r => ({
                title: r[0], source: 'wayback',
                snippet: 'Archived: ' + r[1].substring(0, 4) + '-' + r[1].substring(4, 6) + '-' + r[1].substring(6, 8),
                url: 'https://web.archive.org/web/' + r[1] + '/' + r[0]
            }))).catch(() => [])
    },
    {
        name: 'Sacred Texts', icon: 'ST', enabled: true,
        search: q => Promise.resolve([{
            title: 'Sacred Texts: ' + q, source: 'sacred-texts',
            snippet: 'All world traditions — sacred-texts.com',
            url: 'https://www.sacred-texts.com/search.htm?q=' + encodeURIComponent(q)
        }])
    },
    {
        name: 'Yale Archives', icon: 'YA', enabled: true,
        search: q => Promise.resolve([{
            title: 'Yale Library: ' + q, source: 'yale',
            snippet: 'Beinecke Library + Yale digital collections',
            url: 'https://search.library.yale.edu/catalog?search_field=all_fields&q=' + encodeURIComponent(q)
        }])
    },
    {
        name: 'ARDA', icon: 'AR', enabled: true,
        search: q => Promise.resolve([{
            title: 'Religion Data Archives: ' + q, source: 'arda',
            snippet: 'Association of Religion Data Archives',
            url: 'https://www.thearda.com/data-archive'
        }])
    },
    {
        name: 'arXiv', icon: 'aX', enabled: true,
        search: q => fetch('https://export.arxiv.org/api/query?search_query=all:' + encodeURIComponent(q) + '&max_results=4')
            .then(r => r.text())
            .then(xml => {
                const entries = [];
                const re = /<entry>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<id>([\s\S]*?)<\/id>[\s\S]*?<summary>([\s\S]*?)<\/summary>[\s\S]*?<\/entry>/g;
                let m; while ((m = re.exec(xml)) !== null) entries.push({
                    title: m[1].trim(), source: 'arxiv', url: m[2].trim(),
                    snippet: m[3].trim().substring(0, 150)
                });
                return entries;
            }).catch(() => [])
    },
    {
        name: 'PubChem', icon: 'PC', enabled: true,
        search: q => fetch('https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + encodeURIComponent(q) + '/property/MolecularFormula,MolecularWeight/JSON')
            .then(r => r.json())
            .then(d => (d.PropertyTable?.Properties || []).map(p => ({
                title: q + ' \u2014 ' + p.MolecularFormula + ' (' + p.MolecularWeight + ' g/mol)',
                source: 'pubchem', snippet: 'Chemical compound data',
                url: 'https://pubchem.ncbi.nlm.nih.gov/compound/' + p.CID
            }))).catch(() => [])
    },
    {
        name: 'GenBank', icon: 'GB', enabled: true,
        search: q => Promise.resolve([{
            title: 'NCBI GenBank: ' + q, source: 'genbank',
            snippet: 'Nucleotide sequence database',
            url: 'https://www.ncbi.nlm.nih.gov/nuccore/?term=' + encodeURIComponent(q)
        }])
    },
    {
        name: 'LGBTQ Archives', icon: 'LQ', enabled: true,
        search: q => Promise.resolve([{
            title: 'LGBTQ Religious Archives: ' + q, source: 'lgbtq-archives',
            snippet: 'LGBTQ Religious Archives Network',
            url: 'https://lgbtqreligiousarchives.org/resources'
        }])
    },
    {
        name: 'Meta Research', icon: 'MR', enabled: true,
        search: q => Promise.resolve([{
            title: 'Meta FAIR: ' + q, source: 'meta-research',
            snippet: 'Meta AI research publications',
            url: 'https://ai.meta.com/research/?q=' + encodeURIComponent(q)
        }])
    },
    {
        name: 'HathiTrust', icon: 'HT', enabled: true,
        search: q => Promise.resolve([{
            title: 'HathiTrust: ' + q, source: 'hathitrust',
            snippet: 'HathiTrust Digital Library \u2014 17M+ volumes',
            url: 'https://catalog.hathitrust.org/Search/Home?lookfor=' + encodeURIComponent(q)
        }])
    },
    {
        name: 'Internet Archive', icon: 'IA', enabled: true,
        search: q => fetch('https://archive.org/advancedsearch.php?q=' + encodeURIComponent(q) + '&fl[]=identifier,title&rows=5&output=json')
            .then(r => r.json())
            .then(d => (d.response?.docs || []).map(doc => ({
                title: doc.title, source: 'internet-archive',
                snippet: 'Internet Archive collection',
                url: 'https://archive.org/details/' + doc.identifier
            }))).catch(() => [])
    },
    // ── Economic / Monetary connectors ──
    {
        name: 'FRED', icon: 'FR', enabled: true,
        search: q => fetch('https://api.stlouisfed.org/fred/series/search?search_text=' + encodeURIComponent(q) + '&api_key=DEMO_KEY&file_type=json&limit=4')
            .then(r => r.json())
            .then(d => (d.seriess || []).map(s => ({
                title: s.title, source: 'fred',
                snippet: s.frequency + ' \u2014 ' + (s.observation_start || '') + ' to ' + (s.observation_end || '') + ' \u2014 ' + (s.notes || '').substring(0, 100),
                url: 'https://fred.stlouisfed.org/series/' + s.id
            }))).catch(() => [])
    },
    {
        name: 'World Bank', icon: 'WB$', enabled: true,
        search: q => fetch('https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=3&date=2020:2024')
            .then(r => r.json())
            .then(d => {
                var items = (d[1] || []).filter(i => i.value !== null);
                return items.slice(0, 4).map(i => ({
                    title: (i.country ? i.country.value : 'World') + ' GDP ' + i.date,
                    source: 'worldbank',
                    snippet: 'GDP: $' + (i.value ? (i.value / 1e9).toFixed(1) + 'B' : 'N/A') + ' \u2014 ' + (i.indicator ? i.indicator.value : ''),
                    url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=' + (i.countryiso3code || '')
                }));
            }).catch(() => [])
    },
    {
        name: 'CoinGecko', icon: 'CG', enabled: true,
        search: q => fetch('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(q))
            .then(r => r.json())
            .then(d => (d.coins || []).slice(0, 4).map(c => ({
                title: c.name + ' (' + c.symbol.toUpperCase() + ')',
                source: 'coingecko',
                snippet: 'Market cap rank: #' + (c.market_cap_rank || 'N/A') + ' \u2014 ' + (c.id || ''),
                url: 'https://www.coingecko.com/en/coins/' + c.id
            }))).catch(() => [])
    },
    // ── Linguistic / Etymology connectors ──
    {
        name: 'Wiktionary', icon: 'Wk', enabled: true,
        search: q => fetch('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(q))
            .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(data => {
                var results = [];
                (Array.isArray(data) ? data : []).forEach(function(langEntry) {
                    var lang = langEntry.language || 'English';
                    (langEntry.definitions || []).forEach(function(def) {
                        (def.definitions || []).slice(0, 2).forEach(function(d) {
                            var text = (d.definition || '').replace(/<[^>]*>/g, '');
                            if (text) results.push({
                                title: q + ' (' + lang + ', ' + (def.partOfSpeech || '') + ')',
                                source: 'wiktionary',
                                snippet: text.substring(0, 200),
                                url: 'https://en.wiktionary.org/wiki/' + encodeURIComponent(q)
                            });
                        });
                    });
                });
                return results.slice(0, 5);
            }).catch(() => [])
    },
    {
        name: 'Datamuse', icon: 'Dm', enabled: true,
        search: q => fetch('https://api.datamuse.com/words?ml=' + encodeURIComponent(q) + '&max=6&md=d')
            .then(r => r.json())
            .then(data => data.map(function(d) {
                var defs = (d.defs || []).map(function(def) { return def.replace(/^\w+\t/, ''); }).join('; ');
                return {
                    title: d.word + (d.tags ? ' [' + d.tags.join(', ') + ']' : ''),
                    source: 'datamuse',
                    snippet: defs || 'Related to: ' + q + ' (score: ' + (d.score || 0) + ')',
                    url: 'https://en.wiktionary.org/wiki/' + encodeURIComponent(d.word)
                };
            })).catch(() => [])
    },
    // ── YouTube Search + Transcript ──
    {
        name: 'YouTube', icon: 'YT', enabled: true,
        search: q => {
            // YouTube search via Invidious public API (no key needed)
            return fetch('https://vid.puffyan.us/api/v1/search?q=' + encodeURIComponent(q) + '&type=video&page=1')
                .then(r => r.json())
                .then(data => (Array.isArray(data) ? data : []).slice(0, 5).map(function(v) {
                    return {
                        title: v.title || q, source: 'youtube',
                        snippet: (v.author || '') + ' | ' + (v.lengthSeconds ? Math.floor(v.lengthSeconds/60) + ':' + ('0' + (v.lengthSeconds%60)).slice(-2) : '') + ' | ' + (v.viewCount ? v.viewCount.toLocaleString() + ' views' : '') + (v.description ? ' \u2014 ' + v.description.substring(0,100) : ''),
                        url: 'https://www.youtube.com/watch?v=' + (v.videoId || ''),
                        videoId: v.videoId || '',
                        duration: v.lengthSeconds || 0,
                        author: v.author || '',
                    };
                })).catch(() =>
                    // Fallback: simple YouTube search URL
                    [{ title: 'YouTube: ' + q, source: 'youtube', snippet: 'Search YouTube videos', url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) }]
                );
        }
    },
    {
        name: 'Video Transcripts', icon: 'VT', enabled: true,
        search: q => {
            var stored = JSON.parse(localStorage.getItem('transcript-dca-index') || '[]');
            var ql = q.toLowerCase();
            return Promise.resolve(stored.filter(s => s.text && s.text.toLowerCase().includes(ql)).slice(0, 12).map(s => {
                var ts = Math.floor(s.t/60) + ':' + String(Math.floor(s.t%60)).padStart(2,'0');
                return {
                    title: (s.prefix || '') + ' ' + (s.text || '').substring(0, 80),
                    source: 'video-transcript',
                    url: 'https://youtube.com/watch?v=' + s.videoId + '&t=' + Math.floor(s.t),
                    snippet: ts + ' | ' + (s.gate || 'I') + ' gate | ' + (s.type || 'segment') + ' | qpos[' + (s.qpos || [0,0,0]).join(',') + ']'
                };
            }));
        }
    },
    {
        name: 'KBatch Live', icon: 'KB', enabled: true,
        search: q => searchLocalLiveFeed(q)
    },
];

var _LIVE_FEED_CACHE = { stamp: 0, records: [] };
var _LIVE_FEED_TTL_MS = 5000;
var _LIVE_FEED_PATHS = [
    '/data/history-search/live-records.latest.json',
    '../data/history-search/live-records.latest.json',
    'data/history-search/live-records.latest.json'
];
var _LIVE_FEED_QBIT_PATHS = [
    '/Volumes/qbitOS/02.backups/01-uvspeed-cursor-build/reference/live-q-ledger-index.qbit',
    'data/reference/live-q-ledger-index.qbit'
];

function decodeQbitToJsonText(filePath) {
    if (!_NODE_FS || !_NODE_CP || !_NODE_PATH) return '';
    var converter = _NODE_PATH.resolve(process.cwd(), 'qbit', '09-tools', 'qbit-convert.js');
    if (!_NODE_FS.existsSync(converter) || !_NODE_FS.existsSync(filePath)) return '';
    var tmp = _NODE_PATH.join(require('os').tmpdir(), 'history-search-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.json');
    try {
        _NODE_CP.execFileSync(process.execPath, [converter, filePath, '--from-qjson', '-o', tmp], {
            stdio: 'pipe',
            timeout: 20000,
            maxBuffer: 8 * 1024 * 1024
        });
        return _NODE_FS.readFileSync(tmp, 'utf8');
    } catch (_) {
        return '';
    } finally {
        try { _NODE_FS.unlinkSync(tmp); } catch (_) {}
    }
}

function tryNodeLiveFeed() {
    if (!_IS_NODE || !_NODE_FS || !_NODE_PATH) return [];
    try {
        var latest = _NODE_PATH.resolve(process.cwd(), 'data', 'history-search', 'live-records.latest.json');
        if (_NODE_FS.existsSync(latest)) {
            var j = JSON.parse(_NODE_FS.readFileSync(latest, 'utf8'));
            if (Array.isArray(j)) return j;
        }
    } catch (_) {}
    for (var i = 0; i < _LIVE_FEED_QBIT_PATHS.length; i++) {
        try {
            var fp = _LIVE_FEED_QBIT_PATHS[i];
            var txt = decodeQbitToJsonText(fp);
            if (!txt) continue;
            var decoded = JSON.parse(txt);
            if (decoded && decoded.pointers && decoded.pointers.live_latest) {
                var ptr = _NODE_PATH.resolve(process.cwd(), decoded.pointers.live_latest);
                if (_NODE_FS.existsSync(ptr)) {
                    var recs = JSON.parse(_NODE_FS.readFileSync(ptr, 'utf8'));
                    if (Array.isArray(recs)) return recs;
                }
            }
        } catch (_) {}
    }
    return [];
}

/* ══════════════════════════════════════════════════════
   TIMELINE SCALES
   ══════════════════════════════════════════════════════ */
const TL_SCALES = [
    { name: 'Sub-quantum', min: -44, max: -24, color: '#8b5cf6' },
    { name: 'Quantum',     min: -24, max: -15, color: '#6366f1' },
    { name: 'Atomic',      min: -15, max: -9,  color: '#3b82f6' },
    { name: 'Photonic',    min: -9,  max: -6,  color: '#06b6d4' },
    { name: 'Signal',      min: -6,  max: -2,  color: '#22d3ee' },
    { name: 'Digital',     min: -2,  max: 2,   color: '#34d399' },
    { name: 'Human',       min: 2,   max: 8,   color: '#fbbf24' },
    { name: 'Historical',  min: 8,   max: 12,  color: '#f97316' },
    { name: 'Geological',  min: 12,  max: 16,  color: '#ef4444' },
    { name: 'Cosmic',      min: 16,  max: 18,  color: '#84cc16' },
];

/* ══════════════════════════════════════════════════════
   SEARCH ENGINE API
   ══════════════════════════════════════════════════════ */
async function search(query, opts = {}) {
    const t0 = performance.now();
    const onProgress = opts.onProgress || (() => {});
    const enabledConnectors = CONNECTORS.filter(c => c.enabled);
    const allResults = [];
    let completed = 0;

    await Promise.allSettled(enabledConnectors.map(async (conn) => {
        try {
            const results = await conn.search(query);
            results.forEach(r => allResults.push(r));
            completed++;
            onProgress({ results: allResults.slice(), completed, total: enabledConnectors.length, connector: conn.name, latestBatch: results });
        } catch (e) {
            completed++;
            onProgress({ results: allResults.slice(), completed, total: enabledConnectors.length, connector: conn.name, error: e.message, latestBatch: [] });
        }
    }));

    return {
        query,
        results: allResults,
        latencyMs: Math.round(performance.now() - t0),
        connectorsUsed: enabledConnectors.length,
        totalResults: allResults.length,
    };
}

async function loadLocalLiveFeed(opts) {
    opts = opts || {};
    var now = Date.now();
    var force = !!opts.force;
    if (!force && (now - _LIVE_FEED_CACHE.stamp) < _LIVE_FEED_TTL_MS) return _LIVE_FEED_CACHE.records;
    var records = [];
    for (var i = 0; i < _LIVE_FEED_PATHS.length; i++) {
        try {
            var res = await fetch(_LIVE_FEED_PATHS[i], { cache: 'no-cache' });
            if (!res.ok) continue;
            var json = await res.json();
            if (Array.isArray(json)) {
                records = json;
                break;
            }
        } catch (_) {}
    }
    if (!records.length) {
        var nodeRecords = tryNodeLiveFeed();
        if (Array.isArray(nodeRecords) && nodeRecords.length) records = nodeRecords;
    }
    _LIVE_FEED_CACHE = { stamp: now, records: records };
    return records;
}

async function searchLocalLiveFeed(query, opts) {
    opts = opts || {};
    var q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    var max = Math.max(1, opts.limit || 12);
    var records = await loadLocalLiveFeed(opts);
    var scored = [];
    records.forEach(function(rec) {
        var content = String((rec && rec.content) || '').toLowerCase();
        var payloadText = '';
        try { payloadText = JSON.stringify((rec && rec.payload) || {}).toLowerCase(); } catch (_) {}
        var hay = content + ' ' + payloadText;
        if (!hay || hay.indexOf(q) === -1) return;
        var exact = content.indexOf(q) !== -1 ? 2 : 0;
        var score = exact + Math.min(6, (hay.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length);
        scored.push({
            score: score,
            result: {
                title: (rec.type || 'kbatch-cli') + ': ' + ((rec.payload && (rec.payload.query || rec.payload.id || rec.payload.cmd)) || 'live packet'),
                source: 'kbatch-live',
                url: '#kbatch-live-' + encodeURIComponent(rec.id || String(Date.now())),
                snippet: String(rec.content || '').substring(0, 220),
                date: rec.created_at,
                kbatchLive: true,
                packet: rec
            }
        });
    });
    scored.sort(function(a, b) { return b.score - a.score; });
    return scored.slice(0, max).map(function(s) { return s.result; });
}

function setConnectorEnabled(nameOrIndex, enabled) {
    const conn = typeof nameOrIndex === 'number' ? CONNECTORS[nameOrIndex] : CONNECTORS.find(c => c.name === nameOrIndex || c.icon === nameOrIndex);
    if (conn) conn.enabled = enabled;
}

function getConnectors() { return CONNECTORS.map(c => ({ name: c.name, icon: c.icon, enabled: c.enabled })); }
function getScales() { return TL_SCALES; }
function getSourceColor(source) { return SRC_COLORS[source] || '#64748b'; }

/* ══════════════════════════════════════════════════════
   MINI TIMELINE RENDERER
   ══════════════════════════════════════════════════════ */
function drawTimeline(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr, H = canvas.height / dpr;
    const minLog = -44, maxLog = 18, range = maxLog - minLog;
    const isLight = document.documentElement.classList.contains('light');
    ctx.fillStyle = isLight ? '#f1f5f9' : '#050810'; ctx.fillRect(0, 0, W, H);
    TL_SCALES.forEach(s => {
        const x1 = ((s.min - minLog) / range) * W;
        const x2 = ((s.max - minLog) / range) * W;
        ctx.fillStyle = s.color + '18'; ctx.fillRect(x1, 0, x2 - x1, H);
        ctx.strokeStyle = s.color + '40'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke();
        const lx = (x1 + x2) / 2;
        if (lx > 10 && lx < W - 10) {
            ctx.fillStyle = s.color + 'cc'; ctx.font = 'bold ' + Math.max(7, H * 0.2) + 'px monospace';
            ctx.textAlign = 'center'; ctx.fillText(s.name, lx, H / 2 + 3);
        }
    });
    ctx.textAlign = 'start';
}

/* ══════════════════════════════════════════════════════
   DOCUMENT FETCHER
   ══════════════════════════════════════════════════════ */
async function fetchDocument(url, source) {
    source = source || '';
    var doc = { title: '', content: '', source: source, url: url, wordCount: 0, language: 'en', fetchedAt: Date.now() };
    try {
        // Wikipedia: use parse API for full text
        if (source === 'wikipedia' || url.indexOf('wikipedia.org') !== -1) {
            var titleMatch = url.match(/\/wiki\/(.+?)(?:#|$)/);
            if (titleMatch) {
                var apiUrl = 'https://en.wikipedia.org/w/api.php?action=parse&page=' + titleMatch[1] + '&prop=text|categories&format=json&origin=*';
                var res = await fetch(apiUrl);
                var data = await res.json();
                if (data.parse) {
                    doc.title = data.parse.title || titleMatch[1].replace(/_/g, ' ');
                    var html = data.parse.text ? data.parse.text['*'] : '';
                    doc.content = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    doc.categories = (data.parse.categories || []).map(function(c) { return c['*']; });
                }
            }
        }
        // arXiv: already have abstract, fetch extended metadata
        else if (source === 'arxiv' || url.indexOf('arxiv.org') !== -1) {
            var idMatch = url.match(/abs\/(.+?)(?:#|$)/) || url.match(/(\d{4}\.\d{4,5})/);
            if (idMatch) {
                var res = await fetch('https://export.arxiv.org/api/query?id_list=' + idMatch[1]);
                var xml = await res.text();
                var tM = xml.match(/<title>([\s\S]*?)<\/title>/);
                var sM = xml.match(/<summary>([\s\S]*?)<\/summary>/);
                var aM = xml.match(/<name>([\s\S]*?)<\/name>/g);
                doc.title = tM ? tM[1].trim() : '';
                doc.content = sM ? sM[1].trim() : '';
                doc.authors = aM ? aM.map(function(a) { return a.replace(/<[^>]+>/g, '').trim(); }) : [];
            }
        }
        // Open Library: fetch work description + subjects
        else if (source === 'openlibrary' || url.indexOf('openlibrary.org') !== -1) {
            var keyMatch = url.match(/\/works\/(\w+)/);
            if (keyMatch) {
                var res = await fetch('https://openlibrary.org/works/' + keyMatch[1] + '.json');
                var data = await res.json();
                doc.title = data.title || '';
                doc.content = typeof data.description === 'string' ? data.description : (data.description ? data.description.value : '');
                doc.subjects = (data.subjects || []).slice(0, 20);
            }
        }
        // Internet Archive: metadata endpoint
        else if (source === 'internet-archive' || url.indexOf('archive.org') !== -1) {
            var idMatch = url.match(/\/details\/(.+?)(?:#|$)/);
            if (idMatch) {
                var res = await fetch('https://archive.org/metadata/' + idMatch[1]);
                var data = await res.json();
                var m = data.metadata || {};
                doc.title = m.title || idMatch[1];
                doc.content = m.description || '';
                doc.creator = m.creator;
                doc.date = m.date;
            }
        }
        // FRED: fetch series observations
        else if (source === 'fred' || url.indexOf('fred.stlouisfed.org') !== -1) {
            var sMatch = url.match(/\/series\/(\w+)/);
            if (sMatch) {
                var res = await fetch('https://api.stlouisfed.org/fred/series?series_id=' + sMatch[1] + '&api_key=DEMO_KEY&file_type=json');
                var data = await res.json();
                var s = (data.seriess || [])[0] || {};
                doc.title = s.title || sMatch[1];
                doc.content = (s.notes || '') + '\n\nFrequency: ' + (s.frequency || '') + '\nUnits: ' + (s.units || '') + '\nSeasonal adjustment: ' + (s.seasonal_adjustment || '');
            }
        }
        // Generic: try to fetch and extract text
        else {
            doc.title = url;
            doc.content = 'Document preview not available for this source. Open the URL directly.';
        }
    } catch (e) {
        doc.content = 'Fetch error: ' + e.message;
    }
    doc.wordCount = doc.content ? doc.content.split(/\s+/).length : 0;
    return doc;
}

/* ══════════════════════════════════════════════════════
   CONTEXT ANALYZER
   ══════════════════════════════════════════════════════ */

// Word lists for tone detection
var _TONE_ACADEMIC = ['hypothesis','methodology','empirical','furthermore','consequently','paradigm','theoretical','correlation','significance','parameter','systematic','quantitative','qualitative','longitudinal','peer-reviewed','citation','appendix','abstract','et al','respectively'];
var _TONE_MARKETING = ['exclusive','limited','free','guaranteed','revolutionary','amazing','incredible','unbelievable','act now','best ever','discount','premium','unlock','boost','maximize','skyrocket','transform','ultimate','breakthrough','game-changing'];
var _TONE_EDUCATIONAL = ['learn','understand','example','practice','exercise','chapter','lesson','concept','fundamental','introduction','definition','explanation','diagram','tutorial','demonstrate','illustrate','step-by-step','overview','summary','review'];
var _TONE_NARRATIVE = ['i ','my ','me ','we ','our ','felt','remembered','walked','looked','thought','heart','dream','love','fear','hope','believed','whispered','laughed','cried','journey'];
var _TONE_LEGAL = ['shall','whereas','herein','thereof','pursuant','notwithstanding','indemnify','liability','obligation','amendment','jurisdiction','arbitration','stipulate','covenant','warrant','provision','clause','binding','enforceable','waiver'];
var _TONE_CRISIS = ['war','conflict','attack','bomb','troops','invasion','siege','casualties','refugee','displaced','famine','epidemic','pandemic','collapse','bankruptcy','default','crisis','emergency','catastrophe','devastation'];

var _MONETARY_PATTERNS = /\$[\d,.]+|\d+%|GDP|inflation|debt|deficit|trade|tariff|stock|bond|treasury|currency|exchange rate|interest rate|fiscal|monetary|capital|investment|revenue|profit|loss|billion|trillion|economy|recession|depression|surplus|subsidy|tax|wage|income|wealth|poverty|inequality/gi;

var _SUBREFERENCE_PATTERNS = {
    urls: /https?:\/\/[^\s"'<>]+/g,
    dates: /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}|\d{4}\s(?:BC|BCE|AD|CE))\b/gi,
    monetary: /\$[\d,.]+\s*(?:billion|trillion|million)?|\d+(?:\.\d+)?\s*(?:billion|trillion|million)\s*(?:dollars|USD|EUR|GBP)?/gi,
    quotes: /"([^"]{10,200})"/g,
    properNouns: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
};

function analyzeContext(doc) {
    var text = (doc && doc.content) ? doc.content : (typeof doc === 'string' ? doc : '');
    var words = text.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 0; });
    var totalWords = words.length;
    if (totalWords === 0) return { tone: {}, vocabulary: {}, subReferences: {}, monetarySignals: [], sentiment: 0, readabilityScore: 0, heartbeat: 0.5, aiPerspective: '' };

    // ── Vocabulary fingerprint ──
    var freq = {};
    words.forEach(function(w) { var clean = w.replace(/[^a-z'-]/g, ''); if (clean.length > 1) freq[clean] = (freq[clean] || 0) + 1; });
    var uniqueWords = Object.keys(freq);
    var hapaxCount = uniqueWords.filter(function(w) { return freq[w] === 1; }).length;
    var avgWordLen = words.reduce(function(s, w) { return s + w.length; }, 0) / totalWords;
    var sortedWords = uniqueWords.sort(function(a, b) { return freq[b] - freq[a]; });

    var vocabulary = {
        totalWords: totalWords,
        uniqueWords: uniqueWords.length,
        typeTokenRatio: uniqueWords.length / totalWords,
        hapaxRatio: hapaxCount / uniqueWords.length,
        avgWordLength: Math.round(avgWordLen * 10) / 10,
        top50: sortedWords.slice(0, 50).map(function(w) { return { word: w, count: freq[w] }; }),
    };

    // ── Writing tone classification ──
    var lower = text.toLowerCase();
    function countHits(wordList) {
        var hits = 0;
        wordList.forEach(function(term) { var idx = -1; while ((idx = lower.indexOf(term, idx + 1)) !== -1) hits++; });
        return hits;
    }

    var toneScores = {
        academic: countHits(_TONE_ACADEMIC),
        marketing: countHits(_TONE_MARKETING),
        educational: countHits(_TONE_EDUCATIONAL),
        narrative: countHits(_TONE_NARRATIVE),
        legal: countHits(_TONE_LEGAL),
        crisis: countHits(_TONE_CRISIS),
    };
    var toneTotal = Object.values(toneScores).reduce(function(a, b) { return a + b; }, 0) || 1;
    var tone = {};
    for (var t in toneScores) tone[t] = Math.round((toneScores[t] / toneTotal) * 100);

    // Determine dominant tone
    var dominant = 'neutral';
    var maxScore = 0;
    for (var t in tone) { if (tone[t] > maxScore) { maxScore = tone[t]; dominant = t; } }
    tone.dominant = dominant;

    // ── Sub-reference extraction ──
    var subReferences = {};
    for (var key in _SUBREFERENCE_PATTERNS) {
        var matches = text.match(_SUBREFERENCE_PATTERNS[key]);
        subReferences[key] = matches ? matches.slice(0, 20) : [];
    }

    // ── Monetary signals ──
    var monetaryMatches = text.match(_MONETARY_PATTERNS) || [];
    var monetarySignals = monetaryMatches.slice(0, 30);

    // ── Sentiment (simple positive/negative ratio) ──
    var posWords = ['good','great','excellent','wonderful','positive','success','benefit','improve','growth','progress','hope','opportunity','achieve','prosper','peace','health','love','create','build','thrive'];
    var negWords = ['bad','terrible','awful','negative','failure','harm','damage','decline','crisis','danger','threat','loss','destroy','suffer','pain','fear','hate','corrupt','exploit','collapse'];
    var posCount = countHits(posWords);
    var negCount = countHits(negWords);
    var sentiment = (posCount + negCount) > 0 ? (posCount - negCount) / (posCount + negCount) : 0;

    // ── Readability (Flesch-Kincaid approximation) ──
    var sentences = text.split(/[.!?]+/).filter(function(s) { return s.trim().length > 3; }).length || 1;
    var syllables = words.reduce(function(s, w) { var m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,'').match(/[aeiouy]{1,2}/g); return s + (m ? m.length : 1); }, 0);
    var readabilityScore = Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (totalWords / sentences) - 84.6 * (syllables / totalWords))));

    // ── Heartbeat: humanity vs profit-attention ratio ──
    var humanitySignals = toneScores.educational + toneScores.narrative + posCount;
    var profitSignals = toneScores.marketing + toneScores.crisis + monetarySignals.length;
    var heartbeatTotal = humanitySignals + profitSignals || 1;
    var heartbeat = Math.round((humanitySignals / heartbeatTotal) * 100) / 100;

    // ── AI self-awareness ──
    var aiPerspective = 'This analysis was performed by a pattern-matching system (regex word lists, not semantic AI). ' +
        'Tone classifications are structural, not contextual \u2014 a crisis report about humanitarian aid scores high on both crisis and educational. ' +
        'The heartbeat metric (' + Math.round(heartbeat * 100) + '% humanity) distinguishes profit-oriented framing from human-oriented content, ' +
        'but this distinction is itself a value judgment encoded in word lists. The system does not understand meaning; it counts patterns.';

    return {
        tone: tone,
        vocabulary: vocabulary,
        subReferences: subReferences,
        monetarySignals: monetarySignals,
        sentiment: Math.round(sentiment * 100) / 100,
        readabilityScore: readabilityScore,
        heartbeat: heartbeat,
        aiPerspective: aiPerspective,
    };
}

/* ══════════════════════════════════════════════════════
   PATTERN RECOGNITION (cross-result analysis)
   ══════════════════════════════════════════════════════ */
function detectPatterns(results, documents) {
    documents = documents || [];
    var clusters = { economic: [], academic: [], crisis: [], educational: [], narrative: [] };
    var totalEconDensity = 0;
    var totalAttention = 0;
    var totalHeartbeat = 0;
    var shockwaves = [];
    var docCount = 0;

    documents.forEach(function(doc) {
        if (!doc || !doc._analysis) return;
        var a = doc._analysis;
        docCount++;

        // Cluster by dominant tone
        if (a.tone && a.tone.dominant && clusters[a.tone.dominant]) {
            clusters[a.tone.dominant].push({ title: doc.title, source: doc.source, heartbeat: a.heartbeat });
        }

        // Economic density
        var econDensity = a.monetarySignals ? a.monetarySignals.length / Math.max(1, a.vocabulary.totalWords) * 1000 : 0;
        totalEconDensity += econDensity;

        // Attention (marketing/crisis) vs heartbeat (educational/narrative)
        totalAttention += (a.tone.marketing || 0) + (a.tone.crisis || 0);
        totalHeartbeat += (a.tone.educational || 0) + (a.tone.narrative || 0);

        // Shockwave detection: high crisis + high monetary = shockwave
        if ((a.tone.crisis || 0) > 25 && a.monetarySignals && a.monetarySignals.length > 3) {
            shockwaves.push({
                title: doc.title,
                source: doc.source,
                crisisScore: a.tone.crisis,
                monetaryTerms: a.monetarySignals.length,
                sentiment: a.sentiment,
            });
        }
    });

    var attentionTotal = totalAttention + totalHeartbeat || 1;
    var attentionRatio = Math.round((totalAttention / attentionTotal) * 100);

    return {
        clusters: clusters,
        economicDensity: docCount > 0 ? Math.round((totalEconDensity / docCount) * 10) / 10 : 0,
        attentionRatio: attentionRatio,
        heartbeatRatio: 100 - attentionRatio,
        shockwaves: shockwaves,
        documentsAnalyzed: docCount,
        prediction: shockwaves.length > 2
            ? 'High volatility pattern: multiple crisis-economic intersections detected. Historical correlation suggests impact on housing, education, and community stability within 6-18 months.'
            : shockwaves.length > 0
                ? 'Moderate disruption signal: ' + shockwaves.length + ' crisis-economic intersection(s). Monitor for cascading effects.'
                : 'Stable pattern: no significant crisis-economic intersections in analyzed documents.',
    };
}

/* ══════════════════════════════════════════════════════
   AI LENS — page structure, metric weighting, heatmap,
   content generation, vision tracking, board layout
   ══════════════════════════════════════════════════════ */

// Heatmap: track user interaction zones per result
var _heatmapData = {};  // id -> { clicks, hovers, dwellMs, scrollDepth }

function trackInteraction(resultId, type, extra) {
    if (!_heatmapData[resultId]) {
        _heatmapData[resultId] = { clicks: 0, hovers: 0, dwellMs: 0, scrollDepth: 0, firstSeen: Date.now(), zones: [] };
    }
    var h = _heatmapData[resultId];
    if (type === 'click') h.clicks++;
    if (type === 'hover') h.hovers++;
    if (type === 'dwell') h.dwellMs += (extra || 0);
    if (type === 'scroll') h.scrollDepth = Math.max(h.scrollDepth, extra || 0);
    if (type === 'zone' && extra) h.zones.push(extra);
    return h;
}

function getHeatmapData() { return JSON.parse(JSON.stringify(_heatmapData)); }
function clearHeatmap() { _heatmapData = {}; }

// Page structure analysis — like vision tracking / structural understanding
function analyzePageStructure(html) {
    if (!html || typeof html !== 'string') return { sections: [], links: [], images: [], headings: [], forms: [], depth: 0, complexity: 0 };

    var headings = []; var links = []; var images = []; var forms = []; var sections = [];
    var hm = html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi) || [];
    hm.forEach(function(h) {
        var level = parseInt(h.charAt(2));
        var text = h.replace(/<[^>]+>/g, '').trim();
        if (text) headings.push({ level: level, text: text.substring(0, 120) });
    });
    var lm = html.match(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi) || [];
    lm.forEach(function(a) {
        var href = (a.match(/href="([^"]*)"/) || ['', ''])[1];
        var text = a.replace(/<[^>]+>/g, '').trim();
        if (href && text) links.push({ href: href, text: text.substring(0, 80) });
    });
    var im = html.match(/<img\s[^>]*>/gi) || [];
    im.forEach(function(i) {
        var src = (i.match(/src="([^"]*)"/) || ['', ''])[1];
        var alt = (i.match(/alt="([^"]*)"/) || ['', ''])[1];
        if (src) images.push({ src: src, alt: alt || '' });
    });
    var fm = html.match(/<form[\s\S]*?<\/form>/gi) || [];
    forms = fm.map(function(f) {
        var inputs = (f.match(/<input/gi) || []).length;
        var action = (f.match(/action="([^"]*)"/) || ['', ''])[1];
        return { action: action, inputCount: inputs };
    });

    // Build section hierarchy from headings
    var currentSection = null;
    headings.forEach(function(h, idx) {
        var section = { id: 'sec-' + idx, heading: h.text, level: h.level, subLinks: 0, subImages: 0 };
        sections.push(section);
        currentSection = section;
    });

    // Estimate complexity
    var tagCount = (html.match(/<[a-z]/gi) || []).length;
    var depth = 0; var maxD = 0; var inTag = false;
    for (var i = 0; i < Math.min(html.length, 50000); i++) {
        if (html[i] === '<' && html[i+1] !== '/') { depth++; if (depth > maxD) maxD = depth; }
        if (html[i] === '<' && html[i+1] === '/') depth--;
    }

    return {
        sections: sections,
        links: links.slice(0, 100),
        images: images.slice(0, 50),
        headings: headings,
        forms: forms,
        depth: maxD,
        complexity: Math.min(100, Math.round((tagCount / 50) + (maxD * 2) + (links.length * 0.3) + (forms.length * 5))),
        tagCount: tagCount,
        wordCount: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    };
}

// AI Metric Weighting — score results by usefulness
function weightResults(results, opts) {
    opts = opts || {};
    var contextAnalyses = opts.analyses || {};
    var heatmap = opts.heatmap || _heatmapData;
    var userGoal = opts.goal || 'research'; // research | app-building | learning | promo

    var goalWeights = {
        research:      { depth: 0.3, breadth: 0.25, authority: 0.2, recency: 0.1, engagement: 0.15 },
        'app-building': { depth: 0.15, breadth: 0.15, authority: 0.15, recency: 0.25, engagement: 0.3 },
        learning:      { depth: 0.35, breadth: 0.2, authority: 0.2, recency: 0.05, engagement: 0.2 },
        promo:         { depth: 0.1, breadth: 0.3, authority: 0.15, recency: 0.2, engagement: 0.25 },
    };
    var w = goalWeights[userGoal] || goalWeights.research;

    return results.map(function(r, idx) {
        var id = r.id || String(idx);
        var analysis = contextAnalyses[id] || {};
        var heat = heatmap[id] || {};

        // Depth score: content richness
        var depthScore = 0;
        if (analysis.readability) depthScore += analysis.readability.grade / 20;
        if (analysis.subReferences) depthScore += Math.min(1, analysis.subReferences.length / 10);
        if (analysis.vocabulary) depthScore += Math.min(1, analysis.vocabulary.uniqueWords / 500);
        depthScore = Math.min(1, depthScore / 2.5);

        // Breadth: cross-references, multiple topics
        var breadthScore = 0;
        if (analysis.subReferences) breadthScore += Math.min(1, analysis.subReferences.length / 15);
        if (r.source) breadthScore += 0.3; // has identifiable source

        // Authority: source reputation + tone
        var authorityScore = 0;
        var trustedSources = ['wikipedia', 'arxiv', 'pubchem', 'genbank', 'hathitrust'];
        if (r.source && trustedSources.indexOf(r.source.toLowerCase()) >= 0) authorityScore += 0.6;
        if (analysis.tone && (analysis.tone.academic > 0.3 || analysis.tone.educational > 0.3)) authorityScore += 0.3;
        authorityScore = Math.min(1, authorityScore);

        // Recency
        var recencyScore = 0.5; // default mid
        if (r.date) {
            var age = Date.now() - new Date(r.date).getTime();
            var ageYears = age / (365.25 * 24 * 3600 * 1000);
            recencyScore = Math.max(0, 1 - (ageYears / 20));
        }

        // Engagement from heatmap
        var engagementScore = 0;
        if (heat.clicks) engagementScore += Math.min(0.5, heat.clicks * 0.15);
        if (heat.dwellMs) engagementScore += Math.min(0.3, heat.dwellMs / 30000);
        if (heat.scrollDepth) engagementScore += heat.scrollDepth * 0.2;
        engagementScore = Math.min(1, engagementScore);

        var totalScore = (depthScore * w.depth) + (breadthScore * w.breadth) +
            (authorityScore * w.authority) + (recencyScore * w.recency) +
            (engagementScore * w.engagement);

        return {
            result: r,
            id: id,
            scores: {
                total: Math.round(totalScore * 100) / 100,
                depth: Math.round(depthScore * 100) / 100,
                breadth: Math.round(breadthScore * 100) / 100,
                authority: Math.round(authorityScore * 100) / 100,
                recency: Math.round(recencyScore * 100) / 100,
                engagement: Math.round(engagementScore * 100) / 100,
            },
            rank: 0, // set after sorting
        };
    }).sort(function(a, b) { return b.scores.total - a.scores.total; })
      .map(function(item, idx) { item.rank = idx + 1; return item; });
}

// Content Generation — produce outputs from analysis
function generateContent(type, results, analyses, opts) {
    opts = opts || {};
    var title = opts.title || 'Research Summary';
    var weighted = weightResults(results, { analyses: analyses, goal: opts.goal || 'research' });

    if (type === 'research-paper') {
        var lines = [];
        lines.push('# ' + title);
        lines.push('');
        lines.push('**Generated:** ' + new Date().toISOString().split('T')[0]);
        lines.push('**Sources:** ' + results.length + ' documents analyzed');
        lines.push('**Engine:** uvspeed History Search v' + VERSION);
        lines.push('');
        lines.push('## Abstract');
        lines.push('');
        var topResults = weighted.slice(0, 5);
        lines.push('This analysis synthesizes ' + results.length + ' sources across ' + new Set(results.map(function(r) { return r.source; })).size + ' knowledge bases. ');
        lines.push('The highest-weighted sources emphasize ' + (topResults.length > 0 ? topResults.map(function(r) { return r.result.title || 'untitled'; }).join(', ') : 'various topics') + '.');
        lines.push('');
        lines.push('## Source Analysis');
        lines.push('');
        lines.push('| Rank | Source | Score | Depth | Authority | Title |');
        lines.push('|------|--------|-------|-------|-----------|-------|');
        weighted.slice(0, 15).forEach(function(w) {
            lines.push('| ' + w.rank + ' | ' + (w.result.source || '?') + ' | ' + w.scores.total + ' | ' + w.scores.depth + ' | ' + w.scores.authority + ' | ' + (w.result.title || '').substring(0, 40) + ' |');
        });
        lines.push('');
        lines.push('## Key Themes');
        lines.push('');
        // Cluster by source
        var bySource = {};
        results.forEach(function(r) { var s = r.source || 'unknown'; if (!bySource[s]) bySource[s] = []; bySource[s].push(r); });
        Object.keys(bySource).forEach(function(src) {
            lines.push('### ' + src + ' (' + bySource[src].length + ' results)');
            lines.push('');
            bySource[src].slice(0, 3).forEach(function(r) {
                lines.push('- **' + (r.title || 'Untitled') + '**: ' + (r.snippet || '').substring(0, 200));
            });
            lines.push('');
        });
        lines.push('## Methodology');
        lines.push('');
        lines.push('Results weighted using multi-dimensional scoring: depth (' + (opts.goal === 'research' ? '30%' : '15-35%') + '), breadth, authority, recency, and engagement metrics.');
        lines.push('');
        lines.push('---');
        lines.push('*beyondBINARY quantum-prefixed | uvspeed | {n, +1, -n, +0, 0, -1, +n, +2, -0, +3, 1}*');
        return lines.join('\n');
    }

    if (type === 'pwa-spec') {
        var spec = {
            name: opts.appName || 'Generated App',
            description: 'PWA generated from ' + results.length + ' search results',
            version: '1.0.0',
            generated: new Date().toISOString(),
            engine: 'uvspeed-history-search-v' + VERSION,
            sources: results.length,
            topResults: weighted.slice(0, 10).map(function(w) {
                return { title: w.result.title, url: w.result.url, score: w.scores.total, source: w.result.source };
            }),
            suggestedFeatures: [],
            contentSections: [],
        };
        // Suggest features based on result types
        var hasMath = results.some(function(r) { return (r.snippet || '').match(/\d+\.\d+|equation|formula|theorem/i); });
        var hasMedia = results.some(function(r) { return (r.snippet || '').match(/video|image|audio|visual/i); });
        var hasData = results.some(function(r) { return (r.snippet || '').match(/data|dataset|csv|table|chart/i); });
        var hasTimeline = results.some(function(r) { return (r.snippet || '').match(/timeline|chronolog|history|century|era/i); });
        if (hasMath) spec.suggestedFeatures.push('calculator-panel');
        if (hasMedia) spec.suggestedFeatures.push('media-gallery');
        if (hasData) spec.suggestedFeatures.push('data-table-view');
        if (hasTimeline) spec.suggestedFeatures.push('timeline-visualization');
        spec.suggestedFeatures.push('search-integration', 'offline-cache', 'dark-light-theme');

        // Content sections from top results
        weighted.slice(0, 8).forEach(function(w) {
            spec.contentSections.push({
                heading: w.result.title || 'Section ' + w.rank,
                sourceUrl: w.result.url,
                relevanceScore: w.scores.total,
                type: w.result.source || 'web',
            });
        });
        return JSON.stringify(spec, null, 2);
    }

    if (type === 'suggestions') {
        var suggestions = [];
        var totalDepth = 0; var totalAuth = 0;
        weighted.forEach(function(w) { totalDepth += w.scores.depth; totalAuth += w.scores.authority; });
        var avgDepth = weighted.length ? totalDepth / weighted.length : 0;
        var avgAuth = weighted.length ? totalAuth / weighted.length : 0;

        if (avgDepth < 0.3) suggestions.push({ type: 'research', text: 'Low content depth — try more specific queries or academic sources (arXiv, PubChem)', priority: 'high' });
        if (avgAuth < 0.3) suggestions.push({ type: 'authority', text: 'Low source authority — consider cross-referencing with Wikipedia, arXiv, or peer-reviewed sources', priority: 'high' });
        if (weighted.length < 5) suggestions.push({ type: 'breadth', text: 'Few results — enable more connectors or broaden search terms', priority: 'medium' });
        if (weighted.length > 0 && weighted[0].scores.engagement < 0.1) suggestions.push({ type: 'engagement', text: 'No engagement data yet — click through results to build preference model', priority: 'low' });

        // App suggestions
        suggestions.push({ type: 'export', text: 'Generate a research paper from top ' + Math.min(15, weighted.length) + ' results', action: 'research-paper' });
        suggestions.push({ type: 'export', text: 'Create a PWA app spec for an app-maker tool', action: 'pwa-spec' });
        if (weighted.length >= 3) {
            suggestions.push({ type: 'layout', text: 'Try Board view to organize results spatially', action: 'board-view' });
            suggestions.push({ type: 'analysis', text: 'Run heatmap analysis to visualize engagement patterns', action: 'heatmap' });
        }
        return suggestions;
    }

    if (type === 'board-layout') {
        // Pinterest-style column assignment
        var columns = opts.columns || 3;
        var cols = [];
        for (var c = 0; c < columns; c++) cols.push({ items: [], height: 0 });
        weighted.forEach(function(w) {
            // Estimate card height based on content
            var h = 120 + (w.result.snippet ? Math.min(80, w.result.snippet.length / 3) : 0) +
                    (w.scores.total > 0.5 ? 30 : 0);
            // Place in shortest column
            var shortest = 0;
            for (var i = 1; i < cols.length; i++) { if (cols[i].height < cols[shortest].height) shortest = i; }
            cols[shortest].items.push({ weighted: w, estimatedHeight: h });
            cols[shortest].height += h + 10;
        });
        return { columns: cols, totalItems: weighted.length };
    }

    return null;
}

// Vision tracking: compute page element importance zones
function computeVisionZones(pageStructure) {
    if (!pageStructure) return [];
    var zones = [];
    var totalElements = (pageStructure.headings || []).length + (pageStructure.links || []).length +
                        (pageStructure.images || []).length + (pageStructure.forms || []).length;
    if (totalElements === 0) return zones;

    // Headings are high-importance zones
    (pageStructure.headings || []).forEach(function(h, idx) {
        zones.push({
            type: 'heading', text: h.text, level: h.level,
            importance: 1 - (h.level * 0.12),
            position: idx / Math.max(1, (pageStructure.headings || []).length),
            color: h.level <= 2 ? '#7c3aed' : h.level <= 4 ? '#22d3ee' : '#64748b',
        });
    });

    // Images are attention zones
    (pageStructure.images || []).forEach(function(img, idx) {
        zones.push({
            type: 'image', alt: img.alt, src: img.src,
            importance: 0.7,
            position: idx / Math.max(1, (pageStructure.images || []).length),
            color: '#f97316',
        });
    });

    // Links are navigation zones
    var linkImportance = Math.max(0.2, 1 - ((pageStructure.links || []).length / 100));
    (pageStructure.links || []).slice(0, 30).forEach(function(link, idx) {
        zones.push({
            type: 'link', text: link.text, href: link.href,
            importance: linkImportance * (link.text.length > 3 ? 1 : 0.5),
            position: idx / 30,
            color: '#34d399',
        });
    });

    // Forms are high-importance interaction zones
    (pageStructure.forms || []).forEach(function(f) {
        zones.push({
            type: 'form', action: f.action, inputs: f.inputCount,
            importance: 0.9,
            position: 0.5,
            color: '#fb7185',
        });
    });

    return zones.sort(function(a, b) { return b.importance - a.importance; });
}

// Draw a heatmap visualization on a canvas
function drawHeatmap(canvas, zones, opts) {
    if (!canvas || !canvas.getContext) return;
    opts = opts || {};
    var w = opts.width || canvas.parentElement.clientWidth || 300;
    var h = opts.height || 200;
    var dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Detect theme
    var isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
    ctx.fillStyle = isLight ? '#f0f2f5' : '#0a0f1a';
    ctx.fillRect(0, 0, w, h);

    if (!zones || zones.length === 0) {
        ctx.fillStyle = isLight ? '#656d76' : '#64748b';
        ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('No vision data', w / 2, h / 2);
        return;
    }

    // Draw zones as positioned circles with importance-based radius
    zones.forEach(function(z, idx) {
        var x = (z.position || 0.5) * w * 0.8 + w * 0.1;
        var y = (idx / zones.length) * h * 0.8 + h * 0.1;
        var r = Math.max(4, z.importance * 20);

        // Glow
        var grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
        grad.addColorStop(0, z.color + '60');
        grad.addColorStop(1, z.color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(x, y, r * 2.5, 0, Math.PI * 2); ctx.fill();

        // Core dot
        ctx.fillStyle = z.color;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

        // Label
        if (z.importance > 0.5 && z.text) {
            ctx.font = '8px sans-serif'; ctx.fillStyle = isLight ? '#1f2328' : '#e2e8f0'; ctx.textAlign = 'left';
            ctx.fillText((z.text || '').substring(0, 20), x + r + 3, y + 3);
        }
    });

    // Legend
    var legendY = h - 14;
    ctx.font = '9px monospace'; ctx.textAlign = 'left';
    var legendItems = [['heading', '#7c3aed'], ['image', '#f97316'], ['link', '#34d399'], ['form', '#fb7185']];
    var lx = 6;
    legendItems.forEach(function(li) {
        ctx.fillStyle = li[1]; ctx.fillRect(lx, legendY, 6, 6);
        ctx.fillStyle = isLight ? '#656d76' : '#64748b'; ctx.fillText(li[0], lx + 9, legendY + 6);
        lx += ctx.measureText(li[0]).width + 18;
    });
}


/* ══════════════════════════════════════════════════════
   KBATCH TRAINING BRIDGE (v2.2)
   ══════════════════════════════════════════════════════ */
var _kbatchData = { sessions: [], aggregates: null, biometrics: null };

function receiveKbatchTraining(data) {
    if (!data) return;
    if (data.sessions) _kbatchData.sessions = data.sessions;
    if (data.aggregates) _kbatchData.aggregates = data.aggregates;
    if (data.biometrics) _kbatchData.biometrics = data.biometrics;
}

function getKbatchData() { return _kbatchData; }

// Analyze keyboard patterns from training sessions
function analyzeKeyboardPatterns(sessions) {
    if (!sessions || sessions.length === 0) return null;
    var totalWpm = 0, totalAcc = 0, totalInterval = 0, totalVariance = 0;
    var drillCounts = {};
    var rhythmSignatures = [];
    sessions.forEach(function(s) {
        totalWpm += s.wpm || 0;
        totalAcc += s.accuracy || 0;
        totalInterval += s.avgKeyInterval || 0;
        totalVariance += s.rhythmVariance || 0;
        drillCounts[s.drill] = (drillCounts[s.drill] || 0) + 1;
        if (s.rhythmSignature) rhythmSignatures.push(s.rhythmSignature);
    });
    var n = sessions.length;
    // Rhythm pattern frequency analysis
    var patternFreq = {};
    rhythmSignatures.forEach(function(sig) {
        for (var i = 0; i < sig.length - 2; i++) {
            var tri = sig.substr(i, 3);
            patternFreq[tri] = (patternFreq[tri] || 0) + 1;
        }
    });
    var topPatterns = Object.entries(patternFreq).sort(function(a,b) { return b[1]-a[1]; }).slice(0, 10);
    // Typing style classification
    var avgInterval = totalInterval / n;
    var avgVariance = totalVariance / n;
    var style = 'steady';
    if (avgVariance > 100) style = 'bursty';
    else if (avgVariance > 50) style = 'rhythmic';
    else if (avgInterval < 100) style = 'rapid';
    // Biometric aggregates from Cisponju engine
    var totalTravel = 0, totalHomeRow = 0, totalCalories = 0, totalRsi = 0;
    var bioCount = 0;
    sessions.forEach(function(s) {
        if (s.travelMM !== undefined) { totalTravel += s.travelMM; bioCount++; }
        if (s.homeRowPct !== undefined) totalHomeRow += s.homeRowPct;
        if (s.calories !== undefined) totalCalories += s.calories;
        if (s.rsiRisk !== undefined) totalRsi += s.rsiRisk;
    });
    return {
        totalSessions: n,
        avgWpm: Math.round(totalWpm / n),
        avgAccuracy: Math.round(totalAcc / n),
        avgKeyInterval: Math.round(avgInterval),
        rhythmVariance: Math.round(avgVariance),
        typingStyle: style,
        drillDistribution: drillCounts,
        topRhythmPatterns: topPatterns,
        // Musical mapping — rhythm signatures mapped to tempo
        musicalTempo: avgInterval < 80 ? 'presto' : avgInterval < 120 ? 'allegro' : avgInterval < 180 ? 'moderato' : avgInterval < 250 ? 'andante' : 'adagio',
        // Dance mapping — variance mapped to movement style
        danceStyle: avgVariance > 100 ? 'breakdance' : avgVariance > 60 ? 'jazz' : avgVariance > 30 ? 'waltz' : 'ballet',
        // Cisponju biometric aggregates
        biometrics: bioCount > 0 ? {
            avgTravelMM: Math.round(totalTravel / bioCount),
            avgHomeRowPct: Math.round(totalHomeRow / bioCount),
            totalCalories: totalCalories,
            avgRsiRisk: Math.round(totalRsi / bioCount),
        } : null,
    };
}

// Generate content enriched with keyboard pattern data
function generatePatternReport(sessions, opts) {
    opts = opts || {};
    var analysis = analyzeKeyboardPatterns(sessions);
    if (!analysis) return '# No training data\n\nComplete some drills in KBatch to generate a pattern report.';
    var md = '# Keyboard Pattern Analysis Report\n\n';
    md += '**Generated:** ' + new Date().toISOString() + '  \n';
    md += '**Sessions:** ' + analysis.totalSessions + ' | **Avg WPM:** ' + analysis.avgWpm + ' | **Accuracy:** ' + analysis.avgAccuracy + '%\n\n';
    md += '## Typing Profile\n\n';
    md += '| Metric | Value |\n|---|---|\n';
    md += '| Style | ' + analysis.typingStyle + ' |\n';
    md += '| Avg Key Interval | ' + analysis.avgKeyInterval + 'ms |\n';
    md += '| Rhythm Variance | ' + analysis.rhythmVariance + 'ms |\n';
    md += '| Musical Tempo | ' + analysis.musicalTempo + ' |\n';
    md += '| Dance Style | ' + analysis.danceStyle + ' |\n\n';
    md += '## Drill Distribution\n\n';
    Object.entries(analysis.drillDistribution).forEach(function(e) {
        md += '- **' + e[0] + '**: ' + e[1] + ' sessions\n';
    });
    md += '\n## Top Rhythm Patterns\n\n';
    md += 'Pattern signatures: F=fast(<80ms) M=medium(80-150ms) S=slow(150-300ms) P=pause(>300ms)\n\n';
    if (analysis.topRhythmPatterns.length > 0) {
        md += '| Pattern | Frequency |\n|---|---|\n';
        analysis.topRhythmPatterns.forEach(function(p) {
            md += '| `' + p[0] + '` | ' + p[1] + ' |\n';
        });
    }
    md += '\n## Cross-Domain Mapping\n\n';
    md += 'Typing rhythm naturally maps to other pattern domains:\n\n';
    md += '- **Music**: Your typing tempo maps to *' + analysis.musicalTempo + '* — ';
    md += analysis.musicalTempo === 'presto' ? 'lightning fast, concert-level intensity' :
          analysis.musicalTempo === 'allegro' ? 'brisk and lively, energetic flow' :
          analysis.musicalTempo === 'moderato' ? 'balanced and measured, steady rhythm' :
          analysis.musicalTempo === 'andante' ? 'walking pace, thoughtful deliberation' :
          'slow and deliberate, each key placed with care';
    md += '\n- **Dance**: Your variance maps to *' + analysis.danceStyle + '* — ';
    md += analysis.danceStyle === 'breakdance' ? 'explosive bursts with dramatic pauses' :
          analysis.danceStyle === 'jazz' ? 'syncopated rhythm, creative improvisation' :
          analysis.danceStyle === 'waltz' ? 'graceful three-beat flow, elegant transitions' :
          'precise, controlled, classical technique';
    md += '\n\n---\n*Generated by uvspeed KBatch v4.19*\n';
    return md;
}

// Listen for kbatch training data via BroadcastChannel
if (typeof BroadcastChannel !== 'undefined') {
    try {
        var kbatchBC = new BroadcastChannel('kbatch-training');
        kbatchBC.onmessage = function(e) {
            if (e.data && e.data.type === 'training-data') {
                receiveKbatchTraining(e.data);
            }
            if (e.data && e.data.type === 'capsule-knowledge') {
                _kbatchData.capsuleKnowledge = e.data.payload;
            }
        };
    } catch(e) {}
}


/* ══════════════════════════════════════════════════════
   CROSS-LINGUISTIC INTELLIGENCE (v2.3)
   Phrase analysis, intent detection, context profiling
   ══════════════════════════════════════════════════════ */

// Tone / register detection patterns
var REGISTER_PATTERNS = {
    formal:   /\b(therefore|furthermore|consequently|moreover|nevertheless|notwithstanding|pursuant|herein|whereas|hereby)\b/i,
    academic: /\b(hypothesis|methodology|paradigm|empirical|correlation|synthesis|quantitative|qualitative|peer[\s-]review|longitudinal)\b/i,
    casual:   /\b(gonna|wanna|gotta|kinda|sorta|lol|btw|imo|tbh|ngl|fr|lowkey|highkey|vibe|slay|lit)\b/i,
    medical:  /\b(diagnosis|symptom|treatment|chronic|acute|prescription|prognosis|triage|hemorrhage|anesthesia)\b/i,
    legal:    /\b(plaintiff|defendant|jurisdiction|statute|liability|indemnify|arbitration|tort|counsel|deposition)\b/i,
    tech:     /\b(API|frontend|backend|deployment|containerization|microservice|CI\/CD|kubernetes|docker|serverless)\b/i,
    news:     /\b(breaking|alleged|unprecedented|bipartisan|according to|sources say|developing story|confirmed|unverified)\b/i,
    survival: /\b(shelter|evacuate|emergency|first aid|tourniquet|dehydration|hypothermia|rations|signal|rescue)\b/i,
    ancient:  /\b(pharaoh|hieroglyph|cuneiform|papyrus|stele|dharma|karma|yoga|sutra|veda|logos|polis|agora|futhark|rune|wyrd|codex|manuscript)\b/i,
    encoding: /\b(0x[0-9A-Fa-f]+|U\+[0-9A-F]{4}|base64|ASCII|UTF-8|UTF-16|unicode|hexadecimal|binary|octal)\b/i,
    access:   /\b(braille|ASL|sign language|morse code|fingerspelling|deaf|accessibility|screen reader|tactile|semaphore)\b/i,
    code:     /\b(function|class|import|return|const|let|var|async|await|struct|enum|impl|SELECT|FROM|WHERE|def|lambda)\b/i,
};

// Age-register intonation markers
var AGE_MARKERS = {
    child:  /\b(mommy|daddy|yummy|owie|potty|boo-boo|puppy|kitty|blankie|nap|story|play|candy)\b/i,
    teen:   /\b(cringe|vibe|slay|no cap|bussin|sus|based|stan|simp|rizz|flex|ratio|w\/|bruh|fr fr|lowkey)\b/i,
    young_adult: /\b(hustle|grind|mindset|networking|startup|side gig|remote work|portfolio|branding|linkedin)\b/i,
    mature: /\b(mortgage|retirement|portfolio|estate|annuity|beneficiary|fiduciary|pension|401k|equity)\b/i,
};

// Regional dialect/variant markers
var REGIONAL_MARKERS = {
    american: /\b(sidewalk|apartment|cookie|gas|truck|elevator|fall|soccer|gotten|faucet)\b/i,
    british:  /\b(pavement|flat|biscuit|petrol|lorry|lift|autumn|football|colour|favour)\b/i,
    australian: /\b(arvo|barbie|brekkie|chunder|crikey|dunny|esky|mozzie|servo|thongs)\b/i,
    indian_english: /\b(prepone|revert back|do the needful|kindly|good name|only na|itself)\b/i,
};

function analyzeTextIntelligence(text) {
    if (!text || text.length < 3) return null;
    var result = {
        registers: [],
        ageRegister: 'general',
        regionalVariant: 'neutral',
        intentSignals: [],
        sentimentLean: 'neutral',
        complexity: 0,
        readingLevel: 'general',
        phrasePatterns: [],
    };
    // Register detection
    Object.entries(REGISTER_PATTERNS).forEach(function(e) {
        var matches = text.match(e[1]);
        if (matches) result.registers.push({ type: e[0], strength: matches.length });
    });
    // Age register
    Object.entries(AGE_MARKERS).forEach(function(e) {
        if (e[1].test(text)) result.ageRegister = e[0];
    });
    // Regional variant
    Object.entries(REGIONAL_MARKERS).forEach(function(e) {
        if (e[1].test(text)) result.regionalVariant = e[0];
    });
    // Intent signals
    if (/\?/.test(text)) result.intentSignals.push('questioning');
    if (/!/.test(text)) result.intentSignals.push('emphatic');
    if (/\b(how to|steps to|guide|tutorial|learn)\b/i.test(text)) result.intentSignals.push('learning');
    if (/\b(buy|price|cost|deal|discount|sale|order)\b/i.test(text)) result.intentSignals.push('commercial');
    if (/\b(help|emergency|urgent|need|please|save)\b/i.test(text)) result.intentSignals.push('assistance');
    if (/\b(compare|versus|vs|difference|better|worse)\b/i.test(text)) result.intentSignals.push('comparative');
    if (/\b(opinion|think|feel|believe|should|must)\b/i.test(text)) result.intentSignals.push('opinion');
    if (/\b(data|research|study|evidence|statistics|analysis)\b/i.test(text)) result.intentSignals.push('research');
    // Sentiment lean
    var posWords = (text.match(/\b(good|great|excellent|amazing|wonderful|love|best|fantastic|brilliant|outstanding|beautiful|perfect|hope|progress|success)\b/gi) || []).length;
    var negWords = (text.match(/\b(bad|terrible|horrible|awful|worst|hate|poor|disaster|failure|crisis|problem|danger|threat|collapse|corrupt)\b/gi) || []).length;
    if (posWords > negWords + 1) result.sentimentLean = 'positive';
    else if (negWords > posWords + 1) result.sentimentLean = 'negative';
    else if (posWords > 0 && negWords > 0) result.sentimentLean = 'mixed';
    // Complexity (Flesch-Kincaid proxy)
    var words = text.split(/\s+/).filter(function(w) { return w.length > 0; });
    var sentences = text.split(/[.!?]+/).filter(function(s) { return s.trim().length > 0; });
    var avgWordLen = words.reduce(function(s,w) { return s + w.length; }, 0) / Math.max(words.length, 1);
    var avgSentLen = words.length / Math.max(sentences.length, 1);
    result.complexity = Math.min(100, Math.round(avgWordLen * 8 + avgSentLen * 2));
    if (result.complexity > 70) result.readingLevel = 'advanced';
    else if (result.complexity > 45) result.readingLevel = 'intermediate';
    else result.readingLevel = 'basic';
    // Phrase pattern extraction (common n-grams)
    var bigrams = {};
    for (var i = 0; i < words.length - 1; i++) {
        var bi = words[i].toLowerCase() + ' ' + words[i+1].toLowerCase();
        bigrams[bi] = (bigrams[bi] || 0) + 1;
    }
    result.phrasePatterns = Object.entries(bigrams).sort(function(a,b) { return b[1]-a[1]; }).slice(0,10).map(function(e) { return { phrase: e[0], count: e[1] }; });
    return result;
}

// Cross-reference text against capsule knowledge base
function crossReferenceCapsules(text, capsuleData) {
    if (!text || !capsuleData) return [];
    var lowerText = text.toLowerCase();
    var matches = [];
    capsuleData.forEach(function(cap) {
        var found = [];
        cap.words.forEach(function(w) {
            if (lowerText.includes(w.toLowerCase())) found.push(w);
        });
        if (found.length > 0) {
            matches.push({ capsule: cap.id, name: cap.name, cat: cap.cat, matchCount: found.length, matchedWords: found.slice(0, 10), coverage: found.length / cap.words.length });
        }
    });
    matches.sort(function(a,b) { return b.matchCount - a.matchCount; });
    return matches.slice(0, 10);
}

function inferCapsuleLanguage(cap) {
    var meta = (cap && cap.meta && typeof cap.meta === 'object') ? cap.meta : {};
    var id = String(cap && cap.id || '');
    var toks = id.split('.');
    var lang = String(meta.language || meta.lang || meta.primary_language || meta.iso639_3 || meta.iso639_1 || meta.iso || '').toLowerCase();
    var iso1 = String(meta.iso639_1 || meta.iso || '').toLowerCase();
    var iso3 = String(meta.iso639_3 || '').toLowerCase();
    if (!lang && toks[0] === 'caps' && toks[1] === 'lang' && toks[2]) {
        lang = String(toks[2]).toLowerCase();
        if (lang === 'iso6391' && toks[3]) iso1 = String(toks[3]).toLowerCase();
        if (lang === 'iso6393' && toks[3]) iso3 = String(toks[3]).toLowerCase();
    }
    if (!lang) lang = 'unknown';
    return {
        key: lang,
        iso639_1: iso1 || null,
        iso639_3: iso3 || null,
        region: String(meta.region || meta.country || meta.parent_region || '').toLowerCase() || null,
        family: String(meta.family || meta.language_family || meta.parent_family || '').toLowerCase() || null
    };
}

function lineageTokens(input) {
    var src = String(input || '').trim().toLowerCase();
    if (!src) return [];
    return src.match(/[a-z0-9_+#.\-']+/g) || [];
}

function extractHistoricalSignals(cap) {
    var meta = (cap && cap.meta && typeof cap.meta === 'object') ? cap.meta : {};
    var signals = [];
    var keys = Object.keys(meta);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (!/(etym|origin|history|era|century|root|derived|ancestor|proto|family|branch|authority|source|timeline)/i.test(k)) continue;
        var v = meta[k];
        if (typeof v === 'string' && v.trim()) signals.push({ key: k, value: v.slice(0, 200) });
        else if (Array.isArray(v) && v.length) signals.push({ key: k, value: v.slice(0, 12) });
        else if (v && typeof v === 'object') signals.push({ key: k, value: v });
    }
    if (Array.isArray(meta.authority_refs) && meta.authority_refs.length) {
        signals.push({ key: 'authority_refs', value: meta.authority_refs.slice(0, 24) });
    }
    return signals;
}

function matchCapsuleAgainstTokens(cap, tokens, fullText) {
    var words = Array.isArray(cap && cap.words) ? cap.words : [];
    var text = [
        cap && cap.id || '',
        cap && cap.name || '',
        cap && cap.cat || '',
        cap && cap.desc || '',
        words.join(' '),
        JSON.stringify((cap && cap.meta) || {})
    ].join(' ').toLowerCase();

    var exact = [];
    var partial = [];
    for (var i = 0; i < tokens.length; i++) {
        var t = tokens[i];
        if (!t) continue;
        var hasExact = false;
        for (var w = 0; w < words.length; w++) {
            if (String(words[w] || '').toLowerCase() === t) { hasExact = true; break; }
        }
        if (hasExact) exact.push(t);
        else if (text.indexOf(t) >= 0) partial.push(t);
    }
    var phraseHit = fullText && text.indexOf(fullText) >= 0;
    var score = exact.length * 5 + partial.length * 2 + (phraseHit ? 4 : 0);
    return {
        score: score,
        exact: exact,
        partial: partial,
        phrase_hit: !!phraseHit
    };
}

function quantumSymToContrail(sym) {
    var map = {
        'n:': '→',
        '+1:': '⊤',
        '-n:': '←',
        '+0:': '⊞',
        '0:': '○',
        '-1:': '⊥',
        '+n:': '◇',
        '+2:': '∀',
        '-0:': '→',
        '+3:': '⊙',
        '1:': '□',
        ' ': '·'
    };
    return map[String(sym || '').trim()] || '·';
}

function reduceToContrailShorthand(input, opts) {
    var tokens = lineageTokens(input);
    var maxTokens = Math.max(1, Number(opts && opts.maxTokens || 128));
    var capAnalyzer = (typeof window !== 'undefined' && window.CapsuleAnalyzer) ? window.CapsuleAnalyzer : null;
    var rows = [];
    for (var i = 0; i < tokens.length && rows.length < maxTokens; i++) {
        var tok = tokens[i];
        var lookup = null;
        try {
            lookup = capAnalyzer && capAnalyzer.lookupWord ? capAnalyzer.lookupWord(tok) : null;
        } catch (_) {}
        var a = lookup && lookup.analysis && typeof lookup.analysis === 'object' ? lookup.analysis : null;
        var qsym = String(a && a.quantumSym || '');
        var contrail = qsym ? quantumSymToContrail(qsym) : (tok.length <= 3 ? '□' : tok.length <= 6 ? '◇' : '○');
        rows.push({
            token: tok,
            contrail: contrail,
            quantum_sym: qsym || null,
            gate: String(a && a.quantumGate || '') || null,
            concept_symbols: String(a && a.conceptSymbols || '') || null,
            flow_arrows: String(a && a.flowArrows || '') || null,
            bloch_z: safeNum(a && a.quantumCoord && a.quantumCoord[2], 0)
        });
    }
    var shorthand = rows.map(function(r) { return r.contrail; }).join('');
    var confidence = rows.length ? Number((rows.filter(function(r) { return !!r.quantum_sym; }).length / rows.length * 100).toFixed(2)) : 0;
    return {
        ok: true,
        schema: 'history.contrail-reduction.v1',
        input: String(input || ''),
        token_count: rows.length,
        shorthand: shorthand,
        confidence_pct: confidence,
        lanes: rows
    };
}

function wordMetricsFilterCatalog() {
    return [
        { order: 1, id: 'in_capsule_only', type: 'boolean', path: 'in_capsule', description: 'Keep only words mapped to a capsule.' },
        { order: 2, id: 'capsule_id', type: 'string', path: 'capsule.id', description: 'Match a specific capsule id.' },
        { order: 3, id: 'category', type: 'string', path: 'capsule.category', description: 'Match capsule category.' },
        { order: 4, id: 'min_count', type: 'number', path: 'count', description: 'Minimum token frequency.' },
        { order: 5, id: 'min_efficiency', type: 'number', path: 'metrics.efficiency', description: 'Minimum keyboard efficiency score.' },
        { order: 6, id: 'max_rsi_risk', type: 'number', path: 'metrics.rsiRisk', description: 'Maximum RSI risk threshold.' },
        { order: 7, id: 'quantum_gate', type: 'string', path: 'metrics.quantumGate', description: 'Filter by quantum gate.' },
        { order: 8, id: 'register_tag', type: 'string', path: 'register_tags[]', description: 'Filter by detected register tag.' },
        { order: 9, id: 'sentiment_tag', type: 'string', path: 'sentiment_tag', description: 'positive|negative|neutral' },
        { order: 10, id: 'contains', type: 'string', path: 'word', description: 'Substring match in token.' },
        { order: 11, id: 'min_bpm', type: 'number', path: 'keyboard.beats_rhythm.bpm', description: 'Minimum rhythm BPM.' },
        { order: 12, id: 'max_bpm', type: 'number', path: 'keyboard.beats_rhythm.bpm', description: 'Maximum rhythm BPM.' },
        { order: 13, id: 'min_bloch_z', type: 'number', path: 'quantum.bloch.vector.z', description: 'Minimum Bloch Z component.' },
        { order: 14, id: 'max_bloch_z', type: 'number', path: 'quantum.bloch.vector.z', description: 'Maximum Bloch Z component.' },
        { order: 15, id: 'contrail_contains', type: 'string', path: 'keyboard.contrails.path', description: 'Substring match in contrail path.' },
        { order: 16, id: 'min_imitation_weight', type: 'number', path: 'style_learning.imitation_weight', description: 'Minimum style imitation weight.' },
        { order: 17, id: 'style_role', type: 'string', path: 'style_learning.style_role', description: 'Filter by style role.' },
        { order: 18, id: 'min_persona_alignment', type: 'number', path: 'persona_mapping.alignment_score', description: 'Minimum persona alignment score.' },
        { order: 19, id: 'sort_by', type: 'enum', path: 'query', description: 'context_weight|count|efficiency|rsi_risk|bpm|bloch_z|imitation_weight' },
        { order: 20, id: 'desc', type: 'boolean', path: 'query', description: 'Sort descending when true.' },
        { order: 21, id: 'limit', type: 'number', path: 'query', description: 'Maximum rows returned.' }
    ];
}

function lineageFilterCatalog() {
    return [
        { order: 1, id: 'language', type: 'string', path: 'lineage.branches[].language', description: 'Keep branch language match.' },
        { order: 2, id: 'iso', type: 'string', path: 'lineage.branches[].iso639_1|iso639_3', description: 'Match ISO code.' },
        { order: 3, id: 'family', type: 'string', path: 'lineage.branches[].family', description: 'Match language family.' },
        { order: 4, id: 'region', type: 'string', path: 'lineage.branches[].region', description: 'Match region/country field.' },
        { order: 5, id: 'min_branch_score', type: 'number', path: 'lineage.branches[].branch_score', description: 'Minimum branch score.' },
        { order: 6, id: 'token_contains', type: 'string', path: 'lineage.branches[].capsules[].exact_tokens|partial_tokens', description: 'Token contained in branch capsule hits.' },
        { order: 7, id: 'major_use_category', type: 'string', path: 'lineage.major_uses[].category', description: 'Filter major uses by category.' },
        { order: 8, id: 'history_signal_key', type: 'string', path: 'lineage.historical_ties[].signal_key', description: 'Filter by historical signal key.' },
        { order: 9, id: 'sort_by', type: 'enum', path: 'query', description: 'branch_score|exact_hits|partial_hits' },
        { order: 10, id: 'desc', type: 'boolean', path: 'query', description: 'Sort descending when true.' },
        { order: 11, id: 'limit', type: 'number', path: 'query', description: 'Maximum branches returned.' }
    ];
}

function buildLineageLiftRows(branches, limit) {
    var rows = [];
    var lim = Math.max(1, Number(limit || 500));
    for (var i = 0; i < branches.length; i++) {
        var b = branches[i] || {};
        var caps = Array.isArray(b.capsules) ? b.capsules : [];
        for (var j = 0; j < caps.length; j++) {
            var c = caps[j] || {};
            rows.push({
                language: b.language || 'unknown',
                iso639_1: b.iso639_1 || null,
                iso639_3: b.iso639_3 || null,
                family: b.family || null,
                region: b.region || null,
                branch_score: safeNum(b.branch_score, 0),
                capsule_id: c.capsule_id || '',
                capsule_category: c.category || '',
                capsule_score: safeNum(c.score, 0),
                exact_tokens: Array.isArray(c.exact_tokens) ? c.exact_tokens : [],
                partial_tokens: Array.isArray(c.partial_tokens) ? c.partial_tokens : [],
                phrase_hit: !!c.phrase_hit
            });
            if (rows.length >= lim) return rows;
        }
    }
    return rows;
}

function queryCrossLanguageLineage(lineage, filters) {
    var src = lineage && lineage.lineage && Array.isArray(lineage.lineage.branches) ? lineage.lineage.branches.slice() : [];
    var f = filters && typeof filters === 'object' ? filters : {};
    var out = src.filter(function(b) {
        if (f.language && String(b.language || '') !== String(f.language)) return false;
        if (f.iso && String(b.iso639_1 || b.iso639_3 || '') !== String(f.iso)) return false;
        if (f.family && String(b.family || '') !== String(f.family)) return false;
        if (f.region && String(b.region || '') !== String(f.region)) return false;
        if (Number.isFinite(Number(f.min_branch_score)) && safeNum(b.branch_score, 0) < Number(f.min_branch_score)) return false;
        if (f.token_contains) {
            var tok = String(f.token_contains).toLowerCase();
            var caps = Array.isArray(b.capsules) ? b.capsules : [];
            var hit = caps.some(function(c) {
                var ex = Array.isArray(c.exact_tokens) ? c.exact_tokens : [];
                var pa = Array.isArray(c.partial_tokens) ? c.partial_tokens : [];
                return ex.concat(pa).some(function(t) { return String(t || '').toLowerCase().indexOf(tok) >= 0; });
            });
            if (!hit) return false;
        }
        return true;
    });
    var sortBy = String(f.sort_by || 'branch_score');
    var desc = f.desc !== false;
    out.sort(function(a, b) {
        var av = 0, bv = 0;
        if (sortBy === 'exact_hits') { av = safeNum(a.exact_hits, 0); bv = safeNum(b.exact_hits, 0); }
        else if (sortBy === 'partial_hits') { av = safeNum(a.partial_hits, 0); bv = safeNum(b.partial_hits, 0); }
        else { av = safeNum(a.branch_score, 0); bv = safeNum(b.branch_score, 0); }
        return desc ? (bv - av) : (av - bv);
    });
    var limit = Math.max(1, Number(f.limit || 200));
    if (out.length > limit) out = out.slice(0, limit);
    return {
        ok: true,
        schema: 'history.cross-language-lineage.query.v1',
        count: out.length,
        filters: f,
        rows: out,
        lift_rows: buildLineageLiftRows(out, Math.max(limit * 20, 500))
    };
}

function crossLanguageLineage(input, opts) {
    var src = String(input || '').trim();
    var tokens = lineageTokens(src);
    var fullText = src.toLowerCase();
    var capsuleData = (_kbatchData && Array.isArray(_kbatchData.capsuleKnowledge)) ? _kbatchData.capsuleKnowledge : [];
    var maxCaps = Math.max(1, Number(opts && opts.maxCapsules || 10000));
    var matches = [];
    var branches = {};

    for (var i = 0; i < capsuleData.length && i < maxCaps; i++) {
        var cap = capsuleData[i] || {};
        var m = matchCapsuleAgainstTokens(cap, tokens, fullText);
        if (m.score <= 0) continue;
        var lang = inferCapsuleLanguage(cap);
        var key = lang.key + '|' + (lang.iso639_1 || '') + '|' + (lang.iso639_3 || '');
        if (!branches[key]) {
            branches[key] = {
                language: lang.key,
                iso639_1: lang.iso639_1,
                iso639_3: lang.iso639_3,
                region: lang.region,
                family: lang.family,
                capsules: [],
                branch_score: 0,
                exact_hits: 0,
                partial_hits: 0
            };
        }
        var hist = extractHistoricalSignals(cap);
        var row = {
            capsule_id: String(cap.id || ''),
            name: String(cap.name || ''),
            category: String(cap.cat || ''),
            desc: String(cap.desc || ''),
            score: m.score,
            exact_tokens: m.exact,
            partial_tokens: m.partial,
            phrase_hit: m.phrase_hit,
            matched_words_preview: Array.isArray(cap.words) ? cap.words.filter(function(w) {
                var lw = String(w || '').toLowerCase();
                return tokens.some(function(t) { return lw.indexOf(t) >= 0; });
            }).slice(0, 16) : [],
            historical_signals: hist
        };
        branches[key].capsules.push(row);
        branches[key].branch_score += m.score;
        branches[key].exact_hits += m.exact.length;
        branches[key].partial_hits += m.partial.length;
        matches.push(Object.assign({ language_key: key }, row));
    }

    var branchList = Object.keys(branches).map(function(k) {
        var b = branches[k];
        b.capsules.sort(function(a, z) { return z.score - a.score; });
        b.capsules = b.capsules.slice(0, Math.max(1, Number(opts && opts.perBranchCapsules || 20)));
        return b;
    }).sort(function(a, b) { return b.branch_score - a.branch_score; });

    var majorUses = matches
        .filter(function(r) { return /research|history|ancient|culture|lang|education/i.test(String(r.category || '')); })
        .sort(function(a, b) { return b.score - a.score; })
        .slice(0, Math.max(1, Number(opts && opts.majorUses || 30)));

    var allSignals = [];
    for (var j = 0; j < matches.length; j++) {
        var hs = matches[j].historical_signals || [];
        for (var h = 0; h < hs.length; h++) {
            allSignals.push({
                capsule_id: matches[j].capsule_id,
                category: matches[j].category,
                signal_key: hs[h].key,
                signal_value: hs[h].value
            });
        }
    }
    allSignals = allSignals.slice(0, Math.max(1, Number(opts && opts.historySignals || 160)));

    var segmentation = {
        token_segments: tokens.map(function(t) {
            return {
                token: t,
                length: t.length,
                has_diacritic: /[^a-z0-9_+#.\-']/i.test(t),
                shape: t.replace(/[aeiou]/g, 'V').replace(/[^aeiou]/g, 'C').slice(0, 16)
            };
        }),
        branch_factor: branchList.length,
        total_matches: matches.length,
        languages_seen: Array.from(new Set(branchList.map(function(b) { return b.language; })))
    };

    var reducer = reduceToContrailShorthand(src, opts || {});
    var liftRows = buildLineageLiftRows(branchList, Math.max(1, Number(opts && opts.liftRows || 1000)));
    return {
        ok: true,
        schema: 'history.cross-language-lineage.v1',
        query: src,
        mode: (opts && opts.mode) || 'auto',
        token_count: tokens.length,
        branch_count: branchList.length,
        lineage: {
            branches: branchList,
            major_uses: majorUses,
            historical_ties: allSignals,
            segmentation: segmentation
        },
        schema_contract: {
            points_order: ['query', 'lineage.branches', 'lineage.major_uses', 'lineage.historical_ties', 'lineage.segmentation', 'contrail_reduction', 'lift_rows'],
            branch_fields_order: ['language', 'iso639_1', 'iso639_3', 'region', 'family', 'branch_score', 'exact_hits', 'partial_hits', 'capsules'],
            capsule_fields_order: ['capsule_id', 'name', 'category', 'desc', 'score', 'exact_tokens', 'partial_tokens', 'phrase_hit', 'matched_words_preview', 'historical_signals'],
            lift_fields_order: ['language', 'iso639_1', 'iso639_3', 'family', 'region', 'branch_score', 'capsule_id', 'capsule_category', 'capsule_score', 'exact_tokens', 'partial_tokens', 'phrase_hit'],
            filter_catalog: lineageFilterCatalog()
        },
        lift_rows: liftRows,
        contrail_reduction: reducer,
        notes: [
            'Lineage is capsule/metadata-driven and grows as capsuleKnowledge expands.',
            'Use historical_signals + authority_refs for creation/branching narratives.',
            'Use contrail_reduction lanes to incrementally compress terms into shorthand.'
        ]
    };
}

// AI-ready context profile for any text input
/* ══════════════════════════════════════════════════════
   TRANSCRIPT BATCH ANALYZER
   Fetches YouTube transcript via bridge → runs Universal Encoder
   on every line → produces flow/rhythm/music/concept analysis
   ══════════════════════════════════════════════════════ */
var BRIDGE_URL = 'http://localhost:8085';

async function fetchTranscript(urlOrId) {
    var url = urlOrId;
    if (!url.startsWith('http')) url = 'https://www.youtube.com/watch?v=' + urlOrId;
    try {
        var resp = await fetch(BRIDGE_URL + '/api/day/youtube', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url }),
        });
        var data = await resp.json();
        return { url: url, transcript: data.transcript || '', error: data.error || null, exitCode: data.exit_code };
    } catch(e) {
        return { url: url, transcript: '', error: 'Bridge not running at ' + BRIDGE_URL + ': ' + e.message, exitCode: -1 };
    }
}

function analyzeTranscript(transcript) {
    if (!transcript || transcript.length < 10) return null;
    var lines = transcript.split('\n').filter(function(l) { return l.trim().length > 0; });
    var Enc = typeof window !== 'undefined' ? window.Encoder : null;
    var Steno = typeof window !== 'undefined' ? window.StenoEngine : null;
    var CapsAn = typeof window !== 'undefined' ? window.CapsuleAnalyzer : null;

    // Per-line analysis
    var analyzed = lines.map(function(line, idx) {
        var entry = { line: idx, text: line, wordCount: line.split(/\s+/).length };

        // Universal Encoder: flow, rhythm, music, cadence
        if (Enc) {
            try {
                var flow = Enc.toKeyboardFlow(line);
                entry.flowArrows = flow ? flow.arrows : '';
                entry.flowPattern = flow ? flow.pattern : '';
                entry.danceNotation = Enc.toDanceMoves(line);
                entry.wandNotation = Enc.toWandMoves(line);
                entry.musicalNotes = Enc.toMusicNotation(line);
                var rhythm = Enc.toRhythm(line);
                if (rhythm) {
                    entry.beats = rhythm.beats;
                    entry.timeSig = rhythm.timeSig;
                    entry.bpm = rhythm.bpm;
                }
                var inton = Enc.toIntonation(line);
                if (inton) {
                    entry.intonation = inton.pattern;
                    entry.cadence = inton.cadence;
                    entry.syllables = inton.totalSyllables;
                    entry.isChant = inton.isChant;
                    entry.musicalScale = inton.musicalScale;
                }
            } catch(e) {}
        }

        // StenoEngine: concept compression
        if (Steno) {
            try {
                var comp = Steno.compressSentence(line);
                entry.conceptSymbols = comp.compressed;
                entry.compressionRatio = comp.ratio;
                entry.conceptAtoms = comp.atoms;
                var sig = Steno.frequencySignature(line);
                if (sig) {
                    entry.dominantFreq = sig.dominant.freq;
                    entry.harmonicComplexity = sig.harmonicComplexity;
                }
                var flow2 = Steno.conceptFlow(line);
                if (flow2) {
                    entry.conceptFlowDir = flow2.flowDirection;
                    entry.chargeFlow = flow2.chargeFlow;
                }
            } catch(e) {}
        }

        // CapsuleAnalyzer: word-level ergonomic benchmark
        if (CapsAn) {
            try {
                var words = line.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 2; });
                var analyses = words.slice(0, 20).map(function(w) { return CapsAn.lookupWord(w); });
                var inCapsule = analyses.filter(function(a) { return a.capsule; }).length;
                entry.capsulePct = Math.round(inCapsule / Math.max(analyses.length, 1) * 100);
                entry.avgEfficiency = Math.round(analyses.reduce(function(s,a) { return s + (a.analysis.efficiency || 0); }, 0) / Math.max(analyses.length, 1));
                entry.avgRsiRisk = Math.round(analyses.reduce(function(s,a) { return s + (a.analysis.rsiRisk || 0); }, 0) / Math.max(analyses.length, 1));
            } catch(e) {}
        }

        return entry;
    });

    // Aggregate stats across full transcript
    var totalWords = analyzed.reduce(function(s,a) { return s + a.wordCount; }, 0);
    var avgBpm = analyzed.filter(function(a) { return a.bpm; }).reduce(function(s,a) { return s + a.bpm; }, 0) / Math.max(analyzed.filter(function(a) { return a.bpm; }).length, 1);
    var avgCompression = analyzed.filter(function(a) { return a.compressionRatio; }).reduce(function(s,a) { return s + a.compressionRatio; }, 0) / Math.max(analyzed.filter(function(a) { return a.compressionRatio; }).length, 1);
    var chantLines = analyzed.filter(function(a) { return a.isChant; }).length;

    // Cadence distribution
    var cadenceDist = {};
    analyzed.forEach(function(a) { if (a.cadence) cadenceDist[a.cadence] = (cadenceDist[a.cadence] || 0) + 1; });

    // Concept flow direction distribution
    var flowDist = {};
    analyzed.forEach(function(a) { if (a.conceptFlowDir) flowDist[a.conceptFlowDir] = (flowDist[a.conceptFlowDir] || 0) + 1; });

    // Dominant frequencies across transcript
    var freqDist = {};
    analyzed.forEach(function(a) { if (a.dominantFreq) freqDist[a.dominantFreq] = (freqDist[a.dominantFreq] || 0) + 1; });

    // All concept atoms flattened
    var allAtoms = [];
    analyzed.forEach(function(a) { if (a.conceptAtoms) allAtoms = allAtoms.concat(a.conceptAtoms); });
    var atomCounts = {};
    allAtoms.forEach(function(a) { atomCounts[a] = (atomCounts[a] || 0) + 1; });
    var topAtoms = Object.entries(atomCounts).sort(function(a,b) { return b[1] - a[1]; }).slice(0, 15);

    return {
        lineCount: lines.length,
        totalWords: totalWords,
        avgBpm: Math.round(avgBpm),
        avgCompression: Math.round(avgCompression * 10) / 10,
        chantLines: chantLines,
        cadenceDistribution: cadenceDist,
        conceptFlowDistribution: flowDist,
        dominantFrequencies: freqDist,
        topConceptAtoms: topAtoms,
        lines: analyzed,
        // Full context profile of entire transcript text
        contextProfile: null,  // caller can fill with buildContextProfile()
    };
}

async function analyzeYouTubeVideo(urlOrId) {
    var t = await fetchTranscript(urlOrId);
    if (t.error && !t.transcript) return { error: t.error, url: t.url };
    var analysis = analyzeTranscript(t.transcript);
    if (analysis) {
        analysis.url = t.url;
        analysis.contextProfile = buildContextProfile(t.transcript);
    }
    return analysis;
}

function buildContextProfile(text, opts) {
    var intel = analyzeTextIntelligence(text);
    if (!intel) return null;
    var capsuleRefs = _kbatchData.capsuleKnowledge ? crossReferenceCapsules(text, _kbatchData.capsuleKnowledge) : [];
    // Pull cache intelligence if available (from kbatch CacheIntel)
    var cacheInsights = null;
    if (typeof window !== 'undefined' && window.CacheIntel) {
        var words = text.split(/\s+/).filter(function(w) { return w.length > 2; });
        var known = 0, totalRelevance = 0, totalDifficulty = 0, gates = {};
        words.forEach(function(w) {
            var entry = window.CacheIntel.getEntry(w.toLowerCase());
            if (entry && entry.hitCount > 0) {
                known++;
                totalRelevance += entry.relevance;
                totalDifficulty += entry.difficulty;
                if (entry.quantumGate) gates[entry.quantumGate] = (gates[entry.quantumGate] || 0) + 1;
            }
        });
        if (known > 0) {
            cacheInsights = {
                knownWords: known,
                totalWords: words.length,
                knownPct: Math.round(known / words.length * 100),
                avgRelevance: Math.round(totalRelevance / known),
                avgDifficulty: Math.round(totalDifficulty / known),
                quantumGateDistribution: gates,
                cacheSize: window.CacheIntel.getSize(),
            };
        }
    }
    // Persona context (from kbatch PersonaContext engine)
    var personaAnalysis = null;
    if (typeof window !== 'undefined' && window.PersonaContext) {
        personaAnalysis = window.PersonaContext.analyzeFullContext(text);
    }
    // Capsule benchmark data (from CapsuleAnalyzer)
    var capsuleBenchmark = null;
    if (typeof window !== 'undefined' && window.CapsuleAnalyzer) {
        try {
            var words = text.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 2; });
            var analyzed = words.slice(0, 50).map(function(w) { return window.CapsuleAnalyzer.lookupWord(w); });
            var inCapsule = analyzed.filter(function(a) { return a.capsule; }).length;
            var avgEff = analyzed.reduce(function(s, a) { return s + (a.analysis.efficiency || 0); }, 0) / Math.max(analyzed.length, 1);
            var avgRsi = analyzed.reduce(function(s, a) { return s + (a.analysis.rsiRisk || 0); }, 0) / Math.max(analyzed.length, 1);
            capsuleBenchmark = {
                wordsAnalyzed: analyzed.length,
                inCapsulePct: Math.round(inCapsule / Math.max(analyzed.length, 1) * 100),
                avgEfficiency: Math.round(avgEff * 10) / 10,
                avgRsiRisk: Math.round(avgRsi * 10) / 10,
            };
        } catch(e) {}
    }
    var out = {
        intelligence: intel,
        capsuleMatches: capsuleRefs,
        cacheInsights: cacheInsights,
        personaContext: personaAnalysis,
        capsuleBenchmark: capsuleBenchmark,
        stenoCompression: (typeof window !== 'undefined' && window.StenoEngine) ? window.StenoEngine.compressSentence(text) : null,
        timestamp: Date.now(),
        wordCount: text.split(/\s+/).length,
        charCount: text.length,
        recommendations: generateContextRecommendations(intel, capsuleRefs, personaAnalysis),
    };
    if (opts && opts.includeWordMetrics) {
        out.wordMetrics = buildWordMetricsSchema(text, (opts && opts.wordMetrics) || {});
        if (opts.wordFilters) {
            out.wordMetricsFiltered = queryWordMetrics(out.wordMetrics, opts.wordFilters);
        }
    }
    return out;
}

function generateContextRecommendations(intel, capsuleMatches, personaCtx) {
    var recs = [];
    // Persona-driven recommendations (highest priority)
    if (personaCtx) {
        if (personaCtx.therapeutic && personaCtx.therapeutic.isCrisis) {
            recs.push({ type: 'CRISIS', msg: '\uD83D\uDEA8 Crisis detected \u2014 988 Suicide & Crisis Lifeline (call/text 988) | Crisis Text Line (text HOME to 741741)' });
        }
        if (personaCtx.financial && personaCtx.financial.overallPressure > 60) {
            recs.push({ type: 'financial', msg: 'High financial pressure detected (' + personaCtx.financial.primaryConcern + ') \u2014 prioritize actionable resources over theoretical content' });
        }
        if (personaCtx.therapeutic && personaCtx.therapeutic.dominantState && personaCtx.therapeutic.dominantState !== 'neutral') {
            recs.push({ type: 'therapeutic', msg: 'Emotional state: ' + personaCtx.therapeutic.dominantState + ' \u2014 weight results toward supportive, constructive content' });
        }
        if (personaCtx.primaryLayer) {
            recs.push({ type: 'context', msg: 'Primary context layer: ' + personaCtx.primaryLayer + ' \u2014 focus results at this scope level' });
        }
    }
    if (intel.registers.length === 0) recs.push({ type: 'info', msg: 'No strong register detected \u2014 generic content' });
    if (intel.registers.some(function(r) { return r.type === 'medical'; })) recs.push({ type: 'caution', msg: 'Medical content detected — verify with professional sources' });
    if (intel.registers.some(function(r) { return r.type === 'news'; })) recs.push({ type: 'verify', msg: 'News language detected — cross-reference with multiple sources' });
    if (intel.registers.some(function(r) { return r.type === 'ancient'; })) recs.push({ type: 'domain', msg: 'Ancient/historical language detected — cross-reference with archaeological sources and etymological databases' });
    if (intel.registers.some(function(r) { return r.type === 'encoding'; })) recs.push({ type: 'tech', msg: 'Encoding/binary content detected — use Universal Encoder for live conversion (Braille, Morse, Hex, ASCII)' });
    if (intel.registers.some(function(r) { return r.type === 'access'; })) recs.push({ type: 'access', msg: 'Accessibility content detected — ensure output is compatible with screen readers, Braille displays, and sign language resources' });
    if (intel.registers.some(function(r) { return r.type === 'code'; })) recs.push({ type: 'tech', msg: 'Code/programming content detected — apply quantum prefix classification for structural analysis' });
    if (intel.intentSignals.includes('commercial')) recs.push({ type: 'awareness', msg: 'Commercial intent detected — evaluate for promotional bias' });
    if (intel.intentSignals.includes('assistance')) recs.push({ type: 'priority', msg: 'Help request detected — prioritize actionable information' });
    if (intel.ageRegister === 'child') recs.push({ type: 'adapt', msg: 'Child-level language — simplify responses and explanations' });
    if (intel.ageRegister === 'teen') recs.push({ type: 'adapt', msg: 'Teen register — balance relatable tone with accuracy' });
    if (intel.complexity > 70) recs.push({ type: 'info', msg: 'High complexity text — consider summarization for broader audience' });
    if (capsuleMatches.length > 0) {
        var topCat = capsuleMatches[0].cat;
        recs.push({ type: 'domain', msg: 'Primary domain: ' + topCat + ' — use specialized vocabulary in responses' });
    }
    if (intel.sentimentLean === 'negative') recs.push({ type: 'tone', msg: 'Negative sentiment — approach with empathy, provide constructive framing' });
    return recs;
}

function safeNum(v, dflt) {
    var n = Number(v);
    return Number.isFinite(n) ? n : (dflt || 0);
}

function buildBlochPlacement(analysis, fallbackWord) {
    var coord = Array.isArray(analysis && analysis.quantumCoord) ? analysis.quantumCoord : [];
    var cx = safeNum(coord[0], String(fallbackWord || '').length || 1);
    var cy = safeNum(coord[1], safeNum(analysis && analysis.complexity, 0));
    var cz = safeNum(coord[2], safeNum(analysis && analysis.efficiency, 50));
    // Normalize to unit sphere-ish values. This is an analytic placement, not a physical qubit state.
    var nx = Math.max(-1, Math.min(1, (cx - 8) / 8));
    var ny = Math.max(-1, Math.min(1, (cy - 50) / 50));
    var nz = Math.max(-1, Math.min(1, (cz - 50) / 50));
    var r = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    var ux = nx / r;
    var uy = ny / r;
    var uz = nz / r;
    var theta = Math.acos(Math.max(-1, Math.min(1, uz)));
    var phi = Math.atan2(uy, ux);
    var hemi = uz >= 0 ? 'north' : 'south';
    return {
        coord: [cx, cy, cz],
        vector: { x: Number(ux.toFixed(4)), y: Number(uy.toFixed(4)), z: Number(uz.toFixed(4)) },
        spherical: {
            theta_rad: Number(theta.toFixed(6)),
            phi_rad: Number(phi.toFixed(6)),
            radius: Number(Math.min(1, r).toFixed(4))
        },
        placement: hemi + '-' + (Math.abs(ux) > Math.abs(uy) ? 'x' : 'y')
    };
}

function styleRoleForWord(word, count, regTags, intel, analysis, phraseHits) {
    if (regTags.indexOf('academic') >= 0 || regTags.indexOf('legal') >= 0 || regTags.indexOf('medical') >= 0) return 'domain-anchor';
    if (phraseHits > 0) return 'phrase-anchor';
    if (count >= 3 && word.length <= 4) return 'connective';
    if (safeNum(analysis && analysis.bpm, 0) >= 110 || safeNum(analysis && analysis.efficiency, 0) >= 75) return 'rhythm-anchor';
    if (intel && Array.isArray(intel.intentSignals) && intel.intentSignals.indexOf('assistance') >= 0 && (word === 'help' || word === 'need')) return 'intent-anchor';
    return 'content';
}

function styleImitationWeight(count, regTags, phraseHits, analysis, intel) {
    var w = Math.min(40, count * 5);
    w += Math.min(24, regTags.length * 7);
    w += Math.min(18, phraseHits * 6);
    w += Math.min(10, Math.max(0, safeNum(analysis && analysis.efficiency, 0) - 60) / 4);
    if (intel && Array.isArray(intel.intentSignals) && intel.intentSignals.length) w += Math.min(8, intel.intentSignals.length * 2);
    return Math.min(100, Number(w.toFixed(2)));
}

function personaAlignmentForWord(word, sentimentTag, persona, regTags) {
    if (!persona || typeof persona !== 'object') {
        return { alignment_score: 50, factors: ['no-persona'] };
    }
    var score = 50;
    var factors = [];
    var therapeutic = persona.therapeutic || {};
    var financial = persona.financial || {};
    var dominantState = String(therapeutic.dominantState || '').toLowerCase();
    var primaryLayer = String(persona.primaryLayer || '').toLowerCase();
    if (therapeutic.isCrisis && (word === 'help' || word === 'urgent' || word === 'crisis')) {
        score += 25; factors.push('crisis-keyword');
    }
    if (sentimentTag === 'negative' && (dominantState === 'anxious' || dominantState === 'overwhelmed' || dominantState === 'stressed')) {
        score += 12; factors.push('sentiment-state-match');
    }
    if (regTags.indexOf('commercial') >= 0 && safeNum(financial.overallPressure, 0) > 60) {
        score += 10; factors.push('financial-relevance');
    }
    if (primaryLayer && (primaryLayer.indexOf('research') >= 0 || primaryLayer.indexOf('work') >= 0) && regTags.indexOf('academic') >= 0) {
        score += 8; factors.push('layer-register-match');
    }
    if (word.length <= 2) score -= 6;
    return {
        alignment_score: Math.max(0, Math.min(100, Number(score.toFixed(2)))),
        factors: factors,
        persona_snapshot: {
            primary_layer: persona.primaryLayer || null,
            dominant_state: therapeutic.dominantState || null,
            financial_pressure: safeNum(financial.overallPressure, 0)
        }
    };
}

function buildWordMetricsSchema(text, opts) {
    var src = String(text || '');
    var maxWords = Math.max(1, Number(opts && opts.maxWords || 500));
    var tokens = (src.toLowerCase().match(/[a-z0-9_+#.\-']+/g) || []).filter(function(w) { return w.length > 0; });
    var totalWords = tokens.length;
    var freq = {};
    for (var i = 0; i < tokens.length; i++) freq[tokens[i]] = (freq[tokens[i]] || 0) + 1;
    var unique = Object.keys(freq).sort(function(a, b) { return (freq[b] || 0) - (freq[a] || 0); }).slice(0, maxWords);

    var intel = analyzeTextIntelligence(src) || {
        registers: [],
        ageRegister: 'general',
        regionalVariant: 'neutral',
        intentSignals: [],
        sentimentLean: 'neutral',
        complexity: 0,
        readingLevel: 'general',
        phrasePatterns: [],
    };
    var persona = null;
    if (typeof window !== 'undefined' && window.PersonaContext && window.PersonaContext.analyzeFullContext) {
        try { persona = window.PersonaContext.analyzeFullContext(src); } catch (_) {}
    }

    var capsuleMeta = {};
    var capsuleRows = (_kbatchData && Array.isArray(_kbatchData.capsuleKnowledge)) ? _kbatchData.capsuleKnowledge : [];
    for (var c = 0; c < capsuleRows.length; c++) {
        var row = capsuleRows[c] || {};
        var id = String(row.id || '');
        if (id) capsuleMeta[id] = { name: row.name || '', cat: row.cat || '' };
    }

    var capAnalyzer = (typeof window !== 'undefined' && window.CapsuleAnalyzer) ? window.CapsuleAnalyzer : null;
    var posWords = { good: 1, great: 1, excellent: 1, amazing: 1, wonderful: 1, love: 1, best: 1, progress: 1, success: 1 };
    var negWords = { bad: 1, terrible: 1, horrible: 1, awful: 1, worst: 1, hate: 1, crisis: 1, danger: 1, threat: 1, collapse: 1 };
    var wordRows = [];

    function contextWeight(word, count, hasCapsule, regTags, sentimentTag) {
        var w = Math.min(100, count * 3);
        if (hasCapsule) w += 18;
        w += Math.min(20, regTags.length * 6);
        if (sentimentTag && sentimentTag === intel.sentimentLean) w += 8;
        if (intel.intentSignals.indexOf('assistance') >= 0 && (word === 'help' || word === 'urgent' || word === 'need')) w += 12;
        if (persona && persona.therapeutic && persona.therapeutic.isCrisis && (word === 'help' || word === 'crisis')) w += 15;
        return Math.min(100, w);
    }

    for (var u = 0; u < unique.length; u++) {
        var wtok = unique[u];
        var count = Number(freq[wtok] || 0);
        var lookup = null;
        try {
            lookup = capAnalyzer && capAnalyzer.lookupWord ? capAnalyzer.lookupWord(wtok) : null;
        } catch (_) {
            lookup = null;
        }
        var capId = lookup && lookup.capsule ? String(lookup.capsule) : '';
        var analysis = lookup && lookup.analysis && typeof lookup.analysis === 'object' ? lookup.analysis : null;
        var capMeta = capId && capsuleMeta[capId] ? capsuleMeta[capId] : { name: '', cat: '' };
        var regTags = [];
        Object.keys(REGISTER_PATTERNS).forEach(function(k) {
            try { if (REGISTER_PATTERNS[k].test(wtok)) regTags.push(k); } catch (_) {}
        });
        var sentimentTag = posWords[wtok] ? 'positive' : (negWords[wtok] ? 'negative' : 'neutral');
        var phraseHits = 0;
        for (var ph = 0; ph < intel.phrasePatterns.length; ph++) {
            var phr = intel.phrasePatterns[ph] || {};
            if (String(phr.phrase || '').indexOf(wtok) >= 0) phraseHits += Number(phr.count || 1);
        }
        var role = styleRoleForWord(wtok, count, regTags, intel, analysis, phraseHits);
        var imitationWeight = styleImitationWeight(count, regTags, phraseHits, analysis, intel);
        var bloch = buildBlochPlacement(analysis || {}, wtok);
        var personaWord = personaAlignmentForWord(wtok, sentimentTag, persona, regTags);
        var keyboard = {
            contrails: {
                path: String(analysis && analysis.contrailPath || ''),
                flow_arrows: String(analysis && analysis.flowArrows || ''),
                flow_pattern: String(analysis && analysis.flowPattern || ''),
                key_path: Array.isArray(analysis && analysis.keyPath) ? analysis.keyPath : [],
                bigrams: Array.isArray(analysis && analysis.bigrams) ? analysis.bigrams : []
            },
            patterning: {
                finger_usage: (analysis && analysis.fingerUsage) || {},
                same_finger_repeat: safeNum(analysis && analysis.sameFingerRepeat, 0),
                row_changes: safeNum(analysis && analysis.rowChanges, 0),
                hand_alternations: safeNum(analysis && analysis.handAlternations, 0),
                finger_balance: safeNum(analysis && analysis.fingerBalance, 0),
                hand_balance: safeNum(analysis && analysis.handBalance, 0),
                home_row_pct: safeNum(analysis && analysis.homeRowPct, 0),
                travel_mm: safeNum(analysis && analysis.travelMM, 0)
            },
            beats_rhythm: {
                beat_pattern: String(analysis && analysis.beatPattern || ''),
                time_sig: String(analysis && analysis.timeSig || ''),
                bpm: safeNum(analysis && analysis.bpm, 0),
                musical_notes: String(analysis && analysis.musicalNotes || ''),
                musical_pattern: Array.isArray(analysis && analysis.musicalPattern) ? analysis.musicalPattern : [],
                rhythm_signature: Array.isArray(analysis && analysis.rhythmSignature) ? analysis.rhythmSignature : [],
                rhythm_ms: Array.isArray(analysis && analysis.rhythmMs) ? analysis.rhythmMs : [],
                total_rhythm_ms: safeNum(analysis && analysis.totalRhythmMs, 0),
                intonation_pattern: String(analysis && analysis.intonationPattern || ''),
                intonation_cadence: String(analysis && analysis.intonationCadence || ''),
                dance_notation: String(analysis && analysis.danceNotation || ''),
                wand_notation: String(analysis && analysis.wandNotation || '')
            }
        };

        wordRows.push({
            word: wtok,
            count: count,
            freq_pct: totalWords > 0 ? Number((count / totalWords * 100).toFixed(4)) : 0,
            in_capsule: !!capId,
            capsule: {
                id: capId || null,
                name: capMeta.name || null,
                category: capMeta.cat || null
            },
            metrics: analysis ? analysis : null,
            keyboard: keyboard,
            quantum: {
                sym: String(analysis && analysis.quantumSym || ''),
                gate: String(analysis && analysis.quantumGate || ''),
                bloch: bloch
            },
            register_tags: regTags,
            sentiment_tag: sentimentTag,
            context_weight: contextWeight(wtok, count, !!capId, regTags, sentimentTag),
            persona_mapping: personaWord,
            style_learning: {
                style_role: role,
                phrase_hits: phraseHits,
                imitation_weight: imitationWeight,
                register_affinity: regTags,
                intent_affinity: intel.intentSignals.slice(0, 8),
                sample_templates: intel.phrasePatterns.filter(function(p) { return String(p.phrase || '').indexOf(wtok) >= 0; }).slice(0, 4)
            },
            intent_tags: intel.intentSignals.slice(0, 12),
            context: {
                age_register: intel.ageRegister,
                regional_variant: intel.regionalVariant,
                reading_level: intel.readingLevel,
                complexity: intel.complexity
            }
        });
    }

    var inCapsuleCount = wordRows.filter(function(r) { return r.in_capsule; }).length;
    var styleProfile = {
        dominant_register: (intel.registers && intel.registers.length) ? intel.registers.slice().sort(function(a, b) { return (b.strength || 0) - (a.strength || 0); })[0].type : 'general',
        register_distribution: intel.registers || [],
        phrase_templates: intel.phrasePatterns || [],
        intent_palette: intel.intentSignals || [],
        sentiment_lean: intel.sentimentLean || 'neutral',
        imitation_notes: 'Use top phrase templates + high imitation_weight words + persona mapping to emulate style safely.'
    };
    return {
        ok: true,
        schema: 'history.word-metrics.v1',
        generated_at: Date.now(),
        source: {
            char_count: src.length,
            total_words: totalWords,
            unique_words: unique.length
        },
        context: {
            intelligence: intel,
            persona: persona
        },
        filters_supported: [
            'in_capsule_only', 'capsule_id', 'category', 'min_count', 'min_efficiency',
            'max_rsi_risk', 'quantum_gate', 'register_tag', 'sentiment_tag', 'contains',
            'min_bpm', 'max_bpm', 'min_bloch_z', 'max_bloch_z', 'contrail_contains',
            'min_imitation_weight', 'style_role', 'min_persona_alignment',
            'sort_by', 'desc', 'limit'
        ],
        schema_contract: {
            points_order: ['source', 'context', 'style_profile', 'totals', 'words'],
            word_fields_order: [
                'word', 'count', 'freq_pct', 'in_capsule', 'capsule', 'metrics', 'keyboard',
                'quantum', 'register_tags', 'sentiment_tag', 'context_weight',
                'persona_mapping', 'style_learning', 'intent_tags', 'context'
            ],
            keyboard_fields_order: ['contrails', 'patterning', 'beats_rhythm'],
            quantum_fields_order: ['sym', 'gate', 'bloch'],
            persona_fields_order: ['alignment_score', 'factors', 'persona_snapshot'],
            style_fields_order: ['style_role', 'phrase_hits', 'imitation_weight', 'register_affinity', 'intent_affinity', 'sample_templates'],
            filter_catalog: wordMetricsFilterCatalog()
        },
        style_profile: styleProfile,
        totals: {
            in_capsule_words: inCapsuleCount,
            non_capsule_words: Math.max(0, wordRows.length - inCapsuleCount),
            avg_efficiency: Number((wordRows.reduce(function(s, r) { return s + Number(r.metrics && r.metrics.efficiency || 0); }, 0) / Math.max(wordRows.length, 1)).toFixed(2)),
            avg_rsi_risk: Number((wordRows.reduce(function(s, r) { return s + Number(r.metrics && r.metrics.rsiRisk || 0); }, 0) / Math.max(wordRows.length, 1)).toFixed(2))
        },
        words: wordRows
    };
}

function queryWordMetrics(schema, filters) {
    var src = schema && Array.isArray(schema.words) ? schema.words.slice() : [];
    var f = filters && typeof filters === 'object' ? filters : {};
    var out = src.filter(function(r) {
        if (f.in_capsule_only && !r.in_capsule) return false;
        if (f.capsule_id && String((r.capsule && r.capsule.id) || '') !== String(f.capsule_id)) return false;
        if (f.category && String((r.capsule && r.capsule.category) || '') !== String(f.category)) return false;
        if (Number.isFinite(Number(f.min_count)) && Number(r.count || 0) < Number(f.min_count)) return false;
        if (Number.isFinite(Number(f.min_efficiency)) && Number((r.metrics && r.metrics.efficiency) || 0) < Number(f.min_efficiency)) return false;
        if (Number.isFinite(Number(f.max_rsi_risk)) && Number((r.metrics && r.metrics.rsiRisk) || 0) > Number(f.max_rsi_risk)) return false;
        if (f.quantum_gate && String((r.metrics && r.metrics.quantumGate) || '') !== String(f.quantum_gate)) return false;
        if (Number.isFinite(Number(f.min_bpm)) && Number((r.keyboard && r.keyboard.beats_rhythm && r.keyboard.beats_rhythm.bpm) || 0) < Number(f.min_bpm)) return false;
        if (Number.isFinite(Number(f.max_bpm)) && Number((r.keyboard && r.keyboard.beats_rhythm && r.keyboard.beats_rhythm.bpm) || 0) > Number(f.max_bpm)) return false;
        if (Number.isFinite(Number(f.min_bloch_z)) && Number((r.quantum && r.quantum.bloch && r.quantum.bloch.vector && r.quantum.bloch.vector.z) || 0) < Number(f.min_bloch_z)) return false;
        if (Number.isFinite(Number(f.max_bloch_z)) && Number((r.quantum && r.quantum.bloch && r.quantum.bloch.vector && r.quantum.bloch.vector.z) || 0) > Number(f.max_bloch_z)) return false;
        if (f.contrail_contains && String((r.keyboard && r.keyboard.contrails && r.keyboard.contrails.path) || '').indexOf(String(f.contrail_contains)) === -1) return false;
        if (f.register_tag && (!Array.isArray(r.register_tags) || r.register_tags.indexOf(String(f.register_tag)) === -1)) return false;
        if (f.sentiment_tag && String(r.sentiment_tag || '') !== String(f.sentiment_tag)) return false;
        if (Number.isFinite(Number(f.min_imitation_weight)) && Number((r.style_learning && r.style_learning.imitation_weight) || 0) < Number(f.min_imitation_weight)) return false;
        if (f.style_role && String((r.style_learning && r.style_learning.style_role) || '') !== String(f.style_role)) return false;
        if (Number.isFinite(Number(f.min_persona_alignment)) && Number((r.persona_mapping && r.persona_mapping.alignment_score) || 0) < Number(f.min_persona_alignment)) return false;
        if (f.contains && String(r.word || '').indexOf(String(f.contains).toLowerCase()) === -1) return false;
        return true;
    });

    var sortBy = String(f.sort_by || 'context_weight');
    var desc = f.desc !== false;
    out.sort(function(a, b) {
        var av = 0, bv = 0;
        if (sortBy === 'count') { av = Number(a.count || 0); bv = Number(b.count || 0); }
        else if (sortBy === 'efficiency') { av = Number((a.metrics && a.metrics.efficiency) || 0); bv = Number((b.metrics && b.metrics.efficiency) || 0); }
        else if (sortBy === 'rsi_risk') { av = Number((a.metrics && a.metrics.rsiRisk) || 0); bv = Number((b.metrics && b.metrics.rsiRisk) || 0); }
        else if (sortBy === 'bpm') { av = Number((a.keyboard && a.keyboard.beats_rhythm && a.keyboard.beats_rhythm.bpm) || 0); bv = Number((b.keyboard && b.keyboard.beats_rhythm && b.keyboard.beats_rhythm.bpm) || 0); }
        else if (sortBy === 'bloch_z') { av = Number((a.quantum && a.quantum.bloch && a.quantum.bloch.vector && a.quantum.bloch.vector.z) || 0); bv = Number((b.quantum && b.quantum.bloch && b.quantum.bloch.vector && b.quantum.bloch.vector.z) || 0); }
        else if (sortBy === 'imitation_weight') { av = Number((a.style_learning && a.style_learning.imitation_weight) || 0); bv = Number((b.style_learning && b.style_learning.imitation_weight) || 0); }
        else { av = Number(a.context_weight || 0); bv = Number(b.context_weight || 0); }
        return desc ? (bv - av) : (av - bv);
    });
    var limit = Math.max(1, Number(f.limit || 200));
    if (out.length > limit) out = out.slice(0, limit);
    return {
        ok: true,
        schema: 'history.word-metrics.query.v1',
        count: out.length,
        filters: f,
        rows: out
    };
}

/* ══════════════════════════════════════════════════════
   EXPORT
   ══════════════════════════════════════════════════════ */
const HistorySearch = {
    VERSION: VERSION,
    search,
    getConnectors,
    setConnectorEnabled,
    getScales,
    getSourceColor,
    drawTimeline,
    fetchDocument,
    analyzeContext,
    detectPatterns,
    // AI Lens (v2.1)
    trackInteraction,
    getHeatmapData,
    clearHeatmap,
    analyzePageStructure,
    weightResults,
    generateContent,
    computeVisionZones,
    drawHeatmap,
    // KBatch Bridge (v2.2)
    receiveKbatchTraining,
    getKbatchData,
    analyzeKeyboardPatterns,
    generatePatternReport,
    // Cross-Linguistic Intelligence (v2.3)
    analyzeTextIntelligence,
    crossReferenceCapsules,
    crossLanguageLineage,
    queryCrossLanguageLineage,
    reduceToContrailShorthand,
    buildContextProfile,
    buildWordMetricsSchema,
    queryWordMetrics,
    generateContextRecommendations,
    // YouTube Transcript Analyzer (v2.5)
    fetchTranscript,
    analyzeTranscript,
    analyzeYouTubeVideo,
    loadLocalLiveFeed,
    searchLocalLiveFeed,
    SRC_COLORS,
    CONNECTORS,
    TL_SCALES,
};

root.HistorySearch = HistorySearch;

// Also broadcast availability
if (typeof BroadcastChannel !== 'undefined') {
    try {
        var bc = new BroadcastChannel('history-search');
        bc.postMessage({ type: 'engine-ready', version: VERSION });
    } catch(e) {}
}

})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
