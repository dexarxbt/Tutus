import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useWebSocket } from './hooks/useWebSocket';
import { Navigation } from './components/Navigation';
import { HomePage } from './pages/HomePage';
import { InvestigatePage } from './pages/InvestigatePage';
import { FindingsPage } from './pages/FindingsPage';
import { EvidencePage } from './pages/EvidencePage';
import { ReplayPage } from './pages/ReplayPage';
import { Finding } from './types';

export default function App() {
  const { connected, messages, clearMessages } = useWebSocket();
  const [latestFinding, setLatestFinding] = useState<Finding | null>(null);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-primary">
        <Navigation connected={connected} />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/investigate"
            element={
              <InvestigatePage
                messages={messages}
                clearMessages={clearMessages}
                connected={connected}
                onFindingReady={setLatestFinding}
              />
            }
          />
          <Route path="/findings" element={<FindingsPage latestFinding={latestFinding} />} />
          <Route path="/evidence" element={<EvidencePage latestFinding={latestFinding} />} />
          <Route path="/replay" element={<ReplayPage latestFinding={latestFinding} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
