# Deployment

How IdeaForge runs on Vercel, how to register Google sign-in callbacks, and how to diagnose configuration errors. Read it before changing environment variables or adding a deployment hostname. The production app is at [idea-forge-wine.vercel.app](https://idea-forge-wine.vercel.app).

## Vercel

The `idea-forge` Vercel project deploys the `main` branch with Next.js and Node.js 24. Next.js serves the pages, accounts, board metadata, and AI routes in one process, so there is no separate API server. Set the variables from `.env.example` as server-side environment variables, and redeploy after changing them, because existing deployments keep their earlier settings. Production variables don't apply to previews, so set preview variables separately.

Keep Fluid compute enabled. Each Featherless or Gemini attempt has a 30-second timeout. On overload, quota exhaustion, or timeout, the server retries once after one second, then calls the fallback model once. A merge can take about 91 seconds across those three attempts, so the merge, Organize, and conclusion routes export `maxDuration = 95`. See [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration).

To run a production build locally, use `npm run build` and `npm start`.

## Google sign-in

Better Auth builds Google's callback from `APP_ORIGIN`, which this repository passes as Better Auth's `baseURL`. Setting `BETTER_AUTH_URL` alone doesn't change the callback. Set `APP_ORIGIN` to the stable URL you use to open the app.

In Google Cloud Console, open APIs & Services, then Credentials, and edit the Web application OAuth client that matches `GOOGLE_CLIENT_ID`. Add the full callback URL under Authorized redirect URIs. Authorized JavaScript origins don't register callbacks.

| Environment | `APP_ORIGIN` | Authorized redirect URI |
| --- | --- | --- |
| Local | `http://localhost:3000` | `http://localhost:3000/api/auth/callback/google` |
| Production | `https://idea-forge-wine.vercel.app` | `https://idea-forge-wine.vercel.app/api/auth/callback/google` |

If you use another domain, replace both production URLs. For preview sign-in, use a stable staging or branch hostname, set that preview's `APP_ORIGIN` to it, and register its exact callback. Each generated deployment hostname needs its own registration. Pointing preview auth at production sends the callback to a different host from the one that started sign-in.

See [Google's OAuth requirements](https://developers.google.com/identity/protocols/oauth2/web-server), [Better Auth's Google setup](https://better-auth.com/docs/authentication/google), and [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Troubleshooting

If Google returns `redirect_uri_mismatch`, read `redirect_uri` in the error details. Compare its protocol, hostname, port, and path with the callback registered for the client in use.

Missing or invalid server settings return HTTP 503 with the affected variable names. The function log records `cause: "server_configuration"` and those names, without their values. If `/api/auth/sign-in/social` fails before opening Google, check that the environment has `MONGODB_URI`, `MONGODB_DB_NAME`, `BETTER_AUTH_SECRET` of at least 32 characters, both Google credentials, and an `APP_ORIGIN` that matches the hostname you're testing. Set the Google credentials together. Set all SMTP variables together, or leave them all empty if you only need Google sign-in.

`/healthz` pings MongoDB and returns `{ "status": "ok" }` when the database responds. An unexpected HTTP 500 logs an error category such as `MongoServerSelectionError`, without the raw message or connection string. When that category appears, check the database credentials, Atlas network access, and database availability.
