# ScoutCoreMLB Auth Email

Use `confirmation.html` as the hosted Supabase **Confirm sign up** template.

Recommended subject:

`Welcome to ScoutCoreMLB — confirm your email`

The app already creates email/password accounts with `supabase.auth.signUp()` and an `emailRedirectTo` back to ScoutCoreMLB. Keep email confirmation enabled so this message is sent during signup.

For a public production site, configure **custom SMTP** in Supabase Auth before opening signup to everyone. Supabase's built-in SMTP is intended for development/testing and may not deliver to arbitrary public addresses.

Suggested sender:

`ScoutCoreMLB <no-reply@auth.scoutcoremlb.com>`

Keep this message transactional and focused on account confirmation rather than marketing.
