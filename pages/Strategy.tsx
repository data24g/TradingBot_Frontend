import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaArrowLeft, FaExclamationTriangle, FaInfoCircle, FaSyncAlt, FaChartLine, FaLayerGroup, FaMoneyBillWave, FaShieldAlt } from "react-icons/fa";
import { Link } from "react-router-dom";

// --- CẤU HÌNH COIN ---
const POPULAR_COINS = [
  { id: "BTC", name: "Bitcoin" }, { id: "ETH", name: "Ethereum" },
  { id: "BNB", name: "Binance Coin" }, { id: "SOL", name: "Solana" },
  { id: "XRP", name: "Ripple" }, { id: "DOGE", name: "Dogecoin" },
  { id: "ADA", name: "Cardano" }, { id: "AVAX", name: "Avalanche" },
  { id: "LINK", name: "Chainlink" }, { id: "DOT", name: "Polkadot" },
  { id: "TRX", name: "Tron" }, { id: "LTC", name: "Litecoin" },
];

// --- INTERFACES ---
interface EntryPlan {
  level: number;
  price: number;
  volume: number;
  coinSize: number;
  weight: number; // Tỷ trọng volume
}

interface ExitPlan {
  targetPercent: number;
  price: number;
  pnl: number;
  roe: number;
}

interface StrategyResult {
  plans: EntryPlan[];
  exitPlans: ExitPlan[];
  avgPrice: number;
  totalVolume: number;
  totalMargin: number;
  liquidationPrice: number | null;
  suggestedSL: number | null;
  lossAtSL: number;
  isRekt: boolean;
  isSafeRange: boolean; // Check xem Liq có nằm ngoài Range không
}

export default function Strategy() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'CLASSIC' | 'RANGE'>('CLASSIC');
  const [symbol, setSymbol] = useState("BTC");
  
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Common Inputs
  const [capital, setCapital] = useState(1000); 
  const [leverage, setLeverage] = useState(10); // Mặc định giảm đòn bẩy xuống cho an toàn
  const [direction, setDirection] = useState<"LONG" | "SHORT">("SHORT");

  // Classic Inputs
  const [entriesCount, setEntriesCount] = useState(6);

  // Range Inputs
  const [rangeMin, setRangeMin] = useState<string>('');
  const [rangeMax, setRangeMax] = useState<string>('');
  const [gridCount, setGridCount] = useState(5);
  // NEW: Hệ số nhân volume cho Range Mode
  const [multiplier, setMultiplier] = useState(1.5); 

  // Result state
  const [result, setResult] = useState<StrategyResult | null>(null);

  // --- LOGIC 1: FETCH GIÁ ---
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        const res = await axios.get(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}USDT`);
        const price = parseFloat(res.data.price);
        setCurrentPrice(price);
        
        // Auto-fill Range thông minh
        if(direction === 'SHORT') {
           setRangeMin(price.toFixed(2));
           setRangeMax((price * 1.1).toFixed(2));
        } else {
           setRangeMax(price.toFixed(2));
           setRangeMin((price * 0.9).toFixed(2));
        }
      } catch (error) {
        console.error("Error init price", error);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, [symbol, direction]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symbol}USDT`);
        setCurrentPrice(parseFloat(res.data.price));
      } catch (error) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [symbol]);

  useEffect(() => { setResult(null); }, [symbol, direction, capital, leverage, entriesCount, rangeMin, rangeMax, gridCount, activeTab, multiplier]);

  // --- FORMAT HELPER ---
  const formatPrice = (val: number) => {
    if (!val && val !== 0) return "...";
    let digits = 2;
    if (val < 0.0001) digits = 8;
    else if (val < 0.01) digits = 6;
    else if (val < 1) digits = 4;
    else if (val < 50) digits = 3;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits }).format(val);
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(val);

  // --- LOGIC TÍNH TOÁN ---
  const calculateStrategy = () => {
    if (!currentPrice) return;

    let entries: EntryPlan[] = [];
    let count = activeTab === 'CLASSIC' ? entriesCount : gridCount;
    
    // 1. TÍNH TOÁN ENTRY POINTS & VOLUMES
    if (activeTab === 'CLASSIC') {
      const stepPercent = 1.5; 
      const firstOrderPercent = 0.02; 
      let currentVolume = capital * leverage * firstOrderPercent; 

      for (let i = 0; i < count; i++) {
        const priceChange = stepPercent * i;
        const entryPrice = direction === "LONG"
            ? currentPrice * (1 - priceChange / 100)
            : currentPrice * (1 + priceChange / 100);

        if (i > 0) currentVolume = currentVolume * 2; 

        entries.push({ 
          level: i + 1, price: entryPrice, volume: currentVolume, coinSize: currentVolume / entryPrice, weight: 0
        });
      }
    } 
    else {
      // --- RANGE MODE (SỬA LẠI LOGIC MARTINGALE) ---
      const rMin = parseFloat(rangeMin);
      const rMax = parseFloat(rangeMax);

      if (!rMin || !rMax || rMin >= rMax) return alert("Vui lòng nhập khoảng giá Min < Max hợp lệ.");
      
      // Tính toán tổng hệ số (Total Ratio) để chia vốn
      // Ví dụ: Multiplier 2, 3 lệnh -> 1 + 2 + 4 = 7 phần
      let totalRatio = 0;
      for (let i = 0; i < count; i++) {
        totalRatio += Math.pow(multiplier, i);
      }

      // Tổng Volume Mục tiêu = Vốn * Leverage
      const totalTargetVolume = capital * leverage;
      
      // Volume cơ sở (Lệnh đầu tiên)
      const baseVolume = totalTargetVolume / totalRatio;

      // Logic bước giá (Step Price)
      let startPrice, endPrice;
      if (direction === 'LONG') {
        startPrice = Math.min(currentPrice, rMax); 
        endPrice = rMin;
      } else {
        startPrice = Math.max(currentPrice, rMin);
        endPrice = rMax;
      }

      const priceGap = Math.abs(startPrice - endPrice);
      const stepPrice = count > 1 ? priceGap / (count - 1) : 0; 

      for (let i = 0; i < count; i++) {
        let entryPrice = 0;
        if (direction === 'LONG') entryPrice = startPrice - (stepPrice * i);
        else entryPrice = startPrice + (stepPrice * i);

        // Clamping range
        if (direction === 'LONG' && entryPrice < rMin) entryPrice = rMin;
        if (direction === 'SHORT' && entryPrice > rMax) entryPrice = rMax;

        // Tính Volume theo cấp số nhân
        const vol = baseVolume * Math.pow(multiplier, i);

        entries.push({
          level: i + 1, 
          price: entryPrice, 
          volume: vol, 
          coinSize: vol / entryPrice,
          weight: Math.pow(multiplier, i)
        });
      }
    }

    // 2. TỔNG HỢP & LIQUIDATION
    const totalVolume = entries.reduce((acc, curr) => acc + curr.volume, 0);
    const totalSize = entries.reduce((acc, curr) => acc + curr.coinSize, 0);
    const avgPrice = totalVolume / totalSize;
    const totalMarginRequired = totalVolume / leverage;
    
    const availableForLoss = capital - totalMarginRequired; 
    let liqPrice = 0;
    let suggestedSL = 0;
    let lossAtSL = 0;
    let isRekt = false;
    let isSafeRange = true; // Cờ kiểm tra an toàn vùng giá

    if (availableForLoss < 0) {
      isRekt = true; 
    } else {
      const priceDistance = availableForLoss / totalSize;
      const maintenanceBuffer = avgPrice * 0.004;

      if (direction === "LONG") {
        let rawLiq = avgPrice - priceDistance;
        liqPrice = rawLiq + maintenanceBuffer; 
        suggestedSL = liqPrice * 1.005; // SL trên Liq 0.5%
        
        // CHECK AN TOÀN: Nếu Giá Thanh Lý cao hơn Giá thấp nhất của Range -> Nguy hiểm
        if (activeTab === 'RANGE' && liqPrice >= parseFloat(rangeMin)) isSafeRange = false;

      } else {
        // SHORT
        let rawLiq = avgPrice + priceDistance;
        liqPrice = rawLiq - maintenanceBuffer;
        suggestedSL = liqPrice * 0.995; // SL dưới Liq 0.5%

        // CHECK AN TOÀN: Nếu Giá Thanh Lý thấp hơn Giá cao nhất của Range -> Nguy hiểm
        if (activeTab === 'RANGE' && liqPrice <= parseFloat(rangeMax)) isSafeRange = false;
      }

      if (suggestedSL < 0) suggestedSL = 0;
      if (liqPrice < 0) liqPrice = 0;

      const priceDiff = Math.abs(avgPrice - suggestedSL);
      lossAtSL = priceDiff * totalSize;
    }

    // 3. EXIT PLAN
    const tpTargets = [2, 5, 10, 20];
    const exitPlans: ExitPlan[] = tpTargets.map(percent => {
      let exitPrice = direction === "LONG" ? avgPrice * (1 + percent / 100) : avgPrice * (1 - percent / 100);
      const pnl = totalSize * Math.abs(exitPrice - avgPrice);
      const roe = totalMarginRequired > 0 ? (pnl / totalMarginRequired) * 100 : 0;
      return { targetPercent: percent, price: exitPrice, pnl, roe };
    });

    setResult({
      plans: entries, exitPlans, avgPrice, totalVolume, totalMargin: totalMarginRequired,
      liquidationPrice: isRekt ? null : liqPrice, suggestedSL: isRekt ? null : suggestedSL, lossAtSL, isRekt, isSafeRange
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-3 md:p-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Link to="/" className="flex items-center gap-2 p-2 px-4 rounded-full bg-gray-800 hover:bg-gray-700 transition text-gray-300 hover:text-white text-sm">
            <FaArrowLeft /> Back
        </Link>
        <div>
           <h1 className="text-2xl sm:text-3xl font-bold text-white">Futures Strategy Planner</h1>
           <p className="text-gray-400 text-xs sm:text-sm">Chiến lược {direction} {symbol}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- SETTINGS --- */}
        <div className="lg:col-span-1 bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg h-fit">
          <div className="flex p-1 bg-gray-900 rounded-lg mb-6 border border-gray-700">
             <button onClick={() => setActiveTab('CLASSIC')} className={`flex-1 py-2 text-xs font-bold rounded transition-all ${activeTab==='CLASSIC' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>CLASSIC DCA</button>
             <button onClick={() => setActiveTab('RANGE')} className={`flex-1 py-2 text-xs font-bold rounded transition-all ${activeTab==='RANGE' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>RANGE DCA</button>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-xs uppercase font-bold text-gray-500 mb-2 block">1. Chọn Coin</label>
              <div className="h-32 overflow-y-auto pr-1 grid grid-cols-3 sm:grid-cols-4 gap-2 border border-gray-700/50 rounded-lg p-2 bg-gray-900/30">
                {POPULAR_COINS.map((c) => (
                  <button key={c.id} onClick={() => setSymbol(c.id)} className={`p-2 rounded text-[10px] font-bold border ${symbol === c.id ? "bg-accent-yellow text-gray-900 border-accent-yellow" : "bg-gray-700 text-gray-300 border-transparent"}`}>{c.id}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Vốn (USDT)</label>
                <input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value))} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white text-lg outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Đòn bẩy (x)</label>
                <input type="number" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white text-lg text-center outline-none" />
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => setDirection("LONG")} className={`py-3 rounded-lg font-bold transition-all ${direction === "LONG" ? "bg-green-600 text-white ring-2 ring-green-400" : "bg-gray-700 text-gray-400"}`}>LONG ↗</button>
                <button onClick={() => setDirection("SHORT")} className={`py-3 rounded-lg font-bold transition-all ${direction === "SHORT" ? "bg-red-600 text-white ring-2 ring-red-400" : "bg-gray-700 text-gray-400"}`}>SHORT ↘</button>
              </div>

              {activeTab === 'CLASSIC' ? (
                <div className="bg-gray-700/20 p-3 rounded border border-gray-600 space-y-3">
                   <div className="flex justify-between items-center">
                      <label className="text-xs text-gray-300">Số lệnh DCA (Martingale)</label>
                      <input type="number" value={entriesCount} onChange={(e) => setEntriesCount(Number(e.target.value))} className="w-16 bg-gray-800 border border-gray-600 rounded p-1 text-center text-white text-sm" />
                   </div>
                </div>
              ) : (
                <div className="bg-purple-900/10 p-3 rounded border border-purple-800/50 space-y-4">
                   <p className="text-xs font-bold text-purple-300 uppercase">Cấu hình vùng giá</p>
                   <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Giá Min</label>
                        <input type="number" value={rangeMin} onChange={(e) => setRangeMin(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Giá Max</label>
                        <input type="number" value={rangeMax} onChange={(e) => setRangeMax(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm font-mono" />
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Số lệnh (Grid)</label>
                        <input type="number" value={gridCount} onChange={(e) => setGridCount(Number(e.target.value))} className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-center text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 block mb-1">Hệ số nhân Vol</label>
                        <input type="number" value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))} step="0.1" className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-center text-sm" />
                      </div>
                   </div>
                   
                   <p className="text-[10px] text-gray-400 italic mt-1">
                     Hệ số nhân: 1 = Đều volume. 2 = Gấp đôi volume lệnh sau.
                     Tăng hệ số nhân giúp kéo giá TB về gần giá cuối để an toàn hơn.
                   </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-gray-700">
              <div className="flex justify-between items-center mb-3">
                 <span className="text-gray-400 text-sm">Giá hiện tại:</span>
                 <span className={`font-mono font-bold flex items-center gap-2 ${isLoading ? 'text-gray-500 animate-pulse' : 'text-white'}`}>
                    {isLoading && <FaSyncAlt className="animate-spin text-xs"/>}
                    {currentPrice ? formatPrice(currentPrice) : "Loading..."}
                 </span>
              </div>
              <button onClick={calculateStrategy} disabled={!currentPrice || isLoading} className={`w-full py-3.5 font-bold rounded-lg shadow-lg active:scale-95 transition-all disabled:opacity-50 uppercase tracking-wide ${activeTab==='CLASSIC'?'bg-blue-600 hover:bg-blue-500 text-white':'bg-purple-600 hover:bg-purple-500 text-white'}`}>TÍNH TOÁN {activeTab}</button>
            </div>
          </div>
        </div>

        {/* --- RESULTS --- */}
        <div className="lg:col-span-2 space-y-6">
           <div className={`bg-gray-800 border rounded-xl p-4 sm:p-6 shadow-lg flex flex-col ${activeTab==='RANGE'?'border-purple-900/50':'border-gray-700'}`}>
             <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <h2 className="text-lg font-semibold text-white">Kết quả phân tích</h2>
                {result && (
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-1 rounded font-bold ${direction==='LONG'?'bg-green-900 text-green-400':'bg-red-900 text-red-400'}`}>
                      {direction} {symbol} x{leverage}
                    </span>
                    {!result.isSafeRange && activeTab==='RANGE' && (
                        <span className="text-xs px-2 py-1 rounded font-bold bg-red-600 text-white flex items-center gap-1 animate-pulse">
                           <FaExclamationTriangle/> RỦI RO CAO
                        </span>
                    )}
                  </div>
                )}
             </div>
             
             {!result ? (
               <div className="flex-grow flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 rounded-xl min-h-[300px] bg-gray-800/50">
                  <FaChartLine className="text-4xl mb-3 opacity-50"/>
                  <p>Chọn chế độ và nhấn "Tính toán"</p>
               </div>
             ) : (
               <>
                 {/* Summary */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50 flex flex-col justify-center">
                      <span className="text-xs text-gray-400 uppercase mb-1">Giá TB (Avg)</span>
                      <span className="text-lg font-mono font-bold text-white">{formatPrice(result.avgPrice)}</span>
                    </div>
                    <div className="bg-gray-700/40 p-3 rounded-lg border border-gray-600/50 flex flex-col justify-center">
                      <span className="text-xs text-gray-400 uppercase mb-1">Tổng Ký quỹ</span>
                      <span className="text-lg font-mono font-bold text-white">{formatMoney(result.totalMargin)}</span>
                    </div>
                    <div className={`p-3 rounded-lg border flex flex-col justify-center sm:col-span-2 ${result.isSafeRange ? 'bg-gray-700/40 border-gray-600/50' : 'bg-red-900/20 border-red-600'}`}>
                       <span className="text-xs text-gray-400 uppercase mb-1 flex justify-between">
                         <span>Giá Thanh Lý</span>
                         {!result.isSafeRange && <span className="text-red-400 font-bold">NẰM TRONG VÙNG DCA!</span>}
                       </span>
                       <div className="flex justify-between items-center">
                         <div>
                            <span className="text-xs text-red-400 mr-1">Liq:</span>
                            {result.isRekt ? <span className="text-red-500 font-bold">THIẾU VỐN</span> : <span className="text-lg font-mono font-bold text-red-400">{formatPrice(result.liquidationPrice || 0)}</span>}
                         </div>
                         <div className="text-right">
                            <span className="text-xs text-accent-yellow mr-1">SL:</span>
                            <span className="text-lg font-mono font-bold text-accent-yellow">{result.suggestedSL ? formatPrice(result.suggestedSL) : "---"}</span>
                         </div>
                       </div>
                    </div>
                 </div>

                 {/* Entry Table */}
                 <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 mb-6">
                   <table className="w-full text-left border-collapse">
                     <thead className="bg-gray-700/50">
                       <tr className="text-gray-400 text-xs uppercase">
                         <th className="py-3 px-4">Lệnh</th>
                         <th className="py-3 px-4">Giá Entry</th>
                         <th className="py-3 px-4">Khoảng cách</th>
                         <th className="py-3 px-4">Volume (USDT)</th>
                         <th className="py-3 px-4">Margin</th>
                       </tr>
                     </thead>
                     <tbody className="text-sm divide-y divide-gray-700">
                       {result.plans.map((p, index) => (
                         <tr key={p.level} className="hover:bg-gray-700/30 transition-colors">
                           <td className="py-3 px-4 font-bold text-accent-yellow">#{p.level}</td>
                           <td className={`py-3 px-4 font-mono ${direction === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>{formatPrice(p.price)}</td>
                           <td className="py-3 px-4 text-gray-400">{index === 0 && activeTab === 'CLASSIC' ? "Gốc" : `${(Math.abs((p.price - (activeTab==='CLASSIC' ? result.plans[0].price : currentPrice || 0))/(activeTab==='CLASSIC' ? result.plans[0].price : currentPrice || 1))*100).toFixed(2)}%`}</td>
                           <td className="py-3 px-4 text-white font-mono">{formatMoney(p.volume)}</td>
                           <td className="py-3 px-4 font-mono text-gray-300">{formatMoney(p.volume / leverage)}</td>
                         </tr>
                       ))}
                     </tbody>
                     <tfoot className="bg-gray-700/20 font-bold">
                        <tr>
                          <td colSpan={3} className="py-3 px-4 text-right text-white">TỔNG:</td>
                          <td className="py-3 px-4 text-white">{formatMoney(result.totalVolume)}</td>
                          <td className="py-3 px-4 text-accent-yellow">{formatMoney(result.totalMargin)}</td>
                        </tr>
                     </tfoot>
                   </table>
                 </div>

                 {/* Mobile Entry Cards */}
                 <div className="md:hidden space-y-2 mb-6">
                    {result.plans.map((p) => (
                       <div key={p.level} className="bg-gray-700/20 border border-gray-700 rounded-lg p-3 text-xs">
                          <div className="flex justify-between font-bold mb-1">
                             <span className="text-accent-yellow">#{p.level}</span>
                             <span className={direction==='LONG'?'text-green-400':'text-red-400'}>{formatPrice(p.price)}</span>
                          </div>
                          <div className="flex justify-between text-gray-400">
                             <span>Vol: {formatMoney(p.volume)}</span>
                             <span>Mar: {formatMoney(p.volume/leverage)}</span>
                          </div>
                       </div>
                    ))}
                 </div>

                 {/* Warnings */}
                 {!result.isSafeRange && activeTab === 'RANGE' && (
                   <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-200 flex gap-3 items-start animate-pulse">
                      <FaShieldAlt className="text-xl flex-shrink-0 mt-0.5" />
                      <div>
                        <strong>CẢNH BÁO NGUY HIỂM:</strong><br/>
                        Giá thanh lý {formatPrice(result.liquidationPrice || 0)} nằm trong khoảng giá DCA {formatPrice(parseFloat(rangeMin))} - {formatPrice(parseFloat(rangeMax))}.
                        <br/>
                        👉 <strong>Giải pháp:</strong> Tăng hệ số nhân Volume (Multiplier) hoặc Giảm Đòn bẩy.
                      </div>
                   </div>
                 )}
               </>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}