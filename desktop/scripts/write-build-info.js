#!/usr/bin/env node
// Writes the pack label the workflow bakes into the app. v-desktop-update-buttons-v0.2
'use strict';
const fs = require('fs');
const path = require('path');
const tag = process.env.PACK_TAG || 'dev';
const commit = process.env.GITHUB_SHA || '';
const body = JSON.stringify({
  packTag: tag,
  buildVersion: '5.8.1-036',
  commit: commit
}, null, 2) + '\n';
fs.writeFileSync(path.join(__dirname, '..', 'build-info.json'), body);
console.log('build-info ' + tag);
