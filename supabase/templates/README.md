# IXMetrics Auth Email

Use `confirmation.html` as the hosted Supabase **Confirm sign up** template.

Recommended subject:

`Welcome to IXMetrics — confirm your email`

The app already creates email/password accounts with `supabase.auth.signUp()` and an `emailRedirectTo` back to IXMetrics. Keep email confirmation enabled so this message is sent during signup.

For a public production site, configure **custom SMTP** in Supabase Auth before opening signup to everyone. Supabase's built-in SMTP is intended for development/testing and may not deliver to arbitrary public addresses.

Suggested sender:

`IXMetrics <no-reply@auth.ixmetrics.com>`

Keep this message transactional and focused on account confirmation rather than marketing.
