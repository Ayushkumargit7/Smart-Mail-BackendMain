import express from 'express';
import cors from 'cors';
import Connection from './database/db.js';
import routes from './routes/route.js';
import Email from './model/email.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";
import { initializeRedisClient, redisCachingMiddleware } from './middlewares/redis.js';
import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.urlencoded());
app.use(express.json());
app.use('/', routes);

const PORT = 8080;


// Initialize Redis client
initializeRedisClient();

// Use the middleware in your routes
app.use('/api', redisCachingMiddleware({ EX: 600 })); // Cache for 600 seconds.


app.get('/', (req, res) => {
  res.send(`Server is running`);
});

//sending mail
const transporter = nodemailer.createTransport({
  service: "gmail",   
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.USER,
    pass: process.env.APP_PASSWORD,
  },
});

const sendMail = async (mailOptions) => {
  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
  } catch (err) {
    console.log(err);
  }   
}

// // Update email type endpoint
// app.post('/api/update-email', async (req, res) => {
//   const { id, type2 } = req.body;

//   try {
//       const email = await Email.updateOne({_id:id }, {$set: { type : "read" }});
//       console.log(email);
//       if (!email) return res.status(404).send('The email with the given ID was not found.');
//       res.send(email);
//   } catch (error) {
//       res.status(500).send('Something went wrong.');
//   }
// });

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

app.post('/generate', async (req, res) => {
    const prompt = req.body.prompt;
    
    if (!prompt) {
      return res.status(400).send({ error: 'Prompt is required' });
    }
  
    // For text-only input, use the gemini-pro model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
  
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    res.send({ generatedText: text });
  });

  //Route for sending emails
  app.post('/sendEmail', async (req, res) => {
    const mailContent = req.body.mailContent;
    const subject = req.body.subject;
    const to = req.body.to;
    
    const mailOptions = {
      from: {
        name: "Ayush Kumar",
        address: process.env.USER
      }, 
      to: to,
      subject: subject,
      text: mailContent,
      html: `<p>${mailContent.replace(/\n/g, "<br>")}</p>`,
    };
    sendMail(mailOptions)
      .then(() => res.status(200).send({ message: "Email sent successfully" }))
      .catch(error => res.status(500).send({ error: "Error sending email", details: error }));
});

Connection();

app.listen(PORT, () => console.log(`Server started on PORT ${PORT}`));
