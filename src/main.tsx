import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './index.css';
import App from './App';
import { connectMcpAppHostIfEmbedded } from './utils/mcpAppBridge';

connectMcpAppHostIfEmbedded();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
