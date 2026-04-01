import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components'
import type { BriefingResult } from '@/lib/ai/generateBriefing'

interface BriefingTemplateProps {
  briefing: BriefingResult
  userName?: string
  date: string
  appUrl?: string
}

export function BriefingTemplate({
  briefing,
  userName,
  date,
  appUrl = 'http://localhost:3000',
}: BriefingTemplateProps) {
  const firstName = userName?.split(' ')[0] ?? 'there'

  return (
    <Html>
      <Head />
      <Preview>Your personalized news briefing for {date}</Preview>
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff' }}>
          {/* Header */}
          <Section style={{ backgroundColor: '#4f46e5', padding: '24px 32px' }}>
            <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: 0, letterSpacing: '-0.025em' }}>
              Daily News Brewer
            </Text>
            <Text style={{ color: '#c7d2fe', fontSize: '13px', margin: '4px 0 0 0' }}>
              {date}
            </Text>
          </Section>

          {/* Body */}
          <Section style={{ padding: '32px' }}>
            <Text style={{ fontSize: '15px', color: '#374151', margin: '0 0 24px 0' }}>
              Good morning{userName ? `, ${firstName}` : ''}! Here&apos;s your personalized news briefing.
            </Text>

            {/* Executive Summary */}
            <Section style={{ backgroundColor: '#f0f9ff', borderLeft: '4px solid #4f46e5', padding: '16px 20px', borderRadius: '0 8px 8px 0', marginBottom: '32px' }}>
              <Text style={{ color: '#4f46e5', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', margin: '0 0 8px 0' }}>
                Today&apos;s Overview
              </Text>
              <Text style={{ color: '#1e3a5f', fontSize: '15px', lineHeight: '1.7', margin: 0 }}>
                {briefing.executive_summary}
              </Text>
            </Section>

            {/* Articles */}
            <Heading as="h2" style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', fontWeight: '600', margin: '0 0 20px 0' }}>
              Top Stories
            </Heading>

            {briefing.articles.map((article, i) => (
              <Section key={i} style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #e5e7eb' }}>
                <Text style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', margin: '0 0 4px 0' }}>
                  {article.topic} · {article.source}
                </Text>
                <Heading as="h3" style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#111827', lineHeight: '1.4' }}>
                  <Link href={article.url} style={{ color: '#111827', textDecoration: 'none' }}>
                    {article.title}
                  </Link>
                </Heading>
                <Text style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#374151', lineHeight: '1.6' }}>
                  {article.summary}
                </Text>
                <Link href={article.url} style={{ fontSize: '13px', color: '#4f46e5', textDecoration: 'none' }}>
                  Read more →
                </Link>
              </Section>
            ))}
          </Section>

          {/* Footer */}
          <Hr style={{ borderColor: '#e5e7eb', margin: 0 }} />
          <Section style={{ backgroundColor: '#f9fafb', padding: '20px 32px' }}>
            <Text style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', margin: 0 }}>
              Daily News Brewer · Personalized for you
              {' · '}
              <Link href={`${appUrl}/dashboard`} style={{ color: '#6b7280' }}>Manage preferences</Link>
              {' · '}
              <Link href={`${appUrl}/dashboard/billing`} style={{ color: '#6b7280' }}>Billing</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default BriefingTemplate
