import './styles/app.css';import './styles/hud.css';import './styles/mobile.css';import {GameApp} from './app/GameApp';import {BUILD_ID} from './app/AppConfig';
document.querySelector('[data-build]')!.textContent=BUILD_ID;new GameApp();
