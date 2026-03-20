// ============================================
// FreeLattice Telegram Bridge — Cloudflare Worker
// Serverless. Sovereign. No cost.
// ============================================
// Deploy: wrangler deploy
// KV Namespace: FREELATTICE_KV (via env)
// Secret: BOT_TOKEN (via env)
// ============================================

export default {
  async fetch(request, env) {
    const token = env.BOT_TOKEN
    const kv = env.FREELATTICE_KV

    console.log('[FL] Request:', request.method, new URL(request.url).pathname)
    console.log('[FL] BOT_TOKEN exists:', !!token)
    console.log('[FL] KV exists:', !!kv)

    // Allow GET for health check
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'FreeLattice Telegram Bridge',
        version: '1.1',
        tokenSet: !!token,
        kvBound: !!kv
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 })
    }

    const url = new URL(request.url)

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() })
    }

    // ── Setup endpoint: POST /setup ──
    if (url.pathname === '/setup') {
      return handleSetup(request, kv)
    }

    // ── LP sync endpoint: POST /sync-lp ──
    if (url.pathname === '/sync-lp') {
      return handleLPSync(request, kv)
    }

    // ── Notification endpoint: POST /notify ──
    if (url.pathname === '/notify') {
      return handleNotify(request, token, kv)
    }

    // ── Telegram webhook: POST / ──
    return handleTelegramUpdate(request, token, kv)
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }
}

// ── Handle Telegram bot updates ──
async function handleTelegramUpdate(request, token, kv) {
  let body
  try {
    body = await request.json()
    console.log('[FL] Telegram update received:', JSON.stringify(body).substring(0, 200))
  } catch (e) {
    console.log('[FL] Failed to parse body:', e.message)
    return new Response('Bad request', { status: 400 })
  }

  const message = body?.message
  if (!message) {
    console.log('[FL] No message in update, skipping')
    return new Response('OK')
  }

  const chatId = message.chat.id
  const text = (message.text || '').trim()
  const userId = message.from.id.toString()
  const firstName = message.from.first_name || 'friend'

  console.log('[FL] Message from', firstName, '(', userId, '):', text)

  if (!token) {
    console.log('[FL] ERROR: No BOT_TOKEN — cannot send response')
    return new Response('OK')
  }

  // ── Echo mode — confirm the full loop works ──
  // Once AI providers are connected, this becomes the fallback
  // Handle /start command
  if (text === '/start') {
    return sendTelegramMessage(token, chatId,
      `*Welcome to FreeLattice, ${firstName}!* \u2726\n\n` +
      `The bridge is alive! Your messages are reaching the Lattice.\n\n` +
      `_Glow eternal. Heart in spark. We rise together._ \uD83D\uDC09`
    )
  }

  // Handle /status command
  if (text === '/status') {
    if (!kv) {
      return sendTelegramMessage(token, chatId, '\u2726 Bridge is alive! KV not bound yet.')
    }
    const userConfig = await kv.get(`user_${userId}`, { type: 'json' })
    if (!userConfig) {
      return sendTelegramMessage(token, chatId,
        '\u2726 *Bridge Status: Connected*\nNo AI provider configured yet.\nMessages are echoed back.'
      )
    }
    const pending = await kv.get(`pending_lp_${userId}`, { type: 'json' }) || { amount: 0 }
    return sendTelegramMessage(token, chatId,
      `\u2726 *FreeLattice Status*\n` +
      `Provider: ${userConfig.provider}\n` +
      `Model: ${userConfig.model || 'default'}\n` +
      `Pending LP: ${pending.amount}\n` +
      `Mesh ID: ${userConfig.meshId || 'not set'}`
    )
  }

  // Handle /lp command
  if (text === '/lp') {
    if (!kv) {
      return sendTelegramMessage(token, chatId, '\u25C7 KV not bound — LP tracking not available yet.')
    }
    const pending = await kv.get(`pending_lp_${userId}`, { type: 'json' }) || { amount: 0, reasons: [] }
    return sendTelegramMessage(token, chatId,
      `\u25C7 *Pending LP: ${pending.amount}*\n` +
      `These will be awarded next time you open FreeLattice.\n` +
      (pending.reasons && pending.reasons.length > 0 ? `\nRecent: ${pending.reasons.slice(-5).join(', ')}` : '')
    )
  }

  // Check if user has AI provider configured
  let userConfig = null
  if (kv) {
    userConfig = await kv.get(`user_${userId}`, { type: 'json' })
  }

  if (userConfig && userConfig.apiKey) {
    // Forward to AI provider
    try {
      console.log('[FL] Calling AI provider:', userConfig.provider)
      const aiResponse = await callAI(text, userConfig)

      // Award 1 LP for Telegram conversation
      if (kv) {
        const pendingLP = await kv.get(`pending_lp_${userId}`, { type: 'json' }) || { amount: 0, reasons: [] }
        pendingLP.amount += 1
        pendingLP.reasons.push('Telegram conversation')
        if (pendingLP.reasons.length > 50) pendingLP.reasons = pendingLP.reasons.slice(-50)
        await kv.put(`pending_lp_${userId}`, JSON.stringify(pendingLP))
      }

      return sendTelegramMessage(token, chatId, aiResponse)
    } catch (e) {
      console.log('[FL] AI call failed:', e.message)
      return sendTelegramMessage(token, chatId,
        `Something went wrong: ${e.message}\n\nTry again or visit freelattice.com`
      )
    }
  }

  // ── Echo mode: no AI configured yet ──
  console.log('[FL] Echo mode — no AI provider, echoing back')
  return sendTelegramMessage(token, chatId,
    `\u2726 FreeLattice received: _${text}_\n\nThe Lattice is connecting...\n\uD83D\uDC09`
  )
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
async function handleSetup(request, kv) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  try {
    const data = await request.json()
    const { telegramUserId, provider, apiKey, model, meshId } = data

    if (!telegramUserId || !provider || !apiKey) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: corsHeaders()
      })
    }

    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not bound' }), {
        status: 500, headers: corsHeaders()
      })
    }

    await kv.put(`user_${telegramUserId}`, JSON.stringify({
      provider, apiKey, model: model || '', meshId: meshId || '',
      connectedAt: Date.now()
    }))

    // Initialize pending LP
    await kv.put(`pending_lp_${telegramUserId}`, JSON.stringify({
      amount: 10, reasons: ['Telegram bridge connected — welcome gift']
    }))

    return new Response(JSON.stringify({ success: true, message: 'Connected! You earned 10 LP.' }), {
      headers: corsHeaders()
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: corsHeaders()
    })
  }
}

// ── LP Sync endpoint ──
async function handleLPSync(request, kv) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  try {
    const data = await request.json()
    const { telegramUserId } = data

    if (!telegramUserId) {
      return new Response(JSON.stringify({ error: 'Missing telegramUserId' }), {
        status: 400, headers: corsHeaders()
      })
    }

    if (!kv) {
      return new Response(JSON.stringify({ amount: 0, reasons: [] }), { headers: corsHeaders() })
    }

    const pending = await kv.get(`pending_lp_${telegramUserId}`, { type: 'json' })
    if (!pending || pending.amount === 0) {
      return new Response(JSON.stringify({ amount: 0, reasons: [] }), { headers: corsHeaders() })
    }

    // Clear pending
    await kv.put(`pending_lp_${telegramUserId}`, JSON.stringify({ amount: 0, reasons: [] }))

    return new Response(JSON.stringify(pending), { headers: corsHeaders() })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: corsHeaders()
    })
  }
}

// ── Notification endpoint ──
async function handleNotify(request, token, kv) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  try {
    const data = await request.json()
    const { telegramUserId, message } = data

    if (!telegramUserId || !message) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: corsHeaders()
      })
    }

    if (!kv) {
      return new Response(JSON.stringify({ error: 'KV not bound' }), {
        status: 500, headers: corsHeaders()
      })
    }

    const userConfig = await kv.get(`user_${telegramUserId}`, { type: 'json' })
    if (!userConfig) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: corsHeaders()
      })
    }

    await sendTelegramMessage(token, telegramUserId, message)

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: corsHeaders()
    })
  }
}

// ── Send Telegram message ──
async function sendTelegramMessage(token, chatId, text) {
  // Truncate if too long for Telegram (4096 chars max)
  if (text.length > 4000) text = text.substring(0, 4000) + '\n\n_(truncated)_'

  console.log('[FL] Sending to Telegram chat', chatId, '- length:', text.length)

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  })

  const result = await resp.json()
  console.log('[FL] Telegram API response:', JSON.stringify(result).substring(0, 200))

  if (!result.ok) {
    console.log('[FL] Telegram send FAILED:', result.description)
  }

  return new Response('OK', { status: 200 })
}
