require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const base = {
  username: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3307),
  dialect: process.env.DB_DIALECT || "mysql",
  // Persist metadata in DB tables instead of files
  migrationStorage: "sequelize",
  migrationStorageTableName: "SequelizeMeta",
  seederStorage: "sequelize",
  seederStorageTableName: "SequelizeData",
  // Timestamps/data handling
  timezone: "+00:00",
  dialectOptions: {
    // Return DATETIME as strings; avoids TZ shifts
    dateStrings: true,
    typeCast: true,
  },
  pool: {
    max: Number(process.env.DB_POOL_MAX || 10),
    min: Number(process.env.DB_POOL_MIN || 0),
    idle: Number(process.env.DB_POOL_IDLE || 10000),
    acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
  },
};

module.exports = {
  development: {
    ...base,
    logging: (msg) => console.log(msg),
  },
  production: {
    ...base,
    logging: false,
  },
};
