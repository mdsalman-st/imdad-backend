const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const multer = require('multer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ========== MULTER SETUP (7 FILES) ==========
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per file
});

// Multi-file upload middleware for madrasa registration
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
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// ========== SCHEMAS ==========

const madrasaSchema = new mongoose.Schema({
  // Basic Info
  madrasaName: { type: String, required: true },
  board: { type: String, required: true },
  category: { type: String, required: true },
  establishedYear: { type: Number, required: true },
  recognition: { type: String, required: true },
  
  // Administrator
  mohtamim: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  
  // Address
  streetAddress: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, default: '' },
  pincode: { type: String, required: true },
  
  // Students & Teachers
  maleStudents: { type: Number, default: 0 },
  femaleStudents: { type: Number, default: 0 },
  totalStudents: { type: Number, default: 0 },
  maleTeachers: { type: Number, default: 0 },
  femaleTeachers: { type: Number, default: 0 },
  totalTeachers: { type: Number, default: 0 },
  educationLevel: { type: String, required: true },
  
  // Payment Info
  upiId: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifsc: { type: String, required: true },
  bankName: { type: String, required: true },
  
  // Login
  password: { type: String, required: true },
  
  // Extra fields (for future use)
  monthlyExpense: { type: Number, default: 0 },
  needReason: { type: String, default: '' },
  urgencyLevel: { type: Number, default: 80 },
  description: { type: String, default: '' },
  address: { type: String, default: '' }, // combined address string
  
  // Status
  status: { type: String, default: 'pending' },
  
  // KYC Documents (5 docs)
  aadhaarDoc: { data: Buffer, contentType: String },
  panDoc: { data: Buffer, contentType: String },
  madrasaProof: { data: Buffer, contentType: String },
  trustDeed: { data: Buffer, contentType: String },
  passbook: { data: Buffer, contentType: String },
  
  // Photos (2 photos)
  frontPhoto: { data: Buffer, contentType: String },
  classroomPhoto: { data: Buffer, contentType: String },
  
  createdAt: { type: Date, default: Date.now }
});

// Auto-calculate totals before save
madrasaSchema.pre('save', function(next) {
  this.totalStudents = (this.maleStudents || 0) + (this.femaleStudents || 0);
  this.totalTeachers = (this.maleTeachers || 0) + (this.femaleTeachers || 0);
  // Combined address
  this.address = `${this.streetAddress || ''}, ${this.city || ''}, ${this.district || ''} - ${this.pincode || ''}`.trim();
  next();
});

madrasaSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.$set) {
    const s = update.$set;
    if (s.maleStudents !== undefined || s.femaleStudents !== undefined) {
      s.totalStudents = (s.maleStudents || 0) + (s.femaleStudents || 0);
    }
    if (s.maleTeachers !== undefined || s.femaleTeachers !== undefined) {
      s.totalTeachers = (s.maleTeachers || 0) + (s.femaleTeachers || 0);
    }
    if (s.streetAddress || s.city || s.district || s.pincode) {
      s.address = `${s.streetAddress || ''}, ${s.city || ''}, ${s.district || ''} - ${s.pincode || ''}`.trim();
    }
  }
  next();
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
  status: { type: String, enum: ['Active', 'Fulfilled'], default: 'Active' },
  createdAt: { type: Date, default: Date.now }
});

const Madrasa = mongoose.model('Madrasa', madrasaSchema);
const Donor = mongoose.model('Donor', donorSchema);
const Donation = mongoose.model('Donation', donationSchema);
const Contact = mongoose.model('Contact', contactSchema);
const Subscriber = mongoose.model('Subscriber', subscriberSchema);
const Need = mongoose.model('Need', needSchema);

// ========== API ROUTES ==========

// ---------- MADRASA REGISTRATION (UPGRADED) ----------
app.post('/api/register/madrasa', madrasaUpload, async (req, res) => {
  try {
    const {
      madrasaName, board, category, establishedYear, recognition,
      mohtamim, phone, email,
      streetAddress, city, district, pincode,
      maleStudents, femaleStudents, maleTeachers, femaleTeachers, educationLevel,
      upi, accountNumber, ifsc, bankName,
      password
    } = req.body;

    // Check required files
    const requiredFiles = ['aadhaarDoc', 'panDoc', 'madrasaProof', 'trustDeed', 'passbook', 'frontPhoto', 'classroomPhoto'];
    const missingFiles = requiredFiles.filter(f => !req.files || !req.files[f]);
    
    if (missingFiles.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Missing documents: ${missingFiles.join(', ')}` 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new madrasa
    const newMadrasa = new Madrasa({
      madrasaName, board, category,
      establishedYear: parseInt(establishedYear), recognition,
      mohtamim, phone,
      email: email || '',
      streetAddress, city, district,
      state: req.body.state || '', pincode,
      maleStudents: parseInt(maleStudents) || 0,
      femaleStudents: parseInt(femaleStudents) || 0,
      maleTeachers: parseInt(maleTeachers) || 0,
      femaleTeachers: parseInt(femaleTeachers) || 0,
      educationLevel,
      upiId: upi,
      accountNumber, ifsc: ifsc.toUpperCase(), bankName,
      password: hashedPassword,
      
      // Documents
      aadhaarDoc: { data: req.files.aadhaarDoc[0].buffer, contentType: req.files.aadhaarDoc[0].mimetype },
      panDoc: { data: req.files.panDoc[0].buffer, contentType: req.files.panDoc[0].mimetype },
      madrasaProof: { data: req.files.madrasaProof[0].buffer, contentType: req.files.madrasaProof[0].mimetype },
      trustDeed: { data: req.files.trustDeed[0].buffer, contentType: req.files.trustDeed[0].mimetype },
      passbook: { data: req.files.passbook[0].buffer, contentType: req.files.passbook[0].mimetype },
      frontPhoto: { data: req.files.frontPhoto[0].buffer, contentType: req.files.frontPhoto[0].mimetype },
      classroomPhoto: { data: req.files.classroomPhoto[0].buffer, contentType: req.files.classroomPhoto[0].mimetype }
    });

    await newMadrasa.save();
    
    res.json({ 
      success: true, 
      message: 'Registration submitted! Pending verification.',
      madrasaId: newMadrasa._id 
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Phone number already registered!' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- DONOR REGISTRATION ----------
app.post('/api/register/donor', async (req, res) => {
  try {
    const { fullName, phone, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    await new Donor({ fullName, phone, password: hashedPassword }).save();
    res.json({ success: true, message: 'Account created! Please login.' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, error: 'Phone already registered!' });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- LOGIN ----------
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    let user = await Donor.findOne({ phone });
    let role = 'donor';
    if (!user) { 
      user = await Madrasa.findOne({ phone }); 
      role = 'madrasa'; 
    }
    if (!user) return res.status(400).json({ success: false, error: 'Account not found.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, error: 'Wrong password!' });
    res.json({ 
      success: true, 
      role, 
      name: user.madrasaName || user.fullName, 
      userId: user._id, 
      phone: user.phone 
    });
  } catch(err) { 
    res.status(500).json({ success: false, error: err.message }); 
  }
});

// ---------- GET ALL MADRASAS ----------
app.get('/api/madrasas', async (req, res) => {
  try {
    const madrasas = await Madrasa.find({ status: 'active' })
      .select('-password -aadhaarDoc -panDoc -madrasaProof -trustDeed -passbook -frontPhoto -classroomPhoto');
    res.json(madrasas);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ---------- GET SINGLE MADRASA ----------
app.get('/api/madrasas/:id', async (req, res) => {
  try {
    const madrasa = await Madrasa.findById(req.params.id)
      .select('-password -aadhaarDoc -panDoc -madrasaProof -trustDeed -passbook -frontPhoto -classroomPhoto');
    if (!madrasa) return res.status(404).json({ error: 'Not found' });
    res.json(madrasa);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ---------- UPDATE MADRASA PROFILE ----------
app.put('/api/madrasas/:id', async (req, res) => {
  try {
    // Don't allow password update through this route
    const updateData = { ...req.body };
    delete updateData.password;
    
    const madrasa = await Madrasa.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -aadhaarDoc -panDoc -madrasaProof -trustDeed -passbook -frontPhoto -classroomPhoto');
    
    if (!madrasa) return res.status(404).json({ error: 'Madrasa not found' });
    res.json(madrasa);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- DONATIONS ----------
app.post('/api/donations', async (req, res) => {
  try {
    const receiptNo = 'IMD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    await new Donation({ ...req.body, receiptNo }).save();
    res.json({ success: true, receiptNo });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.get('/api/donations/:email', async (req, res) => {
  try {
    const donations = await Donation.find({ donorEmail: req.params.email }).sort({ date: -1 });
    res.json(donations);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.get('/api/donations/madrasa/:upi', async (req, res) => {
  try {
    const donations = await Donation.find({ madrasaUpi: req.params.upi }).sort({ date: -1 });
    res.json(donations);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.put('/api/donations/:id/status', async (req, res) => {
  try {
    await Donation.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true, message: `Donation marked as ${req.body.status}` });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ---------- CONTACT ----------
app.post('/api/contact', async (req, res) => {
  try { 
    await Contact.create(req.body); 
    res.json({ success: true }); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ---------- SUBSCRIBE ----------
app.post('/api/subscribe', async (req, res) => {
  try {
    const existing = await Subscriber.findOne({ email: req.body.email });
    if (existing) return res.json({ message: 'Already subscribed!' });
    await Subscriber.create(req.body);
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ---------- ADMIN ROUTES ----------
app.get('/api/admin/pending', async (req, res) => {
  try { 
    const pending = await Madrasa.find({ status: 'pending' }); 
    res.json(pending); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.put('/api/admin/approve/:id', async (req, res) => {
  try { 
    await Madrasa.findByIdAndUpdate(req.params.id, { status: 'active' }); 
    res.json({ success: true }); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.put('/api/admin/reject/:id', async (req, res) => {
  try { 
    await Madrasa.findByIdAndUpdate(req.params.id, { status: 'rejected' }); 
    res.json({ success: true }); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.get('/api/donations/admin', async (req, res) => {
  try { 
    const donations = await Donation.find().sort({ date: -1 }).limit(50); 
    res.json(donations); 
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ---------- STATS ----------
app.get('/api/stats', async (req, res) => {
  try {
    const madrasas = await Madrasa.countDocuments({ status: 'active' });
    const donations = await Donation.countDocuments();
    const totalAmount = await Donation.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    res.json({ 
      madrasas, 
      donations, 
      totalAmount: totalAmount[0]?.total || 0 
    });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ---------- NEEDS (CRUD) ----------
app.get('/api/needs/madrasa/:id', async (req, res) => {
  try {
    const needs = await Need.find({ madrasaId: req.params.id }).sort({ createdAt: -1 });
    res.json(needs);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/needs', async (req, res) => {
  try {
    const need = await Need.create(req.body);
    res.status(201).json(need);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.put('/api/needs/:id', async (req, res) => {
  try {
    const updatedNeed = await Need.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!updatedNeed) return res.status(404).json({ error: 'Need not found' });
    res.json(updatedNeed);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.delete('/api/needs/:id', async (req, res) => {
  try {
    const deletedNeed = await Need.findByIdAndDelete(req.params.id);
    if (!deletedNeed) return res.status(404).json({ error: 'Need not found' });
    res.json({ success: true, message: 'Need deleted' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

app.patch('/api/needs/:id/status', async (req, res) => {
  try {
    const updatedNeed = await Need.findByIdAndUpdate(
      req.params.id, { status: req.body.status }, { new: true }
    );
    if (!updatedNeed) return res.status(404).json({ error: 'Need not found' });
    res.json(updatedNeed);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ========== DOCUMENT SERVING ROUTE ==========
app.get('/api/madrasas/:id/document/:docType', async (req, res) => {
  try {
    const madrasa = await Madrasa.findById(req.params.id);
    if (!madrasa) return res.status(404).json({ error: 'Not found' });
    
    const docMap = {
      'aadhaar': madrasa.aadhaarDoc,
      'pan': madrasa.panDoc,
      'proof': madrasa.madrasaProof,
      'trust': madrasa.trustDeed,
      'passbook': madrasa.passbook,
      'front': madrasa.frontPhoto,
      'classroom': madrasa.classroomPhoto
    };
    
    const doc = docMap[req.params.docType];
    if (!doc || !doc.data) return res.status(404).json({ error: 'Document not found' });
    
    res.set('Content-Type', doc.contentType);
    res.send(doc.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));