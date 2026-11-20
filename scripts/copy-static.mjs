import {mkdir,copyFile,rm} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await rm('dist/types.js',{force:true});
for(const name of ['index.html','styles.css']) await copyFile(name,`dist/${name}`);
console.log('Static pages prepared in dist/.');
