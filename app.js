// श्री Price Code PWA v3.2 (K fixed; prefer local QR libs; CDN fallback)
(function(){
  'use strict';
  const $ = (s)=>document.querySelector(s);
  const priceInput=$('#priceInput');
  const codeOut=$('#codeOut');
  const copyCode=$('#copyCode');
  const encodeBtn=$('#encodeBtn');
  const clearEncode=$('#clearEncode');
  const genQR=$('#genQR');
  const qrCanvas=$('#qrCanvas');
  const downloadQR=$('#downloadQR');
  const encMsg=$('#encMsg');

  const codeInput=$('#codeInput');
  const priceOut=$('#priceOut');
  const copyPrice=$('#copyPrice');
  const decodeBtn=$('#decodeBtn');
  const clearDecode=$('#clearDecode');
  const decMsg=$('#decMsg');

  const scanBtn=$('#scanQR');
  const stopScanBtn=$('#stopScan');
  const scanWrap=$('#scanWrap');
  const video=$('#video');
  const scanCanvas=$('#scanCanvas');

  const K = (function(){ return 7500 + 81; })(); // 7581

  function toBase36(n){ if(n===0) return '0'; const a='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; let s=''; while(n>0){const r=n%36;n=Math.floor(n/36);s=a[r]+s;} return s; }
  function fromBase36(s){ return parseInt(s,36); }

  // dynamic loader as last-resort, if vendor files are missing
  function loadScript(src){ return new Promise((resolve,reject)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.crossOrigin='anonymous'; s.onload=()=>resolve(); s.onerror=()=>reject(new Error('Failed to load '+src)); document.head.appendChild(s); }); }
  async function ensureQRCode(){
    if (window.QRCode && typeof window.QRCode.toCanvas==='function') return true;
    const cdns=['https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js','https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js'];
    for(const url of cdns){ try{ await loadScript(url); if(window.QRCode && window.QRCode.toCanvas) return true; }catch(e){} }
    return false;
  }
  async function ensureJsQR(){
    if (window.jsQR && typeof window.jsQR==='function') return true;
    const cdns=['https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js','https://unpkg.com/jsqr@1.4.0/dist/jsQR.js'];
    for(const url of cdns){ try{ await loadScript(url); if(window.jsQR) return true; }catch(e){} }
    return false;
  }

  function show(n,t){ n.textContent=t; }
  function clearMsg(n){ n.textContent=''; }
  async function copy(text){ try{ await navigator.clipboard.writeText(text); return true; }catch{ return false; } }

  function encodePrice(){
    clearMsg(encMsg);
    const raw=(priceInput.value||'').trim(); if(!raw) return show(encMsg,'Enter a price');
    const cleaned=raw.replace(/[^0-9.]/g,''); const p=Number(cleaned);
    if(!Number.isFinite(p)||p<0) return show(encMsg,'Invalid price');
    const N=Math.round(Number((p*100).toFixed(2))); const M=N+K; const base=toBase36(M); const chk=String(M%97).padStart(2,'0');
    codeOut.value=(base+chk).toUpperCase(); show(encMsg,'OK');
  }

  function decodeCode(){
    clearMsg(decMsg);
    const raw=(codeInput.value||'').trim().toUpperCase(); if(raw.length<3) return show(decMsg,'Enter a valid code');
    const base=raw.slice(0,-2), chk=raw.slice(-2); const M=fromBase36(base); if(!Number.isFinite(M)) return show(decMsg,'Bad code (base)');
    const exp=String(M%97).padStart(2,'0'); if(exp!==chk) return show(decMsg,`BAD CODE (checksum ${chk} ≠ ${exp})`);
    const N=M-K; if(N<0) return show(decMsg,'BAD CODE'); priceOut.value=(N/100).toFixed(2); show(decMsg,'OK');
  }

  async function generateQR(){
    clearMsg(encMsg);
    const code=(codeOut.value||'').trim(); if(!code) return show(encMsg,'Encode first to get a code');
    const ok = await ensureQRCode(); if(!ok) return show(encMsg,'QR library not found. Please add ./vendor/qrcode.min.js (see README_VENDOR).');
    const canvas=qrCanvas; canvas.hidden=false;
    window.QRCode.toCanvas(canvas, code, {width:256, margin:2, color:{dark:'#000', light:'#FFF'}}, (err)=>{
      if(err){ show(encMsg,'Failed to generate QR: '+(err.message||err)); return; }
      const data = canvas.toDataURL('image/png'); downloadQR.href=data; downloadQR.hidden=false; downloadQR.textContent='Download QR'; show(encMsg,'QR ready.');
    });
  }

  let stream=null, rafId=null, detector=null;
  async function startScan(){
    clearMsg(decMsg); scanWrap.hidden=false; stopScanBtn.hidden=false; scanBtn.disabled=true;
    try{
      if('BarcodeDetector' in window){ const formats=await BarcodeDetector.getSupportedFormats().catch(()=>[]); if(formats && formats.includes('qr_code')) detector=new BarcodeDetector({formats:['qr_code']}); }
      if(!detector){ const ok=await ensureJsQR(); if(!ok){ show(decMsg,'QR scanning lib not found. Please add ./vendor/jsQR.js (see README_VENDOR).'); stopScan(); return; } }
      stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); video.srcObject=stream; await video.play();
      if(detector){ const tick=async()=>{ try{ const bars=await detector.detect(video); if(bars&&bars.length){ onScanValue(bars[0].rawValue); return; } }catch{} rafId=requestAnimationFrame(tick); }; tick(); }
      else { const c=scanCanvas, ctx=c.getContext('2d'); const tick=()=>{ const w=video.videoWidth,h=video.videoHeight; if(!w||!h){ rafId=requestAnimationFrame(tick); return; } c.width=w;c.height=h; ctx.drawImage(video,0,0,w,h); const img=ctx.getImageData(0,0,w,h); const res=window.jsQR(img.data,w,h,{inversionAttempts:'dontInvert'}); if(res&&res.data){ onScanValue(res.data); return; } rafId=requestAnimationFrame(tick); }; tick(); }
    }catch(err){ show(decMsg,'Camera error: '+(err && err.message ? err.message : String(err))); stopScan(); }
  }

  function onScanValue(value){ stopScan(); codeInput.value=(value||'').trim().toUpperCase(); decodeCode(); }
  function stopScan(){ if(rafId){cancelAnimationFrame(rafId); rafId=null;} if(video){ video.pause(); video.srcObject=null; } if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; } detector=null; scanWrap.hidden=true; stopScanBtn.hidden=true; scanBtn.disabled=false; }

  copyCode.addEventListener('click', async ()=>{ if(!codeOut.value) return; await copy(codeOut.value); show(encMsg,'Code copied'); });
  copyPrice.addEventListener('click', async ()=>{ if(!priceOut.value) return; await copy(priceOut.value); show(decMsg,'Price copied'); });
  encodeBtn.addEventListener('click', encodePrice);
  decodeBtn.addEventListener('click', decodeCode);
  clearEncode.addEventListener('click', ()=>{ priceInput.value=''; codeOut.value=''; qrCanvas.hidden=true; downloadQR.hidden=true; clearMsg(encMsg); });
  clearDecode.addEventListener('click', ()=>{ codeInput.value=''; priceOut.value=''; clearMsg(decMsg); });
  genQR.addEventListener('click', generateQR);
  scanBtn.addEventListener('click', startScan);
  stopScanBtn.addEventListener('click', stopScan);

  let deferredPrompt; const installBtn=document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt',(e)=>{ e.preventDefault(); deferredPrompt=e; installBtn.hidden=false; });
  installBtn.addEventListener('click', async ()=>{ if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; installBtn.hidden=true; });

  if('serviceWorker' in navigator){ window.addEventListener('load', ()=>{ navigator.serviceWorker.register('./service-worker.js'); }); }
})();
