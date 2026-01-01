const redis = require('redis');

let client = null;

const createClient = () => {
  if (client) {
    return client;
  }

  client = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Redis Client Connected');
  });

  return client;
};

const connect = async () => {
  if (!client) {
    createClient();
  }
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
};

const getClient = () => {
  if (!client) {
    createClient();
  }
  return client;
};

const closeConnection = async () => {
  if (client && client.isOpen) {
    await client.quit();
    client = null;
  }
};

module.exports = {
  createClient,
  connect,
  getClient,
  closeConnection
};

