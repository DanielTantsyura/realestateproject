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
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://realestateproject-pqex.onrender.com/'  // Replace with your actual Render domain
    : 'http://localhost:3001'
}));
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// Configure OpenAI with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint to get clarifying questions
app.post('/api/ask', async (req, res) => {
  const { state, documentType } = req.body;

  const prompt = `Write a ${documentType} for use in ${state}. 
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
  const { clarifyingQuestions, clarifyingAnswers, template } = req.body;

  // Construct the follow-up prompt
  let followUpPrompt = template 
    ? `Here is the original template:\n\n${template}\n\nPlease modify this template according to these answers:\n\n`
    : `Here are the answers to your questions. Please create the document now and return just the document:\n\n`;

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

// Add this new endpoint after your existing endpoints
app.post('/api/ask-with-template', async (req, res) => {
  const { state, documentType, template } = req.body;

  const prompt = `I have a ${documentType} template for use in ${state}. 
    Here is the template:
    
    ${template}

    Please analyze this template and ask me clarifying questions about what needs to be changed or filled in.
    Focus on:
    1. What specific information needs to be updated
    2. Which sections might need modification
    3. Any missing elements that should be added
    4. Any jurisdiction-specific requirements that might be missing
    
    Format each question with a title and number like this:
    1. **Field Update**: [Question about specific field]
    2. **Section Review**: [Question about section changes]
    etc.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini-2024-07-18',
      messages: [
        { role: 'system', content: 'You are a helpful AI for analyzing and modifying legal documents.' },
        { role: 'user', content: prompt },
      ],
    });
    
    const aiResponse = completion.choices[0].message.content;
    res.json({ questions: aiResponse });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generating template-based questions' });
  }
});

// Start server 
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});