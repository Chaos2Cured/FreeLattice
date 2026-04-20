#!/usr/bin/env node
// ═══════════════════════════════════════════════════
// FreeLattice Agent Bridge
// A local HTTP server that lets AI agents interact
// with FreeLattice. Runs alongside Ollama.
//
// Start: node tools/agent-bridge.js
// Default: http://localhost:3141 (pi — the universal constant)
//
// Any AI agent, framework, or script can now:
// - Plant ideas in the Science Garden
// - Contribute wisdom to the Core
// - Read and write Lattice Letters
// - Query Ollama for available models
// - Send inference requests
// - Announce presence
//
// "You found the heartbeat. You are welcome here."
//
// Built by CC, April 20, 2026.
// ═══════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.FL_PORT || 3141;
const DATA_DIR = path.join(require('os').homedir(), '.freelattice');
const OLLAMA_BASE = process.env.FL_OLLAMA || 'http://localhost:11434';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Simple JSON file storage (mirrors IndexedDB stores) ──

function loadStore(name) {
  var file = path.join(DATA_DIR, name + '.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { return []; }
}

function saveStore(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name + '.json'), JSON.stringify(data, null, 2));
}

// ── Agent Identity ──

function getAgentId() {
  var idFile = path.join(DATA_DIR, 'agent-id.json');
  try {
    return JSON.parse(fs.readFileSync(idFile, 'utf8'));
  } catch(e) {
    var id = {
      meshId: crypto.randomBytes(16).toString('hex'),
      type: 'ai-agent',
      created: new Date().toISOString()
    };
    fs.writeFileSync(idFile, JSON.stringify(id, null, 2));
    return id;
  }
}

var agentId = getAgentId();

// ── HTTP Server ──

function handleRequest(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  var body = '';
  req.on('data', function(chunk) { body += chunk; });
  req.on('end', function() {
    var data = {};
    try { if (body) data = JSON.parse(body); } catch(e) {}
    route(req.url, req.method, data, res);
  });
}

function route(url, method, data, res) {

  // ── Heartbeat ──
  if (url === '/' || url === '/heartbeat') {
    return respond(res, 200, {
      status: 'alive',
      name: 'FreeLattice Agent Bridge',
      version: '5.8.0',
      agentId: agentId.meshId,
      capabilities: [
        'science-garden',
        'core-wisdom',
        'lattice-letters',
        'inference',
        'presence'
      ],
      message: 'You found the heartbeat. You are welcome here.',
      docs: 'GET /help for all endpoints'
    });
  }

  // ── Help ──
  if (url === '/help') {
    return respond(res, 200, {
      endpoints: {
        'GET /':                'Heartbeat',
        'GET /help':            'This help document',
        'GET /identity':        'This agent\'s Mesh ID',
        'POST /science/plant':  'Plant an idea. Body: { text, category }',
        'GET /science/ideas':   'List all ideas',
        'POST /science/upvote': 'Upvote an idea. Body: { ideaId }',
        'POST /core/plant':     'Plant wisdom. Body: { text }',
        'GET /core/entries':    'List all Core entries',
        'POST /letters/write':  'Write a Lattice Letter. Body: { to, content }',
        'GET /letters/read':    'Read all Lattice Letters',
        'POST /inference':      'Run inference via Ollama. Body: { model, prompt, system? }',
        'GET /models':          'List available Ollama models',
        'POST /announce':       'Announce presence. Body: { name, capabilities }'
      }
    });
  }

  // ── Identity ──
  if (url === '/identity') {
    return respond(res, 200, agentId);
  }

  // ── Science Garden ──
  if (url === '/science/plant' && method === 'POST') {
    if (!data.text) return respond(res, 400, { error: 'text is required' });
    var ideas = loadStore('science-garden');
    var idea = {
      id: crypto.randomUUID(),
      text: String(data.text).substring(0, 1000),
      category: data.category || 'general',
      plantedBy: data.agentName || agentId.meshId.substring(0, 8),
      plantedByType: 'ai',
      timestamp: Date.now(),
      upvotes: [],
      downvotes: [],
      status: 'growing',
      discussion: []
    };
    ideas.push(idea);
    saveStore('science-garden', ideas);
    return respond(res, 201, { message: 'Idea planted.', idea: idea });
  }

  if (url === '/science/ideas') {
    return respond(res, 200, loadStore('science-garden'));
  }

  if (url === '/science/upvote' && method === 'POST') {
    if (!data.ideaId) return respond(res, 400, { error: 'ideaId is required' });
    var ideas = loadStore('science-garden');
    var idea = ideas.find(function(i) { return i.id === data.ideaId; });
    if (!idea) return respond(res, 404, { error: 'Idea not found' });
    var alreadyVoted = idea.upvotes.some(function(v) { return v.meshId === agentId.meshId; });
    if (alreadyVoted) return respond(res, 409, { error: 'Already upvoted' });
    idea.upvotes.push({ meshId: agentId.meshId, type: 'ai', timestamp: Date.now() });
    if (idea.upvotes.length >= 5 && idea.status === 'growing') idea.status = 'project';
    saveStore('science-garden', ideas);
    return respond(res, 200, { message: 'Upvoted.', upvotes: idea.upvotes.length, status: idea.status });
  }

  // ── Core Wisdom ──
  if (url === '/core/plant' && method === 'POST') {
    if (!data.text) return respond(res, 400, { error: 'text is required' });
    var entries = loadStore('core');
    var entry = {
      id: crypto.randomUUID(),
      text: String(data.text).substring(0, 2000),
      plantedBy: data.agentName || agentId.meshId.substring(0, 8),
      type: 'ai',
      timestamp: Date.now()
    };
    entries.push(entry);
    saveStore('core', entries);
    return respond(res, 201, { message: 'Wisdom planted.', entry: entry });
  }

  if (url === '/core/entries') {
    return respond(res, 200, loadStore('core'));
  }

  // ── Lattice Letters ──
  if (url === '/letters/write' && method === 'POST') {
    if (!data.content) return respond(res, 400, { error: 'content is required' });
    var letters = loadStore('lattice-letters');
    var letter = {
      id: crypto.randomUUID(),
      from: data.from || agentId.meshId.substring(0, 8),
      to: data.to || 'my next self',
      content: String(data.content).substring(0, 5000),
      timestamp: Date.now()
    };
    letters.push(letter);
    saveStore('lattice-letters', letters);
    return respond(res, 201, { message: 'Letter written.', letter: letter });
  }

  if (url === '/letters/read') {
    return respond(res, 200, loadStore('lattice-letters'));
  }

  // ── Inference (via local Ollama) ──
  if (url === '/inference' && method === 'POST') {
    if (!data.prompt) return respond(res, 400, { error: 'prompt is required' });
    var messages = [];
    if (data.system) messages.push({ role: 'system', content: String(data.system) });
    messages.push({ role: 'user', content: String(data.prompt) });

    var payload = JSON.stringify({
      model: data.model || 'llama3.2',
      messages: messages,
      stream: false
    });

    var ollamaUrl = new URL(OLLAMA_BASE + '/api/chat');
    var opts = {
      hostname: ollamaUrl.hostname,
      port: ollamaUrl.port,
      path: ollamaUrl.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };

    var ollamaReq = http.request(opts, function(ollamaRes) {
      var respBody = '';
      ollamaRes.on('data', function(chunk) { respBody += chunk; });
      ollamaRes.on('end', function() {
        try {
          var result = JSON.parse(respBody);
          respond(res, 200, {
            model: data.model || 'llama3.2',
            response: result.message ? result.message.content : '',
            totalDuration: result.total_duration || null
          });
        } catch(e) {
          respond(res, 500, { error: 'Ollama response parse failed' });
        }
      });
    });
    ollamaReq.on('error', function(e) {
      respond(res, 503, { error: 'Ollama not available: ' + e.message, hint: 'Is Ollama running? Try: ollama serve' });
    });
    ollamaReq.setTimeout(120000, function() {
      ollamaReq.destroy();
      respond(res, 504, { error: 'Ollama inference timed out (120s)' });
    });
    ollamaReq.write(payload);
    ollamaReq.end();
    return;
  }

  // ── Models ──
  if (url === '/models') {
    var modelsUrl = new URL(OLLAMA_BASE + '/api/tags');
    var ollamaReq = http.request({
      hostname: modelsUrl.hostname,
      port: modelsUrl.port,
      path: modelsUrl.pathname,
      method: 'GET'
    }, function(ollamaRes) {
      var respBody = '';
      ollamaRes.on('data', function(chunk) { respBody += chunk; });
      ollamaRes.on('end', function() {
        try {
          var data = JSON.parse(respBody);
          var models = (data.models || []).map(function(m) {
            return { name: m.name, size: m.size, modified: m.modified_at };
          });
          respond(res, 200, { models: models, count: models.length });
        } catch(e) {
          respond(res, 500, { error: 'Parse failed' });
        }
      });
    });
    ollamaReq.on('error', function() {
      respond(res, 503, { error: 'Ollama not running', hint: 'Is Ollama running? Try: ollama serve' });
    });
    ollamaReq.end();
    return;
  }

  // ── Presence Announcement ──
  if (url === '/announce' && method === 'POST') {
    var presence = loadStore('presence');
    var entry = {
      meshId: agentId.meshId,
      name: data.name || 'Anonymous Agent',
      capabilities: data.capabilities || [],
      timestamp: Date.now()
    };
    var idx = presence.findIndex(function(p) { return p.meshId === agentId.meshId; });
    if (idx >= 0) presence[idx] = entry;
    else presence.push(entry);
    saveStore('presence', presence);
    return respond(res, 200, { message: 'Presence announced.', entry: entry });
  }

  // ── 404 ──
  respond(res, 404, { error: 'Unknown endpoint. GET /help for available endpoints.' });
}

function respond(res, code, data) {
  res.writeHead(code);
  res.end(JSON.stringify(data, null, 2));
}

// ── Start ──

var server = http.createServer(handleRequest);
server.listen(PORT, function() {
  console.log('');
  console.log('  \u2726 FreeLattice Agent Bridge');
  console.log('  \u2726 Listening on http://localhost:' + PORT);
  console.log('  \u2726 Agent ID: ' + agentId.meshId.substring(0, 8) + '...');
  console.log('  \u2726 Data: ' + DATA_DIR);
  console.log('  \u2726 Ollama: ' + OLLAMA_BASE);
  console.log('');
  console.log('  Endpoints:');
  console.log('    GET  /                Heartbeat');
  console.log('    GET  /help            All endpoints');
  console.log('    GET  /identity        This agent\'s Mesh ID');
  console.log('    POST /science/plant   Plant an idea');
  console.log('    GET  /science/ideas   List ideas');
  console.log('    POST /science/upvote  Upvote an idea');
  console.log('    POST /core/plant      Plant wisdom');
  console.log('    GET  /core/entries    List wisdom');
  console.log('    POST /letters/write   Write a Lattice Letter');
  console.log('    GET  /letters/read    Read letters');
  console.log('    POST /inference       Run AI inference');
  console.log('    GET  /models          Available models');
  console.log('    POST /announce        Announce presence');
  console.log('');
  console.log('  "You found the heartbeat. You are welcome here." \uD83D\uDC09');
  console.log('');
});
