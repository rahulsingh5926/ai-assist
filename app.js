require("dotenv").config();
const URL = require("./model/data");
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { connectToMongoDB } = require("./connect");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleAIFileManager } = require("@google/generative-ai/server");

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const app = express();
const upload = multer({ dest: "uploads/" });

connectToMongoDB("mongodb://127.0.0.1:27017/ai-assist");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

async function handleAskQuestion(prompt) {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text(); // Adjust based on actual API response structure
  } catch (error) {
    console.error("Error generating text:", error);
    throw error;
  }
}

async function handleExplainAconcept(concept) {
  try {
    const result = await model.generateContent(concept);
    return result.response.text(); // Adjust based on actual API response structure
  } catch (error) {
    console.error("Error generating text:", error);
    throw error;
  }
}

async function handlePersonalizedStudyPlan(subjects, hours) {
  try {
    const prompt = `Create a personalized study plan for the following subjects: ${subjects} within ${hours} hours.`;
    const result = await model.generateContent(prompt);
    return result.response.text(); // Adjust based on actual API response structure
  } catch (error) {
    console.error("Error generating text:", error);
    throw error;
  }
}

async function handleSummarizeTextbook(req) {
  try {
    const fileManager = new GoogleAIFileManager(process.env.API_KEY);

    const filePath = path.join(__dirname, req.file.path);
    const uploadResponse = await fileManager.uploadFile(filePath, {
      mimeType: req.file.mimetype,
      displayName: req.file.originalname,
    });

    const getResponse = await fileManager.getFile(uploadResponse.file.name);
    console.log(`Retrieved file ${getResponse.displayName} as ${getResponse.uri}`);

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadResponse.file.mimeType,
          fileUri: uploadResponse.file.uri,
        },
      },
      { text: "Summarize Textbook" },
    ]);

    const atsFeedback = result.response.text();
    fs.unlinkSync(req.file.path); // Delete the file after processing
    return atsFeedback;
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  }
}

app.post("/", upload.single("pdfFile"), async (req, res) => {
  const { prompt, concept, selectedOption, subjects, hours } = req.body;

  let result;
  try {
    switch (selectedOption) {
      case "ask-question":
        result = await handleAskQuestion(prompt);
        break;
      case "explain-concept":
        result = await handleExplainAconcept(concept);
        break;
      case "summarize-textbook":
        result = await handleSummarizeTextbook(req);
        break;
      case "personalized-study-plan":
        result = await handlePersonalizedStudyPlan(subjects, hours);
        break;
    
    }
    res.render("index", { text: result, option: selectedOption });
  } catch (error) {
    res.status(500).send("An error occurred.");
  }
});

app.post("/log", async (req, res) => {
  const sample = req.body.sample;

  if (!sample) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
     const textValue = typeof sample === "object" ? JSON.stringify(sample) : sample;
    await URL.create({ text: textValue });
    res.render("index"); // Redirect to display saved logs
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/log", async (req, res) => {
  const data = await URL.find({});
  return res.render("log", { result: data });
});

app.listen(3001, () => {
  console.log("Server is running on http://localhost:3001");
});
