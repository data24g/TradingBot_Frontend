
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Coin } from '../types';

// --- Constants ---
const COIN_SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'
];

const COIN_NAMES: { [key: string]: string } = {
    'BTCUSDT': 'Bitcoin',
    'ETHUSDT': 'Ethereum',
    'SOLUSDT': 'Solana',
    'BNBUSDT': 'Binance Coin',
    'XRPUSDT': 'Ripple',
    'DOGEUSDT': 'Dogecoin',
    'ADAUSDT': 'Cardano',
    'AVAXUSDT': 'Avalanche',
};

// --- Helper Components ---
const Spinner = () => (
    <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-yellow"></div>
    </div>
);

const TrendIndicator = ({ trend }: { trend?: string }) => {
    let colorClasses = 'bg-gray-600/50 text-gray-300'; // Default for SIDEWAYS or undefined
    if (trend === 'UPTREND') {
        colorClasses = 'bg-accent-green/20 text-accent-green';
    } else if (trend === 'DOWNTREND') {
        colorClasses = 'bg-accent-red/20 text-accent-red';
    }

    return (
        <span className={`px-2 py-1 text-xs font-semibold rounded ${colorClasses}`}>
            {trend || 'N/A'}
        </span>
    );
};

// --- Helper Functions ---
const formatPrice = (price: number): string => {
    const options: Intl.NumberFormatOptions = {
        minimumFractionDigits: 2,
        maximumFractionDigits: price < 1 ? 5 : 2,
    };
    return price.toLocaleString(undefined, options);
};

// --- Main Component ---
const CoinMonitor = () => {
    const [coins, setCoins] = useState<Coin[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMarketData = async () => {
            try {
                const requests = COIN_SYMBOLS.map(symbol =>
                    axios.get(`https://api.binancebotpro.com/api/market-data/state/${symbol.toLowerCase()}`)
                );

                const responses = await Promise.all(requests);

                const marketData: Coin[] = responses
                    .filter(response => response.data && typeof response.data.currentPrice === 'number') // Safety check
                    .map(response => {
                        const data = response.data;
                        return {
                            symbol: data.symbol,
                            name: COIN_NAMES[data.symbol] || data.symbol.replace('USDT', ''),
                            price: data.currentPrice,
                            support: data.supportLevels?.[0] || 0,
                            resistance: data.resistanceLevels?.[0] || 0,
                            trend: data.trend,
                        };
                    });
                
                setCoins(marketData);
                if (error) setError(null); // Clear error on successful fetch
            } catch (err) {
                console.error("Failed to fetch market data:", err);
                // Only show error if we don't have any data to display
                if (coins.length === 0) {
                     if (axios.isAxiosError(err)) {
                        setError(`Failed to fetch market data: ${err.message}. Please check API server status.`);
                    } else {
                        setError("An unexpected error occurred while fetching market data.");
                    }
                }
            } finally {
                // This will be true only on the very first execution
                if (isLoading) {
                    setIsLoading(false);
                }
            }
        };

        fetchMarketData(); // Initial fetch
        const intervalId = setInterval(fetchMarketData, 10000); // Refresh every 10 seconds

        return () => clearInterval(intervalId); // Cleanup interval on component unmount
    }, []); // Empty dependency array ensures this runs only once on mount

    if (isLoading) {
        return (
             <div className="space-y-8">
                {/* Title is now in DashboardLayout */}
                <Spinner />
            </div>
        )
    }

    if (error) {
         return (
             <div className="space-y-8">
                {/* Title is now in DashboardLayout */}
                <p className="text-center p-8 text-accent-red bg-red-500/10 rounded-md">{error}</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {coins.map(coin => (
                    <Link to={`/monitor/${coin.symbol}`} key={coin.symbol} className="block group">
                        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 flex flex-col justify-between h-full transition-all group-hover:shadow-lg group-hover:shadow-accent-yellow/10 group-hover:border-accent-yellow/50 group-hover:-translate-y-1">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center">
                                        <span className="text-2xl font-bold text-white">{coin.symbol.replace('USDT', '')}</span>
                                        <span className="text-sm text-gray-400 ml-2">{coin.name}</span>
                                    </div>
                                   <TrendIndicator trend={coin.trend} />
                                </div>
                                <div className="text-3xl font-light text-white mb-6">
                                    ${formatPrice(coin.price)}
                                </div>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Support</span>
                                    <span className="font-mono text-white">${formatPrice(coin.support)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Resistance</span>
                                    <span className="font-mono text-white">${formatPrice(coin.resistance)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Futures Price</span>
                                    <span className="font-mono text-accent-yellow">${formatPrice(coin.price * 1.005)}</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default CoinMonitor;
