# ScoutCore development workflow

Work-in-progress product changes are saved on the `development` branch.

- GitHub CI runs lint and production build checks on `development`.
- Work-in-progress commits use `[skip netlify]` so they do not consume production deploys.
- `main` remains the production branch.
- When the product is finalized, merge the completed development work into `main` for the final production deployment.
