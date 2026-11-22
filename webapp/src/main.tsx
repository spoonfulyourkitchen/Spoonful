import './web/install';
import { installVersionCheck } from './web/version-check';
import { createRoot } from 'react-dom/client';
import App from '../../mobile/App';

installVersionCheck();

const container = document.getElementById('root');
if (!container) throw new Error('root container missing');

createRoot(container).render(<App />);
