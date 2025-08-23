const { Sequelize } = require("sequelize");
require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const sequelize = new Sequelize(
  process.env.MYSQL_DB,
  process.env.MYSQL_USER,
  process.env.MYSQL_PASSWORD,
  {
    host: process.env.MYSQL_HOST,
    dialect: "mysql",
    logging: false,
  }
);

module.exports = sequelize;
