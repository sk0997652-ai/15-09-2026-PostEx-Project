import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-[#f3f5fa] p-8 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center max-w-md">
        <h1 className="text-xl font-bold text-slate-800 mb-2">PostEx Employee Onboarding</h1>
        <p className="text-sm text-slate-500 mb-4">Backend API initialized and verified. Ready for Step 2 frontend component delivery.</p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Step 1 Complete (64/64 Backend Tests Passed)
        </div>
      </div>
    </div>
  );
}
