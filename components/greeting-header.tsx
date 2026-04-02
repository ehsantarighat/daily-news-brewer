'use client'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function GreetingHeader({ name, subtitle }: { name: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
        {getGreeting()}, {name}!
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
    </div>
  )
}
