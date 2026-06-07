const express = require("express");
const router  = express.Router();
const db      = require("../config/db");

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ" });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM users WHERE username = ? AND password = ?",
      [username, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ" });
    }

    const user = rows[0];
    res.json({
      id:       user.id,
      username: user.username,
      role:     user.role,
      name:     user.name,
      ref_id:   user.ref_id,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "ເກີດຂໍ້ຜິດພາດໃນເຊີເວີ" });
  }
});

module.exports = router;
