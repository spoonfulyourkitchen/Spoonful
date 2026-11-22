import './web/install';
import { createRoot } from 'react-dom/client';
import App from '../../mobile/App';

const container = document.getElementById('root');
if (!container) throw new Error('root container missing');

createRoot(container).render(<App />);
