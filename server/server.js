const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());
app.use(cookieParser());
// Serve static files from the parent directory (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../')));

// Helper to read DB
const readDB = () => {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return { users: [], inquiries: [], products: [] };
  }
};

// Helper to write DB
const writeDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

const ensureDBFile = () => {
  if (!fs.existsSync(DB_FILE)) {
    writeDB({ users: [], inquiries: [], products: [] });
  }
};

ensureDBFile();

// API: Signup
app.post('/api/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const db = readDB();
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already exists' });
  }

  const newUser = { id: Date.now().toString(), name, email, password, role: 'user' };
  db.users.push(newUser);
  writeDB(db);

  res.cookie('auth_token', newUser.id, { httpOnly: true });
  res.json({ message: 'Signup successful', user: { name: newUser.name, email: newUser.email, role: newUser.role } });
});

// API: Inquiry submission
app.post('/api/inquiries', (req, res) => {
  const { name, email, phone, type, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  const db = readDB();
  const inquiry = {
    id: Date.now().toString(),
    name,
    email,
    phone: phone || '',
    type: type || 'general',
    message,
    date: new Date().toISOString(),
  };

  db.inquiries.push(inquiry);
  writeDB(db);

  res.json({ message: 'Inquiry submitted successfully', inquiry });
});

// API: Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.cookie('auth_token', user.id, { httpOnly: true });
  res.json({ message: 'Login successful', user: { name: user.name, email: user.email, role: user.role } });
});

// API: Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logout successful' });
});

// API: Check Auth
app.get('/api/me', (req, res) => {
  const token = req.cookies.auth_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  
  const db = readDB();
  const user = db.users.find(u => u.id === token);
  if (!user) return res.status(401).json({ error: 'User not found' });

  res.json({ user: { name: user.name, email: user.email, role: user.role } });
});

// API: Admin Data
app.get('/api/admin/data', (req, res) => {
  const token = req.cookies.auth_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  
  const db = readDB();
  const user = db.users.find(u => u.id === token);
  
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }

  res.json({ users: db.users, inquiries: db.inquiries });
});

// API: Get Products
app.get('/api/products', (req, res) => {
  const type = req.query.type; // e.g., 'gold', 'diamond', 'silver', 'bridal'
  const db = readDB();
  let products = db.products || [];
  if (type) {
    products = products.filter(p => p.type === type);
  }
  res.json(products);
});

// Fallback for HTML pages
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the running process or set PORT to a different value.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
