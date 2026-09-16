import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import cloud from './server/cloud.js';
import authProxy from './server/auth-proxy.js';
const cloudApi={name:'kitchen-cloud-api',configureServer(server){server.middlewares.use((req,res,next)=>{
  if(req.url?.split('?')[0]==='/api/cloud')return cloud(req,res);
  if(req.url?.startsWith('/api/auth/'))return authProxy(req,res);next();
});}};
export default defineConfig({plugins:[react(),cloudApi],server:{host:'0.0.0.0',port:9799,strictPort:true}});
