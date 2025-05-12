# F&P Tracker

A React and Electron desktop application developed for Curaleaf to track formulation and packaging (F&P) processes. Integrated with Supabase for robust data storage and Auth0 for secure, role-based authentication, the app supports Excel file uploads, advanced data editing with a three-step confirmation process, color-coded visualization, and comprehensive audit logging for user actions.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Database Setup](#database-setup)
- [Visuals](#visuals)
- [Notes](#notes)

## Features

- Secure Authentication: Auth0-based login with user tiers (0–3) for role-based access control, ensuring appropriate permissions for different users.
- Excel File Upload: Upload Excel files with header mapping and data preview for seamless data import.
- Interactive Data Table: Supports cell editing, color coding, spacers, and row operations (duplicate, delete) for efficient data management.
- Three-Step Confirmation: Implements a three-step confirmation process for cell edits, with a 5-minute grace period to ensure data accuracy.
- Audit Logging: Tracks user actions (sign-in, submission, edit, delete, duplicate) in the audit_logs table for accountability and traceability.
- Color Coding: Applies visual rules (e.g., pastel red for cancelled batches) to enhance data organization and readability.
Electron Desktop App: Provides a cross-platform desktop experience for formulation and packaging tracking.

## Prerequisites

Before setting up the project, ensure you have the following:
- Node.js and npm: Install from nodejs.org.
- Supabase Account: Sign up at supabase.com and create a project to obtain REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_KEY.
- Electron: Required for building and running the desktop app.
- Git: For cloning the repository.

## Setup
Follow these steps to set up the project locally:

1. Clone the Repository: git clone https://github.com/claygeo/fnp-tracker.git

2. Navigate to the Project Directory: cd fnp-tracker

3. Install Dependencies: npm install

4. Configure Environment Variables:
- Create a .env file in the project root.
- Add the following, replacing placeholders with your Supabase credentials: REACT_APP_SUPABASE_URL=your-supabase-url
REACT_APP_SUPABASE_KEY=your-supabase-key

5. Run the Development Server: npm run start

6. Build for Windows: npm run dist

## Database Setup
To configure the Supabase database, you need to create the necessary tables. Copy and paste the following SQL code into the Supabase SQL Editor (found in your Supabase dashboard under SQL Editor). This will set up the tables required for the application:

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

## Visuals

Login Screen: ![image](https://github.com/user-attachments/assets/a78a5648-3bd6-488c-8d55-5c7a5f231434)
Main Interface: ![image](https://github.com/user-attachments/assets/40394dc6-da01-4bde-a5a7-179453579304)
Excel Upload Interface: ![image](https://github.com/user-attachments/assets/7074773f-b6f0-4611-b699-8ad18d1b9da7)
![image](https://github.com/user-attachments/assets/bbd471a4-49c2-47be-8f7a-7d2e2d1676c4)
![image](https://github.com/user-attachments/assets/d3bd549f-ad1c-4fc9-b66b-d6a52e5c45fc)

## Notes:

- Curaleaf Branding: Used with permission for this project.
- FFmpeg Binaries: Included under their respective licenses (GPL/LGPL). Ensure compliance with these licenses when distributing the app.
- Environment Security: Ensure the .env file is not committed to version control (it’s excluded via .gitignore).
- Windows-Specific Build: The npm run dist script is tailored for Windows. For other platforms, modify the build configuration in package.json.

