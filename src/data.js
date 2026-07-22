// Seed data for the demo account. Static fixture — no real customer data.

export const ACCOUNT = {
  name: '360 Checking',
  numberMasked: '360 CHECKING...1164',
  startingBalance: 6827.44,
  ownerFirstName: 'Vasanth',
}

// Known Zelle recipients — Capital One leader names per Shantanu (Jul 22):
// never Ravi/Vasanth in front of judges. Anything typed that isn't in this
// list becomes a first-seen payee.
export const KNOWN_PAYEES = [
  {
    id: 'rich',
    name: 'RICH FAIRBANK',
    display: 'Rich Fairbank',
    contact: 'rich.fairbank@zellemail.com',
    lastPaid: 'Jul 12',
  },
  {
    id: 'raji',
    name: 'RAJI CHOCKAIYAN',
    display: 'Raji Chockaiyan',
    contact: 'raji.chockaiyan@zellemail.com',
    lastPaid: 'Jul 8',
  },
]

export const UPCOMING_TRANSACTIONS = []

export const PAST_TRANSACTIONS = [
  { date: 'Jul 20', description: 'RICH FAIRBANK', category: 'Zelle Money Sent', amount: -300.0, balance: 6827.44 },
  { date: 'Jul 20', description: 'RAJI CHOCKAIYAN', category: 'Zelle Money Sent', amount: -200.0, balance: 7127.44 },
  { date: 'Jul 19', description: 'WOODMAN’S FOODS', category: 'Purchase', amount: -31.46, balance: 7327.44 },
  { date: 'Jul 17', description: 'LOWE’S', category: 'Purchase', amount: -527.82, balance: 7358.9 },
  { date: 'Jul 16', description: 'RICH FAIRBANK', category: 'Zelle Money Sent', amount: -100.0, balance: 7886.72 },
  { date: 'Jul 15', description: 'PAYROLL DEPOSIT', category: 'Direct Deposit', amount: 2450.0, balance: 7986.72 },
  { date: 'Jul 14', description: 'CITY COFFEE ROASTERS', category: 'Purchase', amount: -12.4, balance: 5536.72 },
  { date: 'Jul 14', description: 'RICH FAIRBANK', category: 'Zelle Money Sent', amount: -25.0, balance: 5549.12 },
]

export const PROMOS = [
  {
    text: 'Use your Capital One debit card 5 times by 8/31 and earn a $10 summer bonus. ',
    link: 'Get details.',
  },
  {
    text: 'Vasanth, ',
    link: 'sharing 360 Checking with friends could earn you $50 per referral, up to $500 a year.',
  },
  {
    text: 'Get tips and information to help you manage your finances, credit and more. ',
    link: 'Visit Learn & Grow.',
  },
]

export function formatUsd(n) {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Mimics the Zelle directory lookup: any contact resolves to an "enrolled as"
// name, so the UI never needs to ask for one (matches the real flow).
const GENERIC_LOCALS = new Set([
  'contact', 'support', 'info', 'hello', 'admin', 'help', 'service', 'billing',
  'pay', 'payments', 'team', 'office',
])

export function deriveEnrolledName(contact) {
  const c = contact.trim()
  if (!c.includes('@')) {
    // phone number
    const digits = c.replace(/\D/g, '')
    return `ZELLE MEMBER ${digits.slice(-4)}`
  }
  const [local, domain] = c.toLowerCase().split('@')
  const source = GENERIC_LOCALS.has(local.replace(/\d+$/, ''))
    ? domain.split('.')[0]
    : local.replace(/\d+$/, '')
  return source
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function makeConfirmationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTVWXYZ0123456789'
  let code = 'COF'
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}
