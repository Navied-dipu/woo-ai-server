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
  const db = client.db("wooaiDB");
  const promptsCollection = db.collection("prompts");
  try {
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

    const { ObjectId } = require("mongodb"); // Make sure ObjectId is imported at the top of your file

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
