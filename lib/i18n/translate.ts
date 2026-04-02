import type { Locale } from './index'
import en from './messages/en.json'

export type Messages = Record<string, unknown>

const messagesMap: Record<Locale, Messages> = { en }

export function getMessages(locale: Locale): Messages {
  return messagesMap[locale] ?? messagesMap.en
}

function getNestedValue(obj: Messages, path: string): string {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Messages)[key]
    return undefined
  }, obj) as string ?? path
}

export function createTranslator(messages: Messages) {
  return function t(key: string, params?: Record<string, string | number>): string {
    let value = getNestedValue(messages, key)
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      })
    }
    return value
  }
}
