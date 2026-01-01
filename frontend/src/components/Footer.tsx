import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-xl font-bold mb-4">OneSub</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              سیستم مدیریت اشتراک پیشرفته برای مدیریت بهتر خدمات و مشتریان
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-semibold mb-4">لینک‌های سریع</h4>
            <ul className="space-y-2 space-y-reverse">
              <li>
                <Link
                  href="/"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  خانه
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  داشبورد
                </Link>
              </li>
              <li>
                <Link
                  href="/subscriptions"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  اشتراک‌ها
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  درباره ما
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-lg font-semibold mb-4">پشتیبانی</h4>
            <ul className="space-y-2 space-y-reverse">
              <li>
                <Link
                  href="/contact"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  تماس با ما
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  سوالات متداول
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  پشتیبانی فنی
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold mb-4">تماس با ما</h4>
            <ul className="space-y-2 space-y-reverse text-gray-400 text-sm">
              <li>ایمیل: info@parssub.com</li>
              <li>تلفن: 021-12345678</li>
              <li>آدرس: تهران، ایران</li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
          <p>
            © {new Date().getFullYear()} OneSub. تمامی حقوق محفوظ است.
          </p>
        </div>
      </div>
    </footer>
  );
}

