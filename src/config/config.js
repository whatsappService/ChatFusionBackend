// Load environment-specific .env file
const path = require("path");
const dotenv = require("dotenv");

// Determine which environment file to load
const env = process.env.NODE_ENV || "development";
const envFile = path.resolve(__dirname, `../../.env.${env}`);

// Load the environment file
dotenv.config({ path: envFile });

console.log(`Loading environment: ${env}`);
console.log(`Config file: ${envFile}`);
console.log(`Database: ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DB}`);

const DIALECT = process.env.DB_DIALECT || "mysql";
const HOST = process.env.DB_HOST || process.env.MYSQL_HOST || "localhost";
const PORT = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306);
const DATABASE =
  process.env.DB_NAME || process.env.MYSQL_DB || "whatsapp_portal";
const USER = process.env.DB_USER || process.env.MYSQL_USER || "root";
const PASS = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "root";

// Base configuration
const baseConfig = {
  dialect: DIALECT,
  host: HOST,
  port: PORT,
  database: DATABASE,
  username: USER,
  password: PASS,
  logging: false,
  pool: {
    max: Number(process.env.DB_POOL_MAX || 10),
    min: Number(process.env.DB_POOL_MIN || 0),
    idle: Number(process.env.DB_POOL_IDLE || 10000),
    acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
  },
};

// Development configuration (local MySQL on port 3306)
const development = {
  ...baseConfig,
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  username: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  logging: process.env.DEBUG === "true" ? console.log : false,
  pool: {
    max: Number(process.env.DB_POOL_MAX || 10),
    min: Number(process.env.DB_POOL_MIN || 0),
    idle: Number(process.env.DB_POOL_IDLE || 10000),
    acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
  },
};

// Production configuration (external MySQL on port 3307 or Docker)
const production = {
  ...baseConfig,
  host: process.env.MYSQL_HOST || "host.docker.internal",
  port: Number(process.env.MYSQL_PORT || 3307),
  username: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  logging: false,
  pool: {
    max: Number(process.env.DB_POOL_MAX || 20),
    min: Number(process.env.DB_POOL_MIN || 2),
    idle: Number(process.env.DB_POOL_IDLE || 10000),
    acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
  },
};

// Test configuration (same as development)
const test = {
  ...development,
  database: "whatsapp_portal_test",
};

module.exports = {
  development,
  production,
  test,
};
