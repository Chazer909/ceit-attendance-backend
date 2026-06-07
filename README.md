# Smart Track — CEIT Attendance System (Backend)

This is the backend API for **Smart Track**, an AI-powered attendance tracking system for the
Department of Computer Engineering and Information Technology (CEIT). It's a Node.js/Express REST
API backed by MySQL that handles authentication, class sessions, attendance records, and acts as
the bridge between the ESP32-CAM hardware, a Python face-recognition AI service, and the frontend.

> **Note for reviewers:** the frontend (https://github.com/Chazer909/ceit-attendance-backend)
> currently runs on mock data and is not yet calling these endpoints — see that repo's README for
> the integration plan.

## Tech stack

- Node.js + Express
- MySQL (`mysql2`)
- Multer (image upload) + Axios (forwarding frames to the Python AI service)

## Prerequisites

- Node.js (v18+)
- MySQL Server running locally (or reachable)
- The Python AI recognition service (see `ESP32-Cam/` in the thesis project) for the camera
  endpoints to fully work — the API still runs without it, it just can't forward frames for
  recognition

## Setup

```sh
# 1. Clone the repository
git clone https://github.com/Chazer909/ceit-attendance-backend.git
cd ceit-attendance-backend

# 2. Install dependencies
npm install

# 3. Create your local .env file from the example
cp .env.example .env
```

Then edit `.env` with your local MySQL credentials:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=smart_track

PORT=5000
AI_SERVICE_URL=http://localhost:5001
```

```sh
# 4. Create the database schema and seed data
npm run setup

# 5. Start the server
npm run dev      # with auto-reload (nodemon)
# or
npm start
```

The API runs at **http://localhost:5000**. Check it's up via:

```
GET http://localhost:5000/api/health
```

## API overview

| Route                              | Purpose                                                |
|------------------------------------|--------------------------------------------------------|
| `POST /api/auth/login`              | User login (teacher/student/admin/hod)                 |
| `GET  /api/teachers` `/students` `/subjects` | Lookup data (`routes/data.js`)                |
| `GET  /api/enrollments/:subjectId`  | Students enrolled in a subject                         |
| `POST /api/sessions/start`          | Start a check-in session, generates a 6-digit code     |
| `PUT  /api/sessions/:id/end`        | End a check-in session                                 |
| `POST /api/sessions/:id/cancel`     | Cancel a class session                                 |
| `GET  /api/attendance/:classDateId` | Full attendance list for a session                     |
| `PUT  /api/attendance/:id/status`   | Teacher manually updates a student's status            |
| `POST /api/attendance/checkin/code` | Student check-in via 6-digit code (+ GPS distance check) |
| `POST /api/attendance/checkin/face` | Attendance write from AI face recognition              |
| `POST /api/camera/capture`          | ESP32-CAM uploads a frame; forwarded to the Python AI service for recognition |
| `GET  /api/camera/active-session`   | ESP32-CAM polls this to find the active session        |

## Connecting frontend ↔ backend ↔ hardware

For a full end-to-end review/demo, you'd run all three pieces side by side:

1. **This backend** on `http://localhost:5000` (needs MySQL running and seeded via `npm run setup`)
2. **The Python AI recognition service** (in the `ESP32-Cam/` folder of the thesis project) on
   `http://localhost:5001`, matching `AI_SERVICE_URL` in `.env`
3. **The frontend** (https://github.com/Chazer909/ceit-attendance-frontend) on `http://localhost:8080`

The frontend doesn't call this API yet (it uses mock data for the demo), so right now this backend
is best reviewed on its own — e.g. with a REST client (Postman/Insomnia/curl) hitting the routes
above directly against your local MySQL instance.

## Project structure

```
config/      # MySQL connection pool (config/db.js)
middleware/  # (currently empty — no auth/session middleware yet)
routes/      # Express route handlers: auth, data, sessions, attendance, camera
setup/       # Database schema + seed script (db_setup.js)
uploads/     # Temporary storage for incoming camera frames
server.js    # App entry point
```
