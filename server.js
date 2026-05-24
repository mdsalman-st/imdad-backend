import express, { json } from 'express';
import { connect, Schema, model } from 'mongoose';
import cors from 'cors';
import { genSalt, hash, compare } from 'bcryptjs'; 
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';
dotenv.config();

console.log(`🌎 Environment: ${process.env.NODE_ENV || 'development'}`);

const app = express();
app.set('trust proxy', 1); // 🔥 Render rate-limiting aur security ke liye zaroori
app.use(cors());
app.use(json());

// ========== CLOUDINARY CONFIG ==========
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ========== CLOUDINARY STORAGE ==========
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'imdad_madaris',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit', quality: 'auto' }],
    type: 'authenticated',
    sign_url: true,
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Multi-file upload middleware
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
  
  // Extra fields
  monthlyExpense: { type: Number, default: 0 },
  needReason: { type: String, default: '' },
  urgencyLevel: { type: Number, default: 80 },
  description: { type: String, default: '' },
  address: { type: String, default: '' },
  
  // Status
  status: { type: String, default: 'pending' },
  
  // 🔥 CLOUDINARY DOCUMENTS (URLs instead of Buffer)
  documents: {
    aadhaarDoc: {
      url: String,
      public_id: String,
      secure_url: String
    },
    panDoc: {
      url: String,
      public_id: String,
      secure_url: String
    },
    madrasaProof: {
      url: String,
      public_id: String,
      secure_url: String
    },
    trustDeed: {
      url: String,
      public_id: String,
      secure_url: String
    },
    passbook: {
      url: String,
      public_id: String,
      secure_url: String
    },
    frontPhoto: {
      url: String,
      public_id: String,
      secure_url: String
    },
    classroomPhoto: {
      url: String,
      public_id: String,
      secure_url: String
    }
  },
  
  createdAt: { type: Date, default: Date.now }
});

// Auto-calculate totals
madrasaSchema.pre('save', function(next) {
  this.totalStudents = (this.maleStudents || 0) + (this.femaleStudents || 0);
  this.totalTeachers = (this.maleTeachers || 0) + (this.femaleTeachers || 0);
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

const donorSchema = new Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const donationSchema = new Schema({
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

const Madrasa = model('Madrasa', madrasaSchema);
const Donor = model('Donor', donorSchema);
const Donation = model('Donation', donationSchema);
const Contact = model('Contact', contactSchema);
const Subscriber = model('Subscriber', subscriberSchema);
const Need = model('Need', needSchema);

// ========== API ROUTES ==========

// ---------- MADRASA REGISTRATION (CLOUDINARY) ----------
app.post('/api/register/madrasa', madrasaUpload, async (req, res) => {
  try {
    // ✅ FIXED: Saare missing variables ko destructure kiya
    const {
      madrasaName, board, category, establishedYear, recognition,
      mohtamim, phone, email,
      streetAddress, city, district, pincode,
      maleStudents, femaleStudents, maleTeachers, femaleTeachers, educationLevel,
      upiId, accountNumber, ifsc, bankName, password
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
    const salt = await genSalt(10);
    const hashedPassword = await hash(password, salt);

    // Build documents object from Cloudinary response
    const documents = {};
    requiredFiles.forEach(field => {
      const file = req.files[field][0];
      documents[field] = {
        url: file.path,
        secure_url: file.secure_url,
        public_id: file.public_id
      };
    });

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
      upiId: upiId, // ✅ FIXED: Sahi variable map kiya
      accountNumber, 
      ifsc: (ifsc?.toUpperCase?.() || ''), 
      bankName,
      password: hashedPassword,
      documents: documents,
      status: 'pending' // Always set to pending on registration
    });

    await newMadrasa.save();
    
    res.json({ 
      success: true, 
      message: '✅ Registration submitted! Pending verification.',
      madrasaId: newMadrasa._id 
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, error: 'Phone number already registered!' });
    }
    console.error('Registration error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- DONOR REGISTRATION ----------
app.post('/api/register/donor', async (req, res) => {
  try {
    const { fullName, phone, password } = req.body;
    const salt = await genSalt(10);
    const hashedPassword = await hash(password, salt);
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
    const isMatch = await compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, error: 'Wrong password!' });
    res.json({ success: true, role, name: user.madrasaName || user.fullName, userId: user._id, phone: user.phone });
  } catch(err) { res.status(500).json({ success: false, error: err.message }); }
});

// ---------- GET ALL MADRASAS (Public - no documents) ----------
app.get('/api/madrasas', async (req, res) => {
  try {
    const madrasas = await Madrasa.find({ status: 'active' }).select('-password -documents');
    res.json(madrasas);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- GET SINGLE MADRASA (Public) ----------
app.get('/api/madrasas/:id', async (req, res) => {
  try {
    const madrasa = await Madrasa.findById(req.params.id).select('-password -documents');
    if (!madrasa) return res.status(404).json({ error: 'Not found' });
    res.json(madrasa);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- UPDATE MADRASA ----------
app.put('/api/madrasas/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.password;
    delete updateData.documents;
    
    const madrasa = await Madrasa.findByIdAndUpdate(
      req.params.id, updateData, { new: true, runValidators: true }
    ).select('-password -documents');
    
    if (!madrasa) return res.status(404).json({ error: 'Not found' });
    res.json(madrasa);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- DONATIONS ----------
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
    await Donation.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- CONTACT ----------
app.post('/api/contact', async (req, res) => {
  try { await Contact.create(req.body); res.json({ success: true }); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- SUBSCRIBE ----------
app.post('/api/subscribe', async (req, res) => {
  try {
    const existing = await Subscriber.findOne({ email: req.body.email });
    if (existing) return res.json({ message: 'Already subscribed!' });
    await Subscriber.create(req.body);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- ADMIN: PENDING (WITH SIGNED URLs) ----------
app.get('/api/admin/pending', async (req, res) => {
  try { 
    const pending = await Madrasa.find({ status: 'pending' }).select('-password');
    
    // Generate signed URLs for admin (valid 24 hours)
    const pendingWithUrls = await Promise.all(pending.map(async (m) => {
      const madrasaObj = m.toObject();
      if (madrasaObj.documents) {
        for (const docKey of Object.keys(madrasaObj.documents)) {
          const doc = madrasaObj.documents[docKey];
          if (doc && doc.public_id) {
            doc.signed_url = cloudinary.url(doc.public_id, {
              type: 'authenticated',
              sign_url: true,
              secure: true,
              expires_at: Math.floor(Date.now() / 1000) + 86400
            });
          }
        }
      }
      return madrasaObj;
    }));
    
    res.json(pendingWithUrls);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ---------- ADMIN: APPROVE ----------
app.put('/api/admin/approve/:id', async (req, res) => {
  try { 
    await Madrasa.findByIdAndUpdate(req.params.id, { status: 'active' }); 
    res.json({ success: true, message: '✅ Approved!' }); 
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- ADMIN: REJECT ----------
app.put('/api/admin/reject/:id', async (req, res) => {
  try { 
    await Madrasa.findByIdAndUpdate(req.params.id, { status: 'rejected' }); 
    res.json({ success: true, message: '❌ Rejected.' }); 
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- ADMIN: DELETE MADRASA + CLOUDINARY FILES ----------
app.delete('/api/admin/madrasa/:id', async (req, res) => {
  try {
    const madrasa = await Madrasa.findById(req.params.id);
    if (!madrasa) return res.status(404).json({ error: 'Not found' });
    
    // Delete all files from Cloudinary
    if (madrasa.documents) {
      for (const docKey of Object.keys(madrasa.documents)) {
        const doc = madrasa.documents[docKey];
        if (doc && doc.public_id) {
          await cloudinary.uploader.destroy(doc.public_id);
        }
      }
    }
    
    await Madrasa.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Madrasa + all documents deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/donations/admin', async (req, res) => {
  try { 
    const donations = await Donation.find().sort({ date: -1 }).limit(50); 
    res.json(donations); 
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- STATS ----------
app.get('/api/stats', async (req, res) => {
  try {
    const madrasas = await Madrasa.countDocuments({ status: 'active' });
    const donations = await Donation.countDocuments();
    const totalAmountResult = await Donation.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalAmount = (Array.isArray(totalAmountResult) && totalAmountResult.length > 0)
      ? totalAmountResult[0].total
      : 0;
    res.json({ madrasas, donations, totalAmount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------- NEEDS (CRUD) ----------
app.get('/api/needs/madrasa/:id', async (req, res) => {
  try {
    const needs = await Need.find({ madrasaId: req.params.id }).sort({ createdAt: -1 });
    res.json(needs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/needs', async (req, res) => {
  try { const need = await Need.create(req.body); res.status(201).json(need); } 
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/needs/:id', async (req, res) => {
  try {
    const updated = await Need.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/needs/:id', async (req, res) => {
  try {
    await Need.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/needs/:id/status', async (req, res) => {
  try {
    const updated = await Need.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== 🔒 ADMIN DOCUMENT VIEWER (SIGNED URL) ==========
app.get('/api/admin/document/:madrasaId/:docType', async (req, res) => {
  try {
    const madrasa = await Madrasa.findById(req.params.madrasaId);
    if (!madrasa) return res.status(404).json({ error: 'Not found' });
    
    const docKey = req.params.docType;
    const doc = madrasa.documents ? madrasa.documents[docKey] : null;
    if (!doc || !doc.public_id) return res.status(404).json({ error: 'Document not found' });
    
    // Generate signed URL (valid 1 hour)
    const signedUrl = cloudinary.url(doc.public_id, {
      type: 'authenticated',
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 3600
    });
    
    res.json({ url: signedUrl, secure_url: signedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));