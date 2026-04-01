import { Resend } from 'resend'

// Lazy singleton — prevents build-time crash when RESEND_API_KEY is absent
let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!)
  }
  return _resend
}

// Proxy alias for convenience
export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return (getResend() as unknown as Record<string, unknown>)[prop as string]
  },
})
