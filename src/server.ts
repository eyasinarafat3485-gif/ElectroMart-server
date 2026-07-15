import dns from "dns";
// if (dns && typeof dns.setServers === "function") {
//   dns.setServers(["8.8.8.8", "8.8.4.4"]);
// }

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
const port = Number(process.env.PORT) || 5000;

const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors({ origin: true, credentials: true }));

app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// const JWKS = createRemoteJWKSet(
//   new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
// );

// // ====== MIDDLEWARE
// export const verifyToken = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   const authHeader = req.headers.authorization;

//   if (!authHeader) {
//     console.log("❌ Authorization header missing");
//     res.status(401).json({ message: "Unauthorized: Header missing" });
//     return;
//   }

//   const token = authHeader.split(" ")[1];

//   if (!token || token === "undefined" || token === "null") {
//     console.log("❌ Token is invalid or null string:", token);
//     res.status(401).json({ message: "Unauthorized: Token missing" });
//     return;
//   }

//   try {
//     const { payload } = await jwtVerify(token, JWKS);
//     (req as any).user = payload;
//     next();
//   } catch (error: any) {
//     // এই লগটি আপনাকে লাইভ সার্ভারের (Render/Vercel) logs ট্যাবে আসল কারণ দেখাবে
//     console.error("❌ JWT Verification Failed error details:", error.message || error);
    
//     res.status(403).json({ 
//       message: "Forbidden: Token validation failed", 
//       details: error.message 
//     });
//   }
// };



// import { createRemoteJWKSet, jwtVerify } from "jose-cjs";
// import { Request, Response, NextFunction } from "express";

const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, "") : "";

// 🚀 টাইপস্ক্রিপ্ট এরর এড়াতে অবজেক্ট কাস্টিং সহ JWKS কনফিগারেশন
const JWKS = createRemoteJWKSet(
  new URL(`${clientUrl}/api/auth/jwks`),
  {
    timeout: 15000,
    cooldownTime: 60000,
  } as any
);

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ message: "Unauthorized: Header missing" });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token || token === "undefined" || token === "null") {
    res.status(401).json({ message: "Unauthorized: Token missing" });
    return;
  }

  try {
    // 🔒 টোকেন ভেরিফিকেশন
    const { payload } = await jwtVerify(token, JWKS);
    
    (req as any).user = payload;
    next();
  } catch (error: any) {
    // 🚨 এই লগটি আপনার Render/Vercel-এর ব্যাকএন্ড ড্যাশবোর্ডের Logs ট্যাবে আসল কারণ দেখাবে!
    console.error("❌ JWT VERIFICATION CRITICAL ERROR:", error.message || error);
    
    // লাইভ ডিবাগিং এর সুবিধার্থে রেসপন্সেও এরর মেসেজটি সাময়িকভাবে পাঠানো হলো
    res.status(403).json({ 
      message: "Forbidden: Token validation failed", 
      reason: error.message || "Unknown error"
    });
  }
};




















async function run() {
  try {

  const db = client.db("ElectroMart");
  const itemCollection = db.collection("items");
  const userCollection = db.collection("user");
  const orderCollection = db.collection("orderCollection");

  // Root route
  app.get("/", (_req: Request, res: Response) => {
    res.send("ElectroMart Server is running perfectly on Vercel!");
  });

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

  app.get("/api/products", async (_req: Request, res: Response) => {
    const products = await itemCollection.find().limit(4).toArray();
    res.send(products);
  });

  // Get single item
  app.get("/items/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await itemCollection.findOne({ _id: new ObjectId(id) });
    res.send(result);
  });

  app.get("/api/items/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await itemCollection.findOne({ _id: new ObjectId(id) });
    res.send(result);
  });

  // User role update
  app.patch("/api/users/role", async (req: Request, res: Response) => {
    const { email, role } = req.body;
    const result = await userCollection.updateOne(
      { email },
      { $set: { role } }
    );
    res.send(result);
  });

  // Place order
  app.post("/api/orders", async (req: Request, res: Response) => {
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



  // Get user orders (JWT Protected - Simple Version)
app.get("/api/orders", verifyToken, async (req: Request, res: Response): Promise<void> => {
  const userEmail = req.query.email as string;

  if (!userEmail) {
    res.status(400).json({ message: "User email is required" });
    return;
  }

  // সরাসরি ডাটাবেজ থেকে ডেটা কুয়েরি
  const result = await orderCollection
    .find({ userEmail })
    .sort({ orderedAt: -1 })
    .toArray();

  res.status(200).json(result);
});

  // // Get user orders
  // app.get("/api/orders", async (req: Request, res: Response) => {
  //   const userEmail = req.query.email as string;

  //   if (!userEmail) {
  //     res.status(400).json({ message: "User email is required" });
  //     return;
  //   }

  //   const result = await orderCollection
  //     .find({ userEmail })
  //     .sort({ orderedAt: -1 })
  //     .toArray();

  //   res.status(200).json(result);
  // });

  // Get all orders (admin)
  app.get("/orders",  async (_req: Request, res: Response) => {
    const orders = await orderCollection
      .find({})
      .sort({ orderedAt: -1 })
      .toArray();

    res.send(orders);
  });

  app.get("/api/admin/orders",  async (_req: Request, res: Response) => {
    const orders = await orderCollection
      .find({})
      .sort({ orderedAt: -1 })
      .toArray();

    res.send(orders);
  });

  // Orders count
  app.get("/orders/count",  async (_req: Request, res: Response) => {
    const totalOrders = await orderCollection.countDocuments();
    res.send({ totalOrders });
  });

  app.get("/api/orders-count",  async (_req: Request, res: Response) => {
    const totalOrders = await orderCollection.countDocuments();
    res.send({ totalOrders });
  });

  // Update order status
  app.patch("/orders/:id",  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { status } = req.body;

    const result = await orderCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    res.send(result);
  });

  app.patch("/api/orders/:id", async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { status } = req.body;

    const result = await orderCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    res.send(result);
  });

  // Delete order
  app.delete("/orders/:id",  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await orderCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  });

  app.delete("/api/orders/:id",  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await orderCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  });

// };

// Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

