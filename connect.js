const mongoose = require("mongoose");
async function connectToMongoDB(url) {
  return mongoose
    .connect(url)
    .then(() => {
      console.log("connected to mongodb");
    })
    .catch(() => {
      console.log("error connected");
    });
}
module.exports = {
  connectToMongoDB,
};
