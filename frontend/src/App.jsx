import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { SimControlBar } from './components/SimControlBar';
import { EventTicker } from './components/EventTicker';
import { LegendModal } from './components/LegendModal';

import { BriefingStage } from './stages/BriefingStage';
import { MapBuilderStage } from './stages/MapBuilderStage';
import { ReportDeskStage } from './stages/ReportDeskStage';
import { DispatchFloorStage } from './stages/DispatchFloorStage';
import { CrewDeskStage } from './stages/CrewDeskStage';
import { TrackerStage } from './stages/TrackerStage';
import { AnalyticsStage } from './stages/AnalyticsStage';
import { TestLabStage } from './stages/TestLabStage';

const MainContent = () => {
  const { activeStage, theme } = useApp();

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'bg-[#080d1a] bg-grid-pattern text-slate-100' : 'bg-slate-50 bg-grid-pattern-light text-slate-900'} pb-14`}>
      <Header />
      <SimControlBar />

      <main className="flex-1 pb-10">
        {activeStage === 'briefing' && <BriefingStage />}
        {activeStage === 'map' && <MapBuilderStage />}
        {activeStage === 'report' && <ReportDeskStage />}
        {activeStage === 'dispatch' && <DispatchFloorStage />}
        {activeStage === 'crew' && <CrewDeskStage />}
        {activeStage === 'tracker' && <TrackerStage />}
        {activeStage === 'analytics' && <AnalyticsStage />}
        {activeStage === 'tests' && <TestLabStage />}
      </main>

      <EventTicker />
      <LegendModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
