import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { 
  FaArrowLeft, FaHistory, FaMoneyBillWave, 
  FaRobot, FaCalculator, FaChartLine, FaCheckCircle, 
  FaClock, FaWallet, FaEye, FaEyeSlash, FaList, FaTrash 
} from "react-icons/fa";
import { Link, useSearchParams } from "react-router-dom";
import { createChart, IChartApi, ISeriesApi, ColorType, Time } from "lightweight-charts";

// --- MOCK DATA ---
const SYSTEM_ACCOUNTS = [
  { id: 'custom', name: '-- Nhập tay (Custom) --', apiKey: '', secretKey: '', balance: 0 },
  { id: 'user_01', name: 'Nguyễn Văn A (Main)', apiKey: 'vmPUZE6mv9sd...', secretKey: 'NhqPtMdSJ...', balance: 2450.50 },
  { id: 'user_02', name: 'Invest Fund (Sub)', apiKey: 'AbCxE6mv9sd...', secretKey: 'XyZPtMdS...', balance: 15000.00 },
];

const COINS = [
  { id: "BTC", name: "Bitcoin" }, { id: "ETH", name: "Ethereum" },
  { id: "BNB", name: "Binance Coin" }, { id: "SOL", name: "Solana" },
  { id: "XRP", name: "Ripple" }, { id: "ADA", name: "Cardano" },
  { id: "DOGE", name: "Dogecoin" }, { id: "DOT", name: "Polkadot" },
  { id: "MATIC", name: "Polygon" }, { id: "LTC", name: "Litecoin" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS = [{ val: 1, label: "Thứ 2" }, { val: 2, label: "Thứ 3" }, { val: 3, label: "Thứ 4" }, { val: 4, label: "Thứ 5" }, { val: 5, label: "Thứ 6" }, { val: 6, label: "Thứ 7" }, { val: 0, label: "Chủ Nhật" }];
const DATES = Array.from({ length: 28 }, (_, i) => i + 1);

// --- INTERFACES ---
interface BacktestResult {
  symbol: string;
  totalInvested: number;
  currentValue: number;
  totalCoins: number;
  pnl: number;
  roe: number;
  avgPrice: number;
  buyCount: number;
  history: { time: string; value: number; invested: number }[];
}

interface Transaction {
  id: number;
  date: string;
  price: number;
  amountCoin: number;
  amountUsdt: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
}

interface DCAPlan {
  id: number;
  symbol: string;
  amount: number;
  frequency: string;
  detailTime: string;
  nextRun: string;
  status: 'RUNNING' | 'PAUSED';
  accountName?: string;
  totalInvested: number;
  currentValue: number;
  transactions: Transaction[];
}

export default function DCA() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'DEMO';
  const [activeTab, setActiveTab] = useState<'DEMO' | 'REAL' | 'BACKTEST'>(tabParam as 'DEMO' | 'REAL' | 'BACKTEST');

  // Sync with URL params
  useEffect(() => {
    const tab = searchParams.get('tab') || 'DEMO';
    if (tab === 'DEMO' || tab === 'REAL' || tab === 'BACKTEST') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Input States
  const [coin, setCoin] = useState("BTC");
  const [amount, setAmount] = useState(100); 
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [durationYears, setDurationYears] = useState(1); 
  const [targetHour, setTargetHour] = useState(7);
  const [targetWeekday, setTargetWeekday] = useState(1);
  const [targetDate, setTargetDate] = useState(1);

  // Account States
  const [selectedAccountId, setSelectedAccountId] = useState<string>('custom');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [realBalance, setRealBalance] = useState(0); 
  const [realPlans, setRealPlans] = useState<DCAPlan[]>([]);

  // DEMO States
  const [demoBalance, setDemoBalance] = useState(10000);
  const [demoPlans, setDemoPlans] = useState<DCAPlan[]>([]);

  // Backtest & UI States
  const [isCalculating, setIsCalculating] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
  
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // --- LOGIC HANDLERS ---
  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const accId = e.target.value;
    setSelectedAccountId(accId);
    const acc = SYSTEM_ACCOUNTS.find(a => a.id === accId);
    if (acc) {
      setApiKey(acc.apiKey);
      setSecretKey(acc.secretKey);
      setRealBalance(acc.balance);
    } else {
      setApiKey(''); setSecretKey(''); setRealBalance(0);
    }
  };

  const handleCreatePlan = () => {
    let timeDetail = "";
    if (frequency === 'DAILY') timeDetail = `${targetHour}:00 hàng ngày`;
    if (frequency === 'WEEKLY') timeDetail = `Thứ ${targetWeekday === 0 ? 'CN' : targetWeekday + 1}, ${targetHour}:00`;
    if (frequency === 'MONTHLY') timeDetail = `Ngày ${targetDate}, ${targetHour}:00`;

    const newPlan: DCAPlan = {
      id: Date.now(),
      symbol: coin,
      amount: amount,
      frequency: frequency,
      detailTime: timeDetail,
      nextRun: "2025-02-01 07:00",
      status: 'RUNNING',
      accountName: SYSTEM_ACCOUNTS.find(a=>a.id===selectedAccountId)?.name || 'Custom Key',
      totalInvested: 0,
      currentValue: 0,
      transactions: [] 
    };

    if (!apiKey) return alert("Vui lòng chọn tài khoản hoặc nhập API Key!");
    if (realBalance < amount) return alert("Số dư thực tế không đủ!");
    
    setRealPlans([newPlan, ...realPlans]);
    alert("✅ Đã kích hoạt Plan Real thành công!");
  };

  const mockRunTransaction = (planId: number) => {
    const currentPrice = 95000 + Math.random() * 2000;
    const newTx: Transaction = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      price: currentPrice,
      amountUsdt: amount,
      amountCoin: amount / currentPrice,
      status: 'SUCCESS'
    };

    if (realBalance < amount) return alert("Số dư không đủ!");
    setRealBalance(prev => prev - amount);
    setRealPlans(plans => plans.map(p => p.id === planId ? {
      ...p,
      totalInvested: p.totalInvested + amount,
      currentValue: p.currentValue + amount, // Mock value
      transactions: [newTx, ...p.transactions]
    } : p));
  };

  const fetchAllHistoricalData = async (symbol: string, startTime: number, endTime: number) => {
    let allKlines: any[] = [];
    let currentStartTime = startTime;
    const interval = '1h'; const limit = 1000; const totalDuration = endTime - startTime;
    let loopCount = 0; const maxLoops = 200;

    while (currentStartTime < endTime && loopCount < maxLoops) {
      loopCount++;
      try {
        const res = await axios.get("https://api.binance.com/api/v3/klines", {
          params: { symbol: `${symbol}USDT`, interval, startTime: currentStartTime, endTime, limit },
        });
        const data = res.data;
        if (!data || data.length === 0) break;
        allKlines = [...allKlines, ...data];
        currentStartTime = data[data.length - 1][0] + 1; 
        setLoadingProgress(Math.min(99, Math.floor(((data[data.length - 1][0] - startTime) / totalDuration) * 100)));
        await new Promise(r => setTimeout(r, 20));
      } catch (err) { break; }
    }
    setLoadingProgress(100);
    return allKlines;
  };

  const runBacktest = async () => {
    setIsCalculating(true);
    setLoadingProgress(0);
    setBacktestResult(null);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - durationYears);
      
      const klines = await fetchAllHistoricalData(coin, startDate.getTime(), endDate.getTime());
      
      if (!klines || klines.length === 0) {
        alert("Không có dữ liệu lịch sử.");
        setIsCalculating(false);
        return;
      }

      let totalCoins = 0;
      let totalInvested = 0;
      let buyCount = 0;
      const dailyMap = new Map<string, { time: string, value: number, invested: number }>();

      for (let i = 0; i < klines.length; i++) {
        const timestamp = klines[i][0];
        const openPrice = parseFloat(klines[i][1]);
        const closePrice = parseFloat(klines[i][4]);
        
        const dateObj = new Date(timestamp);
        const currentHour = dateObj.getHours();     
        const currentDay = dateObj.getDay();        
        const currentDate = dateObj.getDate();      
        const dateString = dateObj.toISOString().split('T')[0];

        let shouldBuy = false;
        if (currentHour === targetHour) {
          if (frequency === 'DAILY') shouldBuy = true;
          else if (frequency === 'WEEKLY' && currentDay === targetWeekday) shouldBuy = true;
          else if (frequency === 'MONTHLY' && currentDate === targetDate) shouldBuy = true;
        }

        if (shouldBuy) {
          totalCoins += amount / openPrice;
          totalInvested += amount;
          buyCount++;
        }

        if (totalInvested > 0) {
            dailyMap.set(dateString, { time: dateString, value: totalCoins * closePrice, invested: totalInvested });
        }
      }

      const chartHistory = Array.from(dailyMap.values()).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      const finalPrice = parseFloat(klines[klines.length - 1][4]);
      const finalValue = totalCoins * finalPrice;
      const pnl = finalValue - totalInvested;
      const roe = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

      setBacktestResult({
        symbol: coin,
        totalInvested,
        currentValue: finalValue,
        totalCoins,
        pnl,
        roe,
        avgPrice: totalInvested > 0 ? totalInvested / totalCoins : 0,
        buyCount,
        history: chartHistory
      });

    } catch (error) {
      console.error(error);
      alert("Lỗi tính toán.");
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'BACKTEST' || !backtestResult || !chartContainerRef.current) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9CA3AF' },
      grid: { vertLines: { color: '#374151' }, horzLines: { color: '#374151' } },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
    });

    const valueSeries = chart.addLineSeries({ color: '#22c55e', lineWidth: 2 });
    const investedSeries = chart.addLineSeries({ color: '#fbbf24', lineWidth: 2, lineStyle: 2 });

    const valueData = backtestResult.history.map(h => ({ time: h.time as Time, value: h.value }));
    const investedData = backtestResult.history.map(h => ({ time: h.time as Time, value: h.invested }));

    if (valueData.length > 0) {
        valueSeries.setData(valueData);
        investedSeries.setData(investedData);
        chart.timeScale().fitContent();
    }
    chartRef.current = chart;

    const handleResize = () => { if(chartContainerRef.current && chartRef.current) chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth }); };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; } };
  }, [backtestResult, activeTab]);

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 pb-20 md:p-6 md:pb-6">
      
      {/* 1. HEADER (Mobile Optimized) */}
      <div className="p-4 bg-gray-900 border-b border-gray-800 md:border-none md:bg-transparent md:p-0 flex flex-row items-center gap-4 mb-0 md:mb-6 sticky top-0 z-40">
        <Link to="/" className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 transition text-gray-300 hover:text-white border border-gray-700">
            <FaArrowLeft />
        </Link>
        <div>
           <h1 className="text-lg md:text-3xl font-bold text-white flex items-center gap-2">
             <FaRobot className="text-accent-yellow"/> <span>DCA Master</span>
           </h1>
           <p className="text-gray-500 text-xs md:text-sm">Tích sản Tự động</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex p-1 bg-gray-900 rounded-lg mb-6 border border-gray-700">
        <button
          onClick={() => {
            setActiveTab('DEMO');
            setSearchParams({ tab: 'DEMO' });
          }}
          className={`flex-1 py-2 text-xs font-bold rounded transition-all ${activeTab === 'DEMO' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
        >
          🟣 DEMO
        </button>
        <button
          onClick={() => {
            setActiveTab('REAL');
            setSearchParams({ tab: 'REAL' });
          }}
          className={`flex-1 py-2 text-xs font-bold rounded transition-all ${activeTab === 'REAL' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
        >
          🟢 REAL
        </button>
        <button
          onClick={() => {
            setActiveTab('BACKTEST');
            setSearchParams({ tab: 'BACKTEST' });
          }}
          className={`flex-1 py-2 text-xs font-bold rounded transition-all ${activeTab === 'BACKTEST' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
        >
          🔵 BACKTEST
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 md:gap-6 max-w-7xl mx-auto">
        
        {/* --- LEFT: SETTINGS PANEL --- */}
        {/* Mobile: Full width, no rounded corners. Desktop: Card style */}
        <div className="lg:col-span-1 bg-gray-900 md:bg-gray-800 border-b md:border border-gray-800 md:rounded-xl p-5 md:p-6 shadow-none md:shadow-lg h-fit">
          <h2 className="text-base font-bold mb-5 text-white flex items-center gap-2 pb-3 border-b border-gray-800">
            <FaCalculator className="text-accent-yellow"/> Cấu hình {activeTab === 'REAL' ? 'Đầu tư' : 'Kiểm thử'}
          </h2>

          <div className="space-y-5">
            {/* ACCOUNT INFO (Only Real Mode) */}
            {activeTab === 'REAL' && (
              <div className="bg-green-900/10 border border-green-800/50 rounded-lg p-3 space-y-3">
                 <div className="flex justify-between items-center text-green-400 text-[10px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1"><FaWallet/> Tài khoản</span>
                    <span className={apiKey ? 'text-green-400' : 'text-gray-500'}>{apiKey ? '● Connected' : '○ No Key'}</span>
                 </div>
                 <select value={selectedAccountId} onChange={handleAccountChange} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none">
                    {SYSTEM_ACCOUNTS.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                 </select>
                 {selectedAccountId === 'custom' && (
                   <div className="space-y-2">
                      <input type="text" placeholder="API Key" value={apiKey} onChange={e=>setApiKey(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs text-white" />
                      <div className="relative">
                        <input type={showSecret?"text":"password"} placeholder="Secret Key" value={secretKey} onChange={e=>setSecretKey(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-xs text-white pr-8" />
                        <button className="absolute right-2 top-2 text-gray-400" onClick={()=>setShowSecret(!showSecret)}>{showSecret?<FaEyeSlash size={14}/>:<FaEye size={14}/>}</button>
                      </div>
                   </div>
                 )}
                 <div className="flex justify-between items-center pt-2 border-t border-green-800/20">
                    <span className="text-xs text-gray-400">Số dư khả dụng</span>
                    <span className="text-lg font-bold text-white">{formatMoney(realBalance)}</span>
                 </div>
              </div>
            )}

            {/* INPUTS: COIN & AMOUNT */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 mb-1.5 block">Chọn Coin</label>
                <select value={coin} onChange={(e) => setCoin(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white outline-none text-sm font-bold">
                  {COINS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 mb-1.5 block">Số tiền (USDT)</label>
                <input 
                  type="number" 
                  inputMode="decimal" // Bàn phím số trên mobile
                  value={amount} 
                  onChange={(e) => setAmount(Number(e.target.value))} 
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white outline-none text-sm font-bold font-mono" 
                />
              </div>
            </div>

            {/* FREQUENCY */}
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 mb-1.5 block">Tần suất mua</label>
              <div className="grid grid-cols-3 gap-2">
                {['DAILY', 'WEEKLY', 'MONTHLY'].map((freq) => (
                  <button key={freq} onClick={() => setFrequency(freq as any)} className={`py-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all border ${frequency === freq ? "bg-blue-600 border-blue-500 text-white shadow-md" : "bg-gray-950 border-gray-700 text-gray-400"}`}>
                    {freq === 'DAILY' ? 'Hàng Ngày' : freq === 'WEEKLY' ? 'Hàng Tuần' : 'Hàng Tháng'}
                  </button>
                ))}
              </div>
            </div>

            {/* TIMING */}
            <div className="bg-gray-950/50 p-3 rounded-lg border border-gray-800 space-y-3">
               <div className="flex items-center gap-2 text-xs text-gray-300 font-bold">
                 <FaClock className="text-accent-yellow"/> Thời điểm khớp lệnh
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <select value={targetHour} onChange={(e) => setTargetHour(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-white outline-none">
                     {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
                   </select>
                 </div>
                 {frequency !== 'DAILY' && (
                   <div>
                     <select value={frequency==='WEEKLY' ? targetWeekday : targetDate} onChange={(e) => frequency==='WEEKLY' ? setTargetWeekday(Number(e.target.value)) : setTargetDate(Number(e.target.value))} className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-white outline-none">
                       {frequency==='WEEKLY' 
                         ? WEEKDAYS.map(w => <option key={w.val} value={w.val}>{w.label}</option>)
                         : DATES.map(d => <option key={d} value={d}>Ngày {d}</option>)
                       }
                     </select>
                   </div>
                 )}
               </div>
            </div>

            {/* DURATION (Backtest Only) */}
            {activeTab === 'BACKTEST' && (
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 mb-1.5 block">Dữ liệu quá khứ</label>
                <select value={durationYears} onChange={(e) => setDurationYears(Number(e.target.value))} className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white outline-none text-sm">
                  <option value="1">1 Năm qua</option>
                  <option value="3">3 Năm qua</option>
                  <option value="5">5 Năm qua</option>
                  <option value="10">10 Năm qua</option>
                </select>
              </div>
            )}

            {/* ACTION BUTTON */}
            <div className="pt-2 pb-4 md:pb-0">
              {activeTab === 'BACKTEST' ? (
                <button onClick={runBacktest} disabled={isCalculating} className="w-full py-4 bg-accent-yellow hover:bg-yellow-500 text-gray-900 font-bold rounded-xl shadow-lg active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wide text-sm">
                  {isCalculating ? <span className="animate-spin">↻</span> : <FaHistory/>} 
                  {isCalculating ? `Loading ${loadingProgress}%` : 'CHẠY BACKTEST'}
                </button>
              ) : (
                <button onClick={handleCreatePlan} className="w-full py-4 font-bold rounded-xl shadow-lg active:scale-95 transition flex items-center justify-center gap-2 text-sm uppercase tracking-wide bg-green-600 hover:bg-green-500 text-white">
                  <FaCheckCircle/> KÍCH HOẠT LỆNH THẬT
                </button>
              )}
            </div>
          </div>
        </div>

        {/* --- RIGHT: DISPLAY PANEL --- */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6 px-0 md:px-0">
          
          {/* VIEW DEMO PLAN LIST */}
          {activeTab === 'DEMO' && (
            <div className="bg-gray-900 md:bg-gray-800 md:border border-gray-800 md:rounded-xl p-4 md:p-6 shadow-none md:shadow-lg min-h-[400px]">
               <div className="flex justify-between items-center mb-6 px-2 md:px-0">
                 <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-purple-400">
                   <FaRobot/> Danh sách Plan DEMO
                 </h2>
                 <span className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded border border-purple-800">
                   Demo Balance: {formatMoney(demoBalance)}
                 </span>
               </div>

               <div className="space-y-3">
                 {demoPlans.map((plan) => (
                   <div key={plan.id} className="bg-gray-800 md:bg-gray-700/20 border border-gray-700 md:border-gray-600 rounded-xl overflow-hidden shadow-sm">
                      <div className="p-4 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm bg-purple-900 text-purple-400">
                                {plan.symbol.substring(0,3)}
                              </div>
                              <div>
                                 <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{plan.symbol}</span>
                                    <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{plan.frequency}</span>
                                 </div>
                                 <div className="text-xs text-gray-400 mt-0.5">
                                    <span className="text-white font-bold">{plan.amount}$</span> / lần
                                 </div>
                              </div>
                           </div>
                           <button 
                             onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                             className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg flex items-center gap-1 border border-gray-600 transition"
                           >
                             <FaList/> Chi tiết
                           </button>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                           <div>
                              <p className="text-[10px] text-gray-500 uppercase font-bold">Đã đầu tư</p>
                              <p className="text-sm text-white font-bold font-mono">{formatMoney(plan.totalInvested)}</p>
                           </div>
                           <div className="flex gap-2">
                             <button onClick={() => {
                               const currentPrice = 95000 + Math.random() * 2000;
                               const newTx = {
                                 id: Date.now(),
                                 date: new Date().toLocaleString(),
                                 price: currentPrice,
                                 amountUsdt: amount,
                                 amountCoin: amount / currentPrice,
                                 status: 'SUCCESS' as const
                               };
                               setDemoBalance(prev => prev - amount);
                               setDemoPlans(plans => plans.map(p => p.id === plan.id ? {
                                 ...p,
                                 totalInvested: p.totalInvested + amount,
                                 currentValue: p.currentValue + amount,
                                 transactions: [newTx, ...p.transactions]
                               } : p));
                             }} className="text-[10px] bg-gray-800 border border-gray-600 px-3 py-1.5 rounded-full text-gray-300 hover:text-white hover:bg-gray-700 transition">Test</button>
                             <button className="text-[10px] bg-red-900/20 border border-red-800 px-3 py-1.5 rounded-full text-red-400 hover:bg-red-900/40"><FaTrash/></button>
                           </div>
                        </div>
                      </div>

                      {expandedPlanId === plan.id && (
                        <div className="bg-gray-950/50 border-t border-gray-700 p-4">
                           <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">
                             Lịch sử giao dịch
                           </h4>
                           {plan.transactions.length === 0 ? (
                             <p className="text-center text-xs text-gray-500 italic py-4 border border-dashed border-gray-800 rounded">Chưa có giao dịch nào.</p>
                           ) : (
                             <div className="overflow-x-auto">
                               <table className="w-full text-left text-xs whitespace-nowrap">
                                 <thead className="text-gray-500 border-b border-gray-800">
                                   <tr>
                                     <th className="py-2 pl-2">Time</th>
                                     <th className="py-2">Price</th>
                                     <th className="py-2">Amount</th>
                                     <th className="py-2 text-right pr-2">Total</th>
                                   </tr>
                                 </thead>
                                 <tbody className="text-gray-300 divide-y divide-gray-800">
                                   {plan.transactions.map(tx => (
                                     <tr key={tx.id}>
                                       <td className="py-2 pl-2 text-gray-500">{tx.date.split(',')[1]}</td>
                                       <td className="py-2 font-mono text-accent-yellow">${tx.price.toFixed(0)}</td>
                                       <td className="py-2 font-mono">{tx.amountCoin.toFixed(5)}</td>
                                       <td className="py-2 font-mono font-bold text-right pr-2">{formatMoney(tx.amountUsdt)}</td>
                                     </tr>
                                   ))}
                                 </tbody>
                               </table>
                             </div>
                           )}
                        </div>
                      )}
                   </div>
                 ))}

                 {demoPlans.length === 0 && (
                   <div className="text-center py-12 bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-700 mx-4 md:mx-0">
                     <FaRobot className="text-4xl text-gray-600 mx-auto mb-3"/>
                     <p className="text-gray-400 text-sm">Chưa có kế hoạch DEMO nào.</p>
                     <button 
                        onClick={() => {
                          let timeDetail = "";
                          if (frequency === 'DAILY') timeDetail = `${targetHour}:00 hàng ngày`;
                          if (frequency === 'WEEKLY') timeDetail = `Thứ ${targetWeekday === 0 ? 'CN' : targetWeekday + 1}, ${targetHour}:00`;
                          if (frequency === 'MONTHLY') timeDetail = `Ngày ${targetDate}, ${targetHour}:00`;

                          const newPlan = {
                            id: Date.now(),
                            symbol: coin,
                            amount,
                            frequency,
                            detailTime: timeDetail,
                            nextRun: "2025-02-01 07:00",
                            status: 'RUNNING' as const,
                            accountName: 'Demo Account',
                            totalInvested: 0,
                            currentValue: 0,
                            transactions: []
                          };
                          setDemoPlans([newPlan, ...demoPlans]);
                        }}
                        className="mt-4 text-xs bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition"
                     >
                       Tạo Plan DEMO
                     </button>
                   </div>
                 )}
               </div>
            </div>
          )}

          {/* VIEW 1: PLAN LIST */}
          {activeTab === 'REAL' && (
            <div className="bg-gray-900 md:bg-gray-800 md:border border-gray-800 md:rounded-xl p-4 md:p-6 shadow-none md:shadow-lg min-h-[400px]">
               <div className="flex justify-between items-center mb-6 px-2 md:px-0">
                 <h2 className="text-lg md:text-xl font-bold flex items-center gap-2 text-green-400">
                   <FaMoneyBillWave/> Danh sách Plan REAL
                 </h2>
               </div>

               <div className="space-y-3">
                 {realPlans.map((plan) => (
                   <div key={plan.id} className="bg-gray-800 md:bg-gray-700/20 border border-gray-700 md:border-gray-600 rounded-xl overflow-hidden shadow-sm">
                      {/* Plan Summary */}
                      <div className="p-4 flex flex-col gap-4">
                        {/* Top Row: Coin Info & Status */}
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm bg-green-900 text-green-400">
                                {plan.symbol.substring(0,3)}
                              </div>
                              <div>
                                 <div className="flex items-center gap-2">
                                    <span className="font-bold text-white">{plan.symbol}</span>
                                    <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{plan.frequency}</span>
                                 </div>
                                 <div className="text-xs text-gray-400 mt-0.5">
                                    <span className="text-white font-bold">{plan.amount}$</span> / lần
                                 </div>
                              </div>
                           </div>
                           <button 
                             onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                             className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg flex items-center gap-1 border border-gray-600 transition"
                           >
                             <FaList/> Chi tiết
                           </button>
                        </div>

                        {/* Bottom Row: Stats & Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                           <div>
                              <p className="text-[10px] text-gray-500 uppercase font-bold">Đã đầu tư</p>
                              <p className="text-sm text-white font-bold font-mono">{formatMoney(plan.totalInvested)}</p>
                           </div>
                           <div className="flex gap-2">
                             <button onClick={() => mockRunTransaction(plan.id)} className="text-[10px] bg-gray-800 border border-gray-600 px-3 py-1.5 rounded-full text-gray-300 hover:text-white hover:bg-gray-700 transition">Test</button>
                             <button className="text-[10px] bg-red-900/20 border border-red-800 px-3 py-1.5 rounded-full text-red-400 hover:bg-red-900/40"><FaTrash/></button>
                           </div>
                        </div>
                      </div>

                      {/* Expanded History */}
                      {expandedPlanId === plan.id && (
                        <div className="bg-gray-950/50 border-t border-gray-700 p-4 animate-fadeIn">
                           <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 flex justify-between">
                             <span>Lịch sử giao dịch</span>
                             <span className="text-gray-500 truncate max-w-[150px]">{plan.accountName}</span>
                           </h4>
                           {plan.transactions.length === 0 ? (
                             <p className="text-center text-xs text-gray-500 italic py-4 border border-dashed border-gray-800 rounded">Chưa có giao dịch nào.</p>
                           ) : (
                             <div className="overflow-x-auto">
                               <table className="w-full text-left text-xs whitespace-nowrap">
                                 <thead className="text-gray-500 border-b border-gray-800">
                                   <tr>
                                     <th className="py-2 pl-2">Time</th>
                                     <th className="py-2">Price</th>
                                     <th className="py-2">Amount</th>
                                     <th className="py-2 text-right pr-2">Total</th>
                                   </tr>
                                 </thead>
                                 <tbody className="text-gray-300 divide-y divide-gray-800">
                                   {plan.transactions.map(tx => (
                                     <tr key={tx.id}>
                                       <td className="py-2 pl-2 text-gray-500">{tx.date.split(',')[1]}</td>
                                       <td className="py-2 font-mono text-accent-yellow">${tx.price.toFixed(0)}</td>
                                       <td className="py-2 font-mono">{tx.amountCoin.toFixed(5)}</td>
                                       <td className="py-2 font-mono font-bold text-right pr-2">{formatMoney(tx.amountUsdt)}</td>
                                     </tr>
                                   ))}
                                 </tbody>
                               </table>
                             </div>
                           )}
                        </div>
                      )}
                   </div>
                 ))}

                 {realPlans.length === 0 && (
                   <div className="text-center py-12 bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-700 mx-4 md:mx-0">
                     <FaRobot className="text-4xl text-gray-600 mx-auto mb-3"/>
                     <p className="text-gray-400 text-sm">Chưa có kế hoạch nào.</p>
                   </div>
                 )}
               </div>
            </div>
          )}

          {/* VIEW 2: BACKTEST RESULT */}
          {activeTab === 'BACKTEST' && (
            <div className="bg-gray-900 md:bg-gray-800 border-y md:border border-gray-800 md:rounded-xl p-4 md:p-6 shadow-none md:shadow-lg h-full flex flex-col">
              <div className="flex justify-between items-center mb-6 px-2 md:px-0">
                 <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                   <FaChartLine className="text-blue-400"/> Kết quả Backtest
                 </h2>
                 {backtestResult && (
                   <span className={`text-xs font-bold px-2 py-1 rounded border ${backtestResult.roe >= 0 ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-red-900/30 text-red-400 border-red-800'}`}>
                     ROE: {backtestResult.roe > 0 ? '+' : ''}{backtestResult.roe.toFixed(2)}%
                   </span>
                 )}
              </div>

              {!backtestResult ? (
                <div className="flex-grow flex flex-col items-center justify-center text-gray-500 min-h-[300px] bg-gray-900/30 rounded-xl border border-dashed border-gray-800 mx-4 md:mx-0">
                  <FaMoneyBillWave className="text-5xl mb-4 opacity-20"/>
                  <p className="text-sm">Chạy Backtest để xem kết quả</p>
                  {isCalculating && (
                    <div className="mt-4 w-1/2 bg-gray-700 rounded-full h-1.5">
                      <div className="bg-accent-yellow h-1.5 rounded-full transition-all duration-300" style={{ width: `${loadingProgress}%` }}></div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-6 px-2 md:px-0">
                    <div className="bg-gray-800 md:bg-gray-700/30 p-3 rounded-lg border border-gray-700 md:border-gray-600/50">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Tổng Vốn</p>
                      <p className="text-lg font-bold text-gray-300">{formatMoney(backtestResult.totalInvested)}</p>
                    </div>
                    <div className="bg-gray-800 md:bg-gray-700/30 p-3 rounded-lg border border-gray-700 md:border-gray-600/50">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Giá trị hiện tại</p>
                      <p className="text-lg font-bold text-white">{formatMoney(backtestResult.currentValue)}</p>
                    </div>
                    <div className="bg-gray-800 md:bg-gray-700/30 p-3 rounded-lg border border-gray-700 md:border-gray-600/50">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Lãi / Lỗ</p>
                      <p className={`text-lg font-bold ${backtestResult.pnl>=0 ? 'text-green-400' : 'text-red-400'}`}>
                        {backtestResult.pnl >=0 ? '+' : ''}{formatMoney(backtestResult.pnl)}
                      </p>
                    </div>
                    <div className="bg-gray-800 md:bg-gray-700/30 p-3 rounded-lg border border-gray-700 md:border-gray-600/50">
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Giá TB Mua</p>
                      <p className="text-lg font-bold text-accent-yellow">${backtestResult.avgPrice.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex-grow bg-gray-950 md:bg-gray-900 border border-gray-800 md:border-gray-700 rounded-lg p-1 relative min-h-[300px] mx-2 md:mx-0">
                     <div ref={chartContainerRef} className="absolute inset-0 w-full h-full"/>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}