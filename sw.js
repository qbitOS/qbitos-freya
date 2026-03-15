// Copyright (c) 2026 qbitOS / ugrad.ai. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
const CACHE = 'freya-ugrad-ai-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/quantum-prefixes.js',
  '/qbit-dac.js',
  '/qbit-steno.js',
  '/qbit-preflight.js',
  '/history-search-engine.js'
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
