# 🌍 TravelAccess: GPS Tracking & Analytics Platform

TravelAccess is a robust, full-stack GPS tracking system designed for real-time visualization and deep analysis of movement data. Built with Next.js and powered by Oracle Database, it provides a seamless interface for monitoring devices, analyzing speed patterns, and visualizing altitude changes across the globe.

---

## ✨ Key Features

- 📍 **Interactive Mapping**: Real-time GPS point visualization using Leaflet with smooth transitions and custom markers.
- 📊 **Dynamic Analytics**:
  - **Speed Analysis**: Automatic speed calculation between GPS points with interactive SVG charts.
  - **Altitude Profiling**: Track elevation changes over time with detailed altitude charts.
  - **Distance Tracking**: Accurate distance calculation using the Haversine formula.
- 🔍 **Advanced Filtering**: Filter data by specific devices and precise date/time ranges.
- 🛠️ **Data Optimization**: Intelligent filtering to remove redundant GPS points (spatial denoising).
- 📱 **Responsive Design**: Fully responsive dashboard built with Tailwind CSS.
- 🐳 **Docker Ready**: Production-grade Docker and Docker Compose configuration for instant deployment.

---

## 🚀 Tech Stack

- **Frontend**: [Next.js 15+](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Mapping**: [Leaflet](https://leafletjs.com/), [React Leaflet](https://react-leaflet.js.org/)
- **Backend**: Next.js API Routes
- **Database**: [Oracle Database](https://www.oracle.com/database/) (via `oracledb`)
- **Infrastructure**: [Docker](https://www.docker.com/), [Docker Compose](https://docs.docker.com/compose/)

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/get-started) (optional, for containerized setup)
- Oracle Database (local or cloud instance)

### Local Development

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd TravelAccess
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` and fill in your Oracle DB credentials:
   ```bash
   cp .env.example .env.local
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```
   Access the application at `http://localhost:3000`.

### Docker Setup (Recommended)

To run the entire stack using Docker:

```bash
docker-compose up --build -d
```

---

## ⚙️ Configuration

The application requires the following environment variables:

| Variable | Description |
| :--- | :--- |
| `ORACLE_USER` | Your Oracle Database username |
| `ORACLE_PASSWORD` | Your Oracle Database password |
| `ORACLE_CONNECTION_STRING` | Database connection string (e.g., `localhost:1521/XEPDB1`) |
| `NODE_ENV` | `development` or `production` |

---

## 📡 API Endpoints

- `GET /api/devices`: Retrieve a list of all registered tracking devices.
- `GET /api/gps-data`: Retrieve GPS coordinates.
  - **Query Params**: `startDate`, `endDate`, `deviceId`.

---

## 🏗️ Architecture

```text
TravelAccess/
├── app/                # Next.js App Router (Pages & APIs)
│   ├── api/            # Backend API routes
│   └── globals.css     # Global styles
├── components/         # Reusable React components
│   ├── MapContainer.js # Main tracking dashboard & logic
│   └── MapComponent.js # Leaflet map wrapper
├── public/             # Static assets
├── Dockerfile          # Production build configuration
└── docker-compose.yml  # Multi-container orchestration
```

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<p align="center">
  Built with ❤️ for global explorers.
</p>
