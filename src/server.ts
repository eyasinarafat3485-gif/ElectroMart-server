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
    const userCollection = db.collection("user")
    const orderCollection = db.collection("orderCollection")


    // all items get api (with category filtering logic)
    app.get('/api/items', async (req, res) => {
      const category = req.query.category;
      let query = {};
      if (category) {
        query = { category: category };
      }

      const result = await itemCollection.find(query).toArray();
      res.send(result);
    });


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

    // user role set api
    app.patch("/api/users/role", async (req, res) => {
      const { email, role } = req.body;
      const result = await userCollection.updateOne(
        { email },
        {
          $set: {
            role,
          },
        }
      );
      res.send(result);
    });

    // POST API for placing an order
    app.post("/api/orders", async (req, res) => {
      const orderData = req.body;

      const orderWithStatus = {
        ...orderData,
        status: orderData.status || "pending",        
        orderedAt: orderData.orderedAt || new Date().toISOString()
      };

      const result = await orderCollection.insertOne(orderWithStatus);

      res.status(201).json({
        success: true,
        message: "Order saved successfully",
        insertedId: result.insertedId
      });
    });

    // GET API - Get user's orders
    app.get('/api/orders', async (req, res) => {
      const userEmail = req.query.email;

      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      const result = await orderCollection
        .find({ userEmail: userEmail })
        .sort({ orderedAt: -1 })        
        .toArray();

      res.status(200).json(result);
    });

    // get all orders
    app.get("/orders", async (req, res) => {
      const orders = await orderCollection
        .find({})
        .sort({ orderedAt: -1 })
        .toArray();

      res.send(orders);
    });

    // get all orders count
    app.get("/orders/count", async (req, res) => {
      const totalOrders = await orderCollection.countDocuments();

      res.send({
        totalOrders,
      });
    });

    // update order status
    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;   
      const result = await orderCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send(result);
    });

    // delete order
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;

      const result = await orderCollection.deleteOne({
        _id: new ObjectId(id),
      });

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