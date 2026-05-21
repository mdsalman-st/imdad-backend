const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const multer = require('multer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 } 
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ Error:', err));

// ========== SCHEMAS ==========

const madrasaSchema = new mongoose.Schema({
  madrasaName: { type: String, required: true },
  mohtamim: { type: String, required: true }, 
  district: { type: String, required: true },
  state: { type: String }, 
  upiId: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, 
  password: { type: String, required: true }, 
  email: String,
  totalStudents: { type: Number, default: 0 },
  totalTeachers: { type: Number, default: 0 },
  monthlyExpense: { type: Number, default: 0 },
  needReason: { type: String }, 
  urgencyLevel: { type: Number, default: 80 },
  description: String,
  address: String,
  status: { type: String, default: 'pending' },
  aadhaarDoc: { data: Buffer, contentType: String },
  panDoc: { data: Buffer, contentType: String },
  madrasaProof: { data: Buffer, contentType: String },
  createdAt: { type: Date, default: Date.now }
});

const donorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const donationSchema = new mongoose.Schema({
  receiptNo: { type: String, unique: true },
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

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  subject: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const subscriberSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  subscribedAt: { type: Date, default: Date.now }
});

const needSchema = new mongoose.Schema({
  madrasaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Madrasa', required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  cost: { type: Number, required: true },
  urgencyLevel: { type: Number, default: 80 },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const Madrasa = mongoose.model('Madrasa', madrasaSchema);
const Donor = mongoose.model('Donor', donorSchema);
const Donation = mongoose.model('Donation', donationSchema);
const Contact = mongoose.model('Contact', contactSchema);
const Subscriber = mongoose.model('Subscriber', subscriberSchema);
const Need = mongoose.model('Need', needSchema);

// ========== API ROUTES ==========

app.post('/api/register/madrasa', upload.fields([
  { name: 'aadhaarDoc', maxCount: 1 },
  { name: 'panDoc', maxCount: 1 },
  { name: 'madrasaProof', maxCount: 1 }
]), async (req, res) => {
  try {
    const { madrasaName, mohtamim, phone, district, upi, password } = req.body;
    if (!req.files || !req.files.aadhaarDoc || !req.files.panDoc || !req.files.madrasaProof) {
      return res.status(400).json({ success: false, error: 'All KYC documents required!' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newMadrasa = new Madrasa({
      madrasaName, mohtamim, phone, district, upiId: upi, password: hashedPassword,
      aadhaarDoc: { data: req.files.aadhaarDoc[0].buffer, contentType: req.files.aadhaarDoc[0].mimetype },
      panDoc: { data: req.files.panDoc[0].buffer, contentType: req.files.panDoc[0].mimetype },
      madrasaProof: { data: req.files.madrasaProof[0].buffer, contentType: req.files.madrasaProof[0].mimetype }
    });
    await newMadrasa.save();
    res.json({ success: true, message: 'Registration successful! Pending verification.' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Number already registered!' });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/register/donor', async (req, res) => {
  try {
    const { fullName, phone, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    await new Donor({ fullName, phone, password: hashedPassword }).save();
    res.json({ success: true, message: 'Account created!' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Number already registered!' });
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    let user = await Donor.findOne({ phone });
    let role = 'donor';
    if (!user) { user = await Madrasa.findOne({ phone }); role = 'madrasa'; }
    if (!user) return res.status(400).json({ success: false, error: 'Account not found.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, error: 'Wrong password!' });
    res.json({ success: true, role, name: user.madrasaName || user.fullName, userId: user._id, phone: user.phone });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/madrasas', async (req, res) => {
  try {
    const madrasas = await Madrasa.find({ status: 'active' }).select('-aadhaarDoc -panDoc -madrasaProof -password');
    res.json(madrasas);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/madrasas/:id', async (req, res) => {
  try {
    const madrasa = await Madrasa.findById(req.params.id).select('-aadhaarDoc -panDoc -madrasaProof -password');
    if (!madrasa) return res.status(404).json({ error: 'Not found' });
    res.json(madrasa);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== FIX: ADDED PUT ROUTE FOR MADRASA PROFILE UPDATE ==========
app.put('/api/madrasas/:id', async (req, res) => {
  try {
    const madrasa = await Madrasa.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password -aadhaarDoc -panDoc -madrasaProof');
    
    if (!madrasa) {
      return res.status(404).json({ error: 'Madrasa not found' });
    }
    
    res.json(madrasa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/donations', async (req, res) => {
  try {
    const receiptNo = 'IMD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    await new Donation({ ...req.body, receiptNo }).save();
    res.json({ success: true, receiptNo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/donations/:email', async (req, res) => {
  try {
    const donations = await Donation.find({ donorEmail: req.params.email }).sort({ date: -1 });
    res.json(donations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/donations/madrasa/:upi', async (req, res) => {
  try {
    const donations = await Donation.find({ madrasaUpi: req.params.upi }).sort({ date: -1 });
    res.json(donations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/donations/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await Donation.findByIdAndUpdate(req.params.id, { status });
    res.json({ success: true, message: `Donation marked as ${status}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/contact', async (req, res) => {
  try { await Contact.create(req.body); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscribe', async (req, res) => {
  try {
    const existing = await Subscriber.findOne({ email: req.body.email });
    if (existing) return res.json({ message: 'Already subscribed!' });
    await Subscriber.create(req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/pending', async (req, res) => {
  try { const pending = await Madrasa.find({ status: 'pending' }); res.json(pending); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/approve/:id', async (req, res) => {
  try { await Madrasa.findByIdAndUpdate(req.params.id, { status: 'active' }); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/reject/:id', async (req, res) => {
  try { await Madrasa.findByIdAndUpdate(req.params.id, { status: 'rejected' }); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/donations/admin', async (req, res) => {
  try { const donations = await Donation.find().sort({ date: -1 }).limit(50); res.json(donations); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stats', async (req, res) => {
  try {
    const madrasas = await Madrasa.countDocuments({ status: 'active' });
    const donations = await Donation.countDocuments();
    const totalAmount = await Donation.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({ madrasas, donations, totalAmount: totalAmount[0]?.total || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/needs/madrasa/:id', async (req, res) => {
  try {
    const needs = await Need.find({ madrasaId: req.params.id }).sort({ createdAt: -1 });
    res.json(needs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/needs', async (req, res) => {
  try {
    const need = await Need.create(req.body);
    res.status(201).json(need);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));