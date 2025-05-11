# FNP Tracker

A React and Electron desktop application developed for Curaleaf to track formulation and packaging (F&P) processes. Integrated with Supabase for robust data storage and Auth0 for secure, role-based authentication, the app supports Excel file uploads, advanced data editing with a three-step confirmation process, color-coded visualization, and comprehensive audit logging for user actions.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Database Setup](#database-setup)
- [Visuals](#visuals)
- [Notes](#notes)
- [Contributing](#contributing)
- [License](#license)

## Features

Secure Authentication: Auth0-based login with user tiers (0–3) for role-based access control, ensuring appropriate permissions for different users.
Excel File Upload: Upload Excel files with header mapping and data preview for seamless data import.
Interactive Data Table: Supports cell editing, color coding, spacers, and row operations (duplicate, delete) for efficient data management.
Three-Step Confirmation: Implements a three-step confirmation process for cell edits, with a 5-minute grace period to ensure data accuracy.
Audit Logging: Tracks user actions (sign-in, submission, edit, delete, duplicate) in the audit_logs table for accountability and traceability.
Color Coding: Applies visual rules (e.g., pastel red for cancelled batches) to enhance data organization and readability.
Electron Desktop App: Provides a cross-platform desktop experience for formulation and packaging tracking.

## Prerequisites

Before setting up the project, ensure you have the following:

Node.js and npm: Install from nodejs.org.
Supabase Account: Sign up at supabase.com and create a project to obtain REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_KEY.
Auth0 Account: Set up an Auth0 application at auth0.com for authentication credentials.
Electron: Required for building and running the desktop app.
Git: For cloning the repository.

Setup
Follow these steps to set up the project locally:

Clone the Repository:git clone https://github.com/claygeo/fnp-tracker.git


Navigate to the Project Directory:cd fnp-tracker


Install Dependencies:npm install


Configure Environment Variables:
Create a .env file in the project root.
Add the following, replacing placeholders with your Supabase and Auth0 credentials:REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_KEY=your-supabase-key
REACT_APP_AUTH0_DOMAIN=your-auth0-domain
REACT_APP_AUTH0_CLIENT_ID=your-auth0-client-id




Run the Development Server:npm run start


Build for Windows:npm run dist



Database Setup
To configure the Supabase database, you need to create the necessary tables. Copy and paste the following SQL code into the Supabase SQL Editor (found in your Supabase dashboard under SQL Editor). This will set up the tables required for the application.
-- Enable UUID extension for audit_logs table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create audit_logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type TEXT NOT NULL CHECK (action_type IN ('sign-in', 'submission', 'edit', 'delete', 'duplicate')),
    user_email TEXT NOT NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (id IS NOT NULL),
    CHECK (action_type IS NOT NULL),
    CHECK (user_email IS NOT NULL),
    CHECK (details IS NOT NULL)
);

-- Create daily_summary_2024 table
CREATE TABLE daily_summary_2024 (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    product TEXT,
    est_units NUMERIC,
    uom NUMERIC,
    wt NUMERIC,
    CHECK (id IS NOT NULL)
);

-- Create duplicated_products table
CREATE TABLE duplicated_products (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    display_name TEXT,
    original_product_id INTEGER,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (id IS NOT NULL),
    FOREIGN KEY (original_product_id) REFERENCES fnp_tracker(id)
);

-- Create fnp_tracker table
CREATE TABLE fnp_tracker (
    id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    batch_status TEXT,
    category TEXT,
    colors JSONB DEFAULT '{}',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    distillate_oil_used NUMERIC,
    document_no TEXT,
    est_hub_landing DATE,
    est_units NUMERIC,
    finished_goods_barcode TEXT,
    formulation_batch_no TEXT,
    is_duplicate BOOLEAN DEFAULT FALSE,
    lab TEXT,
    lock_timestamp TIMESTAMP WITHOUT TIME ZONE,
    locked BOOLEAN DEFAULT FALSE,
    locked_cells JSONB DEFAULT '{}',
    "order" INTEGER,
    order_index INTEGER DEFAULT 0,
    original_oil_batch TEXT,
    pack_year TEXT,
    packaged_date DATE,
    packaged_week INTEGER,
    packaging_final_units NUMERIC,
    packaging_status TEXT,
    CHECK (id IS NOT NULL)
);

Notes:

Run the SQL code in the order provided, as duplicated_products has a foreign key referencing fnp_tracker.
The uuid-ossp extension is required for the audit_logs table’s UUID primary key.
Ensure Row-Level Security (RLS) is configured in Supabase if your application requires it (e.g., enable RLS and set policies via the Supabase dashboard).
The audit_logs table uses a CHECK constraint to limit action_type to specific values (sign-in, submission, edit, delete, duplicate).

Visuals
Below are placeholders for screenshots showcasing the application's interface and features. (Replace this section with actual image links or filenames once provided.)

Login Screen: [Insert image link or filename]
Excel Upload Interface: [Insert image link or filename]
Data Table with Color Coding: [Insert image link or filename]
Audit Log View: [Insert image link or filename]

Notes

Curaleaf Branding: Used with permission for this project.
FFmpeg Binaries: Included under their respective licenses (GPL/LGPL). Ensure compliance with these licenses when distributing the app.
Environment Security: Ensure the .env file is not committed to version control (it’s excluded via .gitignore).
Windows-Specific Build: The npm run dist script is tailored for Windows. For other platforms, modify the build configuration in package.json.
Auth0 Configuration: Verify that your Auth0 application is configured with the correct callback URLs and user tiers (0–3) for role-based access.

Contributing
Contributions are welcome! To contribute:

Fork the repository.
Create a feature branch: git checkout -b feature/your-feature.
Commit changes: git commit -m "Add your feature".
Push to the branch: git push origin feature/your-feature.
Open a pull request.

Please ensure your code follows the project’s coding standards and includes relevant tests.
License
This project is licensed under the MIT License. See the LICENSE file for details.

