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
  madrasaName: { type: String, required: true },
  board: { type: String, required: true },
  category: { type: String, required: true },
  establishedYear: { type: Number, required: true },
  recognition: { type: String, required: true },
  mohtamim: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  streetAddress: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, default: '' },
  pincode: { type: String, required: true },
  maleStudents: { type: Number, default: 0 },
  femaleStudents: { type: Number, default: 0 },
  totalStudents: { type: Number, default: 0 },
  maleTeachers: { type: Number, default: 0 },
  femaleTeachers: { type: Number, default: 0 },
  totalTeachers: { type: Number, default: 0 },
  educationLevel: { type: String, required: true },
  upiId: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifsc: { type: String, required: true },
  bankName: { type: String, required: true },
  password: { type: String, required: true },
  monthlyExpense: { type: Number, default: 0 },
  needReason: { type: String, default: '' },
  urgencyLevel: { type: Number, default: 80 },
  description: { type: String, default: '' },
  address: { type: String, default: '' },
  status: { type: String, default: 'pending' },
  documents: {
    aadhaarDoc: { url: String, public_id: String, secure_url: String },
    panDoc: { url: String, public_id: String, secure_url: String },
    madrasaProof: { url: String, public_id: String, secure_url: String },
    trustDeed: { url: String, public_id: String, secure_url: String },
    passbook: { url: String, public_id: String, secure_url: String },
    frontPhoto: { url: String, public_id: String, secure_url: String },
    classroomPhoto: { url: String, public_id: String, secure_url: String }
  },
  createdAt: { type: Date, default: Date.now }
});

madrasaSchema.pre('save', function(next) {
  this.totalStudents = (this.maleStudents || 0) + (this.femaleStudents || 0);
  this.totalTeachers = (this.maleTeachers || 0) + (this.femaleTeachers || 0);
  this.address = `${this.streetAddress || ''}, ${this.city || ''}, ${this.district || ''} - ${this.pincode || ''}`.trim();
  next();
});

const donorSchema = new Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const donationSchema = new Schema({
  receiptNo: { type: String, unique: true },
  donorId: { type: Schema.Types.ObjectId, ref: 'Donor', default: null, index: true },
  donorName: { type: String, required: true },
  donorEmail: { type: String, required: true },
  donorPhone: String,
  madrasaName: { type: String, required: true },
  madrasaUpi: { type: String, required: true },
  amount: { type: Number, required: true },
  donationType: String,
  intention: String,
  onBehalfOf: String,
  status: { type: String, enum: ['Pending', 'Received', 'Failed'], default: 'Pending' },
  date: { type: Date, default: Date.now }
});

const contactSchema = new Schema({
  name: String, email: String, phone: String,
  subject: String, message: String,
  createdAt: { type: Date, default: Date.now }
});

const subscriberSchema = new Schema({
  email: { type: String, unique: true },
  subscribedAt: { type: Date, default: Date.now }
});

const needSchema = new Schema({
  madrasaId: { type: Schema.Types.ObjectId, ref: 'Madrasa', required: true },
  title: String, category: String, cost: Number,
  urgencyLevel: { type: Number, default: 80 },
  description: String,
  status: { type: String, enum: ['Active', 'Fulfilled'], default: 'Active' },
  createdAt: { type: Date, default: Date.now }
});

// ✅ NEW: Ask Mufti Question Schema
const questionSchema = new Schema({
  name: String,
  email: String,
  category: String,
  question: String,
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
const Question = model('Question', questionSchema); // 👈 NEW

function getDonorIdFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.role !== 'donor' || !Types.ObjectId.isValid(decoded.userId)) return null;
    return decoded.userId;
  } catch (err) { return null; }
}

function isValidObjectId(id) {
  return Types.ObjectId.isValid(id);
}

// ========== API ROUTES ==========

// Login, Donor Registration, Donor Update, Madrasa Registration (unchanged)
app.post('/api/login', async (req, res) => { /* ... */ });
app.post('/api/register/donor', async (req, res) => { /* ... */ });
app.put('/api/donors/:id', async (req, res) => { /* ... */ });
app.post('/api/register/madrasa', (req, res, next) => { /* ... */ }, async (req, res) => { /* ... */ });

// Public Madrasa Routes
app.get('/api/madrasas', async (req, res) => { /* ... */ });
app.get('/api/madrasas/:id', async (req, res) => { /* ... */ });

// Change Password, Update Madrasa
app.put('/api/change-password', async (req, res) => { /* ... */ });
app.put('/api/madrasas/:id', async (req, res) => { /* ... */ });

// Donations
app.post('/api/donations', async (req, res) => { /* ... */ });
app.get('/api/donations/admin', async (req, res) => { /* ... */ });
app.get('/api/donations/donor/:donorId', async (req, res) => { /* ... */ });
app.get('/api/donations/madrasa/:upi', async (req, res) => { /* ... */ });
app.get('/api/donations/:email', async (req, res) => { /* ... */ });
app.put('/api/donations/:id/status', async (req, res) => { /* ... */ });

// Contact & Subscribe
app.post('/api/contact', async (req, res) => { /* ... */ });
app.post('/api/subscribe', async (req, res) => { /* ... */ });

// ========== ADMIN ROUTES ==========
app.get('/api/admin/pending', async (req, res) => { /* ... */ });
app.put('/api/admin/approve/:id', async (req, res) => { /* ... */ });
app.put('/api/admin/reject/:id', async (req, res) => { /* ... */ });
app.delete('/api/admin/madrasa/:id', async (req, res) => { /* ... */ });
app.get('/api/admin/document/:madrasaId/:docType', async (req, res) => { /* ... */ });

// ✅ NEW: Get all contact messages
app.get('/api/admin/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ NEW: Admin Ask Mufti — Get all questions
app.get('/api/admin/askmufti', async (req, res) => {
  try {
    const questions = await Question.find().sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ NEW: Admin Ask Mufti — Answer a question
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stats
app.get('/api/stats', async (req, res) => { /* ... */ });

// Needs
app.get('/api/needs/madrasa/:id', async (req, res) => { /* ... */ });
app.post('/api/needs', async (req, res) => { /* ... */ });
app.put('/api/needs/:id', async (req, res) => { /* ... */ });
app.delete('/api/needs/:id', async (req, res) => { /* ... */ });

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));