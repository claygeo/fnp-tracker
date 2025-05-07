# FNP Tracker

A React and Electron desktop app for Curaleaf's formulation and packaging (F&P) tracking, integrated with Supabase for data storage and Auth0 for authentication. It supports Excel file uploads, data editing with a three-step confirmation process, color coding, and audit logging.

## Features
- Auth0-based login with user tiers (0–3) for role-based access
- Excel file upload with header mapping and data preview
- Data table with cell editing, coloring, spacers, and row operations (duplicate, delete)
- Three-step confirmation for cell edits with a 5-minute grace period
- Audit logging for user actions (sign-in, submission, edit, delete, duplicate)
- Color rules for visual data organization (e.g., pastel red for cancelled batches)

## Prerequisites
- Node.js and npm
- Supabase account with `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_KEY` environment variables
- Auth0 account for authentication
- Electron for desktop app development

## Setup
1. Clone the repository: `git clone [your-repo-url]`
2. Navigate to the project directory: `cd fnp-tracker`
3. Install dependencies: `npm install`
4. Create a `.env` file with Supabase and Auth0 credentials
5. Start the app: `npm run start`
6. Build for Windows: `npm run dist`

## Notes
- Curaleaf branding is used with permission.
- FFmpeg binaries are included under their respective license (GPL/LGPL).
- Ensure `.env` is not committed (excluded via `.gitignore`).
- The `start:dist` script is Windows-specific.

## License
Licensed under the MIT License. See [LICENSE](LICENSE) for details.
