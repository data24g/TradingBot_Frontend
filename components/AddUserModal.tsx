
import React, { useState } from 'react';
import axios from 'axios';
import { ApiUser } from '../types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: (newUser: ApiUser) => void;
}

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onUserAdded }) => {
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setUsername('');
    setApiKey('');
    setApiSecret('');
    setError('');
    setIsLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !apiKey || !apiSecret) {
      setError('All fields are required.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const response = await axios.post('https://api.binancebotpro.com/api/users', {
        username,
        apiKey,
        apiSecret,
      });

      // Map the response to the ApiUser type before passing it up
      const newUser: ApiUser = {
        id: response.data.id,
        username: response.data.username,
        isActive: response.data.tradingConfig.active, // Assuming this mapping
        tradesToday: response.data.tradesToday,
        lastTradeDate: response.data.lastTradeDate,
      };

      onUserAdded(newUser);
      handleClose();

    } catch (err) {
      console.error('Failed to create user:', err);
      if (axios.isAxiosError(err) && err.response) {
        setError(`Failed to create user: ${err.response.data.message || err.message}`);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-white">Add New User</h3>
        </div>
        <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow text-white"
                        required
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
                    <input
                        id="apiKey"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow text-white"
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                    />
                </div>
                 <div>
                    <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-300 mb-1">API Secret</label>
                    <input
                        id="apiSecret"
                        type="password"
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow text-white"
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                    />
                </div>
                {error && <p className="text-sm text-accent-red">{error}</p>}
            </div>
            <div className="flex justify-end gap-4 p-4 bg-gray-900/50 rounded-b-lg">
                <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-md bg-gray-600 text-white font-semibold hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:ring-offset-gray-800"
                    disabled={isLoading}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 rounded-md bg-accent-yellow text-gray-900 font-semibold hover:bg-accent-yellow-dark transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-yellow focus:ring-offset-gray-800 disabled:bg-accent-yellow/50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                >
                    {isLoading ? 'Creating...' : 'Create User'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;