// تشخیص بانک‌های ایران بر اساس 6 رقم اول شماره کارت

interface BankInfo {
  name: string;
  nameEn: string;
  icon: string;
  color1: string;
  color2: string;
}

const bankData: Record<string, BankInfo> = {
  // بانک‌های دولتی
  '603799': { name: 'بانک ملی ایران', nameEn: 'Bank Melli Iran', icon: 'Melli.svg', color1: '#1E3D7E', color2: '#FFD700' },
  '589210': { name: 'بانک سپه', nameEn: 'Bank Sepah', icon: 'Sepah.svg', color1: '#F9B400', color2: '#555555' },
  '604932': { name: 'بانک سپه', nameEn: 'Bank Sepah', icon: 'Sepah.svg', color1: '#F9B400', color2: '#555555' },
  '603770': { name: 'بانک کشاورزی', nameEn: 'Bank Keshavarzi', icon: 'Keshavarzi.svg', color1: '#007A3C', color2: '#FDC300' },
  '639217': { name: 'بانک کشاورزی', nameEn: 'Bank Keshavarzi', icon: 'Keshavarzi.svg', color1: '#007A3C', color2: '#FDC300' },
  '628023': { name: 'بانک مسکن', nameEn: 'Bank Maskan', icon: 'Maskan.svg', color1: '#B17D57', color2: '#000000' },
  '603769': { name: 'بانک صادرات ایران', nameEn: 'Bank Saderat Iran', icon: 'Saderat.svg', color1: '#005CAB', color2: '#FFFFFF' },
  '589463': { name: 'بانک رفاه کارگران', nameEn: 'Bank Refah Kargaran', icon: 'Refah.svg', color1: '#002D62', color2: '#6F2DA8' },
  '627961': { name: 'بانک صنعت و معدن', nameEn: 'Bank of Industry & Mine', icon: 'Sanat Madan.svg', color1: '#2F4A98', color2: '#00A950' },
  '627648': { name: 'بانک توسعه صادرات ایران', nameEn: 'Export Development Bank (EDBI)', icon: 'Tosee Saderat.svg', color1: '#008C4A', color2: '#FFFFFF' },
  '207177': { name: 'بانک توسعه صادرات ایران', nameEn: 'Export Development Bank (EDBI)', icon: 'Tosee Saderat.svg', color1: '#008C4A', color2: '#FFFFFF' },
  '627760': { name: 'پست‌بانک ایران', nameEn: 'Post Bank Iran', icon: 'Post.svg', color1: '#008000', color2: '#D52B1E' },
  '502908': { name: 'بانک توسعه تعاون', nameEn: 'Cooperative Dev. Bank (Tosee Taavon)', icon: 'Tosee Taavon.svg', color1: '#0070B8', color2: '#FFFFFF' },
  '606373': { name: 'بانک قرض‌الحسنه مهر ایران', nameEn: 'Gharzolhasaneh Mehr Iran Bank', icon: 'Mehr Iran.svg', color1: '#3AB54A', color2: '#FFFFFF' },
  
  // بانک‌های نیمه‌خصوصی
  '610433': { name: 'بانک ملت', nameEn: 'Bank Mellat', icon: 'Mellat.svg', color1: '#FDBD51', color2: '#D81736' },
  '991975': { name: 'بانک ملت', nameEn: 'Bank Mellat', icon: 'Mellat.svg', color1: '#FDBD51', color2: '#D81736' },
  '627353': { name: 'بانک تجارت', nameEn: 'Bank Tejarat', icon: 'Tejarat.svg', color1: '#2F4A98', color2: '#FFFFFF' },
  '585983': { name: 'بانک تجارت', nameEn: 'Bank Tejarat', icon: 'Tejarat.svg', color1: '#2F4A98', color2: '#FFFFFF' },
  
  // بانک‌های خصوصی
  '627412': { name: 'بانک اقتصاد نوین', nameEn: 'Bank Eghtesad Novin (EN Bank)', icon: 'Eghtesad Novin.svg', color1: '#97199A', color2: '#C60610' },
  '622106': { name: 'بانک پارسیان', nameEn: 'Bank Parsian', icon: 'Parsian.svg', color1: '#B17D57', color2: '#000000' },
  '627884': { name: 'بانک پارسیان', nameEn: 'Bank Parsian', icon: 'Parsian.svg', color1: '#B17D57', color2: '#000000' },
  '639194': { name: 'بانک پارسیان', nameEn: 'Bank Parsian', icon: 'Parsian.svg', color1: '#B17D57', color2: '#000000' },
  '502910': { name: 'بانک کارآفرین', nameEn: 'Bank Karafarin', icon: 'Karafarin.svg', color1: '#D4AF64', color2: '#2F7747' },
  '627488': { name: 'بانک کارآفرین', nameEn: 'Bank Karafarin', icon: 'Karafarin.svg', color1: '#D4AF64', color2: '#2F7747' },
  '621986': { name: 'بانک سامان', nameEn: 'Bank Saman', icon: 'Saman.svg', color1: '#00A8E7', color2: '#0070B9' },
  '502229': { name: 'بانک پاسارگاد', nameEn: 'Bank Pasargad', icon: 'Pasargad.svg', color1: '#FFC41E', color2: '#555555' },
  '639347': { name: 'بانک پاسارگاد', nameEn: 'Bank Pasargad', icon: 'Pasargad.svg', color1: '#FFC41E', color2: '#555555' },
  '639607': { name: 'بانک سرمایه', nameEn: 'Bank Sarmayeh', icon: 'Sarmayeh.svg', color1: '#1C4F8E', color2: '#AAAAAA' },
  '639346': { name: 'بانک سینا', nameEn: 'Bank Sina', icon: 'Sina.svg', color1: '#002B5C', color2: '#FFFFFF' },
  '502806': { name: 'بانک شهر', nameEn: 'Bank Shahr', icon: 'Shahr.svg', color1: '#EE1C25', color2: '#FFFFFF' },
  '504706': { name: 'بانک شهر', nameEn: 'Bank Shahr', icon: 'Shahr.svg', color1: '#EE1C25', color2: '#FFFFFF' },
  '502938': { name: 'بانک دی', nameEn: 'Bank Day', icon: 'Dey.svg', color1: '#00899C', color2: '#4D4D4D' },
  '636214': { name: 'بانک آینده', nameEn: 'Bank Ayandeh', icon: 'Ayandeh.svg', color1: '#572600', color2: '#B38807' },
  '505416': { name: 'بانک گردشگری', nameEn: 'Tourism Bank (Gardeshgari)', icon: 'Gardeshgari.svg', color1: '#009B5D', color2: '#FBB03B' },
  '505785': { name: 'بانک ایران‌زمین', nameEn: 'Bank Iran Zamin', icon: 'Iran Zamin.svg', color1: '#8E24AA', color2: '#EC407A' },
  '505809': { name: 'بانک خاورمیانه', nameEn: 'Middle East Bank', icon: 'Khavar Mianeh.svg', color1: '#FF8800', color2: '#212121' },
  '585947': { name: 'بانک خاورمیانه', nameEn: 'Middle East Bank', icon: 'Khavar Mianeh.svg', color1: '#FF8800', color2: '#212121' },
  '504172': { name: 'بانک قرض‌الحسنه رسالت', nameEn: 'Qarz-al-Hasaneh Resalat Bank', icon: 'Resalat.svg', color1: '#00BCE4', color2: '#FFFFFF' },
  
  // نئوبانک‌ها
  '62198619': { name: 'بلوبانک', nameEn: 'Blu Bank', icon: 'Blu Bank.svg', color1: '#4b84de', color2: '#17325e' },
  
  // بانک‌های ادغام‌شده در بانک سپه
  '627381': { name: 'بانک انصار', nameEn: 'Ansar Bank', icon: 'Sepah.svg', color1: '#F9B400', color2: '#555555' },
  '639599': { name: 'بانک قوامین', nameEn: 'Qavamin Bank', icon: 'Sepah.svg', color1: '#F9B400', color2: '#555555' },
  '639370': { name: 'بانک مهر اقتصاد', nameEn: 'Mehr Eghtesad Bank', icon: 'Sepah.svg', color1: '#F9B400', color2: '#555555' },
  '636949': { name: 'بانک حکمت ایرانیان', nameEn: 'Hekmat Iranian Bank', icon: 'Sepah.svg', color1: '#F9B400', color2: '#555555' },
  '505801': { name: 'مؤسسه کوثر', nameEn: 'Kosar Credit', icon: 'Sepah.svg', color1: '#F9B400', color2: '#555555' }
};

/**
 * تشخیص بانک بر اساس شماره کارت
 * @param cardNumber - شماره کارت (با یا بدون فاصله)
 * @returns اطلاعات بانک یا null اگر پیدا نشد
 */
const detectBank = (cardNumber: string): BankInfo | null => {
  if (!cardNumber) return null;
  
  // حذف فاصله‌ها و کاراکترهای غیر عددی
  const cleanNumber = cardNumber.replace(/[^\d]/g, '');
  
  // بررسی حداقل 6 رقم
  if (cleanNumber.length < 6) return null;
  
  // ابتدا بررسی 8 رقم اول برای بلوبانک
  if (cleanNumber.length >= 8) {
    const firstEightDigits = cleanNumber.substring(0, 8);
    if (bankData[firstEightDigits]) {
      return bankData[firstEightDigits];
    }
  }
  
  // سپس بررسی 6 رقم اول
  const firstSixDigits = cleanNumber.substring(0, 6);
  
  // جستجو در دیتابیس بانک‌ها
  return bankData[firstSixDigits] || null;
};

/**
 * دریافت آیکون بانک
 * @param cardNumber - شماره کارت
 * @returns مسیر آیکون یا null
 */
export const getBankIcon = (cardNumber: string): string | null => {
  const bank = detectBank(cardNumber);
  return bank ? `/bank-icons/${bank.icon}` : null;
};

/**
 * دریافت نام بانک
 * @param cardNumber - شماره کارت
 * @returns نام بانک یا null
 */
export const getBankName = (cardNumber: string): string | null => {
  const bank = detectBank(cardNumber);
  return bank ? bank.name : null;
};

/**
 * دریافت نام انگلیسی بانک
 * @param cardNumber - شماره کارت
 * @returns نام انگلیسی بانک یا null
 */
export const getBankNameEn = (cardNumber: string): string | null => {
  const bank = detectBank(cardNumber);
  return bank ? bank.nameEn : null;
};

// Export bankData و detectBank برای استفاده در کامپوننت‌ها
export { bankData, detectBank };

