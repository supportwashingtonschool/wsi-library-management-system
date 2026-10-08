-- ==============================================================================
-- Supabase PostgreSQL Schema for WSI School Library Management System
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Book_Metadata
-- Stores bibliographic data for unique books by ISBN
CREATE TABLE IF NOT EXISTS "Book_Metadata" (
    isbn VARCHAR(20) PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    cover_url TEXT,
    category TEXT,
    publisher TEXT,
    place_of_publication TEXT,
    published_year VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Physical_Books
-- Stores specific physical copies/holdings belonging to the library
-- Accession number format: 'WSI-0001'
CREATE TABLE IF NOT EXISTS "Physical_Books" (
    accession_number VARCHAR(50) PRIMARY KEY,
    isbn VARCHAR(20) NOT NULL REFERENCES "Book_Metadata"(isbn) ON DELETE RESTRICT ON UPDATE CASCADE,
    call_number VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'Available' CHECK (LOWER(status) IN ('available', 'borrowed', 'lost', 'damaged', 'maintenance')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Students
-- Stores student borrower information
-- Library ID format: 'WSI-LRC-S-0001' (formerly 'WSI-S-0001')
CREATE TABLE IF NOT EXISTS "Students" (
    library_id VARCHAR(50) PRIMARY KEY,
    full_name TEXT NOT NULL,
    grade_level VARCHAR(50) NOT NULL,
    address TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Schema Migration Commands:
-- ALTER TABLE "Students" ADD COLUMN IF NOT EXISTS address TEXT;
-- ALTER TABLE "Students" ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 4. Loans
-- Tracks checkout and circulation transactions
CREATE TABLE IF NOT EXISTS "Loans" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_accession VARCHAR(50) NOT NULL REFERENCES "Physical_Books"(accession_number) ON DELETE RESTRICT ON UPDATE CASCADE,
    student_id VARCHAR(50) NOT NULL REFERENCES "Students"(library_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    checkout_date TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    due_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (LOWER(status) IN ('active', 'returned', 'overdue')),
    returned_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_physical_books_isbn ON "Physical_Books"(isbn);
CREATE INDEX IF NOT EXISTS idx_physical_books_status ON "Physical_Books"(status);
CREATE INDEX IF NOT EXISTS idx_loans_book_accession ON "Loans"(book_accession);
CREATE INDEX IF NOT EXISTS idx_loans_student_id ON "Loans"(student_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON "Loans"(status);

-- Enable Row Level Security (RLS)
ALTER TABLE "Book_Metadata" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Physical_Books" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Loans" ENABLE ROW LEVEL SECURITY;

-- RLS policies for MVP (allows public read and write operations)
CREATE POLICY "Allow public all access on Book_Metadata"
    ON "Book_Metadata" FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public all access on Physical_Books"
    ON "Physical_Books" FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public all access on Students"
    ON "Students" FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public all access on Loans"
    ON "Loans" FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 5. Supabase Storage: 'student-photos' Bucket Configuration
-- ==============================================================================
-- Create public storage bucket for student ID photos:
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to student photo objects:
CREATE POLICY "Allow public read on student-photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'student-photos');

-- Allow uploads to student-photos:
CREATE POLICY "Allow public insert on student-photos"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'student-photos');

