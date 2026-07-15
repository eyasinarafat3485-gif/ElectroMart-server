import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import jwt from "jsonwebtoken"; // রিমোট jose-cjs এর বদলে নিরাপদ এবং স্ট্যান্ডার্ড লাইব্রেরি

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing in the .env file");
}

const app = express();
const port = Number(process.env.PORT) || 5000;

// লাইভ ও লোকাল উভয় এনভায়রনমেন্টের জন্য CORS সম্পূর্ণ সচল রাখা হয়েছে
app.use(cors({ 
  origin: true, 
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ====== MIDDLEWARE (টোকেন ভেরিফিকেশন)
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.log("❌ Authorization header missing");
    res.status(401).json({ message: "Unauthorized: Header missing" });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token || token === "undefined" || token === "null") {
    console.log("❌ Token is invalid or null string:", token);
    res.status(401).json({ message: "Unauthorized: Token missing" });
    return;
  }

  try {
    // আপনার .env ফাইলের JWT_SECRET অথবা আপনার দেওয়া কোনো সিক্রেট কী দিয়ে ভেরিফাই
    const secret = process.env.JWT_SECRET || "electro_mart_secret_key_2026";
    const decoded = jwt.verify(token, secret);
    
    (req as any).user = decoded;
    next();
  } catch (error: any) {
    console.error("❌ JWT Verification Failed:", error.message || error);
    res.status(403).json({ 
      message: "Forbidden: Token validation failed", 
      details: error.message 
    });
  }
};

async function run() {
  try {
    const db = client.db("ElectroMart");
    const itemCollection = db.collection("items");
    const userCollection = db.collection("user");
    const orderCollection = db.collection("orderCollection");

    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // Root route
    app.get("/", (_req: Request, res: Response) => {
      res.send("ElectroMart Server is running perfectly!");
    });

    // Get all items
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
    app.get("/api/products", async (_req: Request, res: Response) => {
      const products = await itemCollection.find().limit(4).toArray();
      res.send(products);
    });

    // Get single item
    app.get("/api/items/:id", async (req: Request, res: Response) => {
      const id = req.params.id as string;
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

    // Place order (এখানেই লাইভে সমস্যা হচ্ছিল)
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
        res.status(400).json({ message: "User email is required" });
        return;
      }
      const result = await orderCollection
        .find({ userEmail })
        .sort({ orderedAt: -1 })
        .toArray();
      res.status(200).json(result);
    });

    // Get all orders (admin)
    app.get("/api/admin/orders", verifyToken, async (_req: Request, res: Response) => {
      const orders = await orderCollection.find({}).sort({ orderedAt: -1 }).toArray();
      res.send(orders);
    });

    // Orders count
    app.get("/api/orders-count", verifyToken, async (_req: Request, res: Response) => {
      const totalOrders = await orderCollection.countDocuments();
      res.send({ totalOrders });
    });

    // Update order status
    app.patch("/api/orders/:id", verifyToken, async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const { status } = req.body;
      const result = await orderCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
      res.send(result);
    });

    // Delete order
    app.delete("/api/orders/:id", verifyToken, async (req: Request, res: Response) => {
      const id = req.params.id as string;
      const result = await orderCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

  } catch (error) {
    console.error("Database error:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});