# Supabase Edge Functions — PostEx HR Onboarding Portal

This directory contains the server-side Edge Functions for the PostEx HR Onboarding Portal.

## Architecture Guidelines (Ground Rule #8)
All backend logic that cannot or should not run client-side is executed via Supabase Edge Functions running on Deno. No custom Express/Node server is used.

### Planned Edge Functions (Built in upcoming steps):
- `generate-credentials`: Generates secure onboarding access credentials for new hires.
- `handle-otp`: Secure one-time password generation and verification via SMS/Email.
- `generate-pdf`: Renders signed offer letters and employment contracts as PDFs.
- `workflow-transition`: Validates and triggers stage transitions with audit logging and permissions checks.

### Directory Structure
```
supabase/
├── config.toml
└── functions/
    ├── _shared/
    │   └── cors.ts              # Reusable CORS headers across functions
    ├── generate-credentials/    # (To be added in future step)
    │   └── index.ts
    ├── handle-otp/              # (To be added in future step)
    │   └── index.ts
    ├── generate-pdf/            # (To be added in future step)
    │   └── index.ts
    └── workflow-transition/     # (To be added in future step)
        └── index.ts
```

### Local Development & Deployment via Supabase CLI
- **Serve locally**: `supabase functions serve [function-name]`
- **Deploy**: `supabase functions deploy [function-name] --project-ref <your-project-ref>`
- **Set Secrets**: `supabase secrets set SECRET_NAME="value"`
