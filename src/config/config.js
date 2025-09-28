require("dotenv").config();

const DIALECT = process.env.DB_DIALECT || "mysql";
const HOST = process.env.DB_HOST || process.env.MYSQL_HOST || "localhost";
const PORT = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3307);
const DATABASE =
  process.env.DB_NAME || process.env.MYSQL_DB || "whatsapp_portal";
const USER = process.env.DB_USER || process.env.MYSQL_USER || "root";
const PASS = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "root";

const common = {
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

module.exports = {
  development: common,
  production: common,
  test: common,
};
