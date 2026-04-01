import type { Locale } from './index'

import en from './messages/en.json'
import fr from './messages/fr.json'
import ru from './messages/ru.json'
import fa from './messages/fa.json'
import ar from './messages/ar.json'
import de from './messages/de.json'
import tr from './messages/tr.json'
import uz from './messages/uz.json'

export type Messages = Record<string, unknown>

const messagesMap: Record<Locale, Messages> = { en, fr, ru, fa, ar, de, tr, uz }

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
