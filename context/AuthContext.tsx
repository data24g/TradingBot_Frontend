import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthContextType {
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation(); // Hook này giúp detect khi chuyển trang

  // Khởi tạo state từ localStorage
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token');
  });

  const isAuthenticated = !!token;

  // TỰ ĐỘNG ĐỒNG BỘ:
  // Mỗi khi URL thay đổi (ví dụ: từ Login -> Home), ta kiểm tra lại localStorage
  // Điều này giúp Login.tsx hoạt động độc lập mà AuthContext vẫn cập nhật kịp thời.
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);
  }, [location.pathname]);

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};