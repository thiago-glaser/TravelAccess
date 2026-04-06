const fs = require('fs');
let c = fs.readFileSync('components/Navbar.js', 'utf8');

const linkStr = `                                    </Link>
                                    <Link
                                        href="/dashboard/other-expenses"
                                        onClick={() => setIsDataOpen(false)}
                                        className={\`flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors \${pathname === '/dashboard/other-expenses' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'}\`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        Other Expenses
                                    </Link>`;

c = c.replace(/{t\('navbar\.data\.maintenance'\)}\n                                    <\/Link>/, `{t('navbar.data.maintenance')}\n${linkStr}`);

const linkStrMob = `                                    </Link>
                                    <Link
                                        href="/dashboard/other-expenses"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={\`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all \${pathname === '/dashboard/other-expenses' ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}\`}
                                    >
                                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        Other Expenses
                                    </Link>`;

c = c.replace(/{t\('navbar\.data\.maintenance'\)}\n                                    <\/Link>/, `{t('navbar.data.maintenance')}\n${linkStrMob}`);

fs.writeFileSync('components/Navbar.js', c);
