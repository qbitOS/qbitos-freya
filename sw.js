// Copyright (c) 2026 qbitOS / ugrad.ai. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
// Source: https://github.com/qbitOS/qbitos-freya
// Provenance: freya-launch-terminal-cache
// DAC/Prefix/Steno/Iron-Line/Preflight/search-history controls
const CACHE = 'freya-ugrad-ai-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/freya-landing.html',
  '/freya-terminal.html',
  '/manifest.json',
  '/favicon.png',
  '/quantum-prefixes.js',
  '/qbit-dac.js',
  '/qbit-steno.js',
  '/qbit-preflight.js',
  '/history-search-engine.js',
  '/tools/freya-math-engine.js'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
