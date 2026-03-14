# 🌍 TravelAccess: Precision GPS Tracking & Expense Management

TravelAccess is a professional, full-stack platform designed for gig economy workers, fleet managers, and individual drivers who need total control over their travel data. Built with **Next.js 15+** and **Oracle Database**, it automates mileage logging, expense tracking, and provides deep analytical insights into your driving habits.

---

## ✨ Key Features

### 🚀 Core Tracking & Mapping
- 🗺️ **Interactive Mapping**: Real-time GPS point visualization using Leaflet with smooth transitions and heat-map alternatives.
- 🕒 **Session Management**: Automatically or manually track discrete movement sessions with timing, distance, and duration analytics.
- 📊 **Dynamic Analytics**: 
  - **Speed Analysis**: Interactive SVG charts showing speed fluctuations across journeys.
  - **Altitude Profiling**: Track elevation changes and terrain analysis.
- 📍 **Automated Geocoding**: Background jobs automatically resolve GPS coordinates into human-readable addresses.

### 💰 Vehicle & Expense Management
- 🚗 **Fleet Control**: Manage multiple vehicles with detailed descriptions and license plate tracking.
- ⛽ **Fuel Intelligence**: Log refueling entries with automatic **KM/L (L/100km)** consumption and **Cost per Kilometer** calculations.
- 🔧 **Maintenance Logs**: Track services, repairs, and part replacements. Supports **Image and PDF** receipt attachments.
- 🛡️ **Insurance Tracking**: Manage policy payments and historical coverage periods.

### 🔐 Security & Access
- 🔓 **Google OAuth 2.0**: Fast, secure sign-in via Google accounts alongside traditional email/password auth.
- 🔐 **JWT Session Management**: Secure, encrypted session handling with HttpOnly cookies.
- 🔑 **API Key Management**: Generate secure keys for external OBD-II trackers or mobile app integration.
- 🕵️ **Privacy Isolation**: Multi-tenant architecture ensures data is strictly isolated by user and device ownership.

### 🧪 Trial & Admin Tools
- 🎪 **Demo Mode**: Instant access with credentials (`demo` / `demo123`).
- 🧹 **Automated Reset**: The demo environment is automatically cleaned and regenerated every day at **8:00 AM UTC**.
- 🛠️ **Admin Control Panel**: Integrated tools to force-reset demo data or clean environments with one click.
- 📋 **Access Monitoring**: Real-time logging of demo account connections (IP, User Agent, Referer) for administrator review.

---

## 🚀 Tech Stack

- **Frontend**: [Next.js 15+](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/)
- **ORM / Database**: [Sequelize 6](https://sequelize.org/) & [Oracle Database](https://www.oracle.com/database/) (via `oracledb`)
- **Mapping**: [Leaflet](https://leafletjs.com/), [React Leaflet](https://react-leaflet.js.org/), [Leaflet Heat](https://github.com/Leaflet/Leaflet.heat)
- **Reporting**: [jspdf](https://github.com/parallax/jsPDF), [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable)
- **Infrastructure**: [Docker](https://www.docker.com/), [Docker Compose](https://docs.docker.com/compose/)

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- Oracle Database (local or cloud instance)
- Oracle Client / Wallet (for cloud connections)

### Local Development
1. **Clone & Install**:
   ```bash
   git clone <repository-url>
   cd TravelAccess
   npm install
   ```

2. **Configure Environment**:
   Create a `.env.local` file. Required variables:
   - `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECTION_STRING`
   - `JWT_SECRET`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (for OAuth)

3. **Initialize Database**:
   The app uses Sequelize for schema management. You can trigger the initial demo setup (which creates core tables) via:
   ```bash
   # Requires Admin Login -> use the UI button or call:
   GET /api/setup-demo?force=true
   ```

4. **Run Server**:
   ```bash
   npm run dev
   ```
   Access at `http://localhost:3000`.

---

## 📡 Core API Categories

- **Auth**: `/api/auth/[login, register, google, logout, me]`
- **Devices**: `/api/user/devices`
- **Vehicles**: `/api/user/cars`
- **Expenses**: `/api/user/fuel`, `/api/user/maintenance`, `/api/user/insurance`
- **Tracking**: `/api/LocationData`, `/api/Session/[start, end]`
- **Admin**: `/api/admin/demo-logs`, `/api/setup-demo`
- **Jobs**: `/api/jobs/[geocode-locations, merge-location-geocodes]`

---

## 🏗️ Architecture

```text
TravelAccess/
├── app/                # UI Pages & API Routes
├── components/         # Premium UI Components (Maps, Charts, Nav)
├── lib/
│   ├── models/         # Sequelize Data Models
│   ├── jobs/           # Background Task Logic (Geocoding, daily resets)
│   ├── auth.js         # JWT & Permission Utilities
│   └── sequelize.js    # Database Connection Pool
├── scripts/            # Database migration and utility scripts
├── public/             # Static Assets
└── deploy.ps1          # Automated CI/CD Docker Deployment Script
```

---

## 📝 License
This project is licensed under the MIT License.

---
<p align="center">Built with ❤️ for gig economy professionals and travelers everywhere.</p>
