import Link from "next/link";
import Image from "next/image";
import { BookPlus, Repeat, LayoutDashboard, ArrowLeft, Users, LogOut, Database } from "lucide-react";
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
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800">
          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-white p-0.5 shrink-0 ring-1 ring-white/20">
            <Image
              src="/logo.png"
              alt="Washington School Philippines"
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-white truncate leading-tight">
              Washington School
            </span>
            <span className="block text-[10px] text-blue-400 font-medium tracking-wider uppercase">
              Admin Portal
            </span>
          </div>
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
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0 border border-slate-200">
              <Image
                src="/logo.png"
                alt="Washington School Philippines"
                width={28}
                height={28}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-sm font-semibold text-slate-800">
              Washington School Philippines • Library Management System
            </span>
          </div>
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md px-2.5 py-1 font-medium">
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
