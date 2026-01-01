const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const sessionManager = require('./sessionManager');

// ذخیره تمام درخواست‌های مهم API
const importantAPICalls = [];

// پیدا کردن مسیر Chrome
function findChromePath() {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];

  for (const chromePath of chromePaths) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  return null;
}

async function autoLogin() {
  console.log('🚀 Starting Chrome...');
  
  const chromePath = findChromePath();
  if (!chromePath) {
    console.error('❌ Chrome not found! Please install Chrome.');
    process.exit(1);
  }

  console.log(`✅ Chrome found: ${chromePath}`);

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const page = await browser.newPage();

  // تنظیم User-Agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36');

  // لیست API های مهم که باید ضبط شوند
  const importantAPIPatterns = [
    '/api/auth/login',
    '/api/auth/logout',
    '/api/userConfigs',
    '/api/transactionResources',
    '/api/depositList',
    '/api/notifications',
    '/api/transferMoney',
    '/api/balance',
    '/api/transactions',
    '/api/cards',
    '/api/accounts'
  ];

  // ضبط درخواست‌های مهم
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    
    // بررسی اینکه آیا این یک API مهم است
    const isImportant = importantAPIPatterns.some(pattern => url.includes(pattern));
    
    if (isImportant && (method === 'GET' || method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      const headers = request.headers();
      const postData = request.postData();
      
      const apiCall = {
        timestamp: new Date().toISOString(),
        url: url,
        method: method,
        headers: headers,
        postData: postData || null
      };

      importantAPICalls.push(apiCall);
      console.log(`📡 ${method} ${url}`);
    }
  });

  // ضبط پاسخ‌های مهم
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    const request = response.request();
    const method = request.method();
    
    // بررسی اینکه آیا این یک API مهم است
    const isImportant = importantAPIPatterns.some(pattern => url.includes(pattern));
    
    if (isImportant && (method === 'GET' || method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      try {
        const headers = response.headers();
        let responseBody = null;
        const contentType = headers['content-type'] || '';

        // فقط JSON را بخوان
        if (contentType.includes('application/json')) {
          try {
            responseBody = await response.json();
          } catch (e) {
            try {
              responseBody = await response.text();
            } catch (e2) {
              console.log(`⚠️  Error reading response: ${url}`);
            }
          }
        }

        // پیدا کردن درخواست مربوطه و اضافه کردن پاسخ
        const apiCall = importantAPICalls.find(call => call.url === url && call.method === method);
        if (apiCall) {
          apiCall.response = {
            status: status,
            statusText: response.statusText(),
            headers: headers,
            body: responseBody
          };
          console.log(`✅ ${method} ${url} - Status: ${status}`);
          
          // اگر لاگین بود، اطلاعات سشن را ذخیره کن
          if (url.includes('/api/auth/login') && status === 200 && responseBody) {
            saveLoginSession(response, responseBody);
          }
        }
      } catch (error) {
        console.log(`❌ Error processing response: ${url} - ${error.message}`);
      }
    }
  });

  console.log('🌐 Opening page...');
  await page.goto('https://ib.sb24.ir/webbank/index', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  console.log('✅ Page opened!');
  console.log('⏳ Waiting for page to fully load (10 seconds)...');
  
  // Wait for page to fully load - at least 10 seconds
  await page.waitForTimeout(10000);
  
  // Wait for Angular app to initialize
  await page.waitForFunction(() => {
    return document.querySelector('app-login') !== null || 
           document.querySelector('form.login-form') !== null;
  }, { timeout: 30000 });
  
  console.log('✅ Angular app initialized');
  await page.waitForTimeout(2000); // Additional wait for form rendering

  // Get login credentials from environment variables
  const username = process.env.SAMAN_USERNAME || 'onebit.ir';
  const password = process.env.SAMAN_PASSWORD || 'Alireza1380#';

  console.log(`🔐 Logging in with user: ${username}`);

  try {
    console.log('🔍 Finding login fields...');
    
    // Wait for Angular Material form to load
    await page.waitForSelector('app-login, form.login-form, mat-form-field', { 
      timeout: 30000,
      visible: true 
    });
    
    console.log('✅ Login form found');
    await page.waitForTimeout(2000); // Wait for Angular to render
    
    // Find username field using formcontrolname (Angular Material)
    const usernameSelectors = [
      'input[formcontrolname="username"]',
      'input[id*="mat-input-0"]',
      'input[name*="tsn-input"]',
      'input[type="text"].mat-mdc-input-element',
      'input[type="text"]'
    ];

    let usernameField = null;
    for (const selector of usernameSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000, visible: true });
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          // Check if element is visible and clickable
          const isVisible = await elements[0].isIntersectingViewport();
          if (isVisible) {
            usernameField = elements[0];
            console.log(`✅ Username field found with selector: ${selector}`);
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!usernameField) {
      throw new Error('Username field not found');
    }

    // Wait for element to be ready
    await page.waitForTimeout(1000);
    
    // Enter username
    await usernameField.focus();
    await page.waitForTimeout(500);
    await usernameField.click({ clickCount: 3 });
    await page.waitForTimeout(300);
    await usernameField.type(username, { delay: 100 });
    console.log('✅ Username entered');

    // Find password field using formcontrolname (Angular Material)
    const passwordSelectors = [
      'input[formcontrolname="password"]',
      'input[type="password"][id*="mat-input-1"]',
      'input[type="password"][name*="tsn-password"]',
      'input[type="password"].mat-mdc-input-element',
      'input[type="password"]'
    ];
    
    let passwordField = null;
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000, visible: true });
        const elements = await page.$$(selector);
        
        // Find the visible password field (skip hidden ones)
        for (const element of elements) {
          const isHidden = await page.evaluate(el => {
            return el.style.display === 'none' || 
                   el.tabIndex === -2 || 
                   el.id === 'prevent_autofill' ||
                   window.getComputedStyle(el).display === 'none';
          }, element);
          
          if (!isHidden) {
            const isVisible = await element.isIntersectingViewport();
            if (isVisible) {
              passwordField = element;
              console.log(`✅ Password field found with selector: ${selector}`);
              break;
            }
          }
        }
        
        if (passwordField) break;
      } catch (e) {
        continue;
      }
    }
    
    if (!passwordField) {
      throw new Error('Password field not found');
    }
    
    // Check if element is visible
    const isPasswordVisible = await passwordField.isIntersectingViewport();
    if (!isPasswordVisible) {
      // Scroll to element
      await passwordField.scrollIntoView();
      await page.waitForTimeout(500);
    }

    // Enter password
    await passwordField.focus();
    await page.waitForTimeout(500);
    await passwordField.click({ clickCount: 3 });
    await page.waitForTimeout(300);
    await passwordField.type(password, { delay: 100 });
    console.log('✅ Password entered');

    // Find login button using different methods
    let loginButton = null;
    
    // Method 1: Direct search for submit button
    try {
      loginButton = await page.$('button[type="submit"]');
    } catch (e) {}
    
    // Method 2: Search in login-button-container
    if (!loginButton) {
      try {
        loginButton = await page.$('.login-button-container button[type="submit"], .login-button button');
      } catch (e) {}
    }
    
    // Method 3: XPath search for button with "ورود" text
    if (!loginButton) {
      try {
        const buttons = await page.$x("//button[contains(text(), 'ورود')]");
        if (buttons.length > 0) loginButton = buttons[0];
      } catch (e) {}
    }
    
    // Method 4: Class search
    if (!loginButton) {
      try {
        loginButton = await page.$('button.btn-main, button.login-button, input[type="submit"]');
      } catch (e) {}
    }

    // If button found, try to click it
    if (loginButton) {
      try {
        // Check if element is visible
        const isButtonVisible = await loginButton.isIntersectingViewport();
        if (!isButtonVisible) {
          await loginButton.scrollIntoView();
          await page.waitForTimeout(500);
        }
        
        await page.waitForTimeout(500);
        await loginButton.click();
        console.log('✅ Login button clicked');
      } catch (e) {
        console.log(`⚠️  Error clicking button: ${e.message}`);
        console.log('⚠️  Using Enter key...');
        await passwordField.press('Enter');
      }
    } else {
      console.log('⚠️  Login button not found, using Enter key...');
      await page.waitForTimeout(500);
      await passwordField.press('Enter');
    }

    console.log('⏳ Waiting for login response...');
    
    // Wait for login to complete (or error)
    // Wait for URL change or main page elements to appear
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }),
        page.waitForSelector('app-root, [class*="home"], [class*="dashboard"]', { timeout: 15000 })
      ]);
      console.log('✅ Login page loaded');
    } catch (e) {
      console.log('⚠️  Waiting for page to load...');
      await page.waitForTimeout(5000);
    }

    // Check if login was successful
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    // If navigated to home page, login was successful
    if (currentUrl.includes('/home') || currentUrl.includes('/dashboard')) {
      console.log('✅ Login successful!');
    } else {
      console.log('⚠️  Login may have failed or requires additional confirmation');
    }

    // Wait for API calls to complete
    console.log('⏳ Waiting for API calls...');
    await page.waitForTimeout(10000);

    // Save API calls before closing
    saveAPICalls();

    console.log('\n✅ Done!');
    console.log(`📊 Total API calls recorded: ${importantAPICalls.length}`);
    console.log('💾 Data saved to important-api-calls.json');

    // Close browser after 5 seconds
    console.log('\n⏳ Browser will close in 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();

  } catch (error) {
    console.error('❌ Login error:', error.message);
    
    // Save API calls that have been recorded so far
    if (importantAPICalls.length > 0) {
      saveAPICalls();
      console.log(`💾 ${importantAPICalls.length} API calls saved`);
    }
    
    console.log('\n⚠️  Please login manually and perform various operations');
    console.log('💾 Data will be saved automatically');
    console.log('⏹️  Press Ctrl+C to stop\n');

    // Auto-save every 30 seconds
    const autoSaveInterval = setInterval(() => {
      if (importantAPICalls.length > 0) {
        saveAPICalls();
      }
    }, 30000);

    // Wait for user to press Ctrl+C
    process.on('SIGINT', async () => {
      console.log('\n\n⏸️  Saving final data...');
      clearInterval(autoSaveInterval);
      saveAPICalls();
      await browser.close();
      console.log('✅ All data saved.');
      process.exit(0);
    });

    await new Promise(() => {});
  }
}

function saveLoginSession(response, responseBody) {
  try {
    // Extract csrftoken from header
    const csrfToken = response.headers()['csrftoken'] || response.headers()['csrf-token'];
    
    const sessionData = {
      csrfToken: csrfToken || null,
      userInfo: responseBody.userInfoResponseModel || null,
      authExpiration: responseBody.authExpiration || null,
      passwordExpiration: responseBody.passwordExpiration || null,
      lastClientAddress: responseBody.lastClientAddress || null,
      twoPhaseLoginWithTicketRequired: responseBody.twoPhaseLoginWithTicketRequired || false,
      gender: responseBody.gender || null
    };

    sessionManager.saveSession(sessionData);
    console.log('✅ Session information saved');
    
    if (responseBody.userInfoResponseModel) {
      console.log(`👤 User: ${responseBody.userInfoResponseModel.name || 'Unknown'}`);
      console.log(`🆔 User ID: ${responseBody.userInfoResponseModel.id || 'Unknown'}`);
    }
  } catch (error) {
    console.error('❌ Error saving session:', error.message);
  }
}

function saveAPICalls() {
  const outputPath = path.join(__dirname, 'important-api-calls.json');
  const data = {
    collectedAt: new Date().toISOString(),
    totalCalls: importantAPICalls.length,
    calls: importantAPICalls
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`💾 ${importantAPICalls.length} important requests saved`);
}

// Run script
autoLogin().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

