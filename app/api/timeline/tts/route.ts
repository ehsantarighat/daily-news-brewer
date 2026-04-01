import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey === 'your-openai-api-key') {
    return new Response('OPENAI_API_KEY not configured', { status: 501 })
  }

  const { text } = await request.json() as { text: string }
  if (!text?.trim()) return new Response('No text provided', { status: 400 })

  const openai = getOpenAIClient()

  const response = await openai.audio.speech.create({
    model: 'tts-1-hd',   // high quality
    voice: 'nova',        // warm, natural female voice
    input: text,
    response_format: 'mp3',
  })

  const buffer = await response.arrayBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
