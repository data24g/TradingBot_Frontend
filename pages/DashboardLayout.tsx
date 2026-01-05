
import React, { useState, useMemo } from 'react';
import { Outlet, useLocation, useOutletContext } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { LogoIcon, MenuIcon, PlusIcon, RefreshIcon } from '../components/icons';
import { ApiUser } from '../types';
import AddUserModal from '../components/AddUserModal';

const getTitleFromPathname = (pathname: string): string => {
  if (pathname.startsWith('/monitor/')) {
    const symbol = pathname.split('/').pop()?.replace('USDT', '') || 'Chart';
    return `${symbol} Chart`;
  }

  switch (pathname) {
    case '/users':
      return 'User Management';
    case '/history':
      return 'Trade History';
    case '/monitor':
      return 'Coin Monitor';
    default:
      return 'Dashboard';
  }
};

// Define the type for the context that will be passed down to child routes
export type UsersContextType = {
  users: ApiUser[];
  setUsers: React.Dispatch<React.SetStateAction<ApiUser[]>>;
  handleUserAdded: (newUser: ApiUser) => void;
};

// Custom hook for child components to easily access the context
export const useUsersContext = () => useOutletContext<UsersContextType>();


const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Lifted state for users, to be passed down via Outlet context
  const [users, setUsers] = useState<ApiUser[]>([]);

  const pageTitle = useMemo(() => getTitleFromPathname(location.pathname), [location.pathname]);

  const handleUserAdded = (newUser: ApiUser) => {
    // Add the new user to the list and re-sort
    setUsers(prevUsers => [...prevUsers, newUser].sort((a, b) => a.username.localeCompare(b.username)));
  };
  
  const handleRefresh = () => {
    // A simple yet effective way to force a full data re-fetch on all components
    window.location.reload();
  }

  return (
    <>
      <div className="min-h-screen bg-gray-900 text-gray-200">
        {/* Backdrop for mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black opacity-50 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <div className="flex flex-col md:ml-64">
          {/* Redesigned Header for mobile with Quick Actions */}
          <header className="md:hidden bg-accent-yellow p-4 grid grid-cols-3 items-center sticky top-0 z-10 border-b border-gray-900/20 shadow-md">
            {/* Left side: Menu button */}
            <div className="justify-self-start">
              <button onClick={() => setIsSidebarOpen(true)} aria-label="Open sidebar" className="text-gray-800 hover:text-black p-2 rounded-full hover:bg-black/10 transition-colors">
                <MenuIcon className="w-6 h-6" />
              </button>
            </div>
            
            {/* Center: Page Title */}
            <h1 className="text-lg font-bold text-gray-900 text-center justify-self-center whitespace-nowrap">{pageTitle}</h1>

            {/* Right side: Quick Actions */}
            <div className="flex items-center gap-1 justify-self-end">
              {/* Quick Action: Refresh Data (Global) */}
              <button 
                onClick={handleRefresh}
                className="p-2 rounded-full text-gray-800 hover:bg-black/10 transition-colors"
                title="Refresh page data"
              >
                <RefreshIcon className="w-5 h-5" />
              </button>

              {/* Quick Action: Add User (Contextual) */}
              {location.pathname === '/users' && (
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="p-2 rounded-full text-gray-800 hover:bg-black/10 transition-colors"
                    title="Add User"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </header>
          
          {/* Redesigned Header for Desktop */}
          <header className="hidden md:flex bg-gray-800 border-b border-gray-700 h-20 items-center justify-between px-10 sticky top-0 z-10">
             <h1 className="text-2xl font-bold text-white">{pageTitle}</h1>
             <div className="flex items-center gap-4">
                {/* Quick Action: Refresh Data (Global) */}
                <button 
                  onClick={handleRefresh}
                  className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                  title="Refresh page data"
                >
                  <RefreshIcon className="w-5 h-5" />
                </button>

                {/* Quick Action: Add User (Contextual) */}
                {location.pathname === '/users' && (
                  <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-900 bg-accent-yellow hover:bg-accent-yellow-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-yellow focus:ring-offset-gray-800 transition-colors"
                  >
                      <PlusIcon className="w-5 h-5 mr-2 -ml-1" />
                      Add User
                  </button>
                )}
             </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
            {/* Pass state and handlers down to child components (Users.tsx) */}
            <Outlet context={{ users, setUsers, handleUserAdded }} />
          </main>
        </div>
      </div>
       <AddUserModal 
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onUserAdded={handleUserAdded}
      />
    </>
  );
};

export default DashboardLayout;
