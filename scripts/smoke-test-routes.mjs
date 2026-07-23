import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3000';

const routes = [
  '/expert/onboarding/profile',
  '/expert/onboarding/workplace',
  '/expert/onboarding/experience',
  '/expert/onboarding/education',
  '/expert/onboarding/specialties',
];

async function runSmokeTest() {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const results = [];

  for (const route of routes) {
    console.log(`\n📋 Testing: ${route}`);
    console.log('─'.repeat(60));

    const page = await browser.newPage();

    // Collect errors and failed requests
    const pageErrors = [];
    const failedRequests = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    page.on('requestfailed', (request) => {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText,
      });
    });

    try {
      // Navigate to route
      const response = await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'networkidle0',
      });

      const statusCode = response.status();
      console.log(`HTTP Status: ${statusCode}`);

      // Get page text to check for runtime errors
      const bodyText = await page.evaluate(() => document.body.innerText);

      // Check for error indicators
      const hasRuntimeError = bodyText.includes('Runtime Error');
      const hasCannotFindModule = bodyText.includes('Cannot find module');

      console.log(`Runtime Error: ${hasRuntimeError ? '❌ DETECTED' : '✅ None'}`);
      console.log(`Cannot find module: ${hasCannotFindModule ? '❌ DETECTED' : '✅ None'}`);
      console.log(`Page Errors: ${pageErrors.length} ${pageErrors.length > 0 ? '❌' : '✅'}`);
      console.log(`Failed Requests: ${failedRequests.length} ${failedRequests.length > 0 ? '⚠️' : '✅'}`);

      // Check main heading
      const heading = await page.evaluate(() => {
        const h2 = document.querySelector('h2');
        return h2 ? h2.innerText : 'Not found';
      });
      console.log(`Heading: ${heading}`);

      // Determine pass/fail
      const isPassed =
        statusCode === 200 &&
        !hasRuntimeError &&
        !hasCannotFindModule &&
        pageErrors.length === 0;

      results.push({
        route,
        status: statusCode,
        runtimeError: hasRuntimeError,
        cannotFindModule: hasCannotFindModule,
        pageErrors: pageErrors.length,
        failedRequests: failedRequests.length,
        heading,
        passed: isPassed,
      });

      console.log(`Result: ${isPassed ? '✅ PASS' : '❌ FAIL'}`);

      if (pageErrors.length > 0) {
        console.log(`Errors: ${pageErrors.join(' | ')}`);
      }
      if (failedRequests.length > 0) {
        console.log(`Failed Requests:`);
        failedRequests.forEach((req) => {
          console.log(`  - ${req.url}: ${req.error}`);
        });
      }

    } catch (error) {
      console.log(`Exception: ${error.message}`);
      results.push({
        route,
        status: 'ERROR',
        error: error.message,
        passed: false,
      });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('SMOKE TEST SUMMARY');
  console.log('='.repeat(60));

  const summary = results.map((r) => ({
    route: r.route,
    status: r.passed ? '✅ PASS' : '❌ FAIL',
    http: r.status,
  }));

  console.table(summary);

  const passCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log(`\n${passCount}/${totalCount} routes passed`);

  if (passCount === totalCount) {
    console.log('\n🎉 ALL TESTS PASSED');
    return 0;
  } else {
    console.log('\n⚠️  SOME TESTS FAILED');
    console.log('\nDetailed Results:');
    results.forEach((r) => {
      if (!r.passed) {
        console.log(`\n❌ ${r.route}`);
        console.log(`   HTTP: ${r.status}`);
        console.log(`   Runtime Error: ${r.runtimeError || r.error}`);
        console.log(`   Cannot find module: ${r.cannotFindModule}`);
        console.log(`   Page Errors: ${r.pageErrors}`);
      }
    });
    return 1;
  }
}

runSmokeTest().then((exitCode) => {
  process.exit(exitCode);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
