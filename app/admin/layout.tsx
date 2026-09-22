import Link from "next/link";
import { BookPlus, Repeat, LayoutDashboard, Library, ArrowLeft, Users, LogOut, Database } from "lucide-react";
import { logout } from "@/app/actions/authActions";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-800">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-800 font-bold text-lg text-blue-400">
          <Library className="h-6 w-6" />
          <span>WSI Admin</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/admin/cataloging"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <BookPlus className="h-4 w-4" />
            Cataloging
          </Link>
          <Link
            href="/admin/inventory"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <Database className="h-4 w-4" />
            Inventory
          </Link>
          <Link
            href="/admin/circulation"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <Repeat className="h-4 w-4" />
            Circulation
          </Link>
          <Link
            href="/admin/students"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-800 text-slate-300 hover:text-white transition"
          >
            <Users className="h-4 w-4" />
            Students
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Public OPAC
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 text-xs text-rose-400 hover:text-rose-300 transition py-1 font-medium"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Admin Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">School Library Management System</span>
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2.5 py-0.5 font-medium">
            Admin Mode
          </span>
        </header>
        <main className="p-8 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
