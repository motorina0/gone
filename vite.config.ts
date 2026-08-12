import {defineConfig} from 'vite';
export default defineConfig(({mode})=>({base:process.env.VITE_BASE_PATH??(mode==='production'?'/gone/':'/'),define:{__BUILD_ID__:JSON.stringify(process.env.GITHUB_SHA?.slice(0,8)??'dev')},build:{target:'es2022'}}));
