const express = require("express");
const { MongoClient } = require("mongodb");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

//multer module for image storage in local directory
const multer = require("multer");

//bcrypt for password encryption
const bcrypt = require("bcryptjs");

const app = express();
const PORT = 5000;
const client = new MongoClient( "mongodb+srv://<username>:<password>@cluster0.bxdj5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");

// Middleware
app.use(express.json());
app.use(cors());

//serve the images as static files
app.use("/uploads", express.static("uploads"));

// Mongo DB Database connection
async function connectDB() {
  try {
    await client.connect();
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}
connectDB();

//Collections and DB connect
const db = client.db("bounding_box_db");
const usersCollection = db.collection("users");
const imagesCollection = db.collection("images");
const boundingBoxesCollection = db.collection("bounding_boxes");

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

//this creates the folder and stores the image files 
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, "img" + Date.now() + path.extname(file.originalname));
  },
});

// Signup route
app.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body;

    //encryption of password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    //Storing creds in DB
    await usersCollection.insertOne({ email, password: hashedPassword });
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error"+error });
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({ email });

    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    //Response sent only when user is valid
    res.json({ message: "Login successful" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

const upload = multer({ storage });

 // Ensure the uploads folder exists
 if (!fs.existsSync('uploads')) fs.mkdirSync('uploads'); 

//multer provides store option directly in request and we can use req.files to store in local directory
app.post("/upload", upload.array("images", 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files uploaded" });
    //looping to create number of files as the files length
    const imageUrls = req.files.map(file => `/uploads/${file.filename}`);

    //storing the images reference urls in DB
    await imagesCollection.insertMany(imageUrls.map(imageUrl => ({ imageUrl })));
    res.status(201).json({ message: "Images uploaded successfully", imageUrls });
  } catch (error) {
    res.status(500).json({ error: "Error uploading images" });
  }
});

// Get Uploaded Images
app.get("/images", async (req, res) => {
  try {
    const images = await imagesCollection.find().toArray();
    const baseUrl = "http://localhost:5000"; 

    //requesting image urls for image retrieve
    const updatedImages = images.map(img => ({
      imageUrl: `${baseUrl}${img.imageUrl}`
    }));
    res.json(updatedImages);
  } catch (error) {
    res.status(500).json({ error: "Error fetching images" });
  }
});

// Save Bounding Boxes API
app.post("/bounding-boxes", async (req, res) => {
  try {
    const { imgUrls, boundingBoxes } = req.body;

    //storing bounding box data in DB
    await boundingBoxesCollection.insertOne({ imgUrls, boundingBoxes });
    res.status(201).json({ message: "Bounding boxes saved successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error saving bounding boxes" });
  }
});

// Get Bounding Boxes API
app.get("/bounding-boxes", async (req, res) => {
  try {

    //getting bouidng box data for retrieval 
    const result = await boundingBoxesCollection.find({}).toArray();
    res.json(result || { imageUrl, boundingBoxes: [] });
  } catch (error) {
    res.status(500).json({ error: "Error fetching bounding boxes" });
  }
});

// Test route
app.get("/test", (req, res) => {
  res.json({ message: "Frontend successfully connected to backend" });
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});