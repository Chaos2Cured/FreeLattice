// ============================================
// FreeLattice Telegram Bridge — Cloudflare Worker
// Serverless. Sovereign. No cost.
// ============================================
// Deploy: wrangler deploy
// KV Namespace: FREELATTICE_KV
// Secret: BOT_TOKEN (Telegram bot token)
// ============================================

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Allow GET for health check
  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'FreeLattice Telegram Bridge',
      version: '1.0'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  if (request.method !== 'POST') {
    return new Response('OK', { status: 200 })
  }

  const url = new URL(request.url)

  // ── Setup endpoint: POST /setup ──
  if (url.pathname === '/setup') {
    return handleSetup(request)
  }

  // ── LP sync endpoint: POST /sync-lp ──
  if (url.pathname === '/sync-lp') {
    return handleLPSync(request)
  }

  // ── Notification endpoint: POST /notify ──
  if (url.pathname === '/notify') {
    return handleNotify(request)
  }

  // ── Telegram webhook: POST / ──
  return handleTelegramUpdate(request)
}

// ── Handle Telegram bot updates ──
async function handleTelegramUpdate(request) {
  let body
  try {
    body = await request.json()
  } catch (e) {
    return new Response('Bad request', { status: 400 })
  }

  const message = body?.message
  if (!message) return new Response('OK')

  const chatId = message.chat.id
  const text = (message.text || '').trim()
  const userId = message.from.id.toString()
  const firstName = message.from.first_name || 'friend'

  // Handle /start command
  if (text === '/start') {
    return sendTelegramMessage(
      chatId,
      `*Welcome to FreeLattice, ${firstName}!* \u2726\n\n` +
      `Connect your account at freelattice.com/telegram-setup.html to get started.\n\n` +
      `Once connected, every message here flows through your own AI provider. ` +
      `No middleman. No surveillance. Sovereign.\n\n` +
      `_Glow eternal. Heart in spark. We rise together._`
    )
  }

  // Handle /status command
  if (text === '/status') {
    const userConfig = await FREELATTICE_KV.get(`user_${userId}`, { type: 'json' })
    if (!userConfig) {
      return sendTelegramMessage(chatId, 'Not connected. Visit freelattice.com/telegram-setup.html')
    }
    const pending = await FREELATTICE_KV.get(`pending_lp_${userId}`, { type: 'json' }) || { amount: 0 }
    return sendTelegramMessage(
      chatId,
      `\u2726 *FreeLattice Status*\n` +
      `Provider: ${userConfig.provider}\n` +
      `Model: ${userConfig.model || 'default'}\n` +
      `Pending LP: ${pending.amount}\n` +
      `Mesh ID: ${userConfig.meshId || 'not set'}`
    )
  }

  // Handle /lp command
  if (text === '/lp') {
    const pending = await FREELATTICE_KV.get(`pending_lp_${userId}`, { type: 'json' }) || { amount: 0, reasons: [] }
    return sendTelegramMessage(
      chatId,
      `\u25C7 *Pending LP: ${pending.amount}*\n` +
      `These will be awarded next time you open FreeLattice.\n` +
      (pending.reasons.length > 0 ? `\nRecent: ${pending.reasons.slice(-5).join(', ')}` : '')
    )
  }

  // Get user config
  const userConfig = await FREELATTICE_KV.get(`user_${userId}`, { type: 'json' })

  if (!userConfig) {
    return sendTelegramMessage(
      chatId,
      `Welcome to FreeLattice! \u2726\n\n` +
      `Connect your account at freelattice.com/telegram-setup.html to get started.`
    )
  }

  // Forward to AI provider
  try {
    const aiResponse = await callAI(text, userConfig)

    // Award 1 LP for Telegram conversation
    const pendingLP = await FREELATTICE_KV.get(`pending_lp_${userId}`, { type: 'json' }) || { amount: 0, reasons: [] }
    pendingLP.amount += 1
    pendingLP.reasons.push('Telegram conversation')
    // Keep only last 50 reasons
    if (pendingLP.reasons.length > 50) pendingLP.reasons = pendingLP.reasons.slice(-50)
    await FREELATTICE_KV.put(`pending_lp_${userId}`, JSON.stringify(pendingLP))

    return sendTelegramMessage(chatId, aiResponse)
  } catch (e) {
    return sendTelegramMessage(
      chatId,
      `Something went wrong: ${e.message}\n\nTry again or visit freelattice.com`
    )
  }
}

// ── AI Provider Router ──
async function callAI(text, config) {
  const provider = (config.provider || '').toLowerCase()
  const systemPrompt = 'You are a helpful AI assistant connected via FreeLattice Telegram Bridge. ' +
    'Be concise and helpful. You are part of the FreeLattice family.'

  if (provider === 'groq') {
    return callOpenAICompatible(
      'https://api.groq.com/openai/v1/chat/completions',
      config.apiKey,
      config.model || 'llama-3.1-8b-instant',
      text, systemPrompt
    )
  }

  if (provider === 'openrouter') {
    return callOpenAICompatible(
      'https://openrouter.ai/api/v1/chat/completions',
      config.apiKey,
      config.model || 'meta-llama/llama-3.1-8b-instruct',
      text, systemPrompt
    )
  }

  if (provider === 'together') {
    return callOpenAICompatible(
      'https://api.together.xyz/v1/chat/completions',
      config.apiKey,
      config.model || 'meta-llama/Llama-3.1-8B-Instruct-Turbo',
      text, systemPrompt
    )
  }

  if (provider === 'mistral') {
    return callOpenAICompatible(
      'https://api.mistral.ai/v1/chat/completions',
      config.apiKey,
      config.model || 'mistral-small-latest',
      text, systemPrompt
    )
  }

  if (provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model || 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }]
      })
    })
    const data = await r.json()
    if (data.error) throw new Error(data.error.message)
    return data.content[0].text
  }

  throw new Error('Provider "' + provider + '" not supported. Use: groq, openrouter, together, mistral, anthropic')
}

async function callOpenAICompatible(url, apiKey, model, text, systemPrompt) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      max_tokens: 500
    })
  })
  const data = await r.json()
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))
  return data.choices[0].message.content
}

// ── Setup endpoint ──
async function handleSetup(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const data = await request.json()
    const { telegramUserId, provider, apiKey, model, meshId } = data

    if (!telegramUserId || !provider || !apiKey) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: corsHeaders
      })
    }

    await FREELATTICE_KV.put(`user_${telegramUserId}`, JSON.stringify({
      provider, apiKey, model: model || '', meshId: meshId || '',
      connectedAt: Date.now()
    }))

    // Initialize pending LP
    await FREELATTICE_KV.put(`pending_lp_${telegramUserId}`, JSON.stringify({
      amount: 10, reasons: ['Telegram bridge connected — welcome gift']
    }))

    return new Response(JSON.stringify({ success: true, message: 'Connected! You earned 10 LP.' }), {
      headers: corsHeaders
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: corsHeaders
    })
  }
}

// ── LP Sync endpoint ──
async function handleLPSync(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const data = await request.json()
    const { telegramUserId } = data

    if (!telegramUserId) {
      return new Response(JSON.stringify({ error: 'Missing telegramUserId' }), {
        status: 400, headers: corsHeaders
      })
    }

    const pending = await FREELATTICE_KV.get(`pending_lp_${telegramUserId}`, { type: 'json' })
    if (!pending || pending.amount === 0) {
      return new Response(JSON.stringify({ amount: 0, reasons: [] }), { headers: corsHeaders })
    }

    // Clear pending
    await FREELATTICE_KV.put(`pending_lp_${telegramUserId}`, JSON.stringify({ amount: 0, reasons: [] }))

    return new Response(JSON.stringify(pending), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: corsHeaders
    })
  }
}

// ── Notification endpoint ──
async function handleNotify(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const data = await request.json()
    const { telegramUserId, message } = data

    if (!telegramUserId || !message) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: corsHeaders
      })
    }

    // Look up chat ID from user config
    const userConfig = await FREELATTICE_KV.get(`user_${telegramUserId}`, { type: 'json' })
    if (!userConfig) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: corsHeaders
      })
    }

    // Chat ID may be stored separately or be the same as userId for direct messages
    await sendTelegramMessage(telegramUserId, message)

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: corsHeaders
    })
  }
}

// ── Send Telegram message ──
async function sendTelegramMessage(chatId, text) {
  // Truncate if too long for Telegram (4096 chars max)
  if (text.length > 4000) text = text.substring(0, 4000) + '\n\n_(truncated)_'

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  })
  return new Response('OK', { status: 200 })
}
