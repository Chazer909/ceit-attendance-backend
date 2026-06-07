const express  = require("express");
const router   = express.Router();
const multer   = require("multer");
const axios    = require("axios");
const FormData = require("form-data");
const fs       = require("fs");
const path     = require("path");
const db       = require("../config/db");

// Save incoming images to /uploads temporarily
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads")),
  filename:    (req, file, cb) => cb(null, `frame_${Date.now()}.jpg`),
});
const upload = multer({ storage });

// POST /api/camera/capture
// Called by ESP32-CAM — sends a JPEG frame + classDateId in form-data
// Field names: image (file), classDateId (text)
router.post("/capture", upload.single("image"), async (req, res) => {
  const { classDateId } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "ບໍ່ພົບຮູບພາບ" });
  }
  if (!classDateId) {
    return res.status(400).json({ error: "classDateId ຈຳເປັນ" });
  }

  try {
    // Check session is active
    const [sessions] = await db.query(
      "SELECT * FROM class_dates WHERE id = ? AND is_active = TRUE",
      [classDateId]
    );

    if (sessions.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "ການເຊັກອິນບໍ່ໄດ້ເປີດ" });
    }

    // Forward image to Python AI service
    const formData = new FormData();
    formData.append("image", fs.createReadStream(req.file.path), {
      filename: req.file.filename,
      contentType: "image/jpeg",
    });
    formData.append("classDateId", classDateId);

    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/recognize`,
      formData,
      { headers: formData.getHeaders(), timeout: 15000 }
    );

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    const { matched, studentId, studentName, studentCode, confidence } = aiResponse.data;

    if (!matched) {
      return res.json({ matched: false, message: "ບໍ່ຮັບຮູ້ໃບໜ້ານີ້" });
    }

    // Write attendance via face check-in route logic (inline for speed)
    const now = new Date();
    const checkInTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const recId = `${classDateId}-${studentId}`;

    await db.query(
      `INSERT INTO tb_attendance_record
         (id, student_id, student_code, student_name, class_date_id,
          status, check_in_time, check_in_method)
       VALUES (?, ?, ?, ?, ?, 'O', ?, 'face')
       ON DUPLICATE KEY UPDATE
         status = 'O', check_in_time = ?, check_in_method = 'face'`,
      [recId, studentId, studentCode, studentName, classDateId, checkInTime, checkInTime]
    );

    res.json({
      matched: true,
      studentId,
      studentName,
      studentCode,
      confidence,
      checkInTime,
    });
  } catch (err) {
    // Clean up if file still exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // If Python AI is not running yet, return graceful error
    if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
      return res.status(503).json({
        error: "AI service ບໍ່ໄດ້ເປີດ — ກະລຸນາລັນ Python Flask ກ່ອນ",
      });
    }

    console.error("Camera capture error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/camera/active-session
// ESP32 polls this to know if check-in is active and which classDateId to use
router.get("/active-session", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT cd.*, s.subject_name, s.section
       FROM class_dates cd
       JOIN subjects s ON cd.subject_id = s.id
       WHERE cd.is_active = TRUE
       LIMIT 1`
    );
    if (rows.length === 0) {
      return res.json({ active: false });
    }
    res.json({ active: true, session: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
