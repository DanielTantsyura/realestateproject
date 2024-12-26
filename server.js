import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// Configure OpenAI with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint to get clarifying questions
app.post('/api/ask', async (req, res) => {
  const { state, county, documentType } = req.body;

  const prompt = `Write a ${documentType} for use in ${state}${county ? `, ${county} county` : ''}. 
    It should follow standard legal templates and requirements for this jurisdiction.
    Before you write anything, please ask me any clarifying questions you need answered to create an appropriate document.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini-2024-07-18',
      messages: [
        { role: 'system', content: 'You are a helpful AI for generating legal documents.' },
        { role: 'user', content: prompt },
      ],
    });
    
    // Extract the text with clarifying questions
    const aiResponse = completion.choices[0].message.content;
    res.json({ questions: aiResponse });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating questions' });
  }
});

// Endpoint to get final document
app.post('/api/create', async (req, res) => {
  const { clarifyingQuestions, clarifyingAnswers } = req.body;

  // Construct the follow-up prompt
  // We'll pass in the Q&A
  let followUpPrompt = `Here are the answers to your questions. Please create the document now and return just the document. Do not include any other text:\n\n`;
  clarifyingQuestions.forEach((q, index) => {
    followUpPrompt += `${index + 1}. ${q}\nAnswer: ${clarifyingAnswers[index]}\n`;
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini-2024-07-18',
      messages: [
        { role: 'system', content: 'You are a helpful AI for generating legal documents.' },
        { role: 'user', content: followUpPrompt },
      ],
    });
    
    const finalDocument = completion.choices[0].message.content;
    res.json({ document: finalDocument });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating final document' });
  }
});

// Add this new endpoint after your existing endpoints
app.post('/api/update', async (req, res) => {
  const { currentDocument, requestedChanges } = req.body;

  const prompt = `Here is a document:
${currentDocument}

Please update this document according to these requested changes:
${requestedChanges}

Return only the updated document without any additional text or explanations.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini-2024-07-18',
      messages: [
        { role: 'system', content: 'You are a helpful AI for generating legal documents.' },
        { role: 'user', content: prompt },
      ],
    });
    
    const updatedDocument = completion.choices[0].message.content;
    res.json({ document: updatedDocument });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating document' });
  }
});

// Start server 
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});