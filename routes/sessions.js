const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// Generate a random 6-digit code
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/sessions/start
// Body: { classDateId, gps_lat, gps_lng, duration_minutes, teacherName }
router.post("/start", async (req, res) => {
  const { classDateId, gps_lat, gps_lng, duration_minutes = 15, teacherName } = req.body;

  if (!classDateId) {
    return res.status(400).json({ error: "classDateId ຈຳເປັນ" });
  }

  try {
    // Check session exists
    const [existing] = await db.query(
      "SELECT * FROM class_dates WHERE id = ?",
      [classDateId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "ບໍ່ພົບຫ້ອງຮຽນນີ້" });
    }

    const code = generateCode();

    await db.query(
      `UPDATE class_dates
       SET is_active = TRUE, check_in_code = ?, gps_lat = ?, gps_lng = ?, duration_minutes = ?
       WHERE id = ?`,
      [code, gps_lat || null, gps_lng || null, duration_minutes, classDateId]
    );

    // Initialize attendance rows for all students in this course
    const courseId = existing[0].subject_id;
    const [students] = await db.query("SELECT id, student_code, name FROM students");

    for (const s of students) {
      const recId = `${classDateId}-${s.id}`;
      // Insert only if not already there
      await db.query(
        `INSERT IGNORE INTO tb_attendance_record
         (id, student_id, student_code, student_name, class_date_id, status)
         VALUES (?, ?, ?, ?, ?, 'X')`,
        [recId, s.id, s.student_code, s.name, classDateId]
      );
    }

    res.json({
      message: "ເລີ່ມການເຊັກອິນສຳເລັດ",
      checkInCode: code,
      duration_minutes,
      classDateId,
    });
  } catch (err) {
    console.error("Start session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sessions/:classDateId/end
router.put("/:classDateId/end", async (req, res) => {
  try {
    await db.query(
      "UPDATE class_dates SET is_active = FALSE WHERE id = ?",
      [req.params.classDateId]
    );
    res.json({ message: "ສິ້ນສຸດການເຊັກອິນແລ້ວ" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:classDateId/cancel
// Body: { reason, cancelledBy }
router.post("/:classDateId/cancel", async (req, res) => {
  const { reason, cancelledBy } = req.body;
  const { classDateId } = req.params;

  try {
    const [existing] = await db.query(
      "SELECT subject_id FROM class_dates WHERE id = ?",
      [classDateId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "ບໍ່ພົບຫ້ອງຮຽນນີ້" });
    }

    await db.query(
      "UPDATE class_dates SET is_active = FALSE WHERE id = ?",
      [classDateId]
    );

    await db.query(
      `INSERT INTO cancelled_classes (class_date_id, subject_id, reason, cancelled_by)
       VALUES (?, ?, ?, ?)`,
      [classDateId, existing[0].subject_id, reason || "", cancelledBy || ""]
    );

    res.json({ message: "ຍົກເລີກຫ້ອງຮຽນສຳເລັດ" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/cancelled/:courseId — check if course has a cancelled class today
router.get("/cancelled/:courseId", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const [rows] = await db.query(
      `SELECT cc.*, cd.date FROM cancelled_classes cc
       JOIN class_dates cd ON cc.class_date_id = cd.id
       WHERE cc.subject_id = ? AND DATE(cc.cancelled_at) = ?`,
      [req.params.courseId, today]
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
