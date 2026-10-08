import React,{useId} from 'react';

// Decorative studio illustration; never presented as a saved project's geometry.
export default function KitchenArtwork({className=''}) {
  const id=useId().replaceAll(':','');
  return <svg className={`kitchen-artwork ${className}`} viewBox="0 0 680 440" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-wall`} x1="110" y1="20" x2="510" y2="310" gradientUnits="userSpaceOnUse"><stop stopColor="#eee9dc"/><stop offset="1" stopColor="#c5c7b5"/></linearGradient>
      <linearGradient id={`${id}-wood`} x1="90" y1="200" x2="420" y2="370" gradientUnits="userSpaceOnUse"><stop stopColor="#bc9670"/><stop offset="1" stopColor="#826045"/></linearGradient>
      <linearGradient id={`${id}-stone`} x1="160" y1="160" x2="550" y2="340" gradientUnits="userSpaceOnUse"><stop stopColor="#ece5d7"/><stop offset="1" stopColor="#b6b3a5"/></linearGradient>
    </defs>
    <ellipse cx="350" cy="371" rx="252" ry="48" fill="#061f1b" opacity=".18"/>
    <path d="M86 278 86 79 317 22 581 164 581 343 350 419Z" fill={`url(#${id}-wall)`}/>
    <path d="m317 22 264 142v179L317 204Z" fill="#cecfc1"/>
    <path d="m86 278 231-74 264 139-231 76Z" fill="#ddd8ca"/>
    <path d="m87 154 232-68v8L87 163Z" fill="#8d9e8b" opacity=".3"/>
    <path d="m112 94 79-23v94l-79 25Z" fill="#5e7768"/><path d="m120 99 63-18v76l-63 21Z" fill="#b4c7b0"/>
    <path d="m151 91 0 78m-31-31 63-18" stroke="#607666" strokeWidth="4"/>
    <path d="m206 65 95-27v94l-95 29Z" fill="#e8e5d9"/>
    <path d="m254 51 0 95" stroke="#c1bfb1" strokeWidth="2"/>
    <path d="m335 59 218 117v69L335 130Z" fill="#f0ede2"/><path d="m407 98 0 69m73-30 0 70" stroke="#c8c9b8" strokeWidth="2"/>
    <path d="m335 130 218 115v5L335 135Z" fill="#ffeac2"/>
    <path d="m101 219 216-67 248 132-59 21-189-99-161 52Z" fill="#263f36"/>
    <path d="m101 219 55 39v91l-55-31Z" fill="#745b41"/>
    <path d="m156 258 161-52v87l-161 56Z" fill={`url(#${id}-wood)`}/>
    <path d="m317 206 189 99v85l-189-97Z" fill="#677a67"/>
    <path d="m506 305 59-21v83l-59 23Z" fill="#435c4c"/>
    <path d="m210 241 0 88m54-106v87m-106-45 159-53m62 31v87m64-54v87" stroke="#405448" strokeWidth="2" opacity=".7"/>
    <path d="m114 216 203-63 249 132-60 20-189-98-161 51Z" fill={`url(#${id}-stone)`}/>
    <path d="m156 258 161-51 189 98v8l-189-99-161 52Z" fill="#ede9df"/>
    <path d="m155 211 48-15 31 15-48 16Z" fill="#83968e" stroke="#49625b" strokeWidth="2"/>
    <path d="M188 202v-27c0-12 17-13 17-3v7" stroke="#4d6258" strokeWidth="5" strokeLinecap="round"/>
    <path d="m381 219 56 29-33 11-56-29Z" fill="#23362f"/>
    <ellipse cx="380" cy="236" rx="10" ry="4" stroke="#afbab0"/><ellipse cx="407" cy="249" rx="10" ry="4" stroke="#afbab0"/>
    <path d="m259 327 79-24 133 70-79 26Z" fill="#eee8da"/>
    <path d="m259 327 133 72v29l-133-72Z" fill="#c3b49a"/><path d="m392 399 79-26v29l-79 26Z" fill="#a89c85"/>
    <path d="M262 346v39m203-2v30" stroke="#405548" strokeWidth="6"/>
    <path d="M497 109v57m0-57-1-31" stroke="#3c4c40" strokeWidth="2"/>
    <path d="m474 168 22-26 25 39c-16 7-32 1-47-13Z" fill="#344c3e"/><path d="m479 170 36 9" stroke="#ffdc99" strokeWidth="3"/>
    <path d="m524 266 12 6 9-3-2-24-16-7Z" fill="#ddd1b5"/>
    <path d="M534 242c-28-22-24-39-10-23m11 22c20-14 23-31 12-27m-11 28c-9-34-2-42 5-31" stroke="#4b694a" strokeWidth="5" strokeLinecap="round"/>
  </svg>;
}
