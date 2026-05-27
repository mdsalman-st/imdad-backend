import express, { json } from 'express';
import { connect, Schema, model, Types } from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { genSalt, hash, compare } from 'bcryptjs'; 
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();

console.log(`🌎 Environment: ${process.env.NODE_ENV || 'development'}`);

const app = express();
app.set('trust proxy', 1);
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(json());

// ========== CLOUDINARY CONFIG ==========
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isPdf = file.mimetype === 'application/pdf';
    return {
      folder: 'imdad_madaris',
      resource_type: isPdf ? 'raw' : 'image',
      type: 'upload',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      transformation: isPdf ? [] : [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto' }],
    };
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

const madrasaUpload = upload.fields([
  { name: 'aadhaarDoc', maxCount: 1 },
  { name: 'panDoc', maxCount: 1 },
  { name: 'madrasaProof', maxCount: 1 },
  { name: 'trustDeed', maxCount: 1 },
  { name: 'passbook', maxCount: 1 },
  { name: 'frontPhoto', maxCount: 1 },
  { name: 'classroomPhoto', maxCount: 1 }
]);

// ========== MONGODB CONNECTION ==========
connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// ========== SCHEMAS ==========
const madrasaSchema = new Schema({
  // ... (unchanged)
});

const donorSchema = new Schema({
  // ... (unchanged)
});

const donationSchema = new Schema({
  // ... (unchanged)
});

const contactSchema = new Schema({
  // ... (unchanged)
});

const subscriberSchema = new Schema({
  // ... (unchanged)
});

const needSchema = new Schema({
  // ... (unchanged)
});

// ✅ NEW: Question schema for Ask Mufti
const questionSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  category: { type: String, default: 'General' },
  question: { type: String, required: true },
  answer: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'answered'], default: 'pending' },
  answeredDate: Date,
  createdAt: { type: Date, default: Date.now }
});

const Madrasa = model('Madrasa', madrasaSchema);
const Donor = model('Donor', donorSchema);
const Donation = model('Donation', donationSchema);
const Contact = model('Contact', contactSchema);
const Subscriber = model('Subscriber', subscriberSchema);
const Need = model('Need', needSchema);
const Question = model('Question', questionSchema);  // 👈 NEW

function getDonorIdFromRequest(req) { /* ... unchanged */ }
function isValidObjectId(id) { /* ... unchanged */ }

// ========== API ROUTES ==========

// ... (Login, Register, Donor Update, Madrasa Registration, Public Madrasa routes, etc.) ...
// (All existing routes remain exactly as before)

// ====== Ask Mufti PUBLIC routes ======
// POST /api/askmufti - submit a question
app.post('/api/askmufti', async (req, res) => {
  try {
    const { name, email, category, question } = req.body;
    if (!name || !email || !question) {
      return res.status(400).json({ error: 'Name, email, and question are required' });
    }
    const newQuestion = await Question.create({ name, email, category, question });
    res.status(201).json({ success: true, question: newQuestion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/askmufti?email=... - user ke questions
app.get('/api/askmufti', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const questions = await Question.find({ email }).sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ... (Donations, Contact, Subscribe routes) ...

// ==================== ADMIN ROUTES ====================
app.get('/api/admin/pending', /* ... unchanged ... */);
app.put('/api/admin/approve/:id', /* ... unchanged ... */);
app.put('/api/admin/reject/:id', /* ... unchanged ... */);
app.delete('/api/admin/madrasa/:id', /* ... unchanged ... */);
app.get('/api/admin/document/:madrasaId/:docType', /* ... unchanged ... */);
app.get('/api/admin/contacts', /* ... unchanged ... */);

// ✅ NEW: Admin Ask Mufti - get all questions
app.get('/api/admin/askmufti', async (req, res) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ NEW: Admin Ask Mufti - answer a question
app.put('/api/admin/askmufti/:id', async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ error: 'Answer is required' });
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      { answer, status: 'answered', answeredDate: new Date() },
      { new: true }
    );
    if (!question) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, question });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats, Needs routes (unchanged)

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));