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

### AI reports

The superadmin dashboard can generate portfolio, task/schedule, risk, and resource reports using the Gemini API. Configure `Gemini:ApiKey` as a .NET user secret or set the `Gemini__ApiKey` environment variable on the API host. Optionally set `Gemini:Model` / `Gemini__Model`; the default is `gemini-2.5-flash`. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/).

Report generation is restricted to superadmins. The API sends project names and aggregated project/task/milestone/risk/resource metrics to Gemini; it does not send employee contact details. Resource costs in reports are the values recorded on resources, not verified actual spending. Review Google's current Gemini API data-use terms and free-tier limits before sending project data; do not include sensitive information unless your organization's terms allow it.

## Deployment

The frontend can be deployed to Cloudflare Pages from this repository with:

- Root directory: `my-react-app`
- Build command: `npm run build`
- Build output directory: `dist`

Deploy the ASP.NET Core API to a .NET-capable host separately, then configure the frontend to use the deployed API URL.
