# Carrot's Meal Planner

A meal-planning application built with React, Express and MongoDB, with a rustic recipe-notebook style and Carrot and Strawberry characters.

Create a personal meal collection, browse and import public recipes, plan a week of meals, and build a grocery list. The application also includes exports, optional ingredient assistance, Google sign-in, Manager Access and a character mini-game.

**Development status:** under active development. Responsive layouts and optional provider integrations need further work. Nutrition estimates elsewhere in the application remain experimental; the planner marks nutrition unknown until portions can be verified.

Owner and sole project contributor: **Copyrighted-Carrot <belindosamson@gmail.com>**.

## Project structure

```text
client/       React application, styles and illustrations
server/       Express API, MongoDB models, services and tests
scripts/      Repository checks and configuration-helper tests
```

The client and server have separate package manifests and lockfiles. Run commands from the indicated directory; there is no root npm workspace.

## Plans and groceries

Choose a week using its Monday date. Plans save breakfast, lunch, dinner and snacks, with separate records for each account and week. The selected week is remembered per account in the current browser tab; meal and grocery contents are loaded from the server. A save is confirmed only after the API succeeds. If another session changed the record, reload before saving again.

Older undated plans can be copied explicitly into a selected week. Older grocery lists remain available under the saved-list selector; they are not silently assigned a date. Previously discarded snacks cannot be reconstructed automatically. Generate a new plan to include them.

Grocery generation uses the stored plan and combines compatible quantities deterministically. Fractions and mixed fractions are supported. The recipe convention is 1 cup = 240 ml, 1 tablespoon = 15 ml, and 1 teaspoon = 5 ml. Weight, volume, counts and package units remain separate; ingredient names match after case and whitespace normalization, without guessing synonyms, singular forms, density or package size. Ambiguous quantities remain visible as **quantity unknown**.

Checkmarks are saved by item identity. Regenerating a list preserves a check only when both its ingredient identity and amount are unchanged. If the plan changes later, regenerate its grocery list explicitly. Older saved quantity text remains unchanged until regeneration. CSV, PDF and WhatsApp exports include the entire selected saved list, its quantities and checked states, regardless of search or collapsed rows.

The plan API requires `weekStart` (a Monday in `YYYY-MM-DD` form) and a revision when saving. Plan writes send meal IDs; the server stores compact name/ingredient snapshots. Grocery generation sends the saved plan ID and revision, while checkbox writes send an item ID and list revision. The database account must be able to create the unique account/week indexes; a failed index creation blocks first saves rather than allowing duplicate weeks.

## Local setup

Install Node.js with npm, Git and a development MongoDB instance. Install the locked dependencies from the repository root:

```sh
npm ci --prefix server
npm ci --prefix client
```

Copy `server/.env.example` to `server/.env` if a local file does not already exist. Fill in values for your development resources. Keep the local environment file private; never put server credentials in React/browser configuration.

| Server variable | Purpose |
| --- | --- |
| `MONGO_URI` | Development MongoDB connection |
| `JWT_SECRET` | Strong, independently generated signing secret for user sessions |
| `PORT` | API port; the development proxy uses port `5000` |
| `NODE_ENV` | Use `development` locally |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Image-upload configuration |
| `GOOGLE_CLIENT_ID` | Google OAuth audience; must match the browser client ID |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | Optional ingredient-provider credentials |
| `USDA_API_KEY` | Optional nutrition-provider credential |
| `ADMIN_MASTER_PASSWORD`, `ADMIN_JWT_SECRET` | Independent Manager Access password and signing secret |

Replace required placeholders before starting the API. Leave unused optional provider credentials empty. Provider-assisted actions require appropriate configuration; fallback behavior is still being improved. The browser's public Google OAuth client ID is configured in `client/src/index.js`.

`client/.env.example` documents `REACT_APP_API_BASE_URL`. Its default `/api` uses the website's origin. CRA's development proxy forwards these requests to port 5000 during `npm start`; the proxy is not part of a production build. A same-origin deployment must route `/api` to Express. For a separate API host, set an HTTPS URL ending in `/api` in `client/.env.local` before building. Restart the development server or rebuild after changing browser configuration.

Start the server in one terminal:

```sh
cd server
npm run dev
```

Start the client in another terminal:

```sh
cd client
npm start
```

Open `http://localhost:3000` and register a development account. The API listens on `http://localhost:5000` by default. An HTTP response from its root confirms the server is running; it does not confirm database readiness.

## Tests and build

Run from the repository root:

```sh
node scripts/check-secrets.cjs --worktree
node --test scripts/check-secrets.test.cjs
node --test scripts/local-env.test.cjs
npm --prefix server test -- --runInBand --watch=false
npm --prefix client test -- --watchAll=false --runInBand
npm --prefix client run build
```

Jest tests live under `server/tests/` and `client/src/**/*.test.js`. Automated tests use isolated database/provider doubles and HTTP fixtures; live database, OAuth and upload checks require separate development resources. The production client build is written to the ignored `client/build/` directory.

Files such as `server/test_*.js`, `verify_*.js`, seed, reset, migration and debug scripts are maintenance tools. Some contact external providers or modify a database. Read the selected script before running it; do not run all maintenance scripts as a test suite. `test_auth.js` and `verify_all.js` require `RUN_LIVE_CHECKS=yes` and should target a disposable database. Keep diagnostic output private.

## Configuration helpers

`server/setup_admin_env.js` generates missing Manager secrets without printing them and preserves configured values. `server/update_keys.js` accepts explicit replacement values through its process environment and updates only the requested settings. Editing the ignored server environment file privately is also supported. Restart the API after changing its configuration.

## Repository checks

Install the local Git hooks after cloning:

```sh
git config --local core.hooksPath .githooks
```

The pre-commit hook verifies the project owner's Git identity and scans the exact staged content. Pushes are blocked until explicitly enabled by the repository owner. Hooks are local checks and must be installed in each checkout.

Before committing:

```sh
git status --short
node scripts/check-secrets.cjs --worktree
node scripts/check-secrets.cjs --staged
git diff --cached --check
```

Commit source code, assets, lockfiles and placeholder environment examples. Keep real credentials, account data, local notes, screenshots, backups, database dumps, dependencies, build output and logs out of Git. Secret scanning supplements manual review; it cannot identify every possible private value.
