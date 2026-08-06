export default function ClipoMark() {
    return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
            <linearGradient id="clipo-mark-gradient" x1="8" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="45%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#5b21b6" />
            </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#clipo-mark-gradient)" />
        <rect x="14" y="14" width="36" height="36" rx="12" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" />
        <path d="M41 19.5c-7.18 0-13 5.82-13 13s5.82 13 13 13" stroke="white" strokeWidth="7" strokeLinecap="round" />
        <path d="M31.5 25.5 41 32l-9.5 6.5v-13Z" fill="white" />
    </svg>;
}