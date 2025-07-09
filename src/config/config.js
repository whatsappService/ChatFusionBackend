// config/config.js
require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

module.exports = {
  development: {
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT || 3306, // Use MYSQL_PORT from your env file
    dialect: "mysql",
    logging: console.log,
  },
  production: {
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT || 3306,
    dialect: "mysql",
    logging: false,
  },
};
