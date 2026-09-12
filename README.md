## 👤 Author

**Md. Ratul**
- GitHub: [@ratuldev47782](https://github.com/ratuldev47782)
- Email: ratul.dev47782@gmail.com

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

# PERN Auth Template

A full-stack authentication system built with **PostgreSQL/Neon**, **Express**, **React/Next.js**, and **Node.js**.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **Backend** | Express 5, Node.js |
| **Database** | PostgreSQL (via Neon serverless and with Localhost) |
| **ORM** | Drizzle ORM |

## Project Structure

```
PERN-Auth_template/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Route handlers (auth logic)
│   │   ├── db/              # Drizzle schema & connection
│   │   ├── middleware/      # Auth middleware
│   │   ├── routes/          # Express route definitions
│   │   └── app.js           # Express app setup
│   └── server.js            # Entry point
├── frontend/
│   ├── app/
│   │   ├── login/           # Login page
│   │   ├── register/        # Registration page
│   │   └── dashboard/       # Protected dashboard
│   ├── hooks/
│   │   └── useAuth.js      # Auth context/hook
│   └── public/             # Static assets
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 
- PostgreSQL database (Neon recommended)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env  # Configure your DATABASE_URL
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000` and the backend at `http://localhost:5000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create a new user account |
| POST | `/auth/login` | Authenticate and receive user data |

### Register Payload

```json
{
  "user_name": "john_doe",
  "password": "secret123",
  "role": "Operator",
  "assigned_building": "A-2",
  "factory": "K-1",
  "profile_picture": "base64_string_or_null"
}
```

### Login Payload

```json
{
  "user_name": "john_doe",
  "password": "secret123"
}
```

## Features

- **User Registration** with validation and duplicate username check
- **User Login** with credential verification
- **Protected Dashboard** that redirects to login if unauthenticated
- **Profile Display** showing user details, role, factory, and assigned building
- **Logout** functionality with local storage cleanup
- **Image Upload** support for profile pictures (base64)

## Database Schema

The `users` table stores:

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | serial | primary key |
| `user_name` | varchar(100) | unique, not null |
| `password` | text | not null |
| `role` | varchar(100) | not null |
| `assigned_building` | varchar(20) | not null |
| `factory` | varchar(20) | not null |
| `profile_picture` | text | nullable |
| `created_at` | timestamp | default now() |

## Environment Variables

**Backend (.env):**
```
DATABASE_URL=your_postgresql_connection_string
PORT=5000
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Available Scripts

### Backend
```bash
npm run dev       # Start with nodemon
npm run start     # Start production server
npm run db:push   # Push schema to database
npm run db:studio # Open Drizzle Studio
```

### Frontend
```bash
npm run dev       # Start Next.js dev server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint 

```

### Last Updated
```bash
Date : 9 / 8 / 2026
```