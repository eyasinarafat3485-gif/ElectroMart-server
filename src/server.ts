import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose-cjs";
import { Request, Response, NextFunction } from "express";
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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)


export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  // Express-e req.headers thakbei, optional chaining (?.) er proyojon nei
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Header authorization split kora
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS)
    console.log(payload);
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }

  console.log(token);

};;

const run = async () => {
  try {
    await client.connect();
    const db = client.db("ElectroMart");
    const itemCollection = db.collection("items")
    const userCollection = db.collection("user")
    const orderCollection = db.collection("orderCollection")


    // all items get api (with category filtering logic) --- jwt done
    app.get('/api/items',  async (req, res) => {
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

    // single item details get api--- jwt done
    app.get("/items/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const result = await itemCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // user role set api----- jwt done
    app.patch("/api/users/role", verifyToken, async (req, res) => {
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

    // POST API for placing an order--- jwt done
    app.post("/api/orders", verifyToken, async (req, res) => {
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

    // GET API - Get user's orders --- jwt done
    app.get('/api/orders', verifyToken, async (req, res) => {
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

    // get all orders --- jwt done
    app.get("/orders", verifyToken, async (req, res) => {
      const orders = await orderCollection
        .find({})
        .sort({ orderedAt: -1 })
        .toArray();

      res.send(orders);
    });

    // get all orders count --- jwt done
    app.get("/orders/count", verifyToken, async (req, res) => {
      const totalOrders = await orderCollection.countDocuments();

      res.send({
        totalOrders,
      });
    });

    // update order status --- jwt done 
    app.patch("/orders/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const result = await orderCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send(result);
    });

    // delete order --- jwt done
    app.delete("/orders/:id", verifyToken, async (req, res) => {
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