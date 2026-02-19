'use client';

import { useState } from 'react';

export default function ReportsPage() {
    const [loading, setLoading] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        Analytics Reports
                    </h1>
                    <p className="mt-2 text-lg text-gray-600">
                        Generate and export comprehensive tracking summaries for your travel data.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {['Distance Summary', 'Speed Insights', 'Altitude Trends'].map((reportType) => (
                        <div key={reportType} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:border-blue-200 transition-all group cursor-pointer">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                                <svg className="w-6 h-6 text-blue-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 2v-6m0 10h.01M3 21h18" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{reportType}</h3>
                            <p className="text-gray-500 text-sm mb-4">Generate a detailed analysis of your {reportType.toLowerCase()}.</p>
                            <button className="text-blue-600 font-semibold text-sm flex items-center gap-1 group-hover:gap-2 transition-all">
                                Configure Report <span aria-hidden="true">&rarr;</span>
                            </button>
                        </div>
                    ))}
                </div>

                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="p-8 text-center">
                        <div className="py-12">
                            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No Reports Generated</h3>
                            <p className="text-gray-500 max-w-sm mx-auto">
                                Select a report type above to start analyzing your GPS telemetry data.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
