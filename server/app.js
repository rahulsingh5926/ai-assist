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
app.set("views", path.join(__dirname, "..", "views"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index",{selectedOption:"ask-question"});
});

async function handleAskQuestion(userPrompt) {
  try {
    const refinedPrompt = `
      Context: You are a knowledgeable assistant helping a user with a question.
      Task: Answer the following question clearly and concisely: "${userPrompt}".
      Guidelines:
      1. Provide a direct and accurate answer.
      2. If the question is complex, break down the explanation into simple, easy-to-understand steps.
      3. Include relevant examples or analogies if they help clarify the concept.
      4. Avoid unnecessary details, but be thorough where required.
      5. Conclude with a brief summary or additional tips if applicable.
    `;
    const result = await model.generateContent(refinedPrompt);
    return result.response.text(); // Adjust based on actual API response structure
  } catch (error) {
    console.error("Error generating text:", error);
    throw error;
  }
}

async function handleExplainAconcept(concept) {
  try {
    const refinedPrompt = `
      Context: You are an expert AI assistant helping a user who has a basic understanding of the topic.
      Task: Please explain the concept of "${concept}" clearly and concisely.
      Format: 
      1. Begin with a brief definition.
      2. Provide a step-by-step explanation of the main points.
      3. Include an example or analogy to illustrate the concept.
      4. Conclude with any additional details or tips that could help the user understand better.
    `;
    const result = await model.generateContent(refinedPrompt);
    return result.response.text(); // Adjust based on actual API response structure
  } catch (error) {
    console.error("Error generating text:", error);
    throw error;
  }
}

async function handlePersonalizedStudyPlan(subjects, hours) {
  try {
    const prompt = `
      Context: You are an expert study planner helping a student prepare efficiently for their exams.
      Task: Create a personalized study plan for the following subjects: ${subjects}. 
      Constraints: The total study time available is ${hours} hours.
      Guidelines:
      1. Distribute the study time based on the importance or difficulty of each subject.
      2. Include short breaks to maintain focus and energy.
      3. Ensure that the plan balances between revising previously learned material and tackling new topics.
      4. Provide a clear, time-based schedule (e.g., 9:00 AM - 10:00 AM: Subject 1).
      5. Add any tips or suggestions for effective study.
    `;
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
  if (!selectedOption) selectedOption = "ask-question";
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
    res.render("index", { selectedOption, text: result });
  } catch (error) {
    res.status(500).send("An error occurred.");
  }
});

app.post("/log", async (req, res) => {
  const sample = req.body.sample;
  const data = req.body.logData;
  const selectedOption=req.body.selectedOption;

  try {
    if (sample) {
      const textValue = typeof sample === "object" ? JSON.stringify(sample) : sample;
      await URL.create({ text: textValue });
      return res.render("index",{selectedOption}); // Ensure only one response is sent
    }

    if (data) {
      await URL.deleteOne({ text: data });
      return res.render("log"); // Ensure only one response is sent
    }

    // If neither `sample` nor `data` is provided, handle accordingly
    res.status(400).send("No valid data provided.");
  } catch (err) {
    // Handle any errors that occur during the operations
    console.error(err);
    res.status(500).send("An error occurred.");
  }
});

app.get("/log", async (req, res) => {
  const data = await URL.find({});
  return res.render("log", { result: data });
});
app.delete("/log", (req, res) => {
  // Extract the data from the request body
  const data = req.body.logData;

  // Make sure data is properly received
  if (!data) {
    return res.status(400).send("No data provided");
  }

  // Delete the document from the collection
  URL.deleteOne({ text: data }, async(err) => {
    if (err) {
      // Handle any errors during the deletion
      return res.status(500).send("Error deleting data");
    }

    // Render the log page or redirect as needed
    const data = await URL.find({});
    res.render("log",{result:data});
  });
});

app.listen(3003, () => {
  console.log("Server is running on http://localhost:3003");
});
