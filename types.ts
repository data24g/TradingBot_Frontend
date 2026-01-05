
export interface User {
  id: number;
  name: string;
  apiKey: string;
  secretKey: string;
}

export enum TradeSide {
    LONG = 'LONG',
    SHORT = 'SHORT'
}

export enum TradeStatus {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED'
}

export interface Trade {
  id: string;
  userId: string;
  userName: string;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  quantity: number;
  orderSizeUSD: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  entryTime: string;
  status: TradeStatus;
  exitPrice?: number;
  exitTime?: string;
  pnl?: number;
}

export interface Coin {
  symbol: string;
  name: string;
  price: number;
  support: number;
  resistance: number;
  trend?: string;
}

export interface ApiUser {
  id: string;
  username: string;
  isActive: boolean;
  tradesToday: number;
  lastTradeDate: string | null;
  orderSizeUSD?: number;
}

export interface KLineData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}