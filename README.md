# Senior Chatbot

The Senior Chatbot project provides a React-based user interface and a Node.js/Express backend for registering, searching, and reviewing civil complaints. The backend persists data in PostgreSQL and exposes a simple REST API that the frontend consumes.

## Prerequisites
Before you begin, make sure the following tools are installed locally:

- **Node.js** 18 or later (includes npm)
- **PostgreSQL** 13 or later
- **Git**

## Repository Structure

```
.
├── backend          # Express server and database scripts
├── frontend         # React application created with Create React App
└── README.md        # Project documentation (this file)
```

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/<your-org>/senior-chatbot.git
cd senior-chatbot
```

### 2. Set up the database
1. Create a PostgreSQL database (default name: `senior_chatbot`).
2. Run the schema script provided in `backend/database.sql`:
   ```bash
   psql -U <your-db-user> -d senior_chatbot -f backend/database.sql
   ```

### 3. Configure backend environment variables
Create a `.env` file inside the `backend/` folder. Use `backend/.env.example` as a template:
```bash
cd backend
cp .env.example .env
```
Update the values in `.env` to match your local PostgreSQL configuration. The backend expects the following variables:

- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `PORT` (optional, defaults to `5000`)

### 4. Install dependencies
Run the installation commands for both backend and frontend:
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 5. Run the applications
Open two terminal sessions:

**Backend (Express server):**
```bash
cd backend
npm run dev   # Uses nodemon for hot reloading
# or npm start to run without nodemon
```

**Frontend (React app):**
```bash
cd frontend
npm start
```
The frontend development server runs on [http://localhost:3000](http://localhost:3000) and proxies API requests to the backend running on port `5000`.

## Testing

- **Frontend tests:** Run `npm test` inside the `frontend/` directory to execute the Create React App test suite.
- **Backend:** There are currently no automated backend tests. You can verify endpoints manually using tools such as curl or Postman.

## Useful Commands

| Location   | Command           | Description                       |
|------------|------------------|-----------------------------------|
| `backend/` | `npm run dev`     | Start the backend with nodemon    |
| `backend/` | `npm start`       | Start the backend without nodemon |
| `frontend/`| `npm start`       | Start the React development server|
| `frontend/`| `npm test`        | Run the frontend test suite       |
| `frontend/`| `npm run build`   | Create an optimized production build |

## Troubleshooting

- **Database connection errors:** Double-check the credentials in `backend/.env` and confirm the database is running and accessible.
- **Port conflicts:** Change the `PORT` variable in `backend/.env` or use environment variables supported by Create React App (e.g., `PORT=3001 npm start`) to avoid collisions.
- **Dependency issues:** Delete the `node_modules` directory in the affected package and reinstall with `npm install`.

## Contributing

1. Create a new branch off of `main`.
2. Make and test your changes.
3. Submit a pull request with a clear summary of your updates.

