# Saman Bank API Collector

این اسکریپت برای جمع‌آوری API های وب‌سایت بانک سامان طراحی شده است.

## نصب

```bash
npm install
```

## استفاده

```bash
npm start
```

یا

```bash
node collect.js
```

## نحوه کار

1. اسکریپت Chrome را به صورت خودکار باز می‌کند
2. به آدرس `https://ib.sb24.ir/webbank/index` می‌رود
3. تمام درخواست‌های شبکه را ضبط می‌کند
4. داده‌ها را در فایل `api-calls.json` ذخیره می‌کند

## نکات مهم

- بعد از باز شدن Chrome، می‌توانید وارد حساب کاربری شوید
- تمام عملیات‌های مختلف را انجام دهید (استعلام موجودی، تراکنش‌ها، و غیره)
- داده‌ها به صورت خودکار هر 10 ثانیه ذخیره می‌شوند
- برای توقف، `Ctrl+C` را فشار دهید

## خروجی

فایل `api-calls.json` شامل:
- URL هر درخواست
- Method (GET, POST, PUT, DELETE)
- Headers
- Request Body (در صورت وجود)
- Response Status
- Response Headers
- Response Body

