## DataDock Backend

Simple Express API wired to Supabase for auth, database CRUD, and storage uploads.

### Setup

1. Create a `.env` file at the project root based on the values below:

```
PORT=3000
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_KEY=YOUR_SUPABASE_SERVICE_OR_ANON_KEY
SUPABASE_BUCKET=my-bucket
```

2. Install and run:

```
npm install
npm run dev
```

### Routes
- POST `/signup` { email, password }
- POST `/login` { email, password }
- POST `/add-user` { name, number, age }
- GET `/users`
- POST `/upload` multipart/form-data with field `file`
- GET `/files`
- DELETE `/files/:fileName`


