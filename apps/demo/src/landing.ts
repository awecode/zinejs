import './theme.css';
import './landing.css';
import { createThemeToggle, initTheme } from './theme';

initTheme();

const row = document.querySelector('.header-row');
row?.appendChild(createThemeToggle());
