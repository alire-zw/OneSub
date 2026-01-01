const mysql = require('mysql2/promise');

let pool = null;

const createPool = () => {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'onesub',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  return pool;
};

const getConnection = async () => {
  if (!pool) {
    createPool();
  }
  return pool.getConnection();
};

const query = async (sql, params) => {
  const connection = await getConnection();
  try {
    const [results] = await connection.query(sql, params);
    return results;
  } finally {
    connection.release();
  }
};

const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

module.exports = {
  createPool,
  getConnection,
  query,
  closePool
};

