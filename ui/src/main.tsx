import '@fontsource/spectral/600.css';
import '@fontsource/spectral/700.css';
import '@fontsource/spectral/600-italic.css';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles.css';

import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
