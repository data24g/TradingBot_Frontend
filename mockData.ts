import { User, Trade, TradeSide, TradeStatus } from './types';

// Data for generation
const firstNames = ['Liam', 'Olivia', 'Noah', 'Emma', 'Oliver', 'Charlotte', 'Elijah', 'Amelia', 'James', 'Ava', 'William', 'Sophia', 'Benjamin', 'Isabella', 'Lucas', 'Mia', 'Henry', 'Evelyn', 'Theodore', 'Harper', 'David', 'Chloe', 'Joseph', 'Ella', 'Daniel', 'Grace', 'Matthew', 'Lily', 'Samuel', 'Zoe'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const coins = ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA', 'XRP', 'BNB', 'AVAX', 'DOT', 'LINK', 'MATIC', 'SHIB'];

// Helper functions
const generateRandomString = (length: number) => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Generate Users
export const generateMockUsers = (count: number): User[] => {
  const users: User[] = [];
  for (let i = 1; i <= count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    users.push({
      id: i,
      name: `${firstName} ${lastName}`,
      apiKey: `${generateRandomString(5)}...${generateRandomString(5)}`,
      secretKey: `sec...${generateRandomString(4)}`,
    });
  }
  return users;
};

// Generate Trades
export const generateMockTrades = (count: number, users: User[]): Trade[] => {
  const trades: Trade[] = [];
  for (let i = 1; i <= count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 60)); // wider date range
    
    const status = Math.random() > 0.3 ? TradeStatus.CLOSED : TradeStatus.OPEN; // more closed trades for PNL data
    const entryPrice = parseFloat((Math.random() * 70000 + 0.1).toFixed(5));
    const quantity = parseFloat((Math.random() * 5).toFixed(4));
    const side = Math.random() > 0.5 ? TradeSide.LONG : TradeSide.SHORT;
    const symbol = coins[Math.floor(Math.random() * coins.length)];
    
    let exitPrice: number | undefined = undefined;
    let pnl: number | undefined = undefined;
    let exitTime: string | undefined = undefined;

    if (status === TradeStatus.CLOSED) {
        const priceChange = entryPrice * (Math.random() * 0.1 - 0.05); // +/- 5% change
        exitPrice = parseFloat((entryPrice + priceChange).toFixed(5));
        if (side === TradeSide.LONG) {
            pnl = (exitPrice - entryPrice) * quantity;
        } else { // SHORT
            pnl = (entryPrice - exitPrice) * quantity;
        }
        pnl = parseFloat(pnl.toFixed(2));
        const exitDate = new Date(date.getTime() + Math.random() * 1000 * 60 * 60 * 24); // exit within a day
        exitTime = exitDate.toISOString();
    }

    trades.push({
      // FIX: Convert numeric id to string to match Trade interface.
      id: i.toString(),
      // FIX: Convert numeric userId to string to match Trade interface.
      userId: user.id.toString(),
      userName: user.name,
      symbol: symbol,
      side: side,
      quantity: quantity,
      entryPrice: entryPrice,
      orderSizeUSD: parseFloat((entryPrice * quantity).toFixed(2)),
      entryTime: date.toISOString(),
      status: status,
      exitPrice: exitPrice,
      exitTime: exitTime,
      pnl: pnl,
    });
  }
  return trades.sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
};


export const mockUsers: User[] = generateMockUsers(100);
export const mockTrades: Trade[] = generateMockTrades(200, mockUsers);