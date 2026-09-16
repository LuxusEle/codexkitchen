import React,{useState,useEffect} from 'react';
export default function ThemeToggle(){
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('kitchen-theme')==='dark'?'dark':'light';}catch{return 'light';}});
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('kitchen-theme',theme);}catch{}},[theme]);
  return <button type="button" className="secondary compact" aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`} onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?'☀ Light mode':'☾ Dark mode'}</button>;
}
