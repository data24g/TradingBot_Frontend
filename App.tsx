
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import DashboardLayout from './pages/DashboardLayout';
import Users from './pages/Users';
import TradeHistory from './pages/TradeHistory';
import CoinMonitor from './pages/CoinMonitor';
import CoinChart from './pages/CoinChart';
import Register from './pages/Register';
import Strategy from './pages/Strategy';
import DCA from './pages/DCA';

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/monitor" replace />} />
            <Route path="users" element={<Users />} />
            <Route path="history" element={<TradeHistory />} />
            <Route path="monitor" element={<CoinMonitor />} />
            <Route path="monitor/:symbol" element={<CoinChart />} />
            <Route path="/strategy" element={<Strategy />} />
            <Route path="/dca" element={<DCA />} />


          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
