# Superadmin seeding flow

This app keeps the service-role secret out of browser code.

## Required pattern

- Frontend: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Server / admin script: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Never store a service role key under a `VITE_` prefix

## Create the server-only env file

Copy `.env.seed.example` to `.env.seed`, then fill in the real values:

```bash
cp .env.seed.example .env.seed
```

Set `SUPERADMIN_PASSWORD` to a unique password of at least 12 characters. The seed script intentionally has no default password.

Then run:

```bash
npm run seed:superadmin
```

## Supabase invitations from the API

The superadmin invite form sends invitations through the ProjectApi server. Configure its Supabase settings with .NET User Secrets from the React app directory:

```powershell
dotnet user-secrets set "Supabase:Url" "https://your-project.supabase.co" --project ..\ProjectApi\ProjectApi\ProjectApi.csproj
dotnet user-secrets set "SUPABASE_SERVICE_ROLE_KEY" "your-rotated-service-role-key" --project ..\ProjectApi\ProjectApi\ProjectApi.csproj
dotnet user-secrets set "SUPABASE_AUTH_REDIRECT_URL" "http://localhost:5173/login" --project ..\ProjectApi\ProjectApi\ProjectApi.csproj
```

Add the redirect URL to Supabase **Authentication → URL Configuration → Redirect URLs**. For a deployed app, set `SUPABASE_AUTH_REDIRECT_URL` to its login URL. Restart ProjectApi after changing User Secrets. Invitations are sent by Supabase Auth; the API never sends the service-role key to the browser.

The same server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` settings are required for listing, changing roles, and deleting Supabase Auth users. For deployment, add these as environment variables in the ProjectApi host (for example, Render's service environment), then redeploy/restart the API. Do not add the service-role key to Vercel or any `VITE_` variable.

## Manual shell-based seed

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-key \
SUPERADMIN_EMAIL=akelloantony9@gmail.com \
SUPERADMIN_USERNAME=superadmin \
SUPERADMIN_PASSWORD=SuperAdmin123! \
node scripts/seed-superadmin.mjs
```

## Security note

The service-role secret is intentionally not placed in the React app. This script is meant to run only in a trusted terminal, CI job, or backend process.