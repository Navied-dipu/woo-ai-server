const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
require("dotenv").config();
app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("wooaiDB");
    const promptsCollection = db.collection("prompts");
    const savedCollection = db.collection("saved");
    const usersCollection = db.collection("user");
    const sessionCollection = db.collection("session");
    const verifyToken = async (req, res, next) => {
      console.log("headers", req.headers);
      const authHeader = req.headers?.authorization;
      if (!authHeader) {
        return res.status(401).send({ massage: "unauthorized access" });
      }
      const token = await authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ massage: "unauthorized access" });
      }
      const query = { token: token };
      const session = await sessionCollection.findOne(query);
      const userId = session.userId;
      const userQuery = {
        _id: userId,
      };
      const user = await usersCollection.findOne(userQuery);
      console.log(user);
      next();
    };
    app.get("/api/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    const { ObjectId } = require("mongodb"); // Ensure ObjectId is imported

    // ... your existing GET route ...

    // PATCH API to update user status
    app.patch("/api/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body; // Expecting { "status": "new_status" } in the request body

        // Validate if the provided ID is a valid MongoDB ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid user ID format" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: status,
            role: role,
          },
        };

        const result = await usersCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send(result);
      } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    app.get("/api/prompts", async (req, res) => {
      const prompts = await promptsCollection.find().toArray();
      res.send(prompts);
    });
    app.get("/api/prompts/:id", async (req, res) => {
      const { id } = req.params;
      const prompt = await promptsCollection.findOne({ _id: new ObjectId(id) });
      res.send(prompt);
    });
    app.post("/api/prompts", async (req, res) => {
      const prompt = req.body;
      const result = await promptsCollection.insertOne(prompt);
      res.send(result);
    });


    // PATCH API to update prompt status by ID
    app.patch("/api/prompts/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body; // Expecting { "status": "approved" } or similar

        // 1. Validate if status is provided
        if (!status) {
          return res.status(400).send({ message: "Status is required" });
        }

        // 2. Validate if the provided ID is a valid MongoDB ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid prompt ID format" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: status },
        };

        const result = await promptsCollection.updateOne(filter, updateDoc);

        // 3. Check if the prompt exists
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Prompt not found" });
        }

        res.send({
          success: true,
          message: "Prompt status updated successfully",
          result,
        });
      } catch (error) {
        console.error("Error updating prompt status:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // PATCH API to increment copy count
    app.patch("/api/prompts/:id/increment-copy", async (req, res) => {
      try {
        const id = req.params.id;

        // Validate if the ID is a correct MongoDB ObjectId format
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: "Invalid prompt ID format." });
        }

        const filter = { _id: new ObjectId(id) };

        // $inc atomically increases the copyCount field by 1.
        // If copyCount doesn't exist yet on the document, MongoDB automatically creates it starting at 1.
        const updateDoc = {
          $inc: { copyCount: 1 },
        };

        const result = await promptsCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .send({ error: "Prompt document profile not found." });
        }

        res.send({
          success: true,
          message: "Copy count updated successfully.",
          result,
        });
      } catch (error) {
        console.error("Error patching copy count:", error);
        res.status(500).send({ error: "Internal server runtime exception." });
      }
    });
    // saved collection
    app.post("/api/saved", async (req, res) => {
      try {
        const { promptId, userId } = req.body;

        if (!promptId || !userId) {
          return res.status(400).send({ error: "Missing promptId or userId" });
        }

        // 1. Check if this bookmark combination already exists
        const query = { promptId: promptId, userId: userId };
        const existingBookmark = await savedCollection.findOne(query);

        if (existingBookmark) {
          // 2. If it exists, the user is un-bookmarking it -> Remove it
          await savedCollection.deleteOne(query);
          return res.send({ message: "Bookmark removed", isBookmarked: false });
        } else {
          // 3. If it doesn't exist, the user is bookmarking it -> Insert it
          const result = await savedCollection.insertOne({
            promptId,
            userId,
            createdAt: new Date(), // useful to keep track of when they saved it
          });
          return res.send({
            message: "Bookmark saved",
            isBookmarked: true,
            result,
          });
        }
      } catch (error) {
        console.error("Error toggling bookmark:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/api/saved", async (req, res) => {
      const results = await savedCollection.find().toArray();
      res.send(results);
    });

    app.get("/api/saved/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;

        if (!userId) {
          return res.status(400).send({ error: "Missing userId" });
        }

        // userId is stored as a plain string by better-auth, NOT as an ObjectId
        const results = await savedCollection
          .find({ userId: userId })
          .toArray();

        res.send(results);
      } catch (error) {
        console.error("Error fetching user bookmarks:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });
    app.delete("/api/saved/:userId/:promptId", async (req, res) => {
      try {
        const { userId, promptId } = req.params;

        const result = await savedCollection.deleteOne({
          userId: userId,
          promptId: promptId,
        });

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ error: "Saved prompt record not found" });
        }

        res.send({ success: true, message: "Prompt removed successfully" });
      } catch (error) {
        console.error("Error deleting bookmark:", error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
