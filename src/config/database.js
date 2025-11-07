// src/config/database.js
const { Sequelize } = require("sequelize");
const path = require("path");
const dotenv = require("dotenv");

// Determine which environment file to load
const env = process.env.NODE_ENV || "development";
const envFile = path.resolve(__dirname, `../../.env.${env}`);

// Load the environment file
dotenv.config({ path: envFile });

console.log(`[Database] Loading environment: ${env}`);
console.log(`[Database] Config file: ${envFile}`);
console.log(`[Database] Connecting to: ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DB}`);

// Get default port based on environment
const defaultPort = env === "development" ? 3306 : 3307;

const sequelize = new Sequelize(
  process.env.MYSQL_DB || "whatsapp_portal",
  process.env.MYSQL_USER || "root",
  process.env.MYSQL_PASSWORD || "root",
  {
    host: process.env.MYSQL_HOST || (env === "development" ? "127.0.0.1" : "host.docker.internal"),
    port: Number(process.env.MYSQL_PORT || defaultPort),
    dialect: process.env.DB_DIALECT || "mysql",
    logging: process.env.DEBUG === "true" ? console.log : false,
    timezone: "+00:00",
    dialectOptions: {
      dateStrings: true,
      typeCast: true
    },
    pool: {
      max: Number(process.env.DB_POOL_MAX || (env === "production" ? 20 : 10)),
      min: Number(process.env.DB_POOL_MIN || (env === "production" ? 2 : 0)),
      idle: Number(process.env.DB_POOL_IDLE || 10000),
      acquire: Number(process.env.DB_POOL_ACQUIRE || 30000)
    },
    define: {
      // you're already specifying tableName per model; this guards any misses
      freezeTableName: true
    }
  }
);

module.exports = sequelize;
