
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogoIcon } from '../components/icons';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    referrerCode: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post('https://api.binancebotpro.com/api/auth/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        referrerCode: formData.referrerCode
      });

      if (response.status === 200) {
        setSuccess('Đăng ký thành công');
        // Optional: Redirect to login after a short delay
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Registration failed. Please try again.');
      } else {
        setError('An unexpected error occurred during registration.');
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
            Create Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Join TradingBot Dashboard
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-accent-yellow focus:border-accent-yellow focus:z-10 sm:text-sm rounded-t-md"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div>
              <input
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-accent-yellow focus:border-accent-yellow focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div>
              <input
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-accent-yellow focus:border-accent-yellow focus:z-10 sm:text-sm"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div>
              <input
                name="confirmPassword"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-accent-yellow focus:border-accent-yellow focus:z-10 sm:text-sm"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
            <div>
              <input
                name="referrerCode"
                type="text"
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-accent-yellow focus:border-accent-yellow focus:z-10 sm:text-sm rounded-b-md"
                placeholder="Referrer Code (Optional)"
                value={formData.referrerCode}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>
          </div>

          {error && <p className="text-sm text-accent-red text-center">{error}</p>}
          {success && <p className="text-sm text-accent-green text-center">{success}</p>}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-md text-gray-900 bg-accent-yellow hover:bg-accent-yellow-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-yellow focus:ring-offset-gray-800 transition-colors disabled:bg-accent-yellow/50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Registering...' : 'Register'}
            </button>
          </div>
          <div className="text-sm text-center">
            <span className="text-gray-400">Already have an account? </span>
            <Link to="/login" className="font-medium text-accent-yellow hover:text-accent-yellow-dark">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;