import {mkdir,copyFile,rm,cp} from 'node:fs/promises';
import {existsSync} from 'node:fs';
await mkdir('dist',{recursive:true});
await rm('dist/types.js',{force:true});
for(const name of ['index.html','styles.css']) await copyFile(name,`dist/${name}`);
if(existsSync('assets')) await cp('assets','dist/assets',{recursive:true});
console.log('Static pages prepared in dist/.');
