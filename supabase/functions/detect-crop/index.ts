// Harvest Rentals: guess which crop is in a photo, using the Gemini API.
//
// The Gemini key stays here on the server (secret GEMINI_API_KEY) and is never sent
// to the browser. Only signed-in users can call this function (JWT is verified).
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   GEMINI_API_KEY   required, a free key from Google AI Studio
//   GEMINI_MODEL     optional, tried first. Fallbacks are tried if it is busy or retired.
//
// Request:  POST { image: "<base64 jpeg/png/webp, no data: prefix>", mime: "image/jpeg" }
// Response: { crop: "wheat" | null, confidence: "high"|"medium"|"low", alternatives: ["barley"] }

const CROPS = [
  'wheat',
  'rice',
  'maize',
  'sugarcane',
  'cotton',
  'soybean',
  'groundnut',
  'millet',
  'barley',
  'mustard',
  'chickpea',
  'pigeon_pea',
] as const

// Tried in order. Older models such as gemini-2.5-flash are closed to new keys.
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest']

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BASE64_LENGTH = 1_500_000 // about 1.1 MB of picture
const CONFIDENCE = ['high', 'medium', 'low']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const PROMPT = `You help Indian farmers. Look at this photo and decide which ONE crop it shows.
Choose only from this list: ${CROPS.join(', ')}.
- If the photo does not clearly show one of these crops (for example it is blurry, a person, an
  animal, soil only, or a crop not in the list), answer crop = "none".
- confidence is "high" only when you are sure, "medium" when it is probably right, "low" when
  you are guessing.
- alternatives: up to 2 other crops from the list that it could also be (can be empty).
Answer with JSON only.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'not_configured' }, 500)
  const models = [Deno.env.get('GEMINI_MODEL'), ...FALLBACK_MODELS].filter(
    (name, index, list): name is string => Boolean(name) && list.indexOf(name) === index,
  )

  let payload: { image?: unknown; mime?: unknown }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const image = payload.image
  const mime = payload.mime
  if (
    typeof image !== 'string' ||
    image.length < 100 ||
    image.length > MAX_BASE64_LENGTH ||
    typeof mime !== 'string' ||
    !ALLOWED_MIME.includes(mime) ||
    !/^[A-Za-z0-9+/=]+$/.test(image)
  ) {
    return json({ error: 'bad_image' }, 400)
  }

  const body = {
    contents: [
      {
        parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: image } }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          crop: { type: 'STRING', enum: [...CROPS, 'none'] },
          confidence: { type: 'STRING', enum: CONFIDENCE },
          alternatives: { type: 'ARRAY', items: { type: 'STRING', enum: [...CROPS] } },
        },
        required: ['crop', 'confidence'],
      },
    },
  }

  let response: Response | null = null
  let lastStatus = 0
  for (const model of models) {
    try {
      const attempt = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20_000),
        },
      )
      lastStatus = attempt.status
      if (attempt.ok) {
        response = attempt
        break
      }
      // Model retired (404), busy (503) or out of free quota (429): try the next one.
      if (![404, 429, 500, 503].includes(attempt.status)) break
    } catch {
      lastStatus = 0
    }
  }

  if (!response) {
    if (lastStatus === 429) return json({ error: 'busy' }, 429)
    return json({ error: 'upstream_error', status: lastStatus }, 502)
  }

  try {
    const data = await response.json()
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
    const parsed = JSON.parse(text ?? '{}') as {
      crop?: string
      confidence?: string
      alternatives?: unknown
    }
    const crop = (CROPS as readonly string[]).includes(parsed.crop ?? '') ? parsed.crop! : null
    const confidence = CONFIDENCE.includes(parsed.confidence ?? '') ? parsed.confidence! : 'low'
    const alternatives = Array.isArray(parsed.alternatives)
      ? parsed.alternatives
          .filter((item): item is string => typeof item === 'string')
          .filter((item) => (CROPS as readonly string[]).includes(item) && item !== crop)
          .slice(0, 2)
      : []
    return json({ crop, confidence: crop ? confidence : 'low', alternatives })
  } catch {
    return json({ error: 'bad_answer' }, 502)
  }
})
