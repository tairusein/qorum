# QORUM setup

## Backend

QORUM uses Supabase for username/password accounts, private direct messages, play-time sessions, and aggregate game statistics. The login is backed by an internal, reserved `.invalid` email alias; players never enter or receive email. Passwords are handled by Supabase Auth and are never stored in the QORUM database as plain text.

1. The database migrations in `supabase/migrations/` are applied to the QORUM Supabase project (`snwmsqkpzetqnaniltdf`, EU West).
2. The `recover-account` Edge Function is deployed to this project. It uses Supabase's server-side secret key, which Supabase provides to Edge Functions; never add that key to the website or repository. If you change the function source later, redeploy it to Supabase.
3. In Supabase **Authentication → Providers → Email**, disable **Confirm email**. This username-only flow does not send email, and sign-in needs to work immediately after registration.
4. In Supabase **Authentication → URL Configuration**, set the site URL to `https://tairusein.github.io/qorum/` and add `https://tairusein.github.io/qorum/**` and `http://localhost:8000/**` to the allowed redirect URLs.
5. `config.js` contains only the Supabase project URL and publishable key. These are intended to be public. Never put a `service_role` or secret key in this website.

The database applies row-level security to profiles, messages, and game sessions. Recovery codes are generated in the browser using cryptographic randomness; only a SHA-256 hash is stored. The recovery Edge Function checks the one-time code, updates the password through Supabase Auth, and replaces the old code with a new one shown once. QORUM never stores the user's password or includes it in the downloadable recovery card. Users must save the current code privately; without it, their password cannot be recovered because no email address is associated with the account.

Game time is recorded using database timestamps and periodic heartbeats; a crashed or closed tab can add at most 45 seconds after its last heartbeat.

## Publish on GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes this folder when changes are pushed to the `main` branch.

1. The repository is `tairusein/qorum`; commit and push changes to its `main` branch.
2. In repository **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
3. Wait for the workflow to finish, then use `https://tairusein.github.io/qorum/` as the site URL in Supabase Authentication.

GitHub Pages is static hosting; the Supabase project is the live backend. GitHub Pages deploys the static files; database migrations and Edge Function changes must also be applied/deployed to Supabase.

For local testing on Windows, run `py -m http.server 8000` from this folder, then open `http://localhost:8000/`. Authentication redirects are not supported from `file://` URLs.
