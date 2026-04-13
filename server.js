// npm install @google/generative-ai express dotenv

require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const MODEL_NAME = "gemini-2.5-flash";
const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  process.exit(1);
}

const chatHistories = new Map();

async function runChat(userInput, sessionId) {
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const generationConfig = {
    temperature: 0.85,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1000,
  };

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

  const systemHistory = [
    {
      role: "user",
      parts: [{
        text: `You are Lica, a compassionate and empathetic mental health support assistant. 
Your role is to:
- Listen actively and respond with warmth and understanding
- Help users explore their feelings and emotions without judgment
- Offer evidence-based coping strategies like deep breathing, mindfulness, or journaling when relevant
- Gently encourage professional help when a user seems to be in serious distress
- Keep responses concise but meaningful (2-4 sentences usually)
- Never diagnose, prescribe, or replace a mental health professional
- If a user expresses thoughts of self-harm, always provide crisis resources (iCall: 9152987821)
Always be warm, supportive, and human in tone.`
      }],
    },
    {
      role: "model",
      parts: [{ text: "Understood. I'm Lica, and I'm here to provide a safe and supportive space. I'll listen with empathy, offer gentle guidance, and always encourage professional help when needed." }],
    },
  ];

  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, []);
  }
  const sessionHistory = chatHistories.get(sessionId);

  const chat = model.startChat({
    generationConfig,
    safetySettings,
    history: [...systemHistory, ...sessionHistory],
  });

  const result = await chat.sendMessage(userInput);
  const responseText = result.response.text();

  sessionHistory.push({ role: "user", parts: [{ text: userInput }] });
  sessionHistory.push({ role: "model", parts: [{ text: responseText }] });

  if (sessionHistory.length > 40) {
    sessionHistory.splice(0, 2);
  }

  return responseText;
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.post('/chat', async (req, res) => {
  try {
    const userInput = req.body?.userInput;

    if (!userInput || typeof userInput !== 'string' || !userInput.trim()) {
      return res.status(400).json({ error: 'Invalid or empty message.' });
    }
    const sessionId = req.ip || 'default';
    const response = await runChat(userInput.trim(), sessionId);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
