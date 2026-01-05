
import React, { useState } from 'react';
import axios from 'axios';
import { ApiUser } from '../types';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ApiUser;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, user }) => {
  const [newApiKey, setNewApiKey] = useState('');
  const [newApiSecret, setNewApiSecret] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resetForm = () => {
    setNewApiKey('');
    setNewApiSecret('');
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
    if (!newApiKey || !newApiSecret) {
      setError('Both API Key and Secret are required.');
      return;
    }
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      await axios.put(`https://api.binancebotpro.com/api/users/${user.id}/credentials`, {
        newApiKey,
        newApiSecret,
      });
      setSuccessMessage('Credentials updated successfully!');
      setTimeout(() => {
        handleClose();
      }, 1500); // Close modal after 1.5 seconds

    } catch (err) {
      console.error('Failed to update credentials:', err);
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
          <h3 className="text-xl font-semibold text-white">Edit Credentials for <span className="text-accent-yellow">{user.username}</span></h3>
        </div>
        <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
                <div>
                    <label htmlFor="newApiKey" className="block text-sm font-medium text-gray-300 mb-1">New API Key</label>
                    <input
                        id="newApiKey"
                        type="password"
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow text-white"
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                    />
                </div>
                 <div>
                    <label htmlFor="newApiSecret" className="block text-sm font-medium text-gray-300 mb-1">New API Secret</label>
                    <input
                        id="newApiSecret"
                        type="password"
                        value={newApiSecret}
                        onChange={(e) => setNewApiSecret(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow text-white"
                        required
                        autoComplete="new-password"
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
                    {isLoading ? 'Updating...' : 'Update Credentials'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;