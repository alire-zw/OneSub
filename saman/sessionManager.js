const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, 'session.json');

class SessionManager {
  constructor() {
    this.session = null;
    this.loadSession();
  }

  loadSession() {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const data = fs.readFileSync(SESSION_FILE, 'utf8');
        this.session = JSON.parse(data);
        
        // بررسی انقضای سشن
        if (this.session && this.session.authExpiration) {
          const expirationTime = this.session.authExpiration.sessionExpirationDate;
          const now = Date.now();
          
          if (now >= expirationTime) {
            console.log('⚠️  سشن منقضی شده است');
            this.clearSession();
            return;
          }
        }
        
        console.log('✅ سشن از فایل بارگذاری شد');
      }
    } catch (error) {
      console.error('❌ خطا در بارگذاری سشن:', error.message);
      this.session = null;
    }
  }

  saveSession(sessionData) {
    try {
      this.session = {
        ...sessionData,
        savedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(SESSION_FILE, JSON.stringify(this.session, null, 2), 'utf8');
      console.log('✅ سشن ذخیره شد');
      return true;
    } catch (error) {
      console.error('❌ خطا در ذخیره سشن:', error.message);
      return false;
    }
  }

  getSession() {
    return this.session;
  }

  getCsrfToken() {
    return this.session?.csrfToken || null;
  }

  getUserInfo() {
    return this.session?.userInfo || null;
  }

  getAuthExpiration() {
    return this.session?.authExpiration || null;
  }

  isSessionValid() {
    if (!this.session || !this.session.csrfToken) {
      return false;
    }

    // بررسی انقضای سشن
    if (this.session.authExpiration) {
      const expirationTime = this.session.authExpiration.sessionExpirationDate;
      const now = Date.now();
      
      if (now >= expirationTime) {
        return false;
      }
    }

    return true;
  }

  clearSession() {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        fs.unlinkSync(SESSION_FILE);
      }
      this.session = null;
      console.log('✅ سشن پاک شد');
      return true;
    } catch (error) {
      console.error('❌ خطا در پاک کردن سشن:', error.message);
      return false;
    }
  }

  updateSession(updates) {
    if (!this.session) {
      return false;
    }

    try {
      this.session = {
        ...this.session,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(SESSION_FILE, JSON.stringify(this.session, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('❌ خطا در به‌روزرسانی سشن:', error.message);
      return false;
    }
  }
}

module.exports = new SessionManager();

