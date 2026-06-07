const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// GET /api/teachers
router.get("/teachers", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM teachers");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students
router.get("/students", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM students ORDER BY student_code");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subjects
router.get("/subjects", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM subjects");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/subjects/teacher/:teacherId
router.get("/subjects/teacher/:teacherId", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM subjects WHERE teacher_id = ?",
      [req.params.teacherId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/class-dates/:subjectId
router.get("/class-dates/:subjectId", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM class_dates WHERE subject_id = ? ORDER BY date",
      [req.params.subjectId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/enrollments/:subjectId — enrolled students for a subject
router.get("/enrollments/:subjectId", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.* FROM students s
       JOIN enrollments e ON s.id = e.student_id
       WHERE e.subject_id = ? ORDER BY s.student_code`,
      [req.params.subjectId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/student-groups
router.get("/student-groups", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM student_groups");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
