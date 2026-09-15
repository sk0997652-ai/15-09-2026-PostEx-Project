# PostEx HR Onboarding Portal

A production-grade onboarding portal for PostEx, engineered with a React + TypeScript frontend and a serverless Supabase backend (PostgreSQL, Supabase Auth, Supabase Storage, and Supabase Edge Functions).

## Architecture & System Relationships

```
+-------------------------------------------------------------------------+
|                  Frontend (React + TypeScript / Vite)                   |
|  - HR Admin Dashboard & Candidate Onboarding Interface                 |
|  - Real-time status listeners via Supabase Client                       |
|  - Zero custom Express server                                           |
+--------------------+-------------------------+--------------------+-----+
                     |                         |                    |
            [1. Direct Queries]       [2. Authenticate]    [3. Invoke Sensitive]
            (Subject to RLS)                   |                    |
                     v                         v                    v
+--------------------+---------+  +------------+--------+  +--------+-----------+
|      PostgreSQL Database     |  |    Supabase Auth     |  |   Edge Functions   |
| - Row Level Security (RLS)   |  | - Staff login       |  | - Credentials gen  |
| - Tables: onboarding records,|  | - JWT session tokens|  | - OTP handling     |
|   audit logs, candidates     |  | - Role-based claims |  | - PDF generation   |
+--------------------+---------+  +---------------------+  | - State transitions|
                     ^                                     +--------+-----------+
                     |                                              |
                     +-----------------(Service Role)---------------+
```

### Component Relationships

1. **Frontend (`/src`)**:
   - Built with React 19, TypeScript, and Tailwind CSS.
   - Communicates directly with Supabase via `@supabase/supabase-js`.
   - Uses public environment variables (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) which are safe for client-side use because all database operations are secured at the PostgreSQL engine level via Row Level Security (RLS).

2. **Supabase Database (PostgreSQL)**:
   - Houses all application state: candidate profiles, document metadata, onboarding workflow stages, and immutable audit logs.
   - **Row Level Security (RLS) is enabled by default on all tables**: Candidates only see their own onboarding records; HR staff access is governed by authenticated user role policies.

3. **Supabase Auth**:
   - Manages HR staff authentication with standard email/password or magic links, issuing signed JWTs with custom role claims.
   - JWT tokens are automatically passed by the `@supabase/supabase-js` client on all database and storage requests.

4. **Supabase Storage**:
   - Dedicated secure buckets for candidate documents (identity cards, resumes, certifications, signed contracts).
   - Governed by Storage RLS policies tied to candidate IDs and HR staff roles.

5. **Supabase Edge Functions (`/supabase/functions`)**:
   - Serverless TypeScript functions executed in Deno on Supabase infrastructure.
   - Used for privileged server-side operations that cannot safely run in the browser:
     - New hire portal credential generation (temporary passwords / tokens).
     - SMS/Email OTP generation and rate-limited verification.
     - PDF contract stamping and cryptographic signature rendering.
     - Strict multi-stage onboarding workflow state transitions with transactional audit logging.
   - Uses `SUPABASE_SERVICE_ROLE_KEY` securely in the Edge Function environment to perform privileged administrative actions.

## Project Directory Structure

```
├── /index.html                 # HTML application entry point
├── /metadata.json              # AI Studio applet metadata & capabilities
├── /package.json               # Frontend dependencies and build scripts
├── /README.md                  # Project architectural documentation
├── /.env.example               # Environment variables specification
├── /supabase/
│   ├── config.toml             # Supabase CLI configuration
│   └── functions/              # Edge Functions directory
│       ├── README.md           # Edge Functions documentation & deployment guide
│       └── _shared/
│           └── cors.ts         # Shared CORS headers for Edge Functions
└── /src/
    ├── main.tsx                # React DOM root mounting
    ├── App.tsx                 # Core App component with connectivity inspector
    ├── index.css               # Tailwind CSS stylesheet
    ├── lib/
    │   └── supabase.ts         # Initialized Supabase client & health check tools
    └── components/
        └── ConnectivityStatus.tsx # Visual connectivity validation dashboard
```

## Environment Configuration

Configure the following secrets in the environment:
- `VITE_SUPABASE_URL`: Your Supabase Project URL (e.g. `https://your-project.supabase.co`).
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous public API key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (only for backend Edge Functions, never client-side).
