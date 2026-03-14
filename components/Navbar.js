'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useState, useRef, useEffect } from 'react';

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isReportsOpen, setIsReportsOpen] = useState(false);
    const [isDataOpen, setIsDataOpen] = useState(false);
    const [isMapsOpen, setIsMapsOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [mobileReportsOpen, setMobileReportsOpen] = useState(false);
    const [mobileMapsOpen, setMobileMapsOpen] = useState(false);
    const [mobileDataOpen, setMobileDataOpen] = useState(false);
    const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwdStatus, setPwdStatus] = useState({ loading: false, error: '', success: '' });
    const [demoStatus, setDemoStatus] = useState({ loading: false, message: '' });

    const dropdownRef = useRef(null);
    const dropdownReportsRef = useRef(null);
    const dropdownDataRef = useRef(null);
    const dropdownMapsRef = useRef(null);
    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsSettingsOpen(false);
            }
            if (dropdownReportsRef.current && !dropdownReportsRef.current.contains(event.target)) {
                setIsReportsOpen(false);
            }
            if (dropdownDataRef.current && !dropdownDataRef.current.contains(event.target)) {
                setIsDataOpen(false);
            }
            if (dropdownMapsRef.current && !dropdownMapsRef.current.contains(event.target)) {
                setIsMapsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch user profile on mount or when navigation occurs
    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.user) {
                    setUserProfile(data.user);
                } else {
                    setUserProfile(null);
                }
            })
            .catch(err => {
                console.error('Failed to load user profile:', err);
                setUserProfile(null);
            });
    }, [pathname]);

    // Hide navbar on login and register pages
    if (pathname === '/login' || pathname === '/register') {
        return null;
    }

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        }
        window.location.href = '/login';
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (pwdForm.newPassword !== pwdForm.confirmPassword) {
            setPwdStatus({ loading: false, error: 'New passwords do not match', success: '' });
            return;
        }

        setPwdStatus({ loading: true, error: '', success: '' });
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword })
            });
            const data = await res.json();
            if (data.success) {
                setPwdStatus({ loading: false, error: '', success: 'Password updated successfully!' });
                setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setTimeout(() => setIsPasswordModalOpen(false), 2000);
            } else {
                setPwdStatus({ loading: false, error: data.error || 'Failed to update userPassword', success: '' });
            }
        } catch (err) {
            setPwdStatus({ loading: false, error: 'An error occurred', success: '' });
        }
    };
    const handleSetupDemo = async (mode = 'setup') => {
        let confirmMsg = 'Initialize demo user and data?';
        if (mode === 'force') confirmMsg = 'Warning: This will DELETE all existing demo user data and recreate it. Continue?';
        if (mode === 'clean') confirmMsg = 'Warning: This will DELETE all existing demo user data. Continue?';

        if (!confirm(confirmMsg)) return;

        setDemoStatus({ loading: true, message: 'Processing...' });
        try {
            let url = '/api/setup-demo';
            if (mode === 'force') url += '?force=true';
            if (mode === 'clean') url += '?clean=true';

            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setIsSettingsOpen(false);
            } else {
                alert('Error: ' + data.error);
            }
        } catch (err) {
            alert('An error occurred during demo setup.');
        } finally {
            setDemoStatus({ loading: false, message: '' });
        }
    };
    const isDataActive = pathname.startsWith('/dashboard/cars') || pathname.startsWith('/dashboard/fuel') || pathname.startsWith('/dashboard/insurance') || pathname.startsWith('/dashboard/maintenance') || pathname.startsWith('/dashboard/devices') || pathname.startsWith('/dashboard/bluetooth');
    const isSettingsActive = pathname.startsWith('/dashboard/keys') || isPasswordModalOpen;
    return (
        <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="flex items-center group transition-transform duration-200 active:scale-95">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-blue-200 shadow-lg group-hover:rotate-6 transition-transform">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight leading-none">
                                    TravelAccess
                                </span>
                                {userProfile?.isDemo && (
                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mt-0.5 self-start">
                                        Demo Mode
                                    </span>
                                )}
                            </div>
                        </Link>
                    </div>
                    
                    {/* Mobile menu button */}
                    <div className="flex md:hidden items-center">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="text-gray-500 hover:text-blue-600 focus:outline-none p-2 rounded-lg transition-colors"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {isMobileMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                )}
                            </svg>
                        </button>
                    </div>

                    {/* Desktop menu */}
                    <div className="hidden md:flex items-center space-x-1">
                        <Link
                            href="/"
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${pathname === '/'
                                ? 'text-blue-600 bg-blue-50/80 shadow-sm'
                                : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Sessions
                            </div>
                        </Link>
                        {/* Reports Dropdown */}
                        <div className="relative" ref={dropdownReportsRef}>
                            <button
                                onClick={() => setIsReportsOpen(!isReportsOpen)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${pathname.startsWith('/reports')
                                    ? 'text-blue-600 bg-blue-50/80 shadow-sm'
                                    : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 2v-6m0 10h.01M3 21h18M3 7h18M3 11h18M3 15h18" />
                                    </svg>
                                </div>
                                Reports
                                <svg className={`w-3 h-3 transition-transform duration-200 ${isReportsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isReportsOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-[60] transform origin-top transition-all duration-200 animate-in fade-in zoom-in-95">
                                    <Link
                                        href="/reports"
                                        onClick={() => setIsReportsOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/reports' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                        </svg>
                                        Detailed
                                    </Link>
                                    <Link
                                        href="/reports/monthly"
                                        onClick={() => setIsReportsOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/reports/monthly' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Monthly
                                    </Link>
                                    <Link
                                        href="/reports/fuel"
                                        onClick={() => setIsReportsOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/reports/fuel' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        Fuel
                                    </Link>
                                </div>
                            )}
                        </div>
                        {/* Maps Dropdown */}
                        <div className="relative" ref={dropdownMapsRef}>
                            <button
                                onClick={() => setIsMapsOpen(!isMapsOpen)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${pathname.startsWith('/map') || pathname.startsWith('/heatmap')
                                    ? 'text-blue-600 bg-blue-50/80 shadow-sm'
                                    : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                    </svg>
                                </div>
                                Maps
                                <svg className={`w-3 h-3 transition-transform duration-200 ${isMapsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isMapsOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-[60] transform origin-top transition-all duration-200 animate-in fade-in zoom-in-95">
                                    <Link
                                        href="/map"
                                        onClick={() => setIsMapsOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/map' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                        </svg>
                                        Routes
                                    </Link>
                                    <Link
                                        href="/heatmap"
                                        onClick={() => setIsMapsOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/heatmap' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        Heat Map
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Data Dropdown */}
                        <div className="relative" ref={dropdownDataRef}>
                            <button
                                onClick={() => setIsDataOpen(!isDataOpen)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${isDataActive
                                    ? 'text-blue-600 bg-blue-50/80 shadow-sm'
                                    : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                    </svg>
                                </div>
                                Data
                                <svg className={`w-3 h-3 transition-transform duration-200 ${isDataOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isDataOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-[60] transform origin-top transition-all duration-200 animate-in fade-in zoom-in-95">
                                    <Link
                                        href="/dashboard/cars"
                                        onClick={() => setIsDataOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/dashboard/cars' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Cars
                                    </Link>
                                    <Link
                                        href="/dashboard/fuel"
                                        onClick={() => setIsDataOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/dashboard/fuel' ? 'text-green-600 bg-green-50' : 'text-gray-600 hover:text-green-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                        </svg>
                                        Fuel
                                    </Link>
                                    <Link
                                        href="/dashboard/insurance"
                                        onClick={() => setIsDataOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/dashboard/insurance' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        Insurance
                                    </Link>
                                    <Link
                                        href="/dashboard/maintenance"
                                        onClick={() => setIsDataOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/dashboard/maintenance' ? 'text-purple-600 bg-purple-50' : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        Maintenance
                                    </Link>
                                    <Link
                                        href="/dashboard/devices"
                                        onClick={() => setIsDataOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/dashboard/devices' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        Devices
                                    </Link>
                                    <Link
                                        href="/dashboard/bluetooth"
                                        onClick={() => setIsDataOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/dashboard/bluetooth' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.5 10L10.5 4v16l-5-6M10.5 12l4-4M10.5 12l4 4" />
                                        </svg>
                                        Bluetooth
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Settings Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${isSettingsActive
                                    ? 'text-blue-600 bg-blue-50/80 shadow-sm'
                                    : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    {userProfile?.googleAvatarUrl ? (
                                        <img src={userProfile.googleAvatarUrl} alt="Avatar" className="w-5 h-5 rounded-full" />
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </div>
                                Settings
                                <svg className={`w-3 h-3 transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isSettingsOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl py-2 z-[60] transform origin-top transition-all duration-200 animate-in fade-in zoom-in-95">
                                    <button
                                        onClick={() => {
                                            if (userProfile?.isDemo) return;
                                            setIsSettingsOpen(false);
                                            setIsPasswordModalOpen(true);
                                            setPwdStatus({ loading: false, error: '', success: '' });
                                            setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${userProfile?.isDemo ? 'text-gray-400 cursor-not-allowed opacity-60' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                        Change Password
                                    </button>
                                    {!userProfile?.isDemo && (
                                        <Link
                                            href="/dashboard/keys"
                                            onClick={() => setIsSettingsOpen(false)}
                                            className={`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${pathname === '/dashboard/keys' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}`}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                            </svg>
                                            API Keys
                                        </Link>
                                    )}

                                    {userProfile?.isAdmin && (
                                        <>
                                            <div className="border-t border-gray-100 my-1 mx-2"></div>
                                            <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                Admin Tools
                                            </div>
                                            <button
                                                onClick={() => handleSetupDemo('setup')}
                                                disabled={demoStatus.loading}
                                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.996 1.414l-.5 1.5a2 2 0 01-1.898 1.367c-1.12 0-2.032-.912-2.032-2.032v-.5a2 2 0 011.367-1.898l1.5-.5a2 2 0 001.414-1.996l-.477-2.387a2 2 0 00-.547-1.022L11 2.5a2 2 0 00-2-1.5H3a2 2 0 00-2 2v6a2 2 0 00.5 1.5l1.5.5a2 2 0 011.367 1.898v.5a2 2 0 01-2.032 2.032c-1.12 0-2.032-.912-2.032-2.032v-.5a2 2 0 011.367-1.898l1.5-.5a2 2 0 001.414-1.996l-.477-2.387a2 2 0 00-.547-1.022L13 2.5" />
                                                </svg>
                                                {demoStatus.loading ? 'Processing...' : 'Setup Demo Data'}
                                            </button>
                                            <button
                                                onClick={() => handleSetupDemo('force')}
                                                disabled={demoStatus.loading}
                                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Force Demo Reset
                                            </button>
                                            <button
                                                onClick={() => handleSetupDemo('clean')}
                                                disabled={demoStatus.loading}
                                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Clean Demo Data
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                        >
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Logout
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu panel */}
            {isMobileMenuOpen && (
                <div className="md:hidden bg-white border-t border-gray-100 p-4 space-y-2 max-h-[80vh] overflow-y-auto shadow-inner animate-in slide-in-from-top-2">
                    <Link
                        href="/"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Sessions
                    </Link>
                    
                    {/* Reports Section */}
                    <button
                        onClick={() => setMobileReportsOpen(!mobileReportsOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-gray-400 uppercase tracking-wider hover:bg-gray-50 transition-colors"
                    >
                        Reports
                        <svg className={`w-4 h-4 transition-transform duration-200 ${mobileReportsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {mobileReportsOpen && (
                        <div className="space-y-1 ml-2 border-l-2 border-blue-50 pl-2 animate-in slide-in-from-top-1 duration-200">
                            <Link
                                href="/reports"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/reports' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                Detailed Reports
                            </Link>
                            <Link
                                href="/reports/monthly"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/reports/monthly' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Monthly Reports
                            </Link>
                            <Link
                                href="/reports/fuel"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/reports/fuel' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                Fuel Analytics
                            </Link>
                        </div>
                    )}

                    {/* Maps Section */}
                    <button
                        onClick={() => setMobileMapsOpen(!mobileMapsOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-gray-400 uppercase tracking-wider hover:bg-gray-50 transition-colors pt-2"
                    >
                        Maps
                        <svg className={`w-4 h-4 transition-transform duration-200 ${mobileMapsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {mobileMapsOpen && (
                        <div className="space-y-1 ml-2 border-l-2 border-blue-50 pl-2 animate-in slide-in-from-top-1 duration-200">
                            <Link
                                href="/map"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/map' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                Routes
                            </Link>
                            <Link
                                href="/heatmap"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/heatmap' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Heat Map
                            </Link>
                        </div>
                    )}

                    {/* Data Section */}
                    <button
                        onClick={() => setMobileDataOpen(!mobileDataOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-gray-400 uppercase tracking-wider hover:bg-gray-50 transition-colors pt-2"
                    >
                        Data
                        <svg className={`w-4 h-4 transition-transform duration-200 ${mobileDataOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {mobileDataOpen && (
                        <div className="space-y-1 ml-2 border-l-2 border-blue-50 pl-2 animate-in slide-in-from-top-1 duration-200">
                            <Link
                                href="/dashboard/cars"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/dashboard/cars' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Cars
                            </Link>
                            <Link
                                href="/dashboard/fuel"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/dashboard/fuel' ? 'text-green-600 bg-green-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                                Fuel
                            </Link>
                            <Link
                                href="/dashboard/insurance"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/dashboard/insurance' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Insurance
                            </Link>
                            <Link
                                href="/dashboard/maintenance"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/dashboard/maintenance' ? 'text-purple-600 bg-purple-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Maintenance
                            </Link>
                            <Link
                                href="/dashboard/devices"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/dashboard/devices' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Devices
                            </Link>
                            <Link
                                href="/dashboard/bluetooth"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/dashboard/bluetooth' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.5 10L10.5 4v16l-5-6M10.5 12l4-4M10.5 12l4 4" />
                                </svg>
                                Bluetooth
                            </Link>
                        </div>
                    )}

                    {/* Settings Section */}
                    <button
                        onClick={() => setMobileSettingsOpen(!mobileSettingsOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-gray-400 uppercase tracking-wider hover:bg-gray-50 transition-colors pt-2"
                    >
                        Settings
                        <svg className={`w-4 h-4 transition-transform duration-200 ${mobileSettingsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {mobileSettingsOpen && (
                        <div className="space-y-1 ml-2 border-l-2 border-blue-50 pl-2 animate-in slide-in-from-top-1 duration-200">
                            <button
                                onClick={() => {
                                    if (userProfile?.isDemo) return;
                                    setIsMobileMenuOpen(false);
                                    setIsPasswordModalOpen(true);
                                    setPwdStatus({ loading: false, error: '', success: '' });
                                    setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${userProfile?.isDemo ? 'text-gray-400 cursor-not-allowed opacity-60' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                Change Password
                            </button>
                            {!userProfile?.isDemo && (
                                <Link
                                    href="/dashboard/keys"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${pathname === '/dashboard/keys' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                    API Keys
                                </Link>
                            )}

                            {userProfile?.isAdmin && (
                                <>
                                    <div className="border-t border-gray-100 my-1 mx-2"></div>
                                    <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        Admin Tools
                                    </div>
                                    <button
                                        onClick={() => handleSetupDemo('setup')}
                                        disabled={demoStatus.loading}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-all"
                                    >
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.996 1.414l-.5 1.5a2 2 0 01-1.898 1.367c-1.12 0-2.032-.912-2.032-2.032v-.5a2 2 0 011.367-1.898l1.5-.5a2 2 0 001.414-1.996l-.477-2.387a2 2 0 00-.547-1.022L11 2.5a2 2 0 00-2-1.5H3a2 2 0 00-2 2v6a2 2 0 00.5 1.5l1.5.5a2 2 0 011.367 1.898v.5a2 2 0 01-2.032 2.032c-1.12 0-2.032-.912-2.032-2.032v-.5a2 2 0 011.367-1.898l1.5-.5a2 2 0 001.414-1.996l-.477-2.387a2 2 0 00-.547-1.022L13 2.5" />
                                        </svg>
                                        {demoStatus.loading ? 'Processing...' : 'Setup Demo Data'}
                                    </button>
                                    <button
                                        onClick={() => handleSetupDemo('force')}
                                        disabled={demoStatus.loading}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-all"
                                    >
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Force Demo Reset
                                    </button>
                                    <button
                                        onClick={() => handleSetupDemo('clean')}
                                        disabled={demoStatus.loading}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-all"
                                    >
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Clean Demo Data
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                    
                    <button
                        onClick={() => {
                            setIsMobileMenuOpen(false);
                            handleLogout();
                        }}
                        className="w-full mt-4 flex items-center justify-center gap-2 text-left px-4 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-all border border-red-100"
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                    </button>
                </div>
            )}

            {/* Change Password Modal */}
            {isPasswordModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
                        <button
                            onClick={() => setIsPasswordModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6">
                            Change Password
                        </h3>

                        {pwdStatus.success && (
                            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
                                {pwdStatus.success}
                            </div>
                        )}

                        {pwdStatus.error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                                {pwdStatus.error}
                            </div>
                        )}

                        <form onSubmit={handlePasswordChange} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password (optional if purely Google setup)</label>
                                <input
                                    type="password"
                                    value={pwdForm.currentPassword}
                                    onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400 text-gray-900 bg-white"
                                    placeholder="Enter current password"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={pwdForm.newPassword}
                                    onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400 text-gray-900 bg-white"
                                    placeholder="Enter new password"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={pwdForm.confirmPassword}
                                    onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400 text-gray-900 bg-white"
                                    placeholder="Confirm new password"
                                    required
                                    minLength={6}
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={pwdStatus.loading || pwdStatus.success !== ''}
                                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {pwdStatus.loading ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </nav>
    );
}
