const PORT = 8000;
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_KEY);

// Rate limiter middleware
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per `window` (here, per minute)
    message: 'Too many requests from this IP, please try again after a minute',
});

app.use(limiter);

async function sendMessageWithRetry(chat, msg, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await chat.sendMessage(msg);
            const response = await result.response;
            return response.text();
        } catch (error) {
            if (attempt === retries || error.message.includes('503')) {
                throw error;
            }
            console.warn(`Attempt ${attempt} failed, retrying...`);
            await new Promise(res => setTimeout(res, 1000 * attempt));
        }
    }
}

app.post('/gemini', async (req, res) => {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const chat = await model.startChat({ history: req.body.history });
        const msg = req.body.message;
        const text = await sendMessageWithRetry(chat, msg);
        res.send(text);
    } catch (error) {
        console.error(error);
        res.status(503).send('The model is currently overloaded. Please try again later.');
    }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
