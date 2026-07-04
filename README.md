# 🌍 TravelAccess

TravelAccess is a full-stack web platform for drivers, gig economy workers, and fleet managers who need complete control over travel sessions, vehicle expenses, and GPS data. Built with **Next.js**, **MySQL**, and a companion Android app.

---

## ✨ Features

### 🛣️ Session Tracking
- **Bluetooth-triggered sessions** — Android app detects car Bluetooth connection/disconnection and automatically starts/ends sessions via API
- **Manual session creation** — Add sessions directly from the dashboard with custom start/end times
- **Soft-delete & editing** — Close any open session at a specific time, or remove sessions without data loss
- **Geocoding** — Background jobs resolve GPS coordinates into human-readable addresses for session start/end points

### 🗺️ GPS & Mapping
- **GPS data ingestion** — Mobile devices submit batched location points via API
- **Interactive maps** — Leaflet-based map viewer with GPS track visualization and heat maps
- **Route filtering** — Filter location data by device and time range

### 🚗 Vehicle & Expense Management
- **Multiple cars** — Manage a fleet with descriptions and license plates
- **Fuel log** — Record fill-ups with automatic **KM/L**, **L/100km**, and **cost per km** calculation
- **Maintenance log** — Track services and repairs with optional **receipt image** attachments (PDF/image)
- **Insurance tracking** — Log policy payments and coverage periods
- **Other expenses** — Categorized expense tracking with custom expense types and receipt attachments

### 📱 Bluetooth Device Management
- Register Bluetooth MAC addresses and associate them with specific cars
- Triggers automatic session start/end when the Android app connects/disconnects

### 🔐 Authentication & Security
- Email/password login with **bcrypt** password hashing
- **Google OAuth 2.0** single sign-in
- **JWT** sessions via HttpOnly cookies
- **API Key** management for external device integrations (Android app, OBD trackers)
- Multi-tenant — all data is strictly isolated per user

### 🧪 Admin & Monitoring
- **API usage tracking** — middleware logs every request path

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js](https://nextjs.org/) (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Database | MySQL 8 |
| ORM | [Sequelize 6](https://sequelize.org/) + `mysql2` |
| Mapping | [Leaflet](https://leafletjs.com/), React Leaflet, Leaflet Heat |
| PDF Reports | jsPDF, jsPDF-AutoTable |
| Auth | JWT, bcryptjs, Google OAuth 2.0 |
| Geocoding | [Geoapify](https://www.geoapify.com/) Reverse Geocode API |
| Email | Nodemailer |
| Infrastructure | Docker, Docker Compose, Nginx (reverse proxy) |
| Testing | Jest |

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v20+
- MySQL 8 instance (local or Docker)

### 1. Clone & Install
```bash
git clone <repository-url>
cd TravelAccess
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local` and fill in the values:

```env
# MySQL Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database

# Auth
JWT_SECRET=your_long_random_secret

# Google OAuth 2.0
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://yourdomain/api/auth/google/callback

# App URL (no trailing slash)
NEXT_PUBLIC_BASE_URL=https://yourdomain

# Geocoding (https://www.geoapify.com/)
GEOAPIFY_API_KEY=...

# Background job API keys
GEOCODE_JOB_API_KEY=...
MERGE_JOB_API_KEY=...

# Internal middleware tracking
INTERNAL_TRACK_SECRET=long-random-string
INTERNAL_TRACK_URL=http://127.0.0.1:3000
```

### 3. Run Locally
```bash
npm run dev
```
App available at `http://localhost:3000`.

### 4. Docker Deployment
```bash
docker compose up -d
```
The `docker-compose.yml` includes the Next.js app and a MySQL service.

---

## 📡 API Reference

All endpoints require authentication via **API Key** (`x-api-key` header) or **session cookie**.

| Category | Endpoints |
|---|---|
| **Auth** | `POST /api/auth/login` · `register` · `logout` · `forgot-password` · `reset-password` · `change-password` · `verify-email` · `delete-account/*` |
| **Google OAuth** | `GET /api/auth/google` · `/callback` |
| **API Keys** | `GET/POST/DELETE /api/auth/api-keys` |
| **Me** | `GET /api/auth/me` |
| **Sessions** | `GET/POST/PATCH/DELETE /api/sessions` |
| **Session Latest** | `GET /api/sessions/latest` |
| **Start Session** | `POST /api/Session/start-session` — Body: `{ bluetooth_address, device_id, timestamp_utc }` |
| **End Session** | `POST /api/Session/end-session` — Body: `{ bluetooth_address, device_id, timestamp_utc }` |
| **GPS Data** | `POST /api/LocationData` — Body: `{ device_id, locations[] }` |
| **GPS Query** | `GET /api/gps-data?deviceId=&startDate=&endDate=` |
| **Devices** | `GET /api/devices` · `GET/POST/PATCH/DELETE /api/user/devices` |
| **Cars** | `GET/POST/PATCH/DELETE /api/user/cars` |
| **Distance** | `GET /api/user/cars/distance-since-fuel?carId=` |
| **Bluetooth** | `GET/POST/PATCH/DELETE /api/user/bluetooth` |
| **Fuel** | `GET/POST/DELETE /api/user/fuel` |
| **Maintenance** | `GET/POST/DELETE /api/user/maintenance` |
| **Insurance** | `GET/POST/DELETE /api/user/insurance` |
| **Other Expenses** | `GET/POST/DELETE /api/user/other-expenses` |
| **Expense Types** | `GET/POST/DELETE /api/user/expense-types` |
| **Jobs** | `POST /api/jobs/geocode-locations` · `POST /api/jobs/merge-location-geocodes` |


---

## 🏗️ Project Structure

```
TravelAccess/
├── app/
│   ├── api/                  # All API route handlers
│   │   ├── Session/          # start-session, end-session (Bluetooth)
│   │   ├── sessions/         # CRUD session management
│   │   ├── LocationData/     # GPS data ingestion
│   │   ├── gps-data/         # GPS data query
│   │   ├── user/             # Cars, fuel, maintenance, insurance, bluetooth, devices, expenses
│   │   ├── auth/             # Login, register, OAuth, API keys
│   │   ├── jobs/             # Geocoding background jobs
│   └── dashboard/            # UI pages
│       ├── cars/
│       ├── fuel/
│       ├── maintenance/
│       ├── insurance/
│       ├── bluetooth/
│       ├── devices/
│       ├── expense-types/
│       ├── other-expenses/
├── components/               # Shared UI components (Navbar, Maps, Charts)
├── lib/
│   ├── models/               # Sequelize models (MySQL)
│   ├── jobs/                 # Background job logic (geocoding)
│   ├── db.js                 # mysql2 connection pool
│   ├── sequelize.js          # Sequelize instance
│   └── auth.js               # JWT, bcrypt, API key utilities
├── __tests__/                # Jest unit tests
├── database/                 # SQL migration scripts
├── scripts/                  # Utility scripts
├── server.js                 # Custom HTTPS server
├── proxy.js                  # Next.js middleware (auth + usage tracking)
├── Dockerfile
├── docker-compose.yml
└── deploy.ps1                # CI/CD deployment script
```

---

## 🗄️ Key Database Tables

| Table | Description |
|---|---|
| `USERS` | User accounts |
| `DEVICES` | Registered GPS devices |
| `USER_DEVICES` | User ↔ device mapping |
| `CARS` | Vehicles per user |
| `BLUETOOTH` | Bluetooth MAC addresses linked to cars |
| `SESSION_DATA` | Travel sessions (start/end UTC, car, device) |
| `LOCATION_DATA` | Raw GPS points (PK: device + timestamp) |
| `LOCATION_GEOCODE` | Resolved address cache |
| `FUEL_DATA` | Fuel fill-up records |
| `MAINTENANCE_DATA` | Vehicle maintenance records |
| `INSURANCE_DATA` | Insurance payment records |
| `OTHER_EXPENSES` | Categorized other expenses |
| `EXPENSE_TYPES` | User-defined expense categories |

---

## 📝 License
MIT License

---

<p align="center">Built with ❤️ for drivers and travelers everywhere.</p>
