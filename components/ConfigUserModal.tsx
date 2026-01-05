
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ApiUser } from '../types';

interface ConfigUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ApiUser;
  onConfigUpdated: (updatedUser: ApiUser) => void;
}

const ConfigUserModal: React.FC<ConfigUserModalProps> = ({ isOpen, onClose, user, onConfigUpdated }) => {
  const [orderSize, setOrderSize] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (user) {
        setOrderSize(user.orderSizeUSD?.toString() || '');
    }
  }, [user]);

  const resetForm = () => {
    setError('');
    setSuccessMessage('');
    setIsLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sizeValue = Number(orderSize);

    if (isNaN(sizeValue) || sizeValue <= 0) {
      setError('Please enter a valid, positive number for the order size.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      await axios.put(`https://api.binancebotpro.com/api/users/${user.id}/config`, {
        orderSizeUSD: sizeValue,
      });

      // Optimistically update the parent component's state
      onConfigUpdated({ ...user, orderSizeUSD: sizeValue });
      
      setSuccessMessage('Configuration updated successfully!');
      setTimeout(() => {
        handleClose();
      }, 1500);

    } catch (err) {
      console.error('Failed to update config:', err);
      if (axios.isAxiosError(err) && err.response) {
        setError(`Update failed: ${err.response.data.message || err.message}`);
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
          <h3 className="text-xl font-semibold text-white">Configure Order Size for <span className="text-accent-yellow">{user.username}</span></h3>
        </div>
        <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
                <div>
                    <label htmlFor="orderSize" className="block text-sm font-medium text-gray-300 mb-1">Order Size (USD)</label>
                    <input
                        id="orderSize"
                        type="number"
                        value={orderSize}
                        onChange={(e) => setOrderSize(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow text-white"
                        required
                        placeholder="e.g., 1000"
                        min="0"
                        step="any"
                        disabled={isLoading}
                    />
                </div>
                {error && <p className="text-sm text-accent-red">{error}</p>}
                {successMessage && <p className="text-sm text-accent-green">{successMessage}</p>}
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
                    {isLoading ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ConfigUserModal;
