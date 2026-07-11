import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing in the .env file");
}

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const run = async () => {
  try {
    await client.connect();
    const db = client.db("ElectroMart");
    const itemCollection = db.collection("items")


    // all items get api
    app.get('/api/items', async (req, res) => {
      const result = await itemCollection.find().toArray();
      res.send(result);
    })

    // items added post api
    app.post('/api/items', async (req, res) => {
      const items = req.body;
      const result = await itemCollection.insertOne(items);
      res.send(result);
    })

    // home page 4 item er get api
    app.get("/products", async (req, res) => {
      const products = await itemCollection.find().limit(4).toArray();
      res.send(products);
    });

    // single item get api
    app.get("/items/:id", async (req, res) => {
      const { id } = req.params;
      const result = await itemCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
};

run().catch(console.dir);

app.get("/", (_req, res) => {
  res.send("ElectroMart Server is running on 5000...");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});