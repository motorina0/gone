import { defineConfig } from 'vite';
const repo=process.env.GITHUB_REPOSITORY?.split('/')[1];
const owner=process.env.GITHUB_REPOSITORY_OWNER;
const base=repo ? (repo.toLowerCase()===`${owner?.toLowerCase()}.github.io`?'/':`/${repo}/`) : (process.env.VITE_BASE_PATH ?? '/');
export default defineConfig({base,define:{__BUILD_VERSION__:JSON.stringify(process.env.GITHUB_SHA?.slice(0,7) ?? 'dev')}});
