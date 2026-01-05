import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { LogoIcon } from '../components/icons';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Dùng useNavigate để chuyển trang sau khi login thành công
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Gọi API trực tiếp
      const response = await axios.post('https://api.binancebotpro.com/api/auth/login', {
        identifier: email, // Map email vào field identifier
        password: password
      });

      // 2. Kiểm tra và lấy token từ response
      // Response structure: { token: "..." }
      if (response.data && response.data.token) {
        const { token } = response.data;

        // 3. Lưu token vào localStorage
        localStorage.setItem('token', token);

        // 4. Chuyển hướng về trang Dashboard (hoặc trang chủ '/')
        // Lưu ý: Các component bảo vệ (Protected Routes) cần check localStorage để cho phép truy cập
        navigate('/'); 
      } else {
        setError('Phản hồi từ server không hợp lệ (thiếu token).');
      }

    } catch (err: any) {
      console.error('Login error:', err);
      
      // Xử lý thông báo lỗi chi tiết
      if (err.response) {
        // Server trả về lỗi (4xx, 5xx)
        // Ưu tiên lấy message từ server trả về, nếu không có thì dùng message mặc định
        const serverMsg = err.response.data?.message || err.response.data?.error;
        setError(serverMsg || 'Thông tin đăng nhập không chính xác.');
      } else if (err.request) {
        // Không nhận được phản hồi từ server
        setError('Không thể kết nối đến server. Vui lòng kiểm tra mạng.');
      } else {
        // Lỗi setup request
        setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-lg shadow-lg">
        <div className="flex flex-col items-center">
          <LogoIcon className="h-12 w-12 text-accent-yellow mb-2"/>
          <h2 className="text-3xl font-bold text-center text-white">
            TradingBot Dashboard
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Sign in to your account
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-accent-yellow focus:border-accent-yellow focus:z-10 sm:text-sm rounded-t-md"
                placeholder="Email address (admin@gmail.com)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-accent-yellow focus:border-accent-yellow focus:z-10 sm:text-sm rounded-b-md"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded p-2">
              <p className="text-sm text-red-400 text-center">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-md text-gray-900 bg-accent-yellow hover:bg-accent-yellow-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-yellow focus:ring-offset-gray-800 transition-colors disabled:bg-accent-yellow/50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in'}
            </button>
          </div>
          <div className="text-sm text-center">
            <span className="text-gray-400">Don't have an account? </span>
            <Link to="/register" className="font-medium text-accent-yellow hover:text-accent-yellow-dark">
              Register here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;