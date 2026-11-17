// LumiNote icon set — 24x24, 2px stroke, round caps, currentColor
// Style: same family as Lucide / Feather
const Icon = ({ path, size = 20, strokeWidth = 2, fill = 'none', style, children, viewBox = '0 0 24 24' }) => (
  <svg width={size} height={size} viewBox={viewBox} fill={fill} stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {path ? <path d={path}/> : children}
  </svg>
);

const IStack = ({ size = 20, filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor"/>
    <path d="M2 12l10 5 10-5"/>
    <path d="M2 17l10 5 10-5"/>
  </svg>
);

const IBolt = ({ size = 20 }) => (
  <Icon size={size}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Icon>
);
const ICheck = ({ size = 20, strokeWidth = 2.5 }) => (
  <Icon size={size} strokeWidth={strokeWidth}><polyline points="20 6 9 17 4 12"/></Icon>
);
const IArrowRight = ({ size = 20, strokeWidth = 2 }) => (
  <Icon size={size} strokeWidth={strokeWidth}><path d="M5 12h14M13 5l7 7-7 7"/></Icon>
);
const IArrowDown = ({ size = 20 }) => (
  <Icon size={size}><path d="M12 5v14M5 12l7 7 7-7"/></Icon>
);
const IClose = ({ size = 20, strokeWidth = 2.5 }) => (
  <Icon size={size} strokeWidth={strokeWidth}><path d="M6 6l12 12M18 6L6 18"/></Icon>
);
const IPlus = ({ size = 20 }) => (
  <Icon size={size}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Icon>
);
const ISearch = ({ size = 20 }) => (
  <Icon size={size}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Icon>
);
const IClock = ({ size = 20 }) => (
  <Icon size={size}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>
);
const ICalendar = ({ size = 20 }) => (
  <Icon size={size}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Icon>
);
const IGrid = ({ size = 20 }) => (
  <Icon size={size}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></Icon>
);
const IStar = ({ size = 20 }) => (
  <Icon size={size}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></Icon>
);
const IShield = ({ size = 20 }) => (
  <Icon size={size}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></Icon>
);
const ILock = ({ size = 20 }) => (
  <Icon size={size}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></Icon>
);
const ISparkle = ({ size = 20 }) => (
  <Icon size={size}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></Icon>
);
const IMoodboard = ({ size = 20 }) => (
  <Icon size={size}><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/></Icon>
);
const ILayers = ({ size = 20 }) => (
  <Icon size={size}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></Icon>
);
const IGlobe = ({ size = 20 }) => (
  <Icon size={size}><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18"/></Icon>
);
const IDownload = ({ size = 20 }) => (
  <Icon size={size}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Icon>
);
const IChevronDown = ({ size = 20 }) => (
  <Icon size={size}><polyline points="6 9 12 15 18 9"/></Icon>
);
const IChevronRight = ({ size = 20 }) => (
  <Icon size={size}><polyline points="9 6 15 12 9 18"/></Icon>
);
const IMouse = ({ size = 20 }) => (
  <Icon size={size}><path d="M13 3l9 9-6 1.5 3 6-3 1.5-3-6-5 4V3z" strokeLinejoin="round"/></Icon>
);
const ISend = ({ size = 20, strokeWidth = 2.5 }) => (
  <Icon size={size} strokeWidth={strokeWidth}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Icon>
);
const IBook = ({ size = 20 }) => (
  <Icon size={size}><path d="M4 4a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 1 2-2h13"/></Icon>
);
const IChrome = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
    <line x1="21.17" y1="8" x2="12" y2="8"/>
    <line x1="3.95" y1="6.06" x2="8.54" y2="14"/>
    <line x1="10.88" y1="21.94" x2="15.46" y2="14"/>
  </svg>
);
const IEdge = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M4 10c1.5-3 4.5-4 8-4 3 0 6 1 7 4-3-2-7-2-10 0-2 1-3 3-1 5"/>
    <path d="M8 20c4 1 9-.5 12-5-3 2-7 2-10 0"/>
  </svg>
);
const IPin = ({ size = 20 }) => (
  <Icon size={size}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14V12l-2-2V4H7v6L5 12z"/></Icon>
);
const ITag = ({ size = 20 }) => (
  <Icon size={size}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></Icon>
);
const ITerminal = ({ size = 20 }) => (
  <Icon size={size}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></Icon>
);
const IZap = ({ size = 20 }) => (
  <Icon size={size}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Icon>
);
const IMessageSquare = ({ size = 20 }) => (
  <Icon size={size}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Icon>
);
const IImage = ({ size = 20 }) => (
  <Icon size={size}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></Icon>
);
const IHistory = ({ size = 20 }) => (
  <Icon size={size}><path d="M3 12a9 9 0 1 0 9-9"/><polyline points="3 4 3 9 8 9"/><path d="M12 7v5l3 2"/></Icon>
);
const ICursor = ({ size = 20 }) => (
  <Icon size={size}><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></Icon>
);
const IHighlight = ({ size = 20 }) => (
  <Icon size={size}><path d="M14 3l7 7-11 11H3v-7L14 3z"/><path d="M3 21h18"/></Icon>
);
const ISync = ({ size = 20 }) => (
  <Icon size={size}><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Icon>
);

Object.assign(window, {
  Icon, IStack, IBolt, ICheck, IArrowRight, IArrowDown, IClose, IPlus, ISearch, IClock, ICalendar,
  IGrid, IStar, IShield, ILock, ISparkle, IMoodboard, ILayers, IGlobe, IDownload, IChevronDown,
  IChevronRight, IMouse, ISend, IBook, IChrome, IEdge, IPin, ITag, ITerminal, IZap, IMessageSquare,
  IImage, IHistory, ICursor, IHighlight, ISync
});
