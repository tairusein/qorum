# QORUM setup

## Backend

QORUM uses Supabase for email/password accounts, private direct messages, play-time sessions, and aggregate game statistics.

1. The database migrations in `supabase/migrations/` have been applied to the QORUM Supabase project (`snwmsqkpzetqnaniltdf`, EU West).
2. In Supabase **Authentication → URL Configuration**, set the site URL to `https://tairusein.github.io/qorum/` and add `https://tairusein.github.io/qorum/**` and `http://localhost:8000/**` to the allowed redirect URLs.
3. Keep email confirmation enabled. Configure a custom SMTP provider in Supabase **Authentication → SMTP Settings** before inviting public registrations; the default email service is rate-limited and is not intended for a public launch.
4. `config.js` contains only the Supabase project URL and publishable key. These are intended to be public. Never put a `service_role` or secret key in this website.

The database applies row-level security to profiles, messages, and game sessions. A signed-in user can read only their own messages and play sessions. Game time is recorded using database timestamps and periodic heartbeats; a crashed or closed tab can add at most 45 seconds after its last heartbeat.

## Publish on GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes this folder when pushed to the `main` branch.

1. Create a GitHub repository named `qorum` under `tairusein`.
2. Upload the contents of this folder to the repository root, including the hidden `.github` directory.
3. In repository **Settings → Pages**, choose **GitHub Actions** as the build and deployment source.
4. Wait for the workflow to finish, then add the resulting `https://tairusein.github.io/qorum/` URL in Supabase Authentication's site URL and redirect URL settings.

GitHub Pages is static hosting; the Supabase project is the live backend. The current development environment does not have Git installed or a GitHub repository connected, so the first push must be made from a machine with Git or by uploading the files through GitHub.

For local testing on Windows, run `py -m http.server 8000` from this folder, then open `http://localhost:8000/`. Authentication redirects are not supported from `file://` URLs.
