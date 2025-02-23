require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const winston = require("./src/utils/logger");
const sequelize = require("./src/config/database");
const routes = require("./src/routes");
require("./src/models/associations"); // Ensure associations are loaded
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());
app.use(morgan("combined", { stream: winston.stream }));

// Routes
app.use("/api", routes);

const PORT = process.env.PORT || 3000;
sequelize
  .sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });
