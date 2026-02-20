# Database Schema & Initialization

This directory contains the SQL scripts required to initialize the Oracle Database schema for TravelAccess.

## 📂 Structure

The scripts are numbered to ensure correct execution order:

1.  **`01_tables.sql`**: Creates all necessary tables (`USERS`, `DEVICES`, `LOCATION`, `SESSION_DATA`, etc.) and primary/foreign key constraints.
2.  **`02_functions_procedures.sql`**: Defines stored procedures and functions for data processing, such as:
    *   `CALCULATE_DISTANCE_TRAVELED`: Computes distance between points.
    *   `EXTRACT_POINTS`: Processes raw GPS data into session segments.
    *   `GEOCODE_...`: Procedures for reverse geocoding coordinates.
    *   `FIX_MOJIBAKE`: Utility to fix character encoding issues.
3.  **`03_views.sql`**: Creates analytical views:
    *   `V_LOCATION_ENRICHED`: Joins location data with geocoded addresses and timezone info.
    *   `V_SESSIONS`: Summarizes session start/end points.
    *   `V_SESSION_CALC`: Complex logic for session start/end location determination.
4.  **`04_jobs.sql`**: Sets up DBMS_SCHEDULER jobs to run background tasks:
    *   `JOB_EXTRACT_POINTS`: Runs every 5 minutes to process new GPS data.
    *   `JOB_GEOCODE_PENDING_LOCATIONS`: Runs every 6 minutes to reverse geocode new locations.
5.  **`05_indexes.sql`**: Essential performance indexes for high-volume tables (`LOCATION_DATA`, `SESSION_DATA`) and foreign keys.

## 🚀 Initialization

To set up the database from scratch:

1.  **Connect to your Oracle Database** as the target user (e.g., `C##LOCATION`).
2.  **Execute the scripts in order**:

    ```sql
    @01_tables.sql
    @02_functions_procedures.sql
    @03_views.sql
    @04_jobs.sql
    @05_indexes.sql
    ```

    *Using SQL*Plus or SQL Developer.*

## 🔑 Key Tables

*   **`USERS`**: User accounts and authentication.
*   **`DEVICES`**: Master list of known devices.
*   **`USER_DEVICES`**: Mapping of users to the devices they own.
*   **`LOCATION_DATA`**: Raw high-frequency GPS telemetry.
*   **`SESSION_DATA`**: Aggregated travel sessions (trips).

## ⚙️ Configuration

The `PARAMETER` table stores system-wide configuration:

```sql
INSERT INTO PARAMETER (KEY, VALUE) VALUES ('API_KEY', 'your-geoapify-key');
```
