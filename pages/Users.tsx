
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ApiUser } from '../types';
import { EditIcon, CogIcon } from '../components/icons';
import { useUsersContext } from './DashboardLayout'; // Import the custom hook
import EditUserModal from '../components/EditUserModal';
import ConfigUserModal from '../components/ConfigUserModal';


// Helper component for loading spinner
const Spinner = () => (
    <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-yellow"></div>
    </div>
);

const Users = () => {
    // State and handlers are now received from the parent DashboardLayout
    const { users, setUsers } = useUsersContext();
    
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
    const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            // Only fetch if the user list is empty
            if (users.length > 0) {
                setIsLoading(false);
                return;
            }
            try {
                const response = await axios.get('https://api.binancebotpro.com/api/users');
                const sortedUsers = response.data.sort((a: ApiUser, b: ApiUser) => a.username.localeCompare(b.username));
                setUsers(sortedUsers); // Update the state in the parent component
            } catch (err) {
                console.error("Failed to fetch users:", err);
                if (axios.isAxiosError(err)) {
                     setError(`Failed to fetch users: ${err.message}. Please check your network connection and API server status.`);
                } else {
                     setError("An unexpected error occurred while fetching users.");
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, []); // This effect still runs once, but now it populates the parent's state

    const handleEditClick = (user: ApiUser) => {
        setSelectedUser(user);
        setIsEditModalOpen(true);
    };
    
    const handleConfigClick = (user: ApiUser) => {
        setSelectedUser(user);
        setIsConfigModalOpen(true);
    };
    
    const handleUserConfigUpdated = (updatedUser: ApiUser) => {
        setUsers(prevUsers => prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
    };

    const handleToggleActiveStatus = async (userToUpdate: ApiUser) => {
        if (updatingUserId) return;

        setUpdatingUserId(userToUpdate.id);
        const endpointAction = userToUpdate.isActive ? 'deactivate' : 'activate';
        
        try {
            await axios.put(`https://api.binancebotpro.com/api/users/${userToUpdate.id}/${endpointAction}`);
            
            setUsers(prevUsers =>
                prevUsers.map(u =>
                    u.id === userToUpdate.id ? { ...u, isActive: !u.isActive } : u
                )
            );

        } catch (err) {
            console.error(`Failed to ${endpointAction} user:`, err);
        } finally {
            setUpdatingUserId(null);
        }
    };


    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const renderContent = () => {
        if (isLoading) {
            return <Spinner />;
        }
        if (error) {
            return <p className="text-center p-8 text-accent-red bg-red-500/10 rounded-md">{error}</p>;
        }
        if (users.length === 0) {
            return (
                <div className="text-center p-8">
                    <p className="text-gray-400">No users found. Get started by clicking "Add User" in the header.</p>
                </div>
            );
        }
        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="p-4 font-semibold">Username</th>
                            <th className="p-4 font-semibold">Status</th>
                            <th className="p-4 font-semibold text-center">Trades Today</th>
                            <th className="p-4 font-semibold text-right">Order Size (USD)</th>
                            <th className="p-4 font-semibold">Last Trade Date</th>
                            <th className="p-4 font-semibold">User ID</th>
                            <th className="p-4 font-semibold text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user, index) => (
                            <tr key={user.id} className={`border-t border-gray-700 ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`}>
                                <td className="p-4 font-semibold whitespace-nowrap">{user.username}</td>
                                <td className="p-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <label htmlFor={`toggle-${user.id}`} className="flex items-center cursor-pointer">
                                            <div className="relative">
                                                <input
                                                    id={`toggle-${user.id}`}
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={user.isActive}
                                                    onChange={() => handleToggleActiveStatus(user)}
                                                    disabled={updatingUserId === user.id}
                                                />
                                                <div className={`block w-12 h-6 rounded-full transition-colors ${user.isActive ? 'bg-accent-green' : 'bg-gray-600'}`}></div>
                                                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${user.isActive ? 'translate-x-6' : ''}`}></div>
                                            </div>
                                            <span className="ml-3 text-sm font-medium text-gray-300">
                                                {user.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </label>
                                        {updatingUserId === user.id && (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 text-center font-mono whitespace-nowrap">{user.tradesToday}</td>
                                <td className="p-4 text-right font-mono whitespace-nowrap">
                                    {user.orderSizeUSD ? `$${user.orderSizeUSD.toLocaleString()}` : <span className="text-gray-500">Not Set</span>}
                                </td>
                                <td className="p-4 text-gray-400 whitespace-nowrap">{formatDate(user.lastTradeDate)}</td>
                                <td className="p-4 font-mono text-sm text-gray-500 whitespace-nowrap">{user.id}</td>
                                <td className="p-4 text-center">
                                    <div className="flex justify-center items-center gap-4">
                                        <button
                                            onClick={() => handleConfigClick(user)}
                                            className="text-gray-400 hover:text-accent-yellow transition-colors"
                                            aria-label={`Configure user ${user.username}`}
                                        >
                                            <CogIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleEditClick(user)}
                                            className="text-gray-400 hover:text-accent-yellow transition-colors"
                                            aria-label={`Edit user ${user.username}`}
                                        >
                                            <EditIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <>
            <div className="space-y-8">
                <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex justify-between items-center p-6 border-b border-gray-700">
                         <h2 className="text-xl font-semibold text-white">User List</h2>
                         <div className="flex items-center gap-4">
                            {!isLoading && !error && users.length > 0 && (
                                <span className="text-gray-400 font-medium bg-gray-700 px-3 py-1 rounded-full text-sm">{users.length} Users</span>
                            )}
                            {/* The Add User button is now in DashboardLayout */}
                         </div>
                    </div>
                    {renderContent()}
                </div>
            </div>

            {selectedUser && (
                <EditUserModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    user={selectedUser}
                />
            )}
            
            {selectedUser && (
                <ConfigUserModal
                    isOpen={isConfigModalOpen}
                    onClose={() => setIsConfigModalOpen(false)}
                    user={selectedUser}
                    onConfigUpdated={handleUserConfigUpdated}
                />
            )}
        </>
    );
};

export default Users;
