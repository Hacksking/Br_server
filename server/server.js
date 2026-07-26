const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "db.json");

app.use(express.json());

// Manual CORS (No cors package)
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});

// Simple token parser (No cookie-parser package)
app.use((req, res, next) => {
    req.cookies = {};

    const cookie = req.headers.cookie;
    if (cookie) {
        cookie.split(";").forEach(item => {
            const parts = item.split("=");
            if (parts.length === 2) {
                req.cookies[parts[0].trim()] = decodeURIComponent(parts[1]);
            }
        });
    }

    next();
});

// Static Files
app.use(express.static(path.join(__dirname, "../")));

// ---------- Database ----------
const readDB = () => {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    } catch {
        return {
            users: [],
            inquiries: [],
            products: []
        };
    }
};

const writeDB = (db) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
};

if (!fs.existsSync(DB_FILE)) {
    writeDB({
        users: [],
        inquiries: [],
        products: []
    });
}

// ---------- Signup ----------
app.post("/api/signup", (req, res) => {

    const { name, email, password } = req.body;

    if (!name || !email || !password)
        return res.status(400).json({ error: "All fields required" });

    const db = readDB();

    if (db.users.find(u => u.email === email))
        return res.status(400).json({ error: "Email already exists" });

    const user = {
        id: Date.now().toString(),
        name,
        email,
        password,
        role: "user"
    };

    db.users.push(user);
    writeDB(db);

    res.setHeader(
        "Set-Cookie",
        `auth_token=${user.id}; HttpOnly; Path=/`
    );

    res.json({
        message: "Signup successful",
        user
    });

});

// ---------- Login ----------
app.post("/api/login", (req, res) => {

    const { email, password } = req.body;

    const db = readDB();

    const user = db.users.find(
        u => u.email === email && u.password === password
    );

    if (!user)
        return res.status(401).json({
            error: "Invalid credentials"
        });

    res.setHeader(
        "Set-Cookie",
        `auth_token=${user.id}; HttpOnly; Path=/`
    );

    res.json({
        message: "Login successful",
        user
    });

});

// ---------- Logout ----------
app.post("/api/logout", (req, res) => {

    res.setHeader(
        "Set-Cookie",
        "auth_token=; Max-Age=0; Path=/"
    );

    res.json({
        message: "Logout successful"
    });

});

// ---------- Current User ----------
app.get("/api/me", (req, res) => {

    const token = req.cookies.auth_token;

    if (!token)
        return res.status(401).json({
            error: "Not authenticated"
        });

    const db = readDB();

    const user = db.users.find(
        u => u.id === token
    );

    if (!user)
        return res.status(401).json({
            error: "User not found"
        });

    res.json({
        user
    });

});

// ---------- Inquiry ----------
app.post("/api/inquiries", (req, res) => {

    const { name, email, phone, type, message } = req.body;

    if (!name || !email || !message)
        return res.status(400).json({
            error: "Required fields missing"
        });

    const db = readDB();

    const inquiry = {
        id: Date.now().toString(),
        name,
        email,
        phone: phone || "",
        type: type || "general",
        message,
        date: new Date().toISOString()
    };

    db.inquiries.push(inquiry);

    writeDB(db);

    res.json({
        message: "Inquiry submitted",
        inquiry
    });

});

// ---------- Admin ----------
app.get("/api/admin/data", (req, res) => {

    const token = req.cookies.auth_token;

    if (!token)
        return res.status(401).json({
            error: "Unauthorized"
        });

    const db = readDB();

    const admin = db.users.find(
        u => u.id === token && u.role === "admin"
    );

    if (!admin)
        return res.status(403).json({
            error: "Admin only"
        });

    res.json({
        users: db.users,
        inquiries: db.inquiries
    });

});

// ---------- Products ----------
app.get("/api/products", (req, res) => {

    const db = readDB();

    let products = db.products || [];

    if (req.query.type) {
        products = products.filter(
            p => p.type === req.query.type
        );
    }

    res.json(products);

});

// ---------- HTML ----------
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../index.html"));
});

// ---------- Server ----------
app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
