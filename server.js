const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const multer = require('multer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Multer setup for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 } 
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ Error:', err));

// ========== SCHEMAS ==========

// 1. Madrasa Schema
const madrasaSchema = new mongoose.Schema({
  madrasaName: { type: String, required: true },
  mohtamim: { type: String, required: true }, 
  district: { type: String, required: true },
  state: { type: String }, 
  upiId: { type: String, required: true },
  phone: { type: String, required: true, unique: true }, 
  password: { type: String, required: true }, 
  email: String,
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

// 2. Donor Schema
const donorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// 3. Donation Schema
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
  date: { type: Date, default: Date.now }
});

// 4. Contact Schema
const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  subject: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// 5. Subscriber Schema
const subscriberSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  subscribedAt: { type: Date, default: Date.now }
});

// Models
const Madrasa = mongoose.model('Madrasa', madrasaSchema);
const Donor = mongoose.model('Donor', donorSchema);
const Donation = mongoose.model('Donation', donationSchema);
const Contact = mongoose.model('Contact', contactSchema);
const Subscriber = mongoose.model('Subscriber', subscriberSchema);

// ========== API ROUTES ==========

// 🟢 Madrasa Registration (WITH FILES)
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
    res.json({ success: true, message: 'Madrasa registration successful! Verification pending.' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Ye Number pehle se register hai!' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🟢 Donor Registration
app.post('/api/register/donor', async (req, res) => {
  try {
    const { fullName, phone, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newDonor = new Donor({ fullName, phone, password: hashedPassword });
    await newDonor.save();
    res.json({ success: true, message: 'Donor account created successfully!' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Ye Number pehle se register hai!' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🟢 Universal Login
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    let user = await Donor.findOne({ phone });
    let role = 'donor';
    if (!user) { user = await Madrasa.findOne({ phone }); role = 'madrasa'; }
    if (!user) return res.status(400).json({ success: false, error: 'Account nahi mila.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, error: 'Galat password!' });
    res.json({ success: true, role, name: user.madrasaName || user.fullName, userId: user._id, phone: user.phone });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all active madrasas
app.get('/api/madrasas', async (req, res) => {
  try {
    const madrasas = await Madrasa.find({ status: 'active' }).select('-aadhaarDoc -panDoc -madrasaProof -password').sort({ urgencyLevel: -1 });
    res.json(madrasas);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get single madrasa
app.get('/api/madrasas/:id', async (req, res) => {
  try {
    const madrasa = await Madrasa.findById(req.params.id).select('-aadhaarDoc -panDoc -madrasaProof -password');
    if (!madrasa) return res.status(404).json({ error: 'Not found' });
    res.json(madrasa);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create donation
app.post('/api/donations', async (req, res) => {
  try {
    const receiptNo = 'IMD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const donation = new Donation({ ...req.body, receiptNo });
    await donation.save();
    res.json({ success: true, receiptNo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get donations by email
app.get('/api/donations/:email', async (req, res) => {
  try {
    const donations = await Donation.find({ donorEmail: req.params.email }).sort({ date: -1 });
    res.json(donations);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Contact form
app.post('/api/contact', async (req, res) => {
  try {
    await Contact.create(req.body);
    res.json({ success: true, message: 'Message sent!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Newsletter subscribe
app.post('/api/subscribe', async (req, res) => {
  try {
    const existing = await Subscriber.findOne({ email: req.body.email });
    if (existing) return res.json({ message: 'Already subscribed!' });
    await Subscriber.create(req.body);
    res.json({ success: true, message: 'Subscribed!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin - Get pending madrasas
app.get('/api/admin/pending', async (req, res) => {
  try {
    const pending = await Madrasa.find({ status: 'pending' }).select('-password');
    res.json(pending);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin - Approve madrasa
app.put('/api/admin/approve/:id', async (req, res) => {
  try {
    await Madrasa.findByIdAndUpdate(req.params.id, { status: 'active' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin - Reject madrasa
app.put('/api/admin/reject/:id', async (req, res) => {
  try {
    await Madrasa.findByIdAndUpdate(req.params.id, { status: 'rejected' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stats
app.get('/api/stats', async (req, res) => {
  try {
    const madrasas = await Madrasa.countDocuments({ status: 'active' });
    const donations = await Donation.countDocuments();
    const totalAmount = await Donation.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({ madrasas, donations, totalAmount: totalAmount[0]?.total || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))