// we have to  define Schema and model of the mongodb

const mongoose = require("mongoose");

const Schema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      unique: true,
    },

  }
);
const URL = mongoose.model("data", Schema);
module.exports = URL;
