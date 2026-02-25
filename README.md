# 🌍 TravelAccess: GPS Tracking & Analytics Platform

TravelAccess is a robust, full-stack GPS tracking system designed for real-time visualization and deep analysis of movement data. Built with Next.js and powered by Oracle Database, it provides a seamless interface for monitoring devices, analyzing speed patterns, and visualizing altitude changes across the globe.

---

## ✨ Key Features

- 🗺️ **Interactive Mapping**: Real-time GPS point visualization using Leaflet with smooth transitions and custom markers.
- 🔐 **Secure Authentication**: Complete user system with JWT session management, glassmorphism UI, and protected routes.
- 🔑 **API Key Management**: Generate and revoke secure access keys (with `x-api-key` header support) for external device integration.
- 📱 **Device Ownership**: Secure mapping where users only see their own devices. One device, one owner enforcement.
- ⚙️ **Settings Dashboard**: Dedicated space to manage API keys and customize device descriptions/names.
- 🕒 **Session Management**: Track discrete movement sessions with start/end timing and duration analytics.
- 📉 **Advanced Reporting**: Generate comprehensive summaries for distance, speed, and altitude trends.
- 📊 **Dynamic Analytics**:
  - **Speed Analysis**: Automatic speed calculation between GPS points with interactive SVG charts.
  - **Altitude Profiling**: Track elevation changes over time with detailed altitude charts.
- 🔍 **Privacy First**: Multi-tenant data isolation ensures users never see data from devices they don't own.
- 🐳 **Docker Ready**: Production-grade Docker and Docker Compose configuration for instant deployment.

---

## 🚀 Tech Stack

- **Frontend**: [Next.js 15+](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Security**: [Bcrypt.js](https://github.com/dcodeIO/bcrypt.js) (Hashing), [JSON Web Tokens](https://jwt.io/) (Auth)
- **Mapping**: [Leaflet](https://leafletjs.com/), [React Leaflet](https://react-leaflet.js.org/)
- **Backend**: Next.js API Routes (Serverless)
- **Database**: [Oracle Database](https://www.oracle.com/database/) (via `oracledb`)
- **Infrastructure**: [Docker](https://www.docker.com/), [Docker Compose](https://docs.docker.com/compose/)

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/get-started) (optional)
- Oracle Database (local or cloud instance)

### Local Development

1. **Clone & Install**:
   ```bash
   git clone <repository-url>
   cd TravelAccess
   npm install
   ```

2. **Configure Environment**:
   Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Required variables: `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_CONNECTION_STRING`, and `JWT_SECRET`.

3. **Initialize Database**:
   Run the setup script to create the necessary tables (`USERS`, `API_KEYS`, `USER_DEVICES`):
   ```bash
   node scripts/init-db.js
   ```

4. **Run Server**:
   ```bash
   npm run dev
   ```
   Access at `http://localhost:3000`.

---

## 💾 Database Schema

The complete database schema, including all **Tables**, **Views**, **Functions**, and **Scheduler Jobs**, is documented in the `database/` directory.

👉 **[View Database Documentation](database/README.md)**

To initialize the database manually:
1. Connect to your Oracle instance.
2. Run the SQL scripts in order: `01_tables.sql` → `02_functions_procedures.sql` → `03_views.sql` → `04_jobs.sql`.

---

## 📡 API Security

All API endpoints are protected. Authenticate using either:
1.  **Session Cookie**: Automatically handled for browser users after login.
2.  **API Key**: For external clients/trackers, include the `x-api-key` header:
    ```bash
    curl -H "x-api-key: your_key_here" https://your-domain/api/gps-data
    ```

---

## 📡 Core API Endpoints

- `GET /api/devices`: List authorized devices for the current user.
- `GET /api/gps-data`: Search GPS points (filtered by user ownership).
- `POST /api/LocationData`: Insert bulk GPS points (requires API key/session & device ownership validation).
- `POST /api/Session/start-session`: Start a new tracking session (requires API key/session & device ownership validation).
- `POST /api/Session/end-session`: End an active tracking session.
- `GET`, `POST`, `PATCH`, `DELETE /api/user/cars`: Manage user cars.
- `GET`, `POST`, `DELETE /api/user/fuel`: Manage fuel logs.
- `GET /api/user/fuel/[id]/receipt`: Retrieve the receipt image.
- `POST /api/auth/login`: Authenticate and start session.
- `POST /api/auth/api-keys`: Create new access keys.
- `DELETE /api/auth/api-keys?id=...`: Revoke an API key.

---

## 🏗️ Architecture

```text
TravelAccess/
├── app/                # Next.js App Router
│   ├── api/            # Secured API Routes (Auth, Devices, GPS)
│   ├── dashboard/      # User management (Keys, Device Settings)
│   ├── sessions/       # Session tracking analytics
│   └── (auth)/         # Login & Register pages
├── lib/                # Core logic (DB utility, Auth middleware)
├── scripts/            # Database migration & init scripts
├── components/         # Reusable UI & Map components
├── public/             # Static assets
└── Dockerfile          # Container configuration
```

---

## 📝 License

This project is licensed under the MIT License.

---

<p align="center">
  Built with ❤️ for global explorers.
</p>
