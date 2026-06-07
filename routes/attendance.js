const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// GET /api/attendance/:classDateId — full attendance list for a session
router.get("/:classDateId", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ar.*, s.student_code, s.name AS student_name
       FROM tb_attendance_record ar
       JOIN students s ON ar.student_id = s.id
       WHERE ar.class_date_id = ?
       ORDER BY s.student_code`,
      [req.params.classDateId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/attendance/:id/status — teacher manually changes status
// Body: { status }
router.put("/:id/status", async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["O", "L", "X", "Y", "Drop", "W"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "ສະຖານະບໍ່ຖືກຕ້ອງ" });
  }

  try {
    await db.query(
      `UPDATE tb_attendance_record
       SET status = ?, check_in_method = 'manual', is_dropped = ?
       WHERE id = ?`,
      [status, status === "Drop", req.params.id]
    );
    res.json({ message: "ອັບເດດສະຖານະສຳເລັດ" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/attendance/:id/note — teacher adds/edits a note
// Body: { note }
router.put("/:id/note", async (req, res) => {
  try {
    await db.query(
      "UPDATE tb_attendance_record SET note = ? WHERE id = ?",
      [req.body.note || "", req.params.id]
    );
    res.json({ message: "ບັນທຶກໝາຍເຫດສຳເລັດ" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/checkin/code — student submits 6-digit code
// Body: { classDateId, studentId, code, gps_lat, gps_lng }
router.post("/checkin/code", async (req, res) => {
  const { classDateId, studentId, code, gps_lat, gps_lng } = req.body;

  try {
    // Validate session is active and code matches
    const [sessions] = await db.query(
      "SELECT * FROM class_dates WHERE id = ? AND is_active = TRUE AND check_in_code = ?",
      [classDateId, code]
    );

    if (sessions.length === 0) {
      return res.status(400).json({ error: "ລະຫັດບໍ່ຖືກຕ້ອງ ຫຼື ການເຊັກອິນບໍ່ໄດ້ເປີດ" });
    }

    // Determine status: O if within first 10 min, else L
    const now = new Date();
    const checkInTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const recId = `${classDateId}-${studentId}`;

    // Calculate if out of bounds (placeholder — real check done in Python with GPS)
    const session = sessions[0];
    let outOfBounds = false;
    let distance = null;

    if (gps_lat && gps_lng && session.gps_lat && session.gps_lng) {
      distance = getDistanceMeters(gps_lat, gps_lng, session.gps_lat, session.gps_lng);
      outOfBounds = distance > 200; // 200 meter radius
    }

    await db.query(
      `INSERT INTO tb_attendance_record
         (id, student_id, class_date_id, status, check_in_time, check_in_method, out_of_bounds, distance_from_class)
       VALUES (?, ?, ?, 'O', ?, 'code', ?, ?)
       ON DUPLICATE KEY UPDATE
         status = 'O', check_in_time = ?, check_in_method = 'code',
         out_of_bounds = ?, distance_from_class = ?`,
      [recId, studentId, classDateId, checkInTime, outOfBounds, distance,
       checkInTime, outOfBounds, distance]
    );

    res.json({
      message: "ເຊັກອິນສຳເລັດ",
      checkInTime,
      outOfBounds,
      distance,
    });
  } catch (err) {
    console.error("Code check-in error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/checkin/face — called by Python AI after recognition
// Body: { classDateId, studentId, studentCode, studentName, confidence, gps_lat, gps_lng }
router.post("/checkin/face", async (req, res) => {
  const { classDateId, studentId, studentCode, studentName, confidence, gps_lat, gps_lng } = req.body;

  try {
    const [sessions] = await db.query(
      "SELECT * FROM class_dates WHERE id = ? AND is_active = TRUE",
      [classDateId]
    );

    if (sessions.length === 0) {
      return res.status(400).json({ error: "ການເຊັກອິນບໍ່ໄດ້ເປີດ" });
    }

    const session = sessions[0];
    const now = new Date();
    const checkInTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    let outOfBounds = false;
    let distance = null;
    if (gps_lat && gps_lng && session.gps_lat && session.gps_lng) {
      distance = getDistanceMeters(gps_lat, gps_lng, session.gps_lat, session.gps_lng);
      outOfBounds = distance > 200;
    }

    const recId = `${classDateId}-${studentId}`;
    await db.query(
      `INSERT INTO tb_attendance_record
         (id, student_id, student_code, student_name, class_date_id,
          status, check_in_time, check_in_method, out_of_bounds, distance_from_class)
       VALUES (?, ?, ?, ?, ?, 'O', ?, 'face', ?, ?)
       ON DUPLICATE KEY UPDATE
         status = 'O', check_in_time = ?, check_in_method = 'face',
         out_of_bounds = ?, distance_from_class = ?`,
      [recId, studentId, studentCode, studentName, classDateId, checkInTime, outOfBounds, distance,
       checkInTime, outOfBounds, distance]
    );

    res.json({
      message: "ບັນທຶກການເຊັກອິນດ້ວຍໃບໜ້າສຳເລັດ",
      studentId,
      studentName,
      checkInTime,
      outOfBounds,
    });
  } catch (err) {
    console.error("Face check-in error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Haversine formula — distance in metres between two GPS coords
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

module.exports = router;
