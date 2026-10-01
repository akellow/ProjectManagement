# ProjectManagement

Project management application with a React frontend and an ASP.NET Core REST API.

## Repository layout

- `my-react-app/` - React, TypeScript, and Vite frontend.
- `ProjectApi/ProjectApi/` - ASP.NET Core API targeting .NET 8.

## Run locally

Prerequisites: Node.js and the .NET 8 SDK.

### Frontend

```powershell
cd my-react-app
npm install
npm run dev
```

### REST API

Configure the API's database connection and other required settings for your environment, then run:

```powershell
cd ProjectApi/ProjectApi
.\start-local.ps1
```

The local startup script runs the API at `http://localhost:5083`. You can also start it with `dotnet run --urls http://localhost:5083`.

Keep credentials and production secrets out of source control.

## Deployment

The frontend can be deployed to Cloudflare Pages from this repository with:

- Root directory: `my-react-app`
- Build command: `npm run build`
- Build output directory: `dist`

Deploy the ASP.NET Core API to a .NET-capable host separately, then configure the frontend to use the deployed API URL.
