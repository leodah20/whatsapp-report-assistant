import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer';
import {CONFIG} from '../src/config.mjs';

const mark=await readFile(new URL('../web/brand/runavolt.svg',import.meta.url),'utf8');
const browser=await puppeteer.launch({executablePath:CONFIG.chrome,headless:true});
try{
  const page=await browser.newPage();
  await page.setContent('<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#181222}svg{width:74%;height:74%}svg>rect{display:none}</style>'+mark);
  for(const size of [192,512]){
    await page.setViewport({width:size,height:size,deviceScaleFactor:1});
    await page.screenshot({path:fileURLToPath(new URL('../web/brand/app-'+size+'.png',import.meta.url))});
  }
}finally{await browser.close();}
