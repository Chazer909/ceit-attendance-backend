require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");

const authRoute       = require("./routes/auth");
const dataRoute       = require("./routes/data");
const sessionsRoute   = require("./routes/sessions");
const attendanceRoute = require("./routes/attendance");
const cameraRoute     = require("./routes/camera");

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded face images statically (for enrollment preview)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",       authRoute);
app.use("/api",            dataRoute);
app.use("/api/sessions",   sessionsRoute);
app.use("/api/attendance", attendanceRoute);
app.use("/api/camera",     cameraRoute);

// ─── Health check ─────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Smart Track API is running" });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Smart Track API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});
