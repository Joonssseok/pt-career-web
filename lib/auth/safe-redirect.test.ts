import { validateRedirectUrl, getSafeRedirectUrl } from './safe-redirect'

/**
 * M1.2 Safe Redirect Verification Test
 *
 * Tests URL validation against open redirect attacks.
 * Run: `node -r esbuild-register lib/auth/safe-redirect.test.ts`
 */

interface TestCase {
  input: string | null
  expected: boolean
  description: string
}

const ALLOWED_CASES: TestCase[] = [
  { input: '/my', expected: true, description: 'Basic path' },
  { input: '/reset-password', expected: true, description: 'Reset password path' },
  { input: '/my?tab=profile', expected: true, description: 'Path with query string' },
  { input: '/experts', expected: true, description: 'Experts path' },
  { input: '/', expected: true, description: 'Root path' },
]

const BLOCKED_CASES: TestCase[] = [
  { input: '//evil.com', expected: false, description: 'Protocol-relative URL' },
  { input: 'https://evil.com', expected: false, description: 'HTTPS URL' },
  { input: 'http://evil.com', expected: false, description: 'HTTP URL' },
  { input: '\\\\evil.com', expected: false, description: 'Backslash path' },
  { input: '/\\\\evil.com', expected: false, description: 'Mixed slash-backslash' },
  { input: '%2F%2Fevil.com', expected: false, description: 'URL-encoded //' },
  { input: '/%2Fevil.com', expected: false, description: 'URL-encoded forward slash' },
  { input: '%5Cevil.com', expected: false, description: 'URL-encoded backslash' },
  { input: '%00', expected: false, description: 'Null byte' },
  { input: '/%0d%0aLocation:https://evil.com', expected: false, description: 'CRLF injection' },
  { input: ' https://evil.com', expected: false, description: 'Leading whitespace' },
  { input: '/\x00evil', expected: false, description: 'Control character (null)' },
  { input: '/\x1Fevil', expected: false, description: 'Control character (unit separator)' },
  { input: '', expected: false, description: 'Empty string' },
  { input: null, expected: false, description: 'Null input' },
]

function runTests(): void {
  console.log('🧪 Safe Redirect URL Validation Tests\n')

  let passed = 0
  let failed = 0

  console.log('✅ ALLOWED CASES:')
  ALLOWED_CASES.forEach((test) => {
    const result = validateRedirectUrl(test.input)
    const status = result === test.expected ? '✓' : '✗'
    console.log(`${status} ${test.description}: ${test.input} → ${result}`)
    if (result === test.expected) {
      passed++
    } else {
      failed++
    }
  })

  console.log('\n❌ BLOCKED CASES:')
  BLOCKED_CASES.forEach((test) => {
    const result = validateRedirectUrl(test.input)
    const status = result === test.expected ? '✓' : '✗'
    const displayInput = test.input === null ? 'null' : `"${test.input}"`
    console.log(`${status} ${test.description}: ${displayInput} → ${result}`)
    if (result === test.expected) {
      passed++
    } else {
      failed++
    }
  })

  console.log(`\n📊 Results: ${passed}/${passed + failed} passed`)

  if (failed > 0) {
    console.log(`\n❌ ${failed} test(s) failed!`)
    process.exit(1)
  } else {
    console.log('\n✅ All tests passed!')
    process.exit(0)
  }
}

// Test getSafeRedirectUrl fallback
function testFallback(): void {
  console.log('\n🧪 getSafeRedirectUrl Fallback Tests\n')

  const cases = [
    { input: '/my', fallback: '/home', expected: '/my' },
    { input: '//evil.com', fallback: '/home', expected: '/home' },
    { input: null, fallback: '/home', expected: '/home' },
    { input: '/experts', fallback: '/my', expected: '/experts' },
  ]

  cases.forEach((test) => {
    const result = getSafeRedirectUrl(test.input, test.fallback)
    const status = result === test.expected ? '✓' : '✗'
    const displayInput = test.input === null ? 'null' : `"${test.input}"`
    console.log(
      `${status} Input: ${displayInput}, Fallback: "${test.fallback}" → "${result}"`
    )
  })
}

// Run tests
runTests()
testFallback()
