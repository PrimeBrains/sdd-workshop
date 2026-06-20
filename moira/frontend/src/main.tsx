import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { MoiraProvider } from './moira/store';
import { demoEvents, demoCapacity, DEMO_AS_OF } from './moira/demo-data';

const rootEl = document.getElementById('root');
if (rootEl === null) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <MoiraProvider initialEvents={demoEvents} initialCapacity={demoCapacity} initialAsOf={DEMO_AS_OF}>
      <App />
    </MoiraProvider>
  </StrictMode>,
);
