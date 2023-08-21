import express from "express";
import mongoose from "mongoose";
import { createClient } from "redis";
const app = express();
const port = 3000;
const client = createClient();
await client.connect();

await mongoose.connect("mongodb://127.0.0.1:27017/testquery");
const User = mongoose.model("user", { name: String, age: Number });

mongoose.Query.prototype.cache = async function () {
  // generate unique redis key
  const filterObj = this._conditions;
  const options = this.options;
  const modelName = this.mongooseCollection.name;
  const findMethod = this.op;
  const redisKey = JSON.stringify({
    ...filterObj,
    ...options,
    ...{ model: modelName },
    ...{ method: findMethod },
  });

  // check if the result is chached before
  const cached = await client.hGet(modelName, redisKey);

  if (!cached) {
    const result = await mongoose.Query.prototype.exec.apply(this, arguments);
    client.hSet(modelName, redisKey, JSON.stringify(result));
    return result;
  }

  // cache the results
  const cachedResults = JSON.parse(cached);
  return Array.isArray(cachedResults)
    ? cachedResults.map((doc) => this.model.hydrate(doc))
    : this.model.hydrate(cachedResults);
};

app.get("/user", async (req, res) => {
  const users = await User.findOne({ age: { $gt: 30 } }).cache();
  return res.json({ results: users });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
