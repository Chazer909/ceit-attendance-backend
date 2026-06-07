const mysql = require("mysql2/promise");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

async function setup() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    charset: "utf8mb4",
    multipleStatements: true,
  });

  console.log("✅ Connected to MySQL");

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await conn.query(`USE \`${process.env.DB_NAME}\`;`);
  console.log(`✅ Database '${process.env.DB_NAME}' ready`);

  // ─── Tables from CEIT API (mock for now) ────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      username   VARCHAR(50)  UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      role       ENUM('teacher','student','admin','hod') NOT NULL,
      name       VARCHAR(255) NOT NULL,
      ref_id     VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS teachers (
      id           VARCHAR(20)  PRIMARY KEY,
      teacher_code VARCHAR(10)  UNIQUE NOT NULL,
      name         VARCHAR(255) NOT NULL,
      email        VARCHAR(255),
      department   VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS students (
      id           VARCHAR(20)  PRIMARY KEY,
      student_code VARCHAR(20)  UNIQUE NOT NULL,
      name         VARCHAR(255) NOT NULL,
      email        VARCHAR(255),
      department   VARCHAR(255),
      year         INT DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS subjects (
      id           VARCHAR(20)  PRIMARY KEY,
      subject_code VARCHAR(20)  UNIQUE NOT NULL,
      subject_name VARCHAR(255) NOT NULL,
      teacher_id   VARCHAR(20),
      teacher_name VARCHAR(255),
      credits      INT DEFAULT 3,
      semester     VARCHAR(20),
      schedule     VARCHAR(100),
      section      VARCHAR(20),
      room         VARCHAR(20)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS student_groups (
      id         VARCHAR(20)  PRIMARY KEY,
      group_name VARCHAR(50)  NOT NULL,
      year       INT,
      major      VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS study_plan (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      subject_id VARCHAR(20),
      group_id   VARCHAR(20),
      day_of_week VARCHAR(20),
      start_time VARCHAR(10),
      end_time   VARCHAR(10),
      room       VARCHAR(20)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS enrollments (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      student_id VARCHAR(20) NOT NULL,
      subject_id VARCHAR(20) NOT NULL,
      semester   VARCHAR(20),
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // ─── Tables created within the system ───────────────────────────────────
  await conn.query(`
    CREATE TABLE IF NOT EXISTS class_dates (
      id               VARCHAR(20) PRIMARY KEY,
      subject_id       VARCHAR(20) NOT NULL,
      date             DATE        NOT NULL,
      time             VARCHAR(20),
      room             VARCHAR(50),
      check_in_code    VARCHAR(10),
      is_active        BOOLEAN DEFAULT FALSE,
      gps_lat          DECIMAL(10,8),
      gps_lng          DECIMAL(11,8),
      duration_minutes INT DEFAULT 15,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS tb_attendance_record (
      id                  VARCHAR(30) PRIMARY KEY,
      student_id          VARCHAR(20) NOT NULL,
      student_code        VARCHAR(20),
      student_name        VARCHAR(255),
      class_date_id       VARCHAR(20) NOT NULL,
      status              ENUM('O','L','X','Y','Drop','W') DEFAULT 'X',
      check_in_time       VARCHAR(10),
      is_dropped          BOOLEAN DEFAULT FALSE,
      note                TEXT,
      check_in_method     ENUM('face','code','manual') DEFAULT 'manual',
      out_of_bounds       BOOLEAN DEFAULT FALSE,
      distance_from_class INT,
      updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS tb_face_embedding (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      student_id       VARCHAR(20) NOT NULL,
      embedding_vector TEXT        NOT NULL,
      sample_index     INT DEFAULT 0,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS tb_camera (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      camera_code VARCHAR(20) UNIQUE,
      location    VARCHAR(255),
      ip_address  VARCHAR(45),
      is_active   BOOLEAN DEFAULT TRUE,
      last_seen   TIMESTAMP NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS cancelled_classes (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      class_date_id VARCHAR(20) NOT NULL,
      subject_id    VARCHAR(20) NOT NULL,
      reason        TEXT,
      cancelled_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      cancelled_by  VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log("✅ Tables created");

  // ─── Check if already seeded ────────────────────────────────────────────
  const [userRows] = await conn.query("SELECT COUNT(*) AS cnt FROM users");
  if (userRows[0].cnt > 0) {
    console.log("ℹ️  Seed data already exists — skipping insert");
    await conn.end();
    console.log("\n🎉 Setup complete. Run: node server.js\n");
    return;
  }

  // ─── Seed: Users ────────────────────────────────────────────────────────
  await conn.query(`
    INSERT INTO users (username, password, role, name, ref_id) VALUES
    ('teacher001', 'password123', 'teacher', 'ດຣ. ປິຍະວັດ ເລີດສິດທິໄຊ',   '1'),
    ('225N067522', 'password123', 'student', 'ທ້າວ ສຸກພະໄຊ ສູນດາລາວົງ',    '1'),
    ('admin',      'admin123',    'admin',   'ຜູ້ດູແລລະບົບ',                NULL),
    ('hod',        'hod123',      'hod',     'ຮສ. ດຣ. ວາລາພອນ ນະຣົງລິດ',   '2');
  `);

  // ─── Seed: Teachers ─────────────────────────────────────────────────────
  await conn.query(`
    INSERT INTO teachers (id, teacher_code, name, email, department) VALUES
    ('1', 'T001', 'ດຣ. ປິຍະວັດ ເລີດສິດທິໄຊ',  'piyavath@nuol.edu.la',  'ວິທະຍາສາດຄອມພິວເຕີ'),
    ('2', 'T002', 'ຮສ. ວາລາພອນ ນະຣົງລິດ',      'valaphone@nuol.edu.la', 'ເຕັກໂນໂລຊີຂໍ້ມູນຂ່າວສານ'),
    ('3', 'T003', 'ດຣ. ໄຊວັດ ສຸດທິພົງ',         'xayavath@nuol.edu.la',  'ວິທະຍາສາດຄອມພິວເຕີ');
  `);

  // ─── Seed: Students (20 ຄົນ — ຂໍ້ມູນຕົວຈິງ) ────────────────────────────
  await conn.query(`
    INSERT INTO students (id, student_code, name, email, department, year) VALUES
    ('1',  '225N067522', 'ທ້າວ ສຸກພະໄຊ ສູນດາລາວົງ',     '225n067522@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('2',  '225N063822', 'ນາງ ເທບນາລີ ວົງປຣະເສີດ',      '225n063822@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('3',  '225N064922', 'ນາງ ພຸດທັນວາ ໜໍ່ກອງສີເຮືອງ', '225n064922@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('4',  '225N069622', 'ທ້າວ ພຸດທະສອນ ຈັນທະວົງສາ',    '225n069622@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('5',  '225N066822', 'ທ້າວ ກິດທິສັກ ກອງແພງຕາ',      '225n066822@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('6',  '225N066222', 'ນາງ ກະນົກພອນ ພິລາວົງ',        '225n066222@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('7',  '225N065622', 'ທ້າວ ແຈັກກີ້ຊານ ລາດສະອາດ',   '225n065622@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('8',  '225N064822', 'ທ້າວ ວິລະພົນ ຄໍາວົງທອງ',      '225n064822@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('9',  '225N064222', 'ນາງ ມຸກຕາວັນ ວົງລໍຄໍາ',       '225n064222@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('10', '225N125222', 'ທ້າວ ສຸກພະໄຊ ທ່ຽງທໍາ',        '225n125222@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('11', '225N125122', 'ທ້າວ ວິລະຍຸດ ແກ້ວມູນລາ',      '225n125122@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('12', '225N124922', 'ນາງ ມູນິກ ວັນນະສັກ',          '225n124922@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('13', '225N071322', 'ນາງ ພອນປະເສີດ ຈະເລີນສຸກ',     '225n071322@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('14', '225N070222', 'ທ້າວ ອານຸພັດ ຈິນດາຮັກ',       '225n070222@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('15', '225N069922', 'ນາງ ແອນນາ ວາດທະວີສັກ',        '225n069922@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('16', '225N126522', 'ນາງ ທິບພະຈັນ ທຳມະວົງ',        '225n126522@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('17', '225N071022', 'ທ້າວ ອານົນ ສີສົມບັດ',          '225n071022@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('18', '225N066422', 'ທ້າວ ສົມປະສົງ ໄຊຍະເດດ',       '225n066422@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4),
    ('19', '225N064722', 'ນາງ ຈິດລັດດາ ພາມີສິດ',        '225n064722@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 3),
    ('20', '225N063922', 'ນາງ ວົງມະນີ ລາບບັນດິດ',       '225n063922@nuol.edu.la', 'ວິສະວະກຳຄອມພິວເຕີ', 4);
  `);

  // ─── Seed: Student Groups ───────────────────────────────────────────────
  await conn.query(`
    INSERT INTO student_groups (id, group_name, year, major) VALUES
    ('G1', '4COM2', 4, 'ວິສະວະກຳຄອມພິວເຕີ'),
    ('G2', '4COM1', 4, 'ວິສະວະກຳຄອມພິວເຕີ'),
    ('G3', '4COM3', 4, 'ວິສະວະກຳຄອມພິວເຕີ'),
    ('G4', '3COM1', 3, 'ວິສະວະກຳຄອມພິວເຕີ');
  `);

  // ─── Seed: Subjects ─────────────────────────────────────────────────────
  await conn.query(`
    INSERT INTO subjects (id, subject_code, subject_name, teacher_id, teacher_name, credits, semester, schedule, section, room) VALUES
    ('1', 'CS401', 'ວິສະວະກຳຊອບແວ',              '1', 'ດຣ. ປິຍະວັດ ເລີດສິດທິໄຊ', 3, '2/2025', 'ຈັນ 09:00-12:00',    '4COM2', '301'),
    ('2', 'CS402', 'ການພັດທະນາລະບົບຊອບແວ',       '1', 'ດຣ. ປິຍະວັດ ເລີດສິດທິໄຊ', 3, '2/2025', 'ອັງຄານ 09:00-12:00', '4COM1', '302'),
    ('3', 'CS403', 'ການວິເຄາະ ແລະ ອອກແບບລະບົບ', '2', 'ຮສ. ວາລາພອນ ນະຣົງລິດ',   3, '2/2025', 'ພຸດ 13:00-16:00',    '4COM3', '303'),
    ('4', 'IT301', 'ການພັດທະນາ ແລະ ອອກແບບເວັບ',  '3', 'ດຣ. ໄຊວັດ ສຸດທິພົງ',      3, '2/2025', 'ພະຫັດ 09:00-12:00',  '3COM1', '305');
  `);

  // ─── Seed: Study Plan ───────────────────────────────────────────────────
  await conn.query(`
    INSERT INTO study_plan (subject_id, group_id, day_of_week, start_time, end_time, room) VALUES
    ('1', 'G1', 'ຈັນ',    '09:00', '12:00', '301'),
    ('2', 'G2', 'ອັງຄານ', '09:00', '12:00', '302'),
    ('3', 'G3', 'ພຸດ',    '13:00', '16:00', '303'),
    ('4', 'G4', 'ພະຫັດ',  '09:00', '12:00', '305');
  `);

  // ─── Seed: Enrollments ──────────────────────────────────────────────────
  // Students 1-15 (4COM2) → CS401
  // Students 17-18 (4COM1) → CS402
  // Students 16, 20 (4COM3) → CS403
  // Student 19 (3COM1) → IT301
  await conn.query(`
    INSERT INTO enrollments (student_id, subject_id, semester) VALUES
    ('1',  '1', '2/2025'), ('2',  '1', '2/2025'), ('3',  '1', '2/2025'),
    ('4',  '1', '2/2025'), ('5',  '1', '2/2025'), ('6',  '1', '2/2025'),
    ('7',  '1', '2/2025'), ('8',  '1', '2/2025'), ('9',  '1', '2/2025'),
    ('10', '1', '2/2025'), ('11', '1', '2/2025'), ('12', '1', '2/2025'),
    ('13', '1', '2/2025'), ('14', '1', '2/2025'), ('15', '1', '2/2025'),
    ('17', '2', '2/2025'), ('18', '2', '2/2025'),
    ('16', '3', '2/2025'), ('20', '3', '2/2025'),
    ('19', '4', '2/2025');
  `);

  // ─── Seed: Class Dates ──────────────────────────────────────────────────
  await conn.query(`
    INSERT INTO class_dates (id, subject_id, date, time, room, check_in_code, is_active) VALUES
    ('1', '1', '2025-12-01', '09:00-12:00', 'ຫ້ອງ 301', NULL,     FALSE),
    ('2', '1', '2025-12-08', '09:00-12:00', 'ຫ້ອງ 301', NULL,     FALSE),
    ('3', '1', '2025-12-15', '09:00-12:00', 'ຫ້ອງ 301', NULL,     FALSE),
    ('4', '1', '2025-12-22', '09:00-12:00', 'ຫ້ອງ 301', '472891', TRUE),
    ('5', '1', '2025-12-29', '09:00-12:00', 'ຫ້ອງ 301', NULL,     FALSE),
    ('6', '2', '2025-12-02', '09:00-12:00', 'ຫ້ອງ 302', NULL,     FALSE),
    ('7', '2', '2025-12-09', '09:00-12:00', 'ຫ້ອງ 302', NULL,     FALSE);
  `);

  // ─── Seed: Attendance Records (15 students × 3 sessions) ───────────────
  await conn.query(`
    INSERT INTO tb_attendance_record (id, student_id, student_code, student_name, class_date_id, status, check_in_time, is_dropped, note) VALUES
    ('1-1',  '1',  '225N067522', 'ທ້າວ ສຸກພະໄຊ ສູນດາລາວົງ',     '1', 'O', '09:02', FALSE, ''),
    ('1-2',  '2',  '225N063822', 'ນາງ ເທບນາລີ ວົງປຣະເສີດ',      '1', 'O', '08:58', FALSE, ''),
    ('1-3',  '3',  '225N064922', 'ນາງ ພຸດທັນວາ ໜໍ່ກອງສີເຮືອງ', '1', 'L', '09:18', FALSE, 'ລົດຕິດ'),
    ('1-4',  '4',  '225N069622', 'ທ້າວ ພຸດທະສອນ ຈັນທະວົງສາ',    '1', 'O', '09:05', FALSE, ''),
    ('1-5',  '5',  '225N066822', 'ທ້າວ ກິດທິສັກ ກອງແພງຕາ',      '1', 'O', '08:55', FALSE, ''),
    ('1-6',  '6',  '225N066222', 'ນາງ ກະນົກພອນ ພິລາວົງ',        '1', 'O', '09:01', FALSE, ''),
    ('1-7',  '7',  '225N065622', 'ທ້າວ ແຈັກກີ້ຊານ ລາດສະອາດ',   '1', 'X', NULL,    FALSE, ''),
    ('1-8',  '8',  '225N064822', 'ທ້າວ ວິລະພົນ ຄໍາວົງທອງ',      '1', 'O', '09:03', FALSE, ''),
    ('1-9',  '9',  '225N064222', 'ນາງ ມຸກຕາວັນ ວົງລໍຄໍາ',       '1', 'O', '09:00', FALSE, ''),
    ('1-10', '10', '225N125222', 'ທ້າວ ສຸກພະໄຊ ທ່ຽງທໍາ',        '1', 'L', '09:22', FALSE, ''),
    ('1-11', '11', '225N125122', 'ທ້າວ ວິລະຍຸດ ແກ້ວມູນລາ',      '1', 'O', '08:59', FALSE, ''),
    ('1-12', '12', '225N124922', 'ນາງ ມູນິກ ວັນນະສັກ',          '1', 'Y', NULL,    FALSE, 'ລາປ່ວຍ'),
    ('1-13', '13', '225N071322', 'ນາງ ພອນປະເສີດ ຈະເລີນສຸກ',     '1', 'O', '09:04', FALSE, ''),
    ('1-14', '14', '225N070222', 'ທ້າວ ອານຸພັດ ຈິນດາຮັກ',       '1', 'O', '09:01', FALSE, ''),
    ('1-15', '15', '225N069922', 'ນາງ ແອນນາ ວາດທະວີສັກ',        '1', 'X', NULL,    FALSE, ''),
    ('2-1',  '1',  '225N067522', 'ທ້າວ ສຸກພະໄຊ ສູນດາລາວົງ',     '2', 'O', '09:00', FALSE, ''),
    ('2-2',  '2',  '225N063822', 'ນາງ ເທບນາລີ ວົງປຣະເສີດ',      '2', 'O', '08:57', FALSE, ''),
    ('2-3',  '3',  '225N064922', 'ນາງ ພຸດທັນວາ ໜໍ່ກອງສີເຮືອງ', '2', 'O', '09:02', FALSE, ''),
    ('2-4',  '4',  '225N069622', 'ທ້າວ ພຸດທະສອນ ຈັນທະວົງສາ',    '2', 'L', '09:25', FALSE, ''),
    ('2-5',  '5',  '225N066822', 'ທ້າວ ກິດທິສັກ ກອງແພງຕາ',      '2', 'O', '08:58', FALSE, ''),
    ('2-6',  '6',  '225N066222', 'ນາງ ກະນົກພອນ ພິລາວົງ',        '2', 'X', NULL,    FALSE, ''),
    ('2-7',  '7',  '225N065622', 'ທ້າວ ແຈັກກີ້ຊານ ລາດສະອາດ',   '2', 'O', '09:01', FALSE, ''),
    ('2-8',  '8',  '225N064822', 'ທ້າວ ວິລະພົນ ຄໍາວົງທອງ',      '2', 'O', '09:03', FALSE, ''),
    ('2-9',  '9',  '225N064222', 'ນາງ ມຸກຕາວັນ ວົງລໍຄໍາ',       '2', 'L', '09:15', FALSE, ''),
    ('2-10', '10', '225N125222', 'ທ້າວ ສຸກພະໄຊ ທ່ຽງທໍາ',        '2', 'O', '08:56', FALSE, ''),
    ('2-11', '11', '225N125122', 'ທ້າວ ວິລະຍຸດ ແກ້ວມູນລາ',      '2', 'O', '09:00', FALSE, ''),
    ('2-12', '12', '225N124922', 'ນາງ ມູນິກ ວັນນະສັກ',          '2', 'O', '09:02', FALSE, ''),
    ('2-13', '13', '225N071322', 'ນາງ ພອນປະເສີດ ຈະເລີນສຸກ',     '2', 'X', NULL,    FALSE, ''),
    ('2-14', '14', '225N070222', 'ທ້າວ ອານຸພັດ ຈິນດາຮັກ',       '2', 'O', '09:04', FALSE, ''),
    ('2-15', '15', '225N069922', 'ນາງ ແອນນາ ວາດທະວີສັກ',        '2', 'O', '09:01', FALSE, ''),
    ('3-1',  '1',  '225N067522', 'ທ້າວ ສຸກພະໄຊ ສູນດາລາວົງ',     '3', 'O', '09:03', FALSE, ''),
    ('3-2',  '2',  '225N063822', 'ນາງ ເທບນາລີ ວົງປຣະເສີດ',      '3', 'L', '09:20', FALSE, ''),
    ('3-3',  '3',  '225N064922', 'ນາງ ພຸດທັນວາ ໜໍ່ກອງສີເຮືອງ', '3', 'O', '09:00', FALSE, ''),
    ('3-4',  '4',  '225N069622', 'ທ້າວ ພຸດທະສອນ ຈັນທະວົງສາ',    '3', 'O', '09:02', FALSE, ''),
    ('3-5',  '5',  '225N066822', 'ທ້າວ ກິດທິສັກ ກອງແພງຕາ',      '3', 'O', '08:58', FALSE, ''),
    ('3-6',  '6',  '225N066222', 'ນາງ ກະນົກພອນ ພິລາວົງ',        '3', 'O', '09:01', FALSE, ''),
    ('3-7',  '7',  '225N065622', 'ທ້າວ ແຈັກກີ້ຊານ ລາດສະອາດ',   '3', 'O', '09:00', FALSE, ''),
    ('3-8',  '8',  '225N064822', 'ທ້າວ ວິລະພົນ ຄໍາວົງທອງ',      '3', 'X', NULL,    FALSE, ''),
    ('3-9',  '9',  '225N064222', 'ນາງ ມຸກຕາວັນ ວົງລໍຄໍາ',       '3', 'O', '09:04', FALSE, ''),
    ('3-10', '10', '225N125222', 'ທ້າວ ສຸກພະໄຊ ທ່ຽງທໍາ',        '3', 'O', '09:01', FALSE, ''),
    ('3-11', '11', '225N125122', 'ທ້າວ ວິລະຍຸດ ແກ້ວມູນລາ',      '3', 'Y', NULL,    FALSE, 'ໄປທຳທຸລະ'),
    ('3-12', '12', '225N124922', 'ນາງ ມູນິກ ວັນນະສັກ',          '3', 'O', '09:00', FALSE, ''),
    ('3-13', '13', '225N071322', 'ນາງ ພອນປະເສີດ ຈະເລີນສຸກ',     '3', 'O', '09:02', FALSE, ''),
    ('3-14', '14', '225N070222', 'ທ້າວ ອານຸພັດ ຈິນດາຮັກ',       '3', 'L', '09:18', FALSE, ''),
    ('3-15', '15', '225N069922', 'ນາງ ແອນນາ ວາດທະວີສັກ',        '3', 'O', '08:57', FALSE, '');
  `);

  // ─── Seed: Camera ───────────────────────────────────────────────────────
  await conn.query(`
    INSERT INTO tb_camera (camera_code, location, ip_address, is_active) VALUES
    ('CAM-001', 'ຫ້ອງ 301 - ຊັ້ນ 1', '192.168.1.100', TRUE);
  `);

  console.log("✅ Mock data seeded");
  await conn.end();
  console.log("\n🎉 Setup complete! Run:  node server.js\n");
}

setup().catch((err) => {
  console.error("❌ Setup failed:", err.message);
  process.exit(1);
});
