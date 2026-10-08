"use client";

import React from "react";
import Image from "next/image";
import { User } from "lucide-react";
import Barcode from "react-barcode";
import type { Student } from "@/app/actions/studentActions";

interface StudentIdCardProps {
  student: Student;
}

export default function StudentIdCard({ student }: StudentIdCardProps) {
  return (
    <div className="inline-flex flex-row items-center gap-0 bg-white p-2 rounded-xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none print:rounded-none select-none break-inside-avoid">
      {/* ================= FRONT SIDE ================= */}
      <div className="w-[3.375in] h-[2.125in] bg-white border border-slate-300 rounded-lg overflow-hidden relative flex flex-col justify-between shrink-0 box-border shadow-xs print:shadow-none print:border-slate-400">
        {/* Top Header Banner */}
        <div className="bg-[#7A2828] text-white px-2 py-1 flex items-center gap-1.5 shadow-xs shrink-0">
          <div className="relative w-6 h-6 rounded-full bg-white p-0.5 shrink-0 overflow-hidden shadow-xs">
            <Image
              src="/logo.png"
              alt="WSI Logo"
              width={24}
              height={24}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 leading-tight text-center pr-2">
            <h3 className="text-[8.5px] font-black tracking-wider uppercase text-white font-sans">
              WSI LEARNING RESOURCE CENTER
            </h3>
            <p className="text-[5px] text-amber-100/90 font-medium tracking-tight">
              Lot 3 South Horizon I, Governor&apos;s Drive, Brgy. Cabilang Baybay Carmona Cavite
            </p>
          </div>
        </div>

        {/* Card Body with Wave Background */}
        <div className="flex-1 px-2.5 pt-1.5 pb-1 flex flex-col justify-between relative bg-gradient-to-br from-pink-50/50 via-white to-rose-50/30 overflow-hidden">
          {/* Subtle Decorative Curves in Background */}
          <div className="absolute right-0 bottom-0 w-32 h-20 bg-rose-200/20 rounded-full blur-xl pointer-events-none" />

          {/* Top Section: Photo and Student Details Side by Side */}
          <div className="flex items-center gap-2 relative z-10">
            {/* Student Photo */}
            <div className="relative w-[0.75in] h-[0.75in] rounded-lg overflow-hidden bg-slate-100 border-2 border-[#7A2828]/25 shadow-xs shrink-0 flex items-center justify-center">
              {student.photo_url ? (
                <Image
                  src={student.photo_url}
                  alt={student.full_name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
              )}
            </div>

            {/* Student Information Fields */}
            <div className="flex-1 min-w-0 text-[7px] space-y-0.5 leading-snug">
              <div className="flex items-start">
                <span className="w-11 text-slate-500 font-semibold uppercase">Name</span>
                <span className="text-slate-600 font-bold mr-1">:</span>
                <span className="font-extrabold text-slate-900 truncate uppercase text-[7.5px] flex-1">
                  {student.full_name}
                </span>
              </div>
              <div className="flex items-start">
                <span className="w-11 text-slate-500 font-semibold uppercase">Student ID</span>
                <span className="text-slate-600 font-bold mr-1">:</span>
                <span className="font-mono font-black text-[#7A2828] text-[7.5px] flex-1">
                  {student.library_id}
                </span>
              </div>
              <div className="flex items-start">
                <span className="w-11 text-slate-500 font-semibold uppercase">Grade</span>
                <span className="text-slate-600 font-bold mr-1">:</span>
                <span className="font-bold text-slate-800 flex-1 truncate">
                  {student.grade_level}
                </span>
              </div>
              <div className="flex items-start">
                <span className="w-11 text-slate-500 font-semibold uppercase">Address</span>
                <span className="text-slate-600 font-bold mr-1">:</span>
                <span className="text-slate-700 text-[6px] leading-tight line-clamp-2 flex-1 font-medium">
                  {student.address || "Carmona, Cavite"}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Section: Centered 1D Barcode */}
          <div className="flex flex-col items-center justify-center relative z-10 w-full overflow-hidden pt-0.5">
            <div className="bg-white px-2 py-0.5 rounded shadow-2xs border border-slate-100 flex items-center justify-center max-w-full">
              <Barcode
                value={student.library_id}
                width={1.2}
                height={40}
                fontSize={12}
                margin={0}
              />
            </div>
          </div>
        </div>

        {/* Bottom Decorative Footer Strip */}
        <div className="h-1 bg-gradient-to-r from-[#7A2828] via-[#9B3A3A] to-[#7A2828] w-full shrink-0" />
      </div>

      {/* ================= FOLD / CUT GUIDE LINE ================= */}
      <div
        className="h-[2.125in] border-r-2 border-dashed border-gray-300 shrink-0 mx-1 print:mx-0.5"
        title="Fold Line"
      />

      {/* ================= BACK SIDE ================= */}
      <div className="w-[3.375in] h-[2.125in] bg-white border border-slate-300 rounded-lg p-2.5 flex flex-col justify-between shrink-0 box-border relative overflow-hidden shadow-xs print:shadow-none print:border-slate-400">
        {/* Subtle Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none text-[15px] font-black tracking-widest text-slate-900 rotate-[-12deg]">
          TERMS AND CONDITIONS
        </div>

        {/* Terms & Conditions Bullet Points */}
        <div className="relative z-10">
          <ul className="space-y-1 text-[6.2px] text-slate-700 leading-[1.25] list-disc list-outside pl-3">
            <li>
              The <strong className="font-bold text-slate-900">WSILRC</strong> Card must be use in Library premises for borrowing books and other LRC Materials.
            </li>
            <li>
              The <strong className="font-bold text-slate-900">WSILRC</strong> Card is not transferable and was issued for personal use only and must not be lent, shared, or transferred to others.
            </li>
            <li>
              The <strong className="font-bold text-slate-900">WSILRC</strong> Card is required for library entry, attendance tracking, library services.
            </li>
            <li>
              Students must report any lost or damaged WSILRC card to the school Librarian and administration immediately. A replacement fee may apply.
            </li>
          </ul>
        </div>

        {/* Signatures Block */}
        <div className="pt-1.5 border-t border-slate-200 grid grid-cols-2 gap-3 text-center relative z-10 shrink-0">
          <div className="flex flex-col items-center">
            <div className="w-20 border-b border-slate-400 mb-0.5" />
            <span className="text-[7.5px] font-bold text-slate-900 leading-tight">
              Ester V. Robles
            </span>
            <span className="text-[6px] text-slate-500 font-medium">
              School Librarian
            </span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-20 border-b border-slate-400 mb-0.5" />
            <span className="text-[7.5px] font-bold text-slate-900 leading-tight">
              Jeffrey P. Lalley
            </span>
            <span className="text-[6px] text-slate-500 font-medium">
              School Head
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
