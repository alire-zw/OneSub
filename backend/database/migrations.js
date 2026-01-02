require('dotenv').config();
const mysql = require('mysql2/promise');

const createDatabase = async () => {
  const dbName = process.env.DB_NAME || 'onesub';
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database '${dbName}' created or already exists`);
  } catch (error) {
    console.error('Error creating database:', error);
    throw error;
  } finally {
    await connection.end();
  }
};

const createUsersTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userName VARCHAR(255),
      telegramID BIGINT UNIQUE,
      phoneNumber VARCHAR(20),
      userEmail VARCHAR(255),
      isPremium BOOLEAN DEFAULT FALSE,
      loginInfo ENUM('telegramMiniApp', 'webSite') NOT NULL,
      role ENUM('user', 'merchants', 'admin') NOT NULL DEFAULT 'user',
      dateCreated DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastActivity DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_telegram_id (telegramID),
      INDEX idx_phone (phoneNumber),
      INDEX idx_email (userEmail),
      INDEX idx_login_info (loginInfo),
      INDEX idx_role (role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Users table created successfully');
  } catch (error) {
    console.error('Error creating users table:', error);
    throw error;
  }
};

const addLoginInfoColumn = async () => {
  const mysqlDb = require('./mysql');
  
  try {
    const columns = await mysqlDb.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'loginInfo'
    `);

    if (!columns || columns.length === 0) {
      await mysqlDb.query(`
        ALTER TABLE users 
        ADD COLUMN loginInfo ENUM('telegramMiniApp', 'webSite') NOT NULL DEFAULT 'webSite' 
        AFTER isPremium
      `);
      console.log('LoginInfo column added successfully');
    } else {
      console.log('LoginInfo column already exists');
    }
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('LoginInfo column already exists');
    } else {
      console.error('Error adding loginInfo column:', error);
      throw error;
    }
  }
};

const addRoleColumn = async () => {
  const mysqlDb = require('./mysql');
  
  try {
    const columns = await mysqlDb.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'role'
    `);

    if (!columns || columns.length === 0) {
      await mysqlDb.query(`
        ALTER TABLE users 
        ADD COLUMN role ENUM('user', 'merchants', 'admin') NOT NULL DEFAULT 'user' 
        AFTER loginInfo
      `);
      
      // Create index for role column (if it doesn't already exist)
      try {
        await mysqlDb.query(`
          CREATE INDEX idx_role ON users(role)
        `);
        console.log('Role index created successfully');
      } catch (indexError) {
        if (indexError.code === 'ER_DUP_KEYNAME') {
          console.log('Role index already exists');
        } else {
          throw indexError;
        }
      }
      
      console.log('Role column added successfully');
    } else {
      console.log('Role column already exists');
    }
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Role column already exists');
    } else {
      console.error('Error adding role column:', error);
      throw error;
    }
  }
};

const updateNullableColumns = async () => {
  const mysqlDb = require('./mysql');

  try {
    const userNameCol = await mysqlDb.query(`
      SELECT IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'userName'
    `);

    if (userNameCol && userNameCol.length > 0 && userNameCol[0].IS_NULLABLE === 'NO') {
      await mysqlDb.query(`ALTER TABLE users MODIFY COLUMN userName VARCHAR(255) NULL`);
      console.log('userName column updated to nullable');
    }

    const telegramIDCol = await mysqlDb.query(`
      SELECT IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'telegramID'
    `);

    if (telegramIDCol && telegramIDCol.length > 0 && telegramIDCol[0].IS_NULLABLE === 'NO') {
      await mysqlDb.query(`ALTER TABLE users MODIFY COLUMN telegramID BIGINT UNIQUE NULL`);
      console.log('telegramID column updated to nullable');
    }

    console.log('Nullable columns check completed');
  } catch (error) {
    console.error('Error updating nullable columns:', error);
  }
};

const createTransactionsTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      trackId BIGINT UNIQUE NOT NULL,
      orderId VARCHAR(255),
      amount BIGINT NOT NULL,
      status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
      paymentType ENUM('zibal', 'tron') DEFAULT 'zibal',
      refNumber VARCHAR(255),
      cardNumber VARCHAR(20),
      description TEXT,
      paidAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (userId),
      INDEX idx_track_id (trackId),
      INDEX idx_status (status),
      INDEX idx_payment_type (paymentType),
      INDEX idx_created_at (createdAt),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Transactions table created successfully');
    
    // Add paymentType column if it doesn't exist
    const columns = await mysqlDb.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'transactions' 
      AND COLUMN_NAME = 'paymentType'
    `);
    
    if (!columns || columns.length === 0) {
      await mysqlDb.query(`
        ALTER TABLE transactions 
        ADD COLUMN paymentType ENUM('zibal', 'tron', 'saman') DEFAULT 'zibal'
        AFTER status
      `);
      console.log('PaymentType column added to transactions table');
    } else {
      // Update enum to include 'saman' if it doesn't exist
      try {
        await mysqlDb.query(`
          ALTER TABLE transactions 
          MODIFY COLUMN paymentType ENUM('zibal', 'tron', 'saman') DEFAULT 'zibal'
        `);
        console.log('PaymentType enum updated to include saman');
      } catch (error) {
        // Column might already have saman, ignore error
        if (!error.message.includes('Duplicate') && !error.message.includes('already')) {
          console.log('PaymentType enum might already include saman');
        }
      }
    }
    
    // Add samanSerial column for duplicate prevention
    const samanSerialColumns = await mysqlDb.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'transactions' 
      AND COLUMN_NAME = 'samanSerial'
    `);
    
    if (!samanSerialColumns || samanSerialColumns.length === 0) {
      await mysqlDb.query(`
        ALTER TABLE transactions 
        ADD COLUMN samanSerial VARCHAR(255) NULL,
        ADD INDEX idx_saman_serial (samanSerial)
      `);
      console.log('SamanSerial column added to transactions table');
    }
  } catch (error) {
    console.error('Error creating transactions table:', error);
    throw error;
  }
};

const createCryptoTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS crypto (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      transactionId INT,
      walletAddress VARCHAR(64) UNIQUE NOT NULL,
      privateKey VARCHAR(128) NOT NULL,
      amountToman BIGINT NOT NULL,
      amountTrx DECIMAL(20, 8) NOT NULL,
      trxPrice DECIMAL(20, 8) NOT NULL,
      status ENUM('pending', 'completed', 'expired', 'failed') DEFAULT 'pending',
      expiresAt DATETIME NOT NULL,
      completedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (userId),
      INDEX idx_transaction_id (transactionId),
      INDEX idx_wallet_address (walletAddress),
      INDEX idx_status (status),
      INDEX idx_expires_at (expiresAt),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Crypto table created successfully');
  } catch (error) {
    console.error('Error creating crypto table:', error);
    throw error;
  }
};

const createWalletTable = async () => {
  const mysqlDb = require('./mysql');
  
  try {
    const columns = await mysqlDb.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'walletBalance'
    `);

    if (!columns || columns.length === 0) {
      await mysqlDb.query(`
        ALTER TABLE users 
        ADD COLUMN walletBalance BIGINT DEFAULT 0 NOT NULL
        AFTER role
      `);
      console.log('WalletBalance column added successfully');
    } else {
      console.log('WalletBalance column already exists');
    }
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('WalletBalance column already exists');
    } else {
      console.error('Error adding walletBalance column:', error);
    }
  }
};

const createCardsTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS cards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      cardName VARCHAR(255),
      cardNumber VARCHAR(16) NOT NULL,
      shebaNumber VARCHAR(24),
      bankName VARCHAR(255),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (userId),
      INDEX idx_card_number (cardNumber),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Cards table created successfully');
  } catch (error) {
    console.error('Error creating cards table:', error);
    throw error;
  }
};

const createProductsTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productName VARCHAR(255) NOT NULL,
      category ENUM('ChatGPT', 'Gemini', 'Cursor', 'CapCut', 'Discord', 'Youtube') NOT NULL,
      accountType ENUM('اشتراکی', 'اختصاصی') NOT NULL,
      duration INT NOT NULL COMMENT 'مدت زمان به روز',
      purchasePrice BIGINT NOT NULL COMMENT 'قیمت خرید به تومان',
      regularPrice BIGINT NOT NULL COMMENT 'قیمت کاربر عادی به تومان',
      merchantPrice BIGINT NOT NULL COMMENT 'قیمت همکار به تومان',
      activationTimeMinutes INT NOT NULL DEFAULT 0 COMMENT 'مدت زمان فعالسازی به دقیقه',
      activationType ENUM('ایمیل شخصی', 'ایمیل آماده') NOT NULL,
      imagePath VARCHAR(500) COMMENT 'مسیر تصویر محصول در بک‌اند',
      additionalInfo TEXT COMMENT 'اطلاعات تکمیلی',
      isActive BOOLEAN DEFAULT TRUE COMMENT 'وضعیت فعال/غیرفعال',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_category (category),
      INDEX idx_account_type (accountType),
      INDEX idx_is_active (isActive),
      INDEX idx_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Products table created successfully');
  } catch (error) {
    console.error('Error creating products table:', error);
    throw error;
  }
};

const createMerchantsTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS merchants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      rejectionReason TEXT COMMENT 'دلیل رد درخواست',
      approvedBy INT COMMENT 'شناسه ادمین تاییدکننده',
      rejectedBy INT COMMENT 'شناسه ادمین ردکننده',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approvedBy) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (rejectedBy) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_user_id (userId),
      INDEX idx_status (status),
      INDEX idx_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Merchants table created successfully');
  } catch (error) {
    console.error('Error creating merchants table:', error);
    throw error;
  }
};

const createBannersTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      imagePath VARCHAR(500) NOT NULL COMMENT 'مسیر تصویر بنر در بک‌اند',
      linkType ENUM('product', 'category') NOT NULL COMMENT 'نوع لینک: محصول یا دسته‌بندی',
      linkId INT COMMENT 'ID محصول یا دسته‌بندی (برای category می‌تواند NULL باشد و از نام دسته استفاده شود)',
      linkValue VARCHAR(255) COMMENT 'مقدار لینک (نام دسته‌بندی یا NULL برای محصول)',
      displayOrder INT NOT NULL DEFAULT 1 COMMENT 'ترتیب نمایش (1, 2, 3, ...)',
      isActive BOOLEAN DEFAULT TRUE COMMENT 'وضعیت فعال/غیرفعال',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_display_order (displayOrder),
      INDEX idx_is_active (isActive),
      INDEX idx_link_type (linkType),
      INDEX idx_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Banners table created successfully');
  } catch (error) {
    console.error('Error creating banners table:', error);
    throw error;
  }
};

const addProductNoteColumns = async () => {
  const mysqlDb = require('./mysql');
  
  try {
    // بررسی وجود ستون noteType
    const noteTypeCol = await mysqlDb.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'products' 
      AND COLUMN_NAME = 'noteType'
    `);

    if (!noteTypeCol || noteTypeCol.length === 0) {
      await mysqlDb.query(`
        ALTER TABLE products 
        ADD COLUMN noteType ENUM('info', 'warning', 'note') NULL COMMENT 'نوع نکته: اطلاعات، هشدار، نکته'
        AFTER additionalInfo
      `);
      console.log('noteType column added successfully');
    } else {
      console.log('noteType column already exists');
    }

    // بررسی وجود ستون noteText
    const noteTextCol = await mysqlDb.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'products' 
      AND COLUMN_NAME = 'noteText'
    `);

    if (!noteTextCol || noteTextCol.length === 0) {
      await mysqlDb.query(`
        ALTER TABLE products 
        ADD COLUMN noteText TEXT NULL COMMENT 'متن نکته'
        AFTER noteType
      `);
      console.log('noteText column added successfully');
    } else {
      console.log('noteText column already exists');
    }
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Note columns already exist');
    } else {
      console.error('Error adding note columns:', error);
      throw error;
    }
  }
};

const createOrdersTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      orderNumber VARCHAR(20) UNIQUE NOT NULL COMMENT 'شماره سفارش به فرمت OS100001',
      productId INT NOT NULL,
      paymentMethod ENUM('wallet', 'online', 'card', 'crypto') NOT NULL COMMENT 'روش پرداخت',
      orderEmail VARCHAR(255) COMMENT 'ایمیل کاربر برای سفارش',
      amount BIGINT NOT NULL COMMENT 'مبلغ به تومان',
      paidAmount BIGINT DEFAULT 0 COMMENT 'مبلغ پرداخت شده از کیف پول (به تومان)',
      status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
      transactionId INT COMMENT 'شناسه تراکنش پرداخت (برای پرداخت آنلاین)',
      walletAddress VARCHAR(255) COMMENT 'آدرس کیف پول برای پرداخت ارز دیجیتال',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      completedAt DATETIME COMMENT 'زمان تکمیل سفارش',
      INDEX idx_user_id (userId),
      INDEX idx_order_number (orderNumber),
      INDEX idx_product_id (productId),
      INDEX idx_status (status),
      INDEX idx_payment_method (paymentMethod),
      INDEX idx_created_at (createdAt),
      INDEX idx_wallet_address (walletAddress),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE RESTRICT,
      FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Orders table created successfully');
    
    // Add walletAddress column if it doesn't exist (for existing tables)
    try {
      const [columns] = await mysqlDb.query(`
        SHOW COLUMNS FROM orders LIKE 'walletAddress'
      `);
      
      if (columns.length === 0) {
        await mysqlDb.query(`
          ALTER TABLE orders 
          ADD COLUMN walletAddress VARCHAR(255) COMMENT 'آدرس کیف پول برای پرداخت ارز دیجیتال'
        `);
        console.log('walletAddress column added to orders table');
      }
      
      // Add index if it doesn't exist
      try {
        await mysqlDb.query(`
          ALTER TABLE orders 
          ADD INDEX idx_wallet_address (walletAddress)
        `);
        console.log('idx_wallet_address index added to orders table');
      } catch (indexError) {
        if (indexError.code !== 'ER_DUP_KEYNAME') {
          console.log('Index might already exist or error:', indexError.message);
        }
      }
    } catch (alterError) {
      console.log('Error adding walletAddress column (might already exist):', alterError.message);
    }
  } catch (error) {
    console.error('Error creating orders table:', error);
    throw error;
  }
};

const addDeliveryStatusToOrders = async () => {
  const mysqlDb = require('./mysql');
  
  try {
    // Check if column already exists
    const columns = await mysqlDb.query(`
      SHOW COLUMNS FROM orders LIKE 'deliveryStatus'
    `);
    
    if (!columns || columns.length === 0) {
      // Add deliveryStatus column
      await mysqlDb.query(`
        ALTER TABLE orders 
        ADD COLUMN deliveryStatus ENUM('received', 'processing', 'delivered') 
        NOT NULL DEFAULT 'received' 
        COMMENT 'وضعیت تحویل سفارش'
        AFTER status
      `);
      console.log('deliveryStatus column added to orders table');
      
      // Add index for better query performance
      try {
        await mysqlDb.query(`
          ALTER TABLE orders 
          ADD INDEX idx_delivery_status (deliveryStatus)
        `);
        console.log('idx_delivery_status index added to orders table');
      } catch (indexError) {
        if (indexError.code !== 'ER_DUP_KEYNAME') {
          console.log('Note: Could not add index (might already exist):', indexError.message);
        }
      }
    } else {
      // Column exists, check if we need to modify ENUM values
      try {
        // Modify column to update ENUM values to English
        await mysqlDb.query(`
          ALTER TABLE orders 
          MODIFY COLUMN deliveryStatus ENUM('received', 'processing', 'delivered') 
          NOT NULL DEFAULT 'received' 
          COMMENT 'وضعیت تحویل سفارش'
        `);
        console.log('deliveryStatus column ENUM values updated to English');
        
        // Update existing orders without deliveryStatus to 'received'
        await mysqlDb.query(`
          UPDATE orders 
          SET deliveryStatus = 'received' 
          WHERE deliveryStatus IS NULL OR deliveryStatus = ''
        `);
        console.log('Existing orders deliveryStatus set to received');
      } catch (modifyError) {
        // If modification fails, column might already have correct values
        console.log('Note: Could not modify deliveryStatus column (might already be correct):', modifyError.message);
      }
    }
  } catch (error) {
    // Check if error is about column already existing
    if (error.message && error.message.includes('Duplicate column')) {
      console.log('deliveryStatus column already exists in orders table');
    } else {
      console.error('Error adding/modifying deliveryStatus column to orders table:', error);
      throw error;
    }
  }
};

const addAdminMessageToOrders = async () => {
  const mysqlDb = require('./mysql');
  try {
    // Check if column exists
    const columns = await mysqlDb.query('SHOW COLUMNS FROM orders LIKE ?', ['adminMessage']);
    
    if (!columns || columns.length === 0) {
      // Column doesn't exist, add it
      await mysqlDb.query(`
        ALTER TABLE orders 
        ADD COLUMN adminMessage TEXT NULL 
        COMMENT 'پیام ادمین برای سفارش'
        AFTER deliveryStatus
      `);
      console.log('adminMessage column added to orders table');
    } else {
      console.log('adminMessage column already exists in orders table');
    }
  } catch (error) {
    // Check if error is about column already existing
    if (error.message && error.message.includes('Duplicate column')) {
      console.log('adminMessage column already exists in orders table');
    } else {
      console.error('Error adding adminMessage column to orders table:', error);
      throw error;
    }
  }
};

const runMigrations = async () => {
  try {
    await createDatabase();
    const mysqlDb = require('./mysql');
    await mysqlDb.createPool();
    await createUsersTable();
    await addLoginInfoColumn();
    await addRoleColumn();
    await updateNullableColumns();
    await createWalletTable();
    await createTransactionsTable();
    await createCryptoTable();
    await createCardsTable();
    await createProductsTable();
    await addProductNoteColumns();
    await createMerchantsTable();
    await createBannersTable();
    await createOrdersTable();
    await addDeliveryStatusToOrders();
    await addAdminMessageToOrders();
    await createNotificationsTable();
    await createTicketsTable();
    await createTicketMessagesTable();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  runMigrations().then(() => {
    console.log('Migrations completed');
    process.exit(0);
  });
}

const createNotificationsTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      type ENUM('wallet_charge', 'order', 'order_completed', 'order_failed', 'general') NOT NULL DEFAULT 'general',
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      link VARCHAR(500) NULL,
      isRead BOOLEAN DEFAULT FALSE,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      readAt DATETIME NULL,
      INDEX idx_user_id (userId),
      INDEX idx_is_read (isRead),
      INDEX idx_type (type),
      INDEX idx_created_at (createdAt),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Notifications table created successfully');
    
    // Update ENUM if table already exists (for existing databases)
    try {
      const alterQuery = `
        ALTER TABLE notifications 
        MODIFY COLUMN type ENUM('wallet_charge', 'order', 'order_completed', 'order_failed', 'general') NOT NULL DEFAULT 'general'
      `;
      await mysqlDb.query(alterQuery);
      console.log('Notifications table ENUM updated successfully');
    } catch (alterError) {
      // Ignore error if column doesn't exist or ENUM is already updated
      if (!alterError.message.includes('Duplicate') && !alterError.message.includes('Unknown column')) {
        console.log('Note: Could not update ENUM (this is normal if table is already up to date)');
      }
    }
  } catch (error) {
    console.error('Error creating notifications table:', error);
    throw error;
  }
};

const createTicketsTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      type ENUM('sales', 'technical', 'product_support') NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      orderNumber VARCHAR(50) NULL COMMENT 'شماره سفارش در صورت پشتیبانی محصول',
      orderId INT NULL COMMENT 'شناسه سفارش',
      status ENUM('open', 'pending', 'closed') NOT NULL DEFAULT 'open',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (userId),
      INDEX idx_status (status),
      INDEX idx_type (type),
      INDEX idx_order_id (orderId),
      INDEX idx_created_at (createdAt),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Tickets table created successfully');
  } catch (error) {
    console.error('Error creating tickets table:', error);
    throw error;
  }
};

const createTicketMessagesTable = async () => {
  const mysqlDb = require('./mysql');
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticketId INT NOT NULL,
      senderId INT NOT NULL COMMENT 'شناسه فرستنده (userId یا adminId)',
      senderType ENUM('user', 'admin') NOT NULL,
      message TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ticket_id (ticketId),
      INDEX idx_created_at (createdAt),
      FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  try {
    await mysqlDb.query(createTableQuery);
    console.log('Ticket messages table created successfully');
  } catch (error) {
    console.error('Error creating ticket_messages table:', error);
    throw error;
  }
};

module.exports = {
  createUsersTable,
  createCardsTable,
  createProductsTable,
  createMerchantsTable,
  createBannersTable,
  createNotificationsTable,
  createTicketsTable,
  createTicketMessagesTable,
  runMigrations
};

