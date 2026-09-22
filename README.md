# WSI Library Management System

A modern, full-stack School Library Management System (LMS) and Online Public Access Catalog (OPAC) built for **Washington School International**.

## Features

- **Public Catalog (OPAC):** Real-time book search by title, author, category, and ISBN with physical copy availability counters.
- **Student Portal:** Frictionless loan portal where students can check active borrowed books, due dates, and past reading history using only their Library ID (`WSI-S-xxxx`).
- **Circulation Desk:** Real-time book checkout and return with accession barcode validation and student verification.
- **Book Cataloging Engine:** Fast cataloging via Google Books API and OpenLibrary fallback, automatic Call Number auto-generation, and printable Code-128 barcode stickers.
- **Inventory Management:** Full bibliographic metadata editor, physical copy management, category filtering, and batch barcode label sticker sheet printing.
- **Student Management:** Sequential Library ID generation and student enrollment directory.
- **Authentication & Security:** Supabase SSR cookie session authentication with Next.js Middleware route protection for `/admin/:path*`.
- **Live Admin Dashboard:** Real-time library inventory health, active loan metrics, and transaction logs.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database & Auth:** Supabase (PostgreSQL, Supabase SSR Auth)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Barcodes:** React Barcode (Code-128)

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/supportwashingtonschool/wsi-library-management-system.git
cd wsi-library-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GOOGLE_BOOKS_API_KEY=your-google-books-api-key
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.
