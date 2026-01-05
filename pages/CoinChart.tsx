import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  LineData,
  CandlestickData,
  HistogramData,
  SeriesMarker,
  Time,
  LineStyle,
  IPriceLine,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import { ArrowLeftIcon } from '../components/icons';
import { FaEye, FaEyeSlash, FaHistory, FaListAlt, FaWallet, FaChartLine, FaLayerGroup, FaArrowsAltV, FaSyncAlt, FaExchangeAlt, FaCoins } from 'react-icons/fa';
import { KLineData, Coin } from '../types';

/* -------------------------------------------------------------------------- */
/*                                1. MATH HELPERS                             */
/* -------------------------------------------------------------------------- */
const calculateSMA = (data: KLineData[], period: number): LineData[] => {
  const sma: LineData[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
    sma.push({ time: data[i].time as UTCTimestamp, value: sum / period });
  }
  return sma;
};

const calculateBollingerBands = (data: KLineData[], period: number, stdDev: number) => {
  const bb: { time: UTCTimestamp; upper: number; middle: number; lower: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const prices = slice.map((d) => d.close);
    const sma = prices.reduce((acc, val) => acc + val, 0) / period;
    const std = Math.sqrt(prices.map((p) => Math.pow(p - sma, 2)).reduce((acc, val) => acc + val, 0) / period);
    bb.push({ time: data[i].time as UTCTimestamp, upper: sma + stdDev * std, middle: sma, lower: sma - stdDev * std });
  }
  return bb;
};

const ICHIMOKU_COLORS = { TENKAN: '#2962FF', KIJUN: '#B71C1C', CHIKOU: '#43A047', SPAN_A: '#00897B', SPAN_B: '#E53935' };
const calculateIchimoku = (data: KLineData[], t1 = 9, t2 = 26, t3 = 52) => {
  const tenkan: LineData[] = []; const kijun: LineData[] = []; const senkouA: LineData[] = []; const senkouB: LineData[] = []; const chikou: LineData[] = [];
  for (let i = 0; i < data.length; i++) {
    const time = data[i].time as UTCTimestamp;
    if (i >= t1 - 1) {
      const s = data.slice(i - t1 + 1, i + 1);
      tenkan.push({ time, value: (Math.max(...s.map(x => x.high)) + Math.min(...s.map(x => x.low))) / 2 });
    }
    if (i >= t2 - 1) {
      const s = data.slice(i - t2 + 1, i + 1);
      kijun.push({ time, value: (Math.max(...s.map(x => x.high)) + Math.min(...s.map(x => x.low))) / 2 });
    }
    if (i >= t2 - 1) { 
       const sT = data.slice(i - t1 + 1, i + 1); const tenk = (Math.max(...sT.map(s=>s.high)) + Math.min(...sT.map(s=>s.low)))/2;
       const sK = data.slice(i - t2 + 1, i + 1); const kiju = (Math.max(...sK.map(s=>s.high)) + Math.min(...sK.map(s=>s.low)))/2;
       senkouA.push({ time, value: (tenk + kiju) / 2 }); 
    }
    if (i >= t3 - 1) {
       const s = data.slice(i - t3 + 1, i + 1);
       senkouB.push({ time, value: (Math.max(...s.map(x => x.high)) + Math.min(...s.map(x => x.low))) / 2 });
    }
    chikou.push({ time, value: data[i].close });
  }
  return { tenkan, kijun, senkouA, senkouB, chikou };
};

const calculateRSI = (data: KLineData[], period: number = 14): LineData[] => {
  const rsi: LineData[] = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  let avgGain = gains / period; let avgLoss = losses / period;
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0; const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period; avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgGain / avgLoss;
    rsi.push({ time: data[i].time as UTCTimestamp, value: 100 - (100 / (1 + rs)) });
  }
  return rsi;
};

const calculateMACD = (data: KLineData[]) => {
  const k12 = 2/(13); const k26 = 2/(27); const k9 = 2/(10);
  let ema12 = data[0].close; let ema26 = data[0].close;
  const macdLine: number[] = [];
  for(let i=0; i<data.length; i++) {
     ema12 = data[i].close * k12 + ema12 * (1-k12);
     ema26 = data[i].close * k26 + ema26 * (1-k26);
     macdLine.push(ema12 - ema26);
  }
  let signal = macdLine[0];
  const res: any[] = [];
  for(let i=0; i<data.length; i++) {
     signal = macdLine[i] * k9 + signal * (1-k9);
     if (i > 26) {
         res.push({ time: data[i].time, macd: macdLine[i], signal: signal, hist: macdLine[i] - signal });
     }
  }
  return res;
};

/* -------------------------------------------------------------------------- */
/*                                2. TRADE PANEL COMPONENT                    */
/* -------------------------------------------------------------------------- */
const TIMEFRAMES: { [key: string]: string } = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D' };
const formatPrice = (price: number | null | undefined) => price ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(price) : '...';

// --- Interface Definitions ---
interface UserAccount {
  id: string;
  username: string;
  isActive: boolean;
}

// Cấu trúc dữ liệu từ Binance
interface SpotBalance {
  asset: string;
  free: number;
  locked: number;
}

interface FuturesBalance {
  asset: string;
  balance: number;
  availableBalance: number;
}

interface FuturesPosition {
  symbol: string;
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  unRealizedProfit: number;
  leverage: number;
  liquidationPrice: number;
}

interface TradePanelProps {
  symbol: string;
  currentPrice: number;
  marketType: 'SPOT' | 'FUTURES';
  setMarketType: (type: 'SPOT' | 'FUTURES') => void;
  isMobile: boolean;
}

const TradePanel: React.FC<TradePanelProps> = ({ symbol, currentPrice, marketType, setMarketType, isMobile }) => {
  // State API & User
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('custom');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Balance State
  const [spotBalances, setSpotBalances] = useState<SpotBalance[]>([]);
  const [futuresBalances, setFuturesBalances] = useState<FuturesBalance[]>([]);
  const [futuresPositions, setFuturesPositions] = useState<FuturesPosition[]>([]);

  // Order State
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [price, setPrice] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [inputUnit, setInputUnit] = useState<'COIN' | 'USDT'>('COIN');
  const [leverage, setLeverage] = useState(20);
  
  const baseAsset = symbol?.replace('USDT', '') || 'COIN';

  // --- 1. FETCH USERS ---
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('https://api.binancebotpro.com/api/users');
        setUsers(res.data);
      } catch (err) { console.error("Failed to fetch users", err); }
    };
    fetchUsers();
  }, []);

  // --- 2. FETCH KEYS ---
  const handleAccountChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;
    setSelectedUserId(userId);

    if (userId === 'custom') {
      setApiKey(''); setSecretKey('');
      resetData();
      return;
    }

    setIsLoadingKeys(true);
    try {
      const res = await axios.get(`https://api.binancebotpro.com/api/users/${userId}/keys`);
      if (res.data) {
        const key = res.data.apiKey || '';
        const secret = res.data.apiSecret || '';
        setApiKey(key);
        setSecretKey(secret);
        // Auto fetch data when keys are loaded
        fetchBinanceAccountData(key, secret);
      }
    } catch (err) {
      console.error("Failed to fetch keys", err);
      alert("Không thể lấy Key của user này.");
      resetData();
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const resetData = () => {
    setSpotBalances([]);
    setFuturesBalances([]);
    setFuturesPositions([]);
  }

  // --- 3. FETCH BINANCE DATA (REAL API PROXY) ---
  const fetchBinanceAccountData = async (key = apiKey, secret = secretKey) => {
    if (!key || !secret) return;
    setIsRefreshing(true);
    
    try {
      // Gọi API Proxy Backend (Server của bạn phải xử lý việc gọi Binance)
      // Endpoint giả định: /api/binance/proxy/account
      
      const backendUrl = 'https://api.binancebotpro.com/api/binance/proxy';

      // 1. Lấy thông tin Spot
      const spotRes = await axios.post(`${backendUrl}/spot/account`, { apiKey: key, apiSecret: secret });
      // Filter chỉ lấy coin có số dư > 0
      const spotData = spotRes.data.balances
          .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
          .map((b: any) => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) }));
      setSpotBalances(spotData);

      // 2. Lấy thông tin Futures Balance
      const futuresBalRes = await axios.post(`${backendUrl}/futures/balance`, { apiKey: key, apiSecret: secret });
      const futuresData = futuresBalRes.data
          .filter((b: any) => parseFloat(b.balance) > 0)
          .map((b: any) => ({ asset: b.asset, balance: parseFloat(b.balance), availableBalance: parseFloat(b.availableBalance) }));
      setFuturesBalances(futuresData);

      // 3. Lấy thông tin Futures Positions
      const futuresPosRes = await axios.post(`${backendUrl}/futures/positions`, { apiKey: key, apiSecret: secret });
      const positionsData = futuresPosRes.data
          .filter((p: any) => parseFloat(p.positionAmt) !== 0) // Chỉ lấy vị thế đang mở
          .map((p: any) => ({
             symbol: p.symbol,
             positionSide: p.positionSide,
             positionAmt: parseFloat(p.positionAmt),
             entryPrice: parseFloat(p.entryPrice),
             markPrice: parseFloat(p.markPrice),
             unRealizedProfit: parseFloat(p.unRealizedProfit),
             leverage: parseInt(p.leverage),
             liquidationPrice: parseFloat(p.liquidationPrice)
          }));
      setFuturesPositions(positionsData);

    } catch (error) {
      console.error("Error fetching Binance data:", error);
      // Fallback nếu API lỗi để không bị trắng trang (Xóa dòng này khi Production)
      // alert("Lỗi kết nối Binance API qua Proxy. Vui lòng kiểm tra Backend.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // --- CALCULATIONS ---
  const getUsdtBalance = (type: 'SPOT' | 'FUTURES') => {
    if (type === 'SPOT') {
      const usdt = spotBalances.find(b => b.asset === 'USDT');
      return usdt ? usdt.free : 0;
    } else {
      const usdt = futuresBalances.find(b => b.asset === 'USDT');
      return usdt ? usdt.availableBalance : 0;
    }
  };

  useEffect(() => { if (currentPrice && price === '') setPrice(currentPrice.toString()); }, [currentPrice]);
  const getExecutionPrice = () => orderType === 'LIMIT' && price ? parseFloat(price) : currentPrice;

  const handlePercentageClick = (percent: number) => {
    const balance = getUsdtBalance(marketType);
    const execPrice = getExecutionPrice();
    if (!execPrice) return;

    if (inputUnit === 'USDT') {
      setAmount((balance * (percent / 100)).toFixed(2));
    } else {
      setAmount(((balance * (percent / 100)) / execPrice).toFixed(4));
    }
  };

  const convertedValue = useMemo(() => {
    const val = parseFloat(amount); const execPrice = getExecutionPrice(); if (!val || !execPrice) return null;
    return inputUnit === 'COIN' ? `≈ ${(val * execPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` : `≈ ${(val / execPrice).toFixed(5)} ${baseAsset}`;
  }, [amount, inputUnit, price, currentPrice, orderType]);

  const handleTrade = (side: 'BUY' | 'SELL') => {
    if(!apiKey) return alert("Vui lòng chọn tài khoản hoặc nhập API Key");
    // Gọi API đặt lệnh thật
    alert(`Đang gửi lệnh ${side} ${symbol} lên sàn... (Chức năng cần Backend Proxy)`);
  };

  return (
    <div className={`bg-gray-800 border border-gray-700 flex flex-col overflow-hidden ${isMobile ? 'border-t rounded-t-xl' : 'rounded-lg h-full'}`}>
      
      {/* 1. Market Type Tabs */}
      <div className="flex bg-gray-900 p-1 rounded-t-lg">
        <button onClick={() => setMarketType('SPOT')} className={`flex-1 py-2 text-xs font-bold rounded transition-all ${marketType === 'SPOT' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>SPOT</button>
        <button onClick={() => setMarketType('FUTURES')} className={`flex-1 py-2 text-xs font-bold rounded transition-all ${marketType === 'FUTURES' ? 'bg-accent-yellow text-gray-900' : 'text-gray-500 hover:text-gray-300'}`}>FUTURES</button>
      </div>

      <div className="overflow-y-auto p-3 custom-scrollbar space-y-4 flex-grow">
        
        {/* 2. Account Selection & Balance Summary */}
        <div className="space-y-3 border-b border-gray-700 pb-3">
          {/* Select User */}
          <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase">
             <span className="flex items-center gap-1"><FaWallet /> Account</span>
             <div className="flex items-center gap-2">
               {apiKey && (
                 <button onClick={() => fetchBinanceAccountData(apiKey, secretKey)} disabled={isRefreshing} className={`text-xs ${isRefreshing ? 'animate-spin text-accent-yellow' : 'text-gray-400 hover:text-white'}`} title="Làm mới dữ liệu"><FaSyncAlt/></button>
               )}
               <span className={apiKey ? 'text-green-400' : 'text-gray-500'}>{apiKey ? 'Connected' : 'No Key'}</span>
             </div>
          </div>
          
          <select value={selectedUserId} onChange={handleAccountChange} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-2 text-xs text-white outline-none cursor-pointer">
            <option value="custom">-- Nhập tay (Custom) --</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.isActive ? 'Active' : 'Inactive'})</option>)}
          </select>

          {selectedUserId === 'custom' && (
            <div className="space-y-2 pt-1">
               <input type="text" placeholder="API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white" />
               <div className="relative">
                  <input type={showSecret?"text":"password"} placeholder="Secret Key" value={secretKey} onChange={(e)=>setSecretKey(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs text-white pr-8" />
                  <button className="absolute right-2 top-2 text-gray-400" onClick={()=>setShowSecret(!showSecret)}>{showSecret?<FaEyeSlash size={12}/>:<FaEye size={12}/>}</button>
               </div>
            </div>
          )}

          {/* WALLET SUMMARY */}
          {apiKey && (
            <div className="grid grid-cols-2 gap-2 bg-gray-900/50 p-2 rounded border border-gray-600">
               <div className={`text-center border-r border-gray-700 ${marketType==='SPOT' ? 'opacity-100' : 'opacity-50'}`}>
                 <p className="text-[9px] text-gray-400 uppercase">Spot USDT</p>
                 <p className="text-xs font-bold text-white">{formatPrice(getUsdtBalance('SPOT'))}</p>
               </div>
               <div className={`text-center ${marketType==='FUTURES' ? 'opacity-100' : 'opacity-50'}`}>
                 <p className="text-[9px] text-gray-400 uppercase">Futures USDT</p>
                 <p className="text-xs font-bold text-accent-yellow">{formatPrice(getUsdtBalance('FUTURES'))}</p>
               </div>
            </div>
          )}
        </div>

        {/* 3. ORDER FORM */}
        {marketType === 'FUTURES' && (
          <div className="space-y-1">
             <div className="flex justify-between text-xs text-gray-400"><span>Leverage</span><span className="text-accent-yellow font-bold">{leverage}x</span></div>
             <input type="range" min="1" max="125" step="1" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-accent-yellow" />
          </div>
        )}
        <div className="space-y-2">
          <div className="flex bg-gray-900 rounded p-0.5">
            <button onClick={() => setOrderType('LIMIT')} className={`flex-1 text-[10px] py-1.5 rounded transition ${orderType==='LIMIT' ? 'bg-gray-700 text-accent-yellow font-bold' : 'text-gray-500'}`}>Limit</button>
            <button onClick={() => setOrderType('MARKET')} className={`flex-1 text-[10px] py-1.5 rounded transition ${orderType==='MARKET' ? 'bg-gray-700 text-accent-yellow font-bold' : 'text-gray-500'}`}>Market</button>
          </div>
          <div className="relative">
             <span className="absolute left-2 top-2 text-[10px] text-gray-500">Price</span>
             <input type="number" inputMode="decimal" disabled={orderType === 'MARKET'} value={orderType === 'MARKET' ? currentPrice : price} onChange={(e) => setPrice(e.target.value)} className={`w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 pl-10 text-sm text-right text-white font-mono ${orderType==='MARKET' && 'opacity-50'}`} />
          </div>
          <div className="space-y-1">
            <div className="relative">
               <span className="absolute left-2 top-2 text-[10px] text-gray-500 font-medium pointer-events-none">{inputUnit === 'COIN' ? 'Amount' : 'Total'}</span>
               <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-2 pl-12 pr-16 text-sm text-right text-white font-mono" placeholder="0.00" />
               <button onClick={() => setInputUnit(prev => prev === 'COIN' ? 'USDT' : 'COIN')} className="absolute right-1 top-1 bottom-1 px-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded flex items-center justify-center gap-1 cursor-pointer transition-all z-10 group">
                 <span className="text-[10px] font-bold text-gray-200">{inputUnit === 'COIN' ? baseAsset : 'USDT'}</span>
               </button>
            </div>
            <div className="text-right text-[10px] text-gray-500 h-3 font-mono">{convertedValue}</div>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[25, 50, 75, 100].map(pct => (
              <button key={pct} onClick={() => handlePercentageClick(pct)} className="bg-gray-700 hover:bg-gray-600 text-[10px] py-1.5 rounded text-gray-400 hover:text-white transition">{pct}%</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pb-2">
          <button onClick={() => handleTrade('BUY')} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded text-xs transition shadow-lg">{marketType === 'FUTURES' ? 'LONG' : 'BUY'}</button>
          <button onClick={() => handleTrade('SELL')} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded text-xs transition shadow-lg">{marketType === 'FUTURES' ? 'SHORT' : 'SELL'}</button>
        </div>

        {/* 4. HOLDINGS / POSITIONS LIST */}
        <div className="border-t border-gray-700 pt-2">
           <div className="flex gap-2 mb-2 items-center text-[10px] font-bold uppercase text-gray-500">
              <FaListAlt/> {marketType === 'SPOT' ? 'Spot Assets' : 'Open Positions'}
           </div>
           
           <div className="min-h-[120px]">
             {/* SPOT ASSETS LIST */}
             {marketType === 'SPOT' && apiKey && (
               <div className="space-y-2">
                  {spotBalances.length === 0 ? <p className="text-center text-[10px] text-gray-500 py-2">Ví trống</p> : 
                    spotBalances.map((item, idx) => (
                      <div key={idx} className="bg-gray-900/50 p-2 rounded border border-gray-700 flex justify-between items-center">
                         <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold text-white">{item.asset[0]}</div>
                            <div>
                               <p className="text-[11px] font-bold text-white">{item.asset}</p>
                               <p className="text-[9px] text-gray-500">Locked: {item.locked}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-[11px] font-mono text-white">{item.free}</p>
                         </div>
                      </div>
                    ))
                  }
               </div>
             )}

             {/* FUTURES POSITIONS LIST */}
             {marketType === 'FUTURES' && apiKey && (
               <div className="space-y-2">
                  {futuresPositions.length === 0 ? <p className="text-center text-[10px] text-gray-500 py-2">Không có lệnh mở</p> : 
                    futuresPositions.map((pos, idx) => (
                      <div key={idx} className="bg-gray-900/50 p-2 rounded border border-gray-700">
                         <div className="flex justify-between items-center mb-1">
                            <span className="text-[11px] font-bold text-white flex items-center gap-1">
                              {pos.symbol} 
                              <span className={`text-[9px] px-1 rounded ${parseFloat(pos.positionAmt.toString()) > 0 ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                                {parseFloat(pos.positionAmt.toString()) > 0 ? 'L' : 'S'} {pos.leverage}x
                              </span>
                            </span>
                            <div className="text-right">
                              <span className={`text-[11px] font-mono font-bold ${pos.unRealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {pos.unRealizedProfit > 0 ? '+' : ''}{parseFloat(pos.unRealizedProfit.toString()).toFixed(2)} u
                              </span>
                            </div>
                         </div>
                         <div className="grid grid-cols-3 gap-1 text-[9px] text-gray-400 mt-1">
                            <div>Size: <span className="text-gray-300">{Math.abs(pos.positionAmt)}</span></div>
                            <div className="text-center">Entry: <span className="text-gray-300">{parseFloat(pos.entryPrice.toString()).toFixed(2)}</span></div>
                            <div className="text-right">Liq: <span className="text-orange-400">{parseFloat(pos.liquidationPrice.toString()).toFixed(2)}</span></div>
                         </div>
                      </div>
                    ))
                  }
               </div>
             )}
           </div>
        </div>

      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                           MAIN CHART COMPONENT                             */
/* -------------------------------------------------------------------------- */
const CoinChart: React.FC = () => {
  const { symbol } = useParams<{ symbol?: string }>();
  const [marketType, setMarketType] = useState<'SPOT' | 'FUTURES'>('FUTURES');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const mainChartContainerRef = useRef<HTMLDivElement | null>(null);
  const subChartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const subChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  
  const overlayRefs = useRef<any>({});
  const oscillatorRefs = useRef<any>({});
  const annotationLinesRef = useRef<IPriceLine[]>([]);

  const [klineData, setKlineData] = useState<KLineData[]>([]);
  const [activeTimeframe, setActiveTimeframe] = useState('15m');
  const [indicators, setIndicators] = useState({ sma: false, bb: false, ichimoku: true, sr: true, rsi: false, macd: false });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- CHART LOGIC (GIỮ NGUYÊN LOGIC CHART CŨ CỦA BẠN ĐỂ TRÁNH LỖI) ---
  // (Tôi rút gọn đoạn này để tập trung vào TradePanel, nhưng bạn hãy paste lại logic chart full từ câu trả lời trước để đảm bảo chart chạy mượt)
  
  // --- 1. MAIN CHART INIT ---
  useEffect(() => {
    if (!mainChartContainerRef.current) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(mainChartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#1e1e1e' }, textColor: '#d1d5db' },
      grid: { vertLines: { color: '#2d2d2d' }, horzLines: { color: '#2d2d2d' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2d2d2d', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: isMobile ? 2 : 5 },
      handleScroll: { vertTouchDrag: false },
      width: mainChartContainerRef.current.clientWidth,
      height: isMobile ? 350 : 400,
    });
    chartRef.current = chart;
    candleSeriesRef.current = chart.addCandlestickSeries({ upColor: '#22c55e', downColor: '#ef4444', borderUpColor: '#22c55e', borderDownColor: '#ef4444', wickUpColor: '#22c55e', wickDownColor: '#ef4444' });
    volumeSeriesRef.current = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '', scaleMargins: { top: 0.85, bottom: 0 } });

    const handleResizeChart = () => { if (chartRef.current && mainChartContainerRef.current) chartRef.current.applyOptions({ width: mainChartContainerRef.current.clientWidth }); };
    window.addEventListener('resize', handleResizeChart);
    return () => { window.removeEventListener('resize', handleResizeChart); if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; } };
  }, [isMobile]);

  // --- 2. SUB CHART INIT ---
  useEffect(() => {
    if (!subChartContainerRef.current) return;
    if (indicators.rsi || indicators.macd) {
       if (subChartRef.current) { subChartRef.current.remove(); subChartRef.current = null; }
       const subChart = createChart(subChartContainerRef.current, {
          layout: { background: { type: ColorType.Solid, color: '#1e1e1e' }, textColor: '#d1d5db' },
          grid: { vertLines: { color: '#2d2d2d' }, horzLines: { color: '#2d2d2d' } },
          width: subChartContainerRef.current.clientWidth,
          height: isMobile ? 100 : 150,
          timeScale: { visible: true },
          handleScroll: { vertTouchDrag: false },
       });
       subChartRef.current = subChart;
       const handleResizeSub = () => { if(subChartRef.current && subChartContainerRef.current) subChartRef.current.applyOptions({ width: subChartContainerRef.current.clientWidth }); };
       window.addEventListener('resize', handleResizeSub);
       return () => { window.removeEventListener('resize', handleResizeSub); if (subChartRef.current) { subChartRef.current.remove(); subChartRef.current = null; } };
    } else { if (subChartRef.current) { subChartRef.current.remove(); subChartRef.current = null; } }
  }, [indicators.rsi, indicators.macd, isMobile]);

  // --- 3. FETCH DATA ---
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    const fetchData = async () => {
      try {
        const baseUrl = marketType === 'FUTURES' ? 'https://fapi.binance.com/fapi/v1/klines' : 'https://api.binance.com/api/v3/klines';
        const res = await axios.get(baseUrl, { params: { symbol: symbol.toUpperCase(), interval: activeTimeframe, limit: 500 } });
        if (cancelled) return;
        const formatted = res.data.map((d: any[]) => ({ time: (d[0] / 1000) as UTCTimestamp, open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]) }));
        setKlineData(formatted);
      } catch (err) { console.error(err); }
    };
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [symbol, activeTimeframe, marketType]);

  const supportResistance = useMemo(() => {
    if (klineData.length === 0) return { support: null, resistance: null };
    const lookback = Math.min(100, klineData.length); const slice = klineData.slice(klineData.length - lookback);
    return { support: Math.min(...slice.map((d) => d.low)), resistance: Math.max(...slice.map((d) => d.high)) };
  }, [klineData]);

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || klineData.length === 0) return;
    candleSeriesRef.current.setData(klineData as CandlestickData[]);
    volumeSeriesRef.current?.setData(klineData.map(d => ({ time: d.time, value: d.volume, color: d.close >= d.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)' })));
    const chart = chartRef.current;

    if (candleSeriesRef.current) {
        try {
            annotationLinesRef.current.forEach(line => { try{ candleSeriesRef.current?.removePriceLine(line); }catch(e){} });
            annotationLinesRef.current = [];
            if (indicators.sr) {
                if (supportResistance.support) annotationLinesRef.current.push(candleSeriesRef.current.createPriceLine({ price: supportResistance.support, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'SUP', axisLabelVisible: true }));
                if (supportResistance.resistance) annotationLinesRef.current.push(candleSeriesRef.current.createPriceLine({ price: supportResistance.resistance, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'RES', axisLabelVisible: true }));
            }
        } catch (e) {}
    }

    if (!indicators.sma && overlayRefs.current.sma) { chart.removeSeries(overlayRefs.current.sma); delete overlayRefs.current.sma; }
    if (!indicators.bb && overlayRefs.current.bb) { overlayRefs.current.bb.forEach((s:any)=>chart.removeSeries(s)); delete overlayRefs.current.bb; }
    if (!indicators.ichimoku && overlayRefs.current.ich) { Object.values(overlayRefs.current.ich).forEach((s:any)=>chart.removeSeries(s)); delete overlayRefs.current.ich; }

    if (indicators.sma) { if (!overlayRefs.current.sma) overlayRefs.current.sma = chart.addLineSeries({ color: '#F0B90B', lineWidth: 2 }); overlayRefs.current.sma.setData(calculateSMA(klineData, 20)); }
    if (indicators.bb) { if (!overlayRefs.current.bb) overlayRefs.current.bb = [chart.addLineSeries({ color: '#3b82f6', lineWidth: 1 }), chart.addLineSeries({ color: '#3b82f6', lineWidth: 1 })]; const bb = calculateBollingerBands(klineData, 20, 2); overlayRefs.current.bb[0].setData(bb.map(d=>({time:d.time, value:d.upper}))); overlayRefs.current.bb[1].setData(bb.map(d=>({time:d.time, value:d.lower}))); }
    if (indicators.ichimoku) {
        const ich = calculateIchimoku(klineData);
        if (!overlayRefs.current.ich) { overlayRefs.current.ich = { tenkan: chart.addLineSeries({color:ICHIMOKU_COLORS.TENKAN, lineWidth:1}), kijun: chart.addLineSeries({color:ICHIMOKU_COLORS.KIJUN, lineWidth:1}), senkouA: chart.addLineSeries({color:ICHIMOKU_COLORS.SPAN_A, lineWidth:1}), senkouB: chart.addLineSeries({color:ICHIMOKU_COLORS.SPAN_B, lineWidth:1}), chikou: chart.addLineSeries({color:ICHIMOKU_COLORS.CHIKOU, lineWidth:1, lineStyle:LineStyle.Dashed}) }; }
        overlayRefs.current.ich.tenkan.setData(ich.tenkan); overlayRefs.current.ich.kijun.setData(ich.kijun); overlayRefs.current.ich.senkouA.setData(ich.senkouA); overlayRefs.current.ich.senkouB.setData(ich.senkouB); overlayRefs.current.ich.chikou.setData(ich.chikou);
    }

    if (subChartRef.current) {
        const subChart = subChartRef.current;
        if (!indicators.rsi && oscillatorRefs.current.rsi) { subChart.removeSeries(oscillatorRefs.current.rsi); delete oscillatorRefs.current.rsi; }
        if (!indicators.macd && oscillatorRefs.current.macd) { subChart.removeSeries(oscillatorRefs.current.macd.hist); subChart.removeSeries(oscillatorRefs.current.macd.macd); subChart.removeSeries(oscillatorRefs.current.macd.signal); delete oscillatorRefs.current.macd; }
        if (indicators.rsi) { if (!oscillatorRefs.current.rsi) { const s = subChart.addLineSeries({ color: '#a78bfa', lineWidth: 2 }); s.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed }); s.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dashed }); oscillatorRefs.current.rsi = s; } oscillatorRefs.current.rsi.setData(calculateRSI(klineData)); }
        if (indicators.macd) { if (!oscillatorRefs.current.macd) oscillatorRefs.current.macd = { hist: subChart.addHistogramSeries(), macd: subChart.addLineSeries({color:'#2962FF'}), signal: subChart.addLineSeries({color:'#FF6D00'}) }; const macd = calculateMACD(klineData); oscillatorRefs.current.macd.hist.setData(macd.map(d=>({time:d.time, value:d.hist, color:d.hist>0?'#26a69a':'#ef5350'}))); oscillatorRefs.current.macd.macd.setData(macd.map(d=>({time:d.time, value:d.macd}))); oscillatorRefs.current.macd.signal.setData(macd.map(d=>({time:d.time, value:d.signal}))); }
        subChart.timeScale().fitContent();
    }
  }, [klineData, indicators, supportResistance]);
  
  const lastCandle = klineData[klineData.length - 1];

  return (
    <div className={`flex flex-col lg:flex-row gap-4 bg-gray-950 text-gray-100 ${isMobile ? 'p-2 pb-20' : 'p-4 h-[calc(100vh-80px)]'}`}>
      <div className={`flex-grow flex flex-col bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden relative ${isMobile ? 'min-h-[450px]' : ''}`}>
        <div className="flex justify-between items-center p-2 border-b border-gray-800 bg-gray-900 z-20">
          <div className="flex items-center gap-3">
             <Link to="/monitor" className="p-2 bg-gray-800 rounded hover:bg-gray-700"><ArrowLeftIcon className="w-4 h-4"/></Link>
             <div>
                <h1 className="text-base font-bold flex gap-2">{symbol} <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">{marketType}</span></h1>
                <p className="text-lg font-mono font-bold text-white leading-none">{formatPrice(lastCandle?.close)}</p>
             </div>
          </div>
          <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-[150px] lg:max-w-none">
             {Object.keys(TIMEFRAMES).map(tf => (<button key={tf} onClick={() => setActiveTimeframe(tf)} className={`px-2 py-1 text-[10px] rounded font-bold whitespace-nowrap ${activeTimeframe === tf ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>{tf}</button>))}
          </div>
        </div>
        <div className="flex gap-2 p-2 bg-gray-900 border-b border-gray-800 overflow-x-auto no-scrollbar text-[10px] font-bold">
           <button onClick={() => setIndicators(p => ({...p, sr: !p.sr}))} className={`px-3 py-1 rounded whitespace-nowrap ${indicators.sr ? 'bg-gray-600 text-white' : 'bg-gray-700 text-gray-400'}`}>S/R</button>
           <button onClick={() => setIndicators(p => ({...p, sma: !p.sma}))} className={`px-3 py-1 rounded whitespace-nowrap ${indicators.sma ? 'bg-yellow-900/50 text-yellow-400' : 'bg-gray-700 text-gray-400'}`}>SMA</button>
           <button onClick={() => setIndicators(p => ({...p, bb: !p.bb}))} className={`px-3 py-1 rounded whitespace-nowrap ${indicators.bb ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>BB</button>
           <button onClick={() => setIndicators(p => ({...p, ichimoku: !p.ichimoku}))} className={`px-3 py-1 rounded whitespace-nowrap ${indicators.ichimoku ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>Cloud</button>
           <div className="w-px h-4 bg-gray-700 mx-1"></div>
           <button onClick={() => setIndicators(p => ({...p, rsi: !p.rsi, macd: false}))} className={`px-3 py-1 rounded whitespace-nowrap ${indicators.rsi ? 'bg-purple-900/50 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>RSI</button>
           <button onClick={() => setIndicators(p => ({...p, macd: !p.macd, rsi: false}))} className={`px-3 py-1 rounded whitespace-nowrap ${indicators.macd ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>MACD</button>
        </div>
        {indicators.ichimoku && (
          <div className="absolute top-[88px] md:top-16 left-4 z-10 bg-gray-900/80 backdrop-blur-sm p-2 rounded border border-gray-700 text-[10px] space-y-1 shadow-lg pointer-events-none">
             <div className="font-bold text-gray-300 mb-1 border-b border-gray-700 pb-1">Ichimoku</div>
             <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background: ICHIMOKU_COLORS.TENKAN}}></span> <span style={{color: ICHIMOKU_COLORS.TENKAN}}>Tenkan</span></div>
             <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background: ICHIMOKU_COLORS.KIJUN}}></span> <span style={{color: ICHIMOKU_COLORS.KIJUN}}>Kijun</span></div>
             <div className="hidden md:flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background: ICHIMOKU_COLORS.SPAN_A}}></span> <span style={{color: ICHIMOKU_COLORS.SPAN_A}}>Span A</span></div>
             <div className="hidden md:flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background: ICHIMOKU_COLORS.SPAN_B}}></span> <span style={{color: ICHIMOKU_COLORS.SPAN_B}}>Span B</span></div>
          </div>
        )}
        <div className="flex-grow flex flex-col relative bg-[#121212]">
           <div className="flex-grow relative border-b border-gray-800"><div ref={mainChartContainerRef} className="absolute inset-0" /></div>
           {(indicators.rsi || indicators.macd) && (<div className={`${isMobile ? 'h-[120px]' : 'h-[150px]'} relative border-t border-gray-700 bg-[#1e1e1e]`}><div ref={subChartContainerRef} className="absolute inset-0" /></div>)}
        </div>
      </div>
      <div className="w-full lg:w-80 flex-shrink-0 bg-gray-900 z-30">
        <TradePanel symbol={symbol || ''} currentPrice={lastCandle?.close || 0} marketType={marketType} setMarketType={setMarketType} isMobile={isMobile} />
      </div>
    </div>
  );
};

export default CoinChart;