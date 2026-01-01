const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

// ذخیره تمام درخواست‌های شبکه
const apiCalls = [];

async function collectAPIs() {
  console.log('🚀 در حال راه‌اندازی Chrome...');
  
  // پیدا کردن مسیر Chrome
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];

  let executablePath = null;
  for (const path of chromePaths) {
    const fs = require('fs');
    if (fs.existsSync(path)) {
      executablePath = path;
      break;
    }
  }

  if (!executablePath) {
    console.error('❌ Chrome پیدا نشد! لطفاً Chrome را نصب کنید.');
    process.exit(1);
  }

  console.log(`✅ Chrome پیدا شد: ${executablePath}`);

  const browser = await puppeteer.launch({
    headless: false, // نمایش مرورگر
    executablePath: executablePath,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();

  // فعال‌سازی logging برای console
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log(`[Console ${type}]: ${text}`);
    }
  });

  // ضبط تمام درخواست‌های شبکه
  page.on('request', request => {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();
    const postData = request.postData();

    // فقط درخواست‌های API را ذخیره کن (نه فایل‌های استاتیک)
    if (url.includes('api') || 
        url.includes('ajax') || 
        url.includes('service') ||
        url.includes('webbank') ||
        (method !== 'GET' && method !== 'OPTIONS') ||
        url.endsWith('.json') ||
        headers['content-type']?.includes('application/json')) {
      
      const apiCall = {
        timestamp: new Date().toISOString(),
        url: url,
        method: method,
        headers: headers,
        postData: postData || null
      };

      apiCalls.push(apiCall);
      console.log(`📡 ${method} ${url}`);
    }
  });

  // ضبط تمام پاسخ‌های شبکه
  page.on('response', async response => {
    const url = response.url();
    const status = response.status();
    const headers = response.headers();
    const request = response.request();
    const method = request.method();

    // فقط پاسخ‌های API را ذخیره کن
    if (url.includes('api') || 
        url.includes('ajax') || 
        url.includes('service') ||
        url.includes('webbank') ||
        (method !== 'GET' && method !== 'OPTIONS') ||
        url.endsWith('.json') ||
        headers['content-type']?.includes('application/json')) {
      
      try {
        let responseBody = null;
        const contentType = headers['content-type'] || '';

        // فقط JSON و text را بخوان
        if (contentType.includes('application/json') || 
            contentType.includes('text/')) {
          try {
            responseBody = await response.text();
            // سعی کن JSON را parse کن
            try {
              responseBody = JSON.parse(responseBody);
            } catch (e) {
              // اگر JSON نیست، به صورت string نگه دار
            }
          } catch (e) {
            console.log(`⚠️  خطا در خواندن پاسخ: ${url}`);
          }
        }

        // پیدا کردن درخواست مربوطه و اضافه کردن پاسخ
        const apiCall = apiCalls.find(call => call.url === url && call.method === method);
        if (apiCall) {
          apiCall.response = {
            status: status,
            statusText: response.statusText(),
            headers: headers,
            body: responseBody
          };
          console.log(`✅ ${method} ${url} - Status: ${status}`);
        } else {
          // اگر درخواست قبلی ثبت نشده بود، یک رکورد جدید بساز
          apiCalls.push({
            timestamp: new Date().toISOString(),
            url: url,
            method: method,
            headers: request.headers(),
            postData: request.postData() || null,
            response: {
              status: status,
              statusText: response.statusText(),
              headers: headers,
              body: responseBody
            }
          });
        }
      } catch (error) {
        console.log(`❌ خطا در پردازش پاسخ: ${url} - ${error.message}`);
      }
    }
  });

  // ذخیره خودکار هر 10 ثانیه
  const autoSaveInterval = setInterval(() => {
    saveAPICalls();
  }, 10000);

  console.log('🌐 در حال باز کردن صفحه...');
  await page.goto('https://ib.sb24.ir/webbank/index', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  console.log('\n✅ صفحه باز شد!');
  console.log('📝 حالا می‌توانید وارد شوید و عملیات‌های مختلف را انجام دهید.');
  console.log('💾 داده‌ها به صورت خودکار هر 10 ثانیه ذخیره می‌شوند.');
  console.log('⏹️  برای توقف، Ctrl+C را فشار دهید.\n');

  // منتظر بمان تا کاربر Ctrl+C بزند
  process.on('SIGINT', async () => {
    console.log('\n\n⏸️  در حال ذخیره نهایی...');
    clearInterval(autoSaveInterval);
    saveAPICalls();
    await browser.close();
    console.log('✅ تمام داده‌ها ذخیره شد. فایل: api-calls.json');
    process.exit(0);
  });

  // نگه داشتن اسکریپت در حال اجرا
  await new Promise(() => {});
}

function saveAPICalls() {
  const outputPath = path.join(__dirname, 'api-calls.json');
  const data = {
    collectedAt: new Date().toISOString(),
    totalCalls: apiCalls.length,
    calls: apiCalls
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`💾 ${apiCalls.length} درخواست ذخیره شد`);
}

// اجرای اسکریپت
collectAPIs().catch(error => {
  console.error('❌ خطا:', error);
  process.exit(1);
});

