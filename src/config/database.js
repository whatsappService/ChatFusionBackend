const { Sequelize } = require("sequelize");
require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`
});

const sequelize = new Sequelize(
  process.env.MYSQL_DB,
  process.env.MYSQL_USER,
  process.env.MYSQL_PASSWORD,
  {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    dialect: process.env.DB_DIALECT || "mysql",
    logging: false,               // keep runtime quiet; CLI has its own config
    timezone: "+00:00",
    dialectOptions: {
      dateStrings: true,
      typeCast: true
    },
    pool: {
      max: Number(process.env.DB_POOL_MAX || 10),
      min: Number(process.env.DB_POOL_MIN || 0),
      idle: Number(process.env.DB_POOL_IDLE || 10000),
      acquire: Number(process.env.DB_POOL_ACQUIRE || 30000)
    },
    define: {
      // you’re already specifying tableName per model; this guards any misses
      freezeTableName: true
    }
  }
);

module.exports = sequelize;
