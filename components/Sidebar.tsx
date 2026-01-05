import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UsersIcon, HistoryIcon, MonitorIcon, LogoutIcon, LogoIcon, CloseIcon } from './icons';
import Modal from './Modal';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isDCAMenuOpen, setIsDCAMenuOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    // Auto expand DCA menu when on /dca page
    if (location.pathname === '/dca') {
      setIsDCAMenuOpen(true);
    }
  }, [location.pathname]);

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    logout();
    setIsLogoutModalOpen(false);
  };

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center p-3 my-1 rounded-lg transition-colors ${isActive ? 'bg-accent-yellow text-gray-900 font-semibold' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <>
      <aside className={`w-64 bg-gray-800 p-4 flex flex-col h-screen fixed z-30 transition-transform transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex items-center justify-between mb-8">
          <div className="hidden md:flex items-center">
            <LogoIcon className="h-8 w-8 text-accent-yellow mr-2" />
            <h1 className="text-2xl font-bold text-white">TradingBot</h1>
          </div>
          {/* This empty div is for alignment on mobile when the title is in the header */}
          <div className="md:hidden"></div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white" aria-label="Close sidebar">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-grow">
          <NavLink to="/monitor" className={navLinkClasses}>
            <MonitorIcon className="w-5 h-5 mr-3" />
            Theo dõi thị trường và giao dịch
          </NavLink>
          <NavLink to="/strategy" className={navLinkClasses}>
            <MonitorIcon className="w-5 h-5 mr-3" />
            Chiến lược đánh Future
          </NavLink>

          {/* DCA Menu with Submenu */}
          <div>
            <button
              onClick={() => {
                if (location.pathname === '/dca') {
                  setIsDCAMenuOpen(!isDCAMenuOpen);
                } else {
                  navigate('/dca?tab=REAL');
                  setIsDCAMenuOpen(true);
                }
              }}
              className={`w-full flex items-center p-3 my-1 rounded-lg transition-colors ${
                location.pathname === '/dca' 
                  ? 'bg-accent-yellow text-gray-900 font-semibold' 
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <MonitorIcon className="w-5 h-5 mr-3" />
              Đầu tư dài hạn DCA
            </button>
            {isDCAMenuOpen && location.pathname === '/dca' && (
              <div className="ml-8 mt-1 space-y-1">
                <button
                  onClick={() => {
                    navigate('/dca?tab=REAL');
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center p-2 text-xs rounded-lg transition-colors ${
                    (location.search.includes('tab=REAL') || !location.search)
                      ? 'bg-green-600/20 text-green-400 font-semibold border-l-2 border-green-400'
                      : 'text-gray-500 hover:bg-gray-700/50 hover:text-gray-300'
                  }`}
                >
                  Plan REAL
                </button>
                <button
                  onClick={() => {
                    navigate('/dca?tab=BACKTEST');
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center p-2 text-xs rounded-lg transition-colors ${
                    location.search.includes('tab=BACKTEST')
                      ? 'bg-yellow-600/20 text-accent-yellow font-semibold border-l-2 border-accent-yellow'
                      : 'text-gray-500 hover:bg-gray-700/50 hover:text-gray-300'
                  }`}
                >
                  Backtest
                </button>
              </div>
            )}
          </div>

          <NavLink to="/users" className={navLinkClasses}>
            <UsersIcon className="w-5 h-5 mr-3" />
            Quản lý người dùng
          </NavLink>
          <NavLink to="/history" className={navLinkClasses}>
            <HistoryIcon className="w-5 h-5 mr-3" />
            Lịch sử giao dịch
          </NavLink>

        </nav>
        <div>
          <button
            onClick={handleLogoutClick}
            className="flex items-center w-full p-3 rounded-lg text-gray-400 hover:bg-red-500/20 hover:text-accent-red transition-colors"
          >
            <LogoutIcon className="w-5 h-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
        title="Confirm Logout"
      >
        <p>Are you sure you want to log out of the system?</p>
      </Modal>
    </>
  );
};

export default Sidebar;
