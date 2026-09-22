"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  GraduationCap,
  IdCard,
} from "lucide-react";
import {
  registerStudent,
  getStudents,
  type Student,
} from "@/app/actions/studentActions";

export default function StudentsPage() {
  const [fullName, setFullName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastRegistered, setLastRegistered] = useState<Student | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load students from database
  const loadStudents = useCallback(async () => {
    setIsLoadingList(true);
    const result = await getStudents();
    setIsLoadingList(false);
    if (result.success) {
      setStudents(result.students);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // Handle student registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !gradeLevel.trim()) {
      setErrorMessage("Please provide both full name and grade/section.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await registerStudent(fullName.trim(), gradeLevel.trim());
    setIsSubmitting(false);

    if (!result.success || !result.student) {
      setErrorMessage(result.error || "Failed to register student.");
    } else {
      setSuccessMessage(
        `Successfully registered ${result.student.full_name} with Library ID: ${result.student.library_id}`
      );
      setLastRegistered(result.student);
      setFullName("");
      setGradeLevel("");
      // Reload student list
      loadStudents();
    }
  };

  // Filter students by name, grade, or ID
  const filteredStudents = students.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(query) ||
      s.grade_level.toLowerCase().includes(query) ||
      s.library_id.toLowerCase().includes(query)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-600" />
          Student Management & Library IDs
        </h1>
        <p className="text-sm text-slate-500">
          Enroll students, generate automated sequential Library IDs (WSI-S-XXXX), and manage borrowing eligibility.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Registration Form */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 sticky top-6">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Enroll New Student
            </h2>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Grade Level / Section <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="e.g. Grade 7 - Diamond"
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Sequential ID (e.g. WSI-S-0001) will be assigned automatically.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Register Student
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message Card */}
            {successMessage && lastRegistered && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-900 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Registration Successful
                  </span>
                </div>
                <div className="bg-white border border-emerald-200 rounded-lg p-3 text-center space-y-1">
                  <span className="text-xs text-slate-400 block font-medium">Assigned Library ID</span>
                  <span className="text-lg font-mono font-bold text-blue-700 block">
                    {lastRegistered.library_id}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 block">
                    {lastRegistered.full_name}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {lastRegistered.grade_level}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Students Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-800">
                  Enrolled Students ({students.length})
                </h2>
              </div>

              {/* Search filter */}
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, ID, or grade..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Library ID</th>
                    <th className="px-5 py-3">Full Name</th>
                    <th className="px-5 py-3">Grade / Section</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingList ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
                        Loading student records...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                        {searchQuery ? "No students match your search." : "No students registered yet."}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.library_id} className="hover:bg-slate-50 transition">
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                            {s.library_id}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900">
                          {s.full_name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs">
                          {s.grade_level}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            <IdCard className="h-3 w-3 text-slate-400" />
                            Eligible
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
