import dns from "dns";
if (dns && typeof dns.setServers === "function") {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
}

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion, Collection } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose-cjs";

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing in the .env file");
}

const app = express();
const port = Number(process.env.PORT) || 5000;

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

let itemCollection: Collection;
let userCollection: Collection;
let orderCollection: Collection;

const connectDB = async () => {
  if (!itemCollection) {
    await client.connect();
    const db = client.db("ElectroMart");
    itemCollection = db.collection("items");
    userCollection = db.collection("user");
    orderCollection = db.collection("orderCollection");
  }
};

// MIDDLEWARE 
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

// Root route
app.get("/", (_req: Request, res: Response) => {
  res.send("ElectroMart Server is running perfectly on Vercel!");
});

// Get all items (with optional category filter)
app.get("/api/items", async (req: Request, res: Response) => {
  try {
    await connectDB();
    const category = req.query.category as string | undefined;
    const query = category ? { category } : {};

    const result = await itemCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Add new item
app.post("/api/items", async (req: Request, res: Response) => {
  try {
    await connectDB();
    const items = req.body;
    const result = await itemCollection.insertOne(items);
    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
});


const getHomeProducts = async (_req: Request, res: Response) => {
  try {
    await connectDB();
    const products = await itemCollection.find().limit(4).toArray();
    res.send(products);
  } catch (error) {
    res.status(500).send(error);
  }
};
app.get("/products", getHomeProducts);
app.get("/api/products", getHomeProducts);

// Get single item
const getSingleItem = async (req: Request, res: Response) => {
  try {
    await connectDB();
    const id = req.params.id as string; 
    const result = await itemCollection.findOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
};
app.get("/items/:id", getSingleItem);
app.get("/api/items/:id", getSingleItem);

// User role update
app.patch("/api/users/role", verifyToken, async (req: Request, res: Response) => {
  try {
    await connectDB();
    const { email, role } = req.body;
    const result = await userCollection.updateOne(
      { email },
      { $set: { role } }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Place order
app.post("/api/orders", verifyToken, async (req: Request, res: Response) => {
  try {
    await connectDB();
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
  } catch (error) {
    res.status(500).send(error);
  }
});

// Get user orders
app.get("/api/orders", verifyToken, async (req: Request, res: Response) => {
  try {
    await connectDB();
    const userEmail = req.query.email as string;

    if (!userEmail) {
      return res.status(400).json({ message: "User email is required" });
    }

    const result = await orderCollection
      .find({ userEmail })
      .sort({ orderedAt: -1 })
      .toArray();

    res.status(200).json(result);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Get all orders (admin)
const getAllOrdersAdmin = async (_req: Request, res: Response) => {
  try {
    await connectDB();
    const orders = await orderCollection
      .find({})
      .sort({ orderedAt: -1 })
      .toArray();

    res.send(orders);
  } catch (error) {
    res.status(500).send(error);
  }
};
app.get("/orders", verifyToken, getAllOrdersAdmin);
app.get("/api/admin/orders", verifyToken, getAllOrdersAdmin);

// Orders count
const getOrdersCount = async (_req: Request, res: Response) => {
  try {
    await connectDB();
    const totalOrders = await orderCollection.countDocuments();
    res.send({ totalOrders });
  } catch (error) {
    res.status(500).send(error);
  }
};
app.get("/orders/count", verifyToken, getOrdersCount);
app.get("/api/orders-count", verifyToken, getOrdersCount);

// Update order status
const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    await connectDB();
    const id = req.params.id as string; 
    const { status } = req.body;

    const result = await orderCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
};
app.patch("/orders/:id", verifyToken, updateOrderStatus);
app.patch("/api/orders/:id", verifyToken, updateOrderStatus);

// Delete order
const deleteOrder = async (req: Request, res: Response) => {
  try {
    await connectDB();
    const id = req.params.id as string; 
    const result = await orderCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
};
app.delete("/orders/:id", verifyToken, deleteOrder);
app.delete("/api/orders/:id", verifyToken, deleteOrder);

connectDB().catch(console.dir);

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

export default app;