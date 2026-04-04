import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 55

function splitIntoChunks(text: string, maxLen = 4000): string[] {
  const chunks: string[] = []
  let current = ''
  const sentences = text.split(/(?<=[.!?])\s+/)
  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen) {
      if (current) chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { briefingId, script: rawScript } = await request.json() as { briefingId: string; script: string }
    if (!briefingId || !rawScript) return NextResponse.json({ error: 'Missing briefingId or script' }, { status: 400 })
    // Hard cap at 3800 chars to guarantee single TTS call and avoid timeout
    const script = rawScript.slice(0, 3800)

    // ── TTS ────────────────────────────────────────────────────────────────────
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const chunks  = splitIntoChunks(script, 4000)
    const buffers: Buffer[] = []

    for (const chunk of chunks) {
      const tts = await openai.audio.speech.create({ model: 'tts-1', voice: 'onyx', input: chunk })
      buffers.push(Buffer.from(await tts.arrayBuffer()))
    }

    const audioBuffer     = Buffer.concat(buffers)
    const wordCount       = script.split(/\s+/).length
    const durationSeconds = Math.round((wordCount / 150) * 60)

    // ── Upload to Supabase Storage ─────────────────────────────────────────────
    const fileName = `${user.id}/${Date.now()}.mp3`
    const { error: uploadError } = await supabase.storage
      .from('briefings')
      .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: false })

    if (uploadError) return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from('briefings').getPublicUrl(fileName)

    // ── Update DB record ───────────────────────────────────────────────────────
    const { data: updated, error: dbError } = await supabase
      .from('daily_briefings')
      .update({ audio_url: publicUrl, duration_seconds: durationSeconds })
      .eq('id', briefingId)
      .eq('user_id', user.id)
      .select('created_at')
      .single()

    if (dbError) return NextResponse.json({ error: 'DB update failed: ' + dbError.message }, { status: 500 })

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    const nextAt = new Date(new Date(updated.created_at).getTime() + TWENTY_FOUR_HOURS)

    return NextResponse.json({
      briefing: { audio_url: publicUrl, created_at: updated.created_at, duration_seconds: durationSeconds },
      canGenerate:  false,
      next_at:      nextAt.toISOString(),
      ms_remaining: Math.max(0, nextAt.getTime() - Date.now()),
    })
  } catch (e) {
    console.error('[daily-briefing/audio]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Audio generation failed' }, { status: 500 })
  }
}
