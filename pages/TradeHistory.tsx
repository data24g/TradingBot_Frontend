
import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { Trade, TradeSide, TradeStatus, ApiUser } from '../types';

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

// Helper component for loading spinner
const Spinner = () => (
    <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-yellow"></div>
    </div>
);

const TradeHistory = () => {
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [usersList, setUsersList] = useState<ApiUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({ coin: '', userId: 'all', from: '', to: '', status: 'all' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tradesResponse, usersResponse] = await Promise.all([
          axios.get('https://api.binancebotpro.com/api/trades'),
          axios.get('https://api.binancebotpro.com/api/users'),
        ]);

        const mappedTrades: Trade[] = tradesResponse.data.map((trade: any) => ({
          ...trade,
          userName: trade.username,
          side: trade.side.toUpperCase() as TradeSide,
          status: trade.status.toUpperCase() as TradeStatus,
        })).sort((a: Trade, b: Trade) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
        
        setAllTrades(mappedTrades);
        setUsersList(usersResponse.data.sort((a: ApiUser, b: ApiUser) => a.username.localeCompare(b.username)));

      } catch (err) {
        console.error("Failed to fetch trade history or users:", err);
        if (axios.isAxiosError(err)) {
             setError(`Failed to fetch data: ${err.message}. Please check the API server.`);
        } else {
             setError("An unexpected error occurred while fetching data.");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);


  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };
  
  const setDateRange = (from: Date, to: Date) => {
    setFilters(prev => ({ ...prev, from: formatDate(from), to: formatDate(to) }));
  }

  const setTodayFilter = () => setDateRange(new Date(), new Date());

  const setThisWeekFilter = () => {
      const today = new Date();
      const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
      const lastDayOfWeek = new Date(firstDayOfWeek);
      lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
      setDateRange(firstDayOfWeek, lastDayOfWeek);
  };

  const setThisMonthFilter = () => {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setDateRange(firstDayOfMonth, lastDayOfMonth);
  };
    
  const clearFilters = () => {
    setFilters({ coin: '', userId: 'all', from: '', to: '', status: 'all' });
  };

  const { filteredTrades, summary } = useMemo(() => {
    const trades = allTrades.filter(trade => {
      const tradeDate = new Date(trade.entryTime);
      const fromDate = filters.from ? new Date(filters.from) : null;
      const toDate = filters.to ? new Date(filters.to) : null;
      
      if(fromDate) fromDate.setHours(0,0,0,0);
      if(toDate) toDate.setHours(23,59,59,999);

      const userMatch = filters.userId === 'all' ? true : trade.userId === filters.userId;
      const coinMatch = filters.coin ? trade.symbol.toLowerCase().includes(filters.coin.toLowerCase()) : true;
      const fromMatch = fromDate ? tradeDate >= fromDate : true;
      const toMatch = toDate ? tradeDate <= toDate : true;
      const statusMatch = filters.status === 'all' ? true : trade.status === filters.status;

      return userMatch && coinMatch && fromMatch && toMatch && statusMatch;
    });

    let summaryData: { tradeCount: number; totalPnl: number; } | null = null;
    if (filters.userId !== 'all' && trades.length > 0) {
      const totalPnl = trades.reduce((acc, trade) => acc + (trade.pnl || 0), 0);
      summaryData = {
        tradeCount: trades.length,
        totalPnl: totalPnl,
      };
    }
    
    return { filteredTrades: trades, summary: summaryData };
  }, [filters, allTrades]);
  
  const renderTable = () => {
    if (isLoading) return <Spinner />;
    if (error) return <p className="text-center p-8 text-accent-red bg-red-500/10 rounded-md">{error}</p>;
    if (allTrades.length === 0 && !isLoading) return <p className="text-center p-8 text-gray-400">No trade history found.</p>;
    if (filteredTrades.length === 0) return <p className="text-center p-8 text-gray-400">No trades found for the selected filters.</p>;
    
    return (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-700">
              <tr>
                <th className="p-4 font-semibold">User</th>
                <th className="p-4 font-semibold">Symbol</th>
                <th className="p-4 font-semibold">Side</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Entry Price</th>
                <th className="p-4 font-semibold text-right">Quantity</th>
                <th className="p-4 font-semibold text-right">Order Size (USD)</th>
                <th className="p-4 font-semibold text-right">PNL</th>
                <th className="p-4 font-semibold">Entry Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade, index) => (
                <tr key={trade.id} className={`border-t border-gray-700 ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`}>
                  <td className="p-4 whitespace-nowrap">{trade.userName}</td>
                  <td className="p-4 font-bold whitespace-nowrap">{trade.symbol}</td>
                  <td className={`p-4 font-semibold whitespace-nowrap ${trade.side === TradeSide.LONG ? 'text-accent-green' : 'text-accent-red'}`}>{trade.side}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        trade.status === TradeStatus.OPEN
                            ? 'bg-accent-green/20 text-accent-green'
                            : 'bg-gray-600/50 text-gray-400'
                    }`}>
                        {trade.status}
                    </span>
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">${trade.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}</td>
                  <td className="p-4 text-right whitespace-nowrap">{trade.quantity.toFixed(4)}</td>
                  <td className="p-4 text-right whitespace-nowrap">${(trade.orderSizeUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className={`p-4 text-right font-mono whitespace-nowrap ${ (trade.pnl || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                    {trade.pnl !== null && trade.pnl !== undefined ? `${(trade.pnl || 0) >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="p-4 text-gray-400 whitespace-nowrap">{new Date(trade.entryTime).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
            {summary && (
              <tfoot className="bg-gray-700/50 border-t-2 border-accent-yellow">
                  <tr>
                      <td colSpan={7} className="p-4 font-bold text-right text-white text-lg">
                          Summary for {usersList.find(u => u.id === filters.userId)?.username}
                      </td>
                      <td className={`p-4 text-right font-bold whitespace-nowrap text-lg ${ summary.totalPnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                          ${summary.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 font-semibold text-gray-300 whitespace-nowrap">
                          ({summary.tradeCount} trades)
                      </td>
                  </tr>
              </tfoot>
            )}
          </table>
        </div>
    );
  };


  return (
    <div className="space-y-8">
      {/* Filters Card */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-400 mb-1">Coin</label>
                <input type="text" name="coin" placeholder="e.g., BTC" value={filters.coin} onChange={handleFilterChange} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow" />
            </div>
             <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-400 mb-1">User</label>
                <select name="userId" value={filters.userId} onChange={handleFilterChange} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow">
                    <option value="all">All Users</option>
                    {usersList.map(user => (
                        <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                </select>
            </div>
            <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-400 mb-1">Status</label>
                <select name="status" value={filters.status} onChange={handleFilterChange} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow">
                    <option value="all">All Statuses</option>
                    <option value={TradeStatus.OPEN}>Open</option>
                    <option value={TradeStatus.CLOSED}>Closed</option>
                </select>
            </div>
            <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-400 mb-1">From Date</label>
                <input type="date" name="from" value={filters.from} onChange={handleFilterChange} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow" />
            </div>
            <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-400 mb-1">To Date</label>
                <input type="date" name="to" value={filters.to} onChange={handleFilterChange} className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-yellow" />
            </div>
            <div className="flex flex-col justify-end">
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-2">
                     <button onClick={setTodayFilter} className="bg-gray-600 text-white font-semibold py-2 px-3 rounded-md hover:bg-gray-500 transition-colors text-sm">Today</button>
                     <button onClick={setThisWeekFilter} className="bg-gray-600 text-white font-semibold py-2 px-3 rounded-md hover:bg-gray-500 transition-colors text-sm">Week</button>
                     <button onClick={setThisMonthFilter} className="bg-gray-600 text-white font-semibold py-2 px-3 rounded-md hover:bg-gray-500 transition-colors text-sm">Month</button>
                     <button onClick={clearFilters} className="bg-gray-600 text-white font-semibold py-2 px-3 rounded-md hover:bg-gray-500 transition-colors text-sm">Clear</button>
                </div>
            </div>
        </div>
      </div>

      {/* Trades Table Card */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
         <div className="flex justify-between items-center p-6 border-b border-gray-700">
             <h2 className="text-xl font-semibold text-white">Trades List</h2>
             {!isLoading && !error && (
                <span className="text-gray-400 font-medium bg-gray-700 px-3 py-1 rounded-full text-sm">{filteredTrades.length} / {allTrades.length} trades shown</span>
             )}
         </div>
        {renderTable()}
      </div>
    </div>
  );
};

export default TradeHistory;