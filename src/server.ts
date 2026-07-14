import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose-cjs";

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing in the .env file");
}

const app = express();
const port=Number(process.env.PORT)||5000

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
);

// ====== MIDDLEWARE 
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    (req as any).user = payload; 
    next();
  } catch (error) {
    res.status(403).json({ message: "Forbidden" });
  }
};

const run = async () => {
  try {
    await client.connect();
    const db = client.db("ElectroMart");
    const itemCollection = db.collection("items");
    const userCollection = db.collection("user");
    const orderCollection = db.collection("orderCollection");

    console.log("✅ Connected to MongoDB!");

    // Get all items (with optional category filter)
    app.get("/api/items", async (req: Request, res: Response) => {
      const category = req.query.category as string | undefined;
      const query = category ? { category } : {};

      const result = await itemCollection.find(query).toArray();
      res.send(result);
    });

    // Add new item
    app.post("/api/items", async (req: Request, res: Response) => {
      const items = req.body;
      const result = await itemCollection.insertOne(items);
      res.send(result);
    });

    // Get 4 products for home
    app.get("/products", async (_req: Request, res: Response) => {
      const products = await itemCollection.find().limit(4).toArray();
      res.send(products);
    });

    // Get single item
    app.get("/items/:id", async (req: Request, res: Response) => {
      const { id } = req.params;
      const result = await itemCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // User role update
    app.patch("/api/users/role", verifyToken, async (req: Request, res: Response) => {
      const { email, role } = req.body;
      const result = await userCollection.updateOne(
        { email },
        { $set: { role } }
      );
      res.send(result);
    });

    // Place order
    app.post("/api/orders", verifyToken, async (req: Request, res: Response) => {
      const orderData = req.body;
      const orderWithStatus = {
        ...orderData,
        status: orderData.status || "pending",
        orderedAt: orderData.orderedAt || new Date().toISOString(),
      };

      const result = await orderCollection.insertOne(orderWithStatus);
      res.status(201).json({
        success: true,
        message: "Order saved successfully",
        insertedId: result.insertedId,
      });
    });

    // Get user orders
    app.get("/api/orders", verifyToken, async (req: Request, res: Response) => {
      const userEmail = req.query.email as string;

      if (!userEmail) {
        return res.status(400).json({ message: "User email is required" });
      }

      const result = await orderCollection
        .find({ userEmail })
        .sort({ orderedAt: -1 })
        .toArray();

      res.status(200).json(result);
    });

    // Get all orders (admin)
    app.get("/orders", verifyToken, async (_req: Request, res: Response) => {
      const orders = await orderCollection
        .find({})
        .sort({ orderedAt: -1 })
        .toArray();

      res.send(orders);
    });

    // Orders count
    app.get("/orders/count", verifyToken, async (_req: Request, res: Response) => {
      const totalOrders = await orderCollection.countDocuments();
      res.send({ totalOrders });
    });

    // Update order status
    app.patch("/orders/:id", verifyToken, async (req: Request, res: Response) => {
      const { id } = req.params;
      const { status } = req.body;

      const result = await orderCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send(result);
    });

    // Delete order
    app.delete("/orders/:id", verifyToken, async (req: Request, res: Response) => {
      const { id } = req.params;
      const result = await orderCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Root route
    app.get("/", (_req: Request, res: Response) => {
      res.send("ElectroMart Server is running...");
    });

  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
};

run().catch(console.dir);

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});