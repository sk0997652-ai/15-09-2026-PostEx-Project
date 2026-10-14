import React, { useState, useMemo } from 'react';
import '../../styles/overview.css';
import {
  OverviewRowDetailModal,
  SelectedOverviewEntity,
} from '../common/OverviewHeadcountShared';

export interface OverviewMetricsViewProps {
  metrics?: any;
  loading?: boolean;
  onRefresh?: () => void;
  onNavigateToHeadcount?: () => void;
}

/* ============ SVG ICONS (exact paths from reference) ============ */
const IC: Record<string, string> = {
  sim: 'M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM9 12h6v6H9z',
  key: 'M15 7a4 4 0 11-3.9 4.9L3 20v-3h3v-3h3l2.1-2.1A4 4 0 0115 7z',
  card: 'M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM2 10h20M6 15h4',
  doc: 'M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M9 13h6M9 17h6',
  mail: 'M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM3 7l9 6 9-6',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  xc: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9 9l6 6M15 9l-6 6',
  timer: 'M12 21a8 8 0 100-16 8 8 0 000 16zM12 9v4M10 2h4',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  mark: 'M5 7l6 5-6 5M13 7l6 5-6 5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  pin: 'M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  bell: 'M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8zM10 20a2 2 0 004 0',
  headset: 'M4 14v-2a8 8 0 0116 0v2M4 14h3v5H5a1 1 0 01-1-1zM20 14h-3v5h2a1 1 0 001-1zM17 19c0 1.5-2 2-5 2',
  cal: 'M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 10h16M8 3v4M16 3v4',
  dl: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  arr: 'M5 12h14m0 0l-6-6m6 6l-6 6',
  up: 'M7 17L17 7m0 0H9m8 0v8',
  bike: 'M5.5 18a3 3 0 100-6 3 3 0 000 6zM18.5 18a3 3 0 100-6 3 3 0 000 6zM12 18l-2.5-6H15l2.5 6M8 7h3l2 5',
  check: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 12.5l2.5 2.5 4.5-5',
  users: 'M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-1a4 4 0 00-3-3.9M16 4.1a3.5 3.5 0 010 6.8',
  bld: 'M4 21V5a1 1 0 011-1h8a1 1 0 011 1v16M14 9h5a1 1 0 011 1v11M3 21h18M8 8h2M8 12h2M8 16h2',
  srch: 'M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  cal2: 'M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 10h16M8 3v4M16 3v4',
};

const Icon: React.FC<{ name: string; size?: number; strokeWidth?: number; className?: string }> = ({
  name,
  size = 16,
  strokeWidth = 1.8,
  className = '',
}) => {
  const d = IC[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
};

/* ============ DATA & SEEDED RANDOM GENERATOR (exact match from reference) ============ */
interface ZoneItem {
  id: number;
  code: string;
  name: string;
  region: string;
  on: number;
}

interface BranchItem {
  id: number;
  code: string;
  name: string;
  type: string;
  zone: number;
  city: number;
  addr: string;
  ph: string;
  on: number;
}

interface DesignationItem {
  id: number;
  code: string;
  name: string;
  dept: number;
  cat: 'Rider' | 'In-House Staff';
  on: number;
}

interface HeadcountItem {
  b: number;
  d: number;
  ap: number;
  ac: number;
  by: string;
}

const buildStaticData = () => {
  const zones: ZoneItem[] = [
    { id: 1, code: '01', name: 'LAHORE', region: 'Punjab Region', on: 1 },
    { id: 2, code: '02', name: 'ISLAMABAD', region: 'ICT Region', on: 1 },
    { id: 3, code: '03', name: 'KARACHI', region: 'Sindh Region', on: 1 },
    { id: 4, code: '04', name: 'FAISALABAD', region: 'Punjab Region', on: 1 },
    { id: 5, code: '05', name: 'MULTAN', region: 'Punjab Region', on: 1 },
    { id: 6, code: '06', name: 'PESHAWAR', region: 'KPK Region', on: 1 },
  ];

  const depts = [
    { id: 1, code: '001', name: 'OPERATIONS', on: 1 },
    { id: 2, code: '002', name: 'HUMAN RESOURCES', on: 1 },
    { id: 3, code: '003', name: 'FINANCE', on: 1 },
    { id: 4, code: '004', name: 'CUSTOMER SERVICE', on: 1 },
  ];

  const desigs: DesignationItem[] = [
    { id: 1, code: '0101', name: 'RIDER', dept: 1, cat: 'Rider', on: 1 },
    { id: 2, code: '0151', name: 'AREA MANAGER', dept: 1, cat: 'In-House Staff', on: 1 },
    { id: 3, code: '0201', name: 'HR OFFICER', dept: 2, cat: 'In-House Staff', on: 1 },
    { id: 4, code: '0301', name: 'ACCOUNTANT', dept: 3, cat: 'In-House Staff', on: 1 },
    { id: 5, code: '0401', name: 'CS AGENT', dept: 4, cat: 'In-House Staff', on: 1 },
    { id: 6, code: '0102', name: 'DISPATCHER', dept: 1, cat: 'In-House Staff', on: 1 },
  ];

  const AR: Record<number, string> = {
    1: 'Gulberg,Johar Town,DHA,Model Town,Iqbal Town,Shadman,Wapda Town,Bahria Town,Cantt,Garden Town,Samanabad,Township,Raiwind Rd,Ferozepur Rd,Mall Rd,Anarkali,Shalimar,Walton,Valencia,Thokar,Harbanspura,Ravi Rd,Sabzazar,Allama Iqbal Town,Kot Lakhpat,Manawan,Barki Rd,Lake City,Sundar,Sheikhupura,Defence Rd,Jail Rd',
    2: 'F-6,F-7,F-8,F-10,F-11,G-9,G-10,G-11,I-8,I-9,I-10,E-11,Blue Area,Bahria Ph4,DHA Ph2,Saddar RWP,Commercial Mkt,Satellite Town,Chaklala,Westridge,PWD,Gulzar-e-Quaid',
    3: 'Clifton,DHA,Nazimabad,North Nazimabad,Gulshan,Gulistan-e-Jauhar,Korangi,Landhi,Malir,Saddar,PECHS,Tariq Rd,Bahadurabad,Federal B Area,Orangi,SITE,Lyari,Defence Ph8,Scheme 33,Surjani,Shah Faisal,Airport,Gadap,Kemari,Nipa,Johar Mor,North Karachi,New Karachi,Buffer Zone,Mehmoodabad,Kharadar,Boat Basin,Hyderi,Sharfabad,Cantt,Baldia,Tower,I.I Chundrigar,Super Hwy,Hawksbay,Bin Qasim,Ibrahim Hyderi',
    4: 'D Ground,Jinnah Colony,Peoples Colony,Samanabad,Madina Town,Susan Rd,Millat Chowk,Satiana Rd,Jaranwala Rd,Canal Rd,Gatwala,Sargodha Rd,Jhang Rd,Chiniot,Sargodha City,Jhang City,TT Singh,Gojra,Samundri,Toba,Kamalia,Khushab,Bhakkar,Mianwali',
    5: 'Cantt,Gulgasht,Shah Rukn-e-Alam,Bosan Rd,Nishtar Rd,Vehari Rd,Hussain Agahi,Shujabad,Lodhran,Khanewal,Mailsi,Bahawalpur City,Bahawalpur Cantt,Rahim Yar Khan,Sadiqabad,Dera Ghazi Khan,Muzaffargarh,Layyah,Vehari,Burewala,Sahiwal,Pakpattan,Okara,Jalalpur,Ahmedpur East,Liaquatpur,Chishtian,Haroonabad',
    6: 'Hayatabad,University Town,Saddar,Ring Rd,Gulbahar,Peshawar Cantt,Charsadda Rd,Warsak Rd,Mardan,Swabi,Nowshera,Kohat,Bannu,Abbottabad,Mansehra,Haripur,Swat,Dir,Charsadda,Dera Ismail Khan,Hangu,Mingora,Karak,Timergara',
  };

  const PFX: Record<number, string> = { 1: 'LHR', 2: 'ISB', 3: 'KHI', 4: 'FSD', 5: 'MUL', 6: 'PSH' };

  const branches: BranchItem[] = [];
  let _bid = 0;
  Object.entries(AR).forEach(([zStr, list]) => {
    const z = Number(zStr);
    list.split(',').forEach((a) => {
      _bid++;
      branches.push({
        id: _bid,
        code: String(1000 + _bid),
        name: PFX[z] + '-' + a.toUpperCase(),
        type: ['Hub', 'Sub-Hub', 'Warehouse', 'Franchise'][_bid % 4],
        zone: z,
        city: z,
        addr: a + ' Area',
        ph: '',
        on: _bid % 29 ? 1 : 0,
      });
    });
  });

  const hc: HeadcountItem[] = [];
  branches.forEach((b, bi) => {
    desigs.forEach((d, di) => {
      const ap = d.id === 1 ? 18 + ((bi * 7) % 25) : 2 + ((bi + di) % 4);
      const ac = Math.max(0, ap - (((bi * 3 + di * 5) % (d.id === 1 ? 7 : 3))));
      hc.push({ b: b.id, d: d.id, ap, ac, by: 'Asad Khan' });
    });
  });

  // Seeded random onboarding data (_sd=7)
  const rn = ['Ahmed', 'Usman', 'Bilal', 'Hassan', 'Zain', 'Imran', 'Faisal', 'Asif', 'Saad', 'Owais', 'Hamza', 'Talha'];
  const ln = ['Khan', 'Ali', 'Raza', 'Malik', 'Butt', 'Shah', 'Iqbal', 'Sheikh'];
  let _sd = 7;
  const rnd = () => {
    _sd = (_sd * 16807) % 2147483647;
    return _sd / 2147483647;
  };
  const WST = [
    'Invited', 'Draft', 'Draft', 'BM Review', 'BM Review', 'BM Review',
    'HR Review', 'HR Review', 'Need Correction', 'Need Correction',
    'Joiner Tasks', 'Joiner Tasks', 'Onboarded', 'Onboarded', 'Onboarded',
    'Onboarded', 'Onboarded', 'Onboarded', 'Rejected', 'Onboarded',
  ];
  const SLA = 2;

  const onb: any[] = [];
  for (let i = 0; i < 640; i++) {
    const st = WST[Math.floor(rnd() * 20)];
    const b = branches[Math.floor(rnd() * branches.length)];
    const d = desigs[Math.floor(rnd() * 6)];
    const pd = !['Onboarded', 'Rejected'].includes(st);
    onb.push({
      id: i + 1,
      name: rn[Math.floor(rnd() * 12)] + ' ' + ln[Math.floor(rnd() * 8)],
      cnic: '35202-' + String(1000000 + Math.floor(rnd() * 8999999)) + '-' + (1 + Math.floor(rnd() * 9)),
      des: d.id,
      br: b.id,
      st,
      days: pd ? Math.floor(rnd() * rnd() * 6.5) : 0,
      tt: 2 + Math.floor(rnd() * 9),
      inv: 1 + Math.floor(rnd() * 12),
    });
  }

  const pend = (o: any) => !['Onboarded', 'Rejected'].includes(o.st);
  const over = (o: any) => pend(o) && o.days > SLA;
  const OF: Record<string, (o: any) => boolean> = {
    '': () => true,
    avg: () => true,
    pending: pend,
    onboarded: (o: any) => o.st === 'Onboarded',
    overdue: over,
    correction: (o: any) => o.st === 'Need Correction',
    rejected: (o: any) => o.st === 'Rejected',
    ontime: (o: any) => pend(o) && !over(o),
  };

  const avgT = (L: any[]) => {
    const a = L.filter((o) => o.st === 'Onboarded');
    return a.length ? (a.reduce((x, o) => x + o.tt, 0) / a.length).toFixed(1) : '0';
  };

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  const mval = (key: string, L: any[]) => {
    if (key === 'avg') return avgT(L);
    if (key === 'ontime') {
      const p = L.filter(pend);
      return p.length ? pct(p.filter((o) => !over(o)).length, p.length) + '%' : '-';
    }
    return L.filter(OF[key] || (() => true)).length;
  };

  return { zones, depts, desigs, branches, hc, onb, mval };
};

const STATIC_DATA = buildStaticData();

const PAL = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#4f46e5', '#0d9488'];

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

const frBadge = (p: number) => {
  if (p >= 95) return <span className="bd ok">{p}% On Target</span>;
  if (p >= 80) return <span className="bd warn">{p}% Understaffed</span>;
  return <span className="bd err">{p}% Critical</span>;
};

const Donut: React.FC<{ pct: number; color: string; size?: number }> = ({ pct: p, color: c, size = 52 }) => {
  const r = 19;
  const C = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none" stroke="#eef1f7" strokeWidth="4.5" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke={c}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray={`${(C * Math.min(p, 100)) / 100} ${C}`}
        transform="rotate(-90 24 24)"
      />
      <text x="24" y="28" textAnchor="middle" className="donut-text" fill="#0f172a">
        {p}%
      </text>
    </svg>
  );
};

const Sparkline: React.FC<{ color: string; seed: number; id: string }> = ({ color: c, seed: sd, id }) => {
  const points = [0, 1, 2, 3, 4, 5, 6]
    .map((i) => `${i * 14},${(30 - i * 2.6 - (((sd + i * 5) % 6) * 1.4)).toFixed(1)}`)
    .join(' ');
  return (
    <svg
      width="86"
      height="36"
      viewBox="0 0 86 36"
      preserveAspectRatio="none"
      style={{ flex: '1 1 36px', maxWidth: '86px', minWidth: '36px', height: '34px' }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.28" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,36 ${points} 84,36`} fill={`url(#${id})`} />
      <polyline
        points={points}
        fill="none"
        stroke={c}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export const OverviewMetricsView: React.FC<OverviewMetricsViewProps> = ({
  onNavigateToHeadcount,
}) => {
  const { zones, depts, desigs, branches, hc, onb, mval } = STATIC_DATA;

  // Filters & State
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('');
  const [branchSearch, setBranchSearch] = useState<string>('');
  const [branchZoneFilter, setBranchZoneFilter] = useState<string>('');
  const [branchPage, setBranchPage] = useState<number>(1);
  const [desigCatFilter, setDesigCatFilter] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<SelectedOverviewEntity | null>(null);

  // Time-of-day greeting
  const greetingText = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  // Zone statistics rollup
  const zstat = (z: ZoneItem) => {
    const s = { r: [0, 0], i: [0, 0] };
    hc.forEach((h) => {
      const bObj = branches.find((b) => b.id === h.b);
      if (!bObj || bObj.zone !== z.id) return;
      const dObj = desigs.find((d) => d.id === h.d);
      if (!dObj) return;
      const x = dObj.cat === 'Rider' ? s.r : s.i;
      x[0] += h.ap;
      x[1] += h.ac;
    });
    return s;
  };

  const zoneRollups = useMemo(() => {
    return zones.map((z) => ({ z, s: zstat(z) }));
  }, [zones, hc]);

  const totals = useMemo(() => {
    return zoneRollups.reduce(
      (a, x) => ({
        ra: a.ra + x.s.r[0],
        rc: a.rc + x.s.r[1],
        ia: a.ia + x.s.i[0],
        ic: a.ic + x.s.i[1],
      }),
      { ra: 0, rc: 0, ia: 0, ic: 0 }
    );
  }, [zoneRollups]);

  const ap = totals.ra + totals.ia;
  const ac = totals.rc + totals.ic;
  const ov = pct(ac, ap);
  const oc = ov >= 95 ? '#059669' : ov >= 80 ? '#d97706' : '#e11d48';

  const regions = useMemo(() => {
    return [...new Set(zones.map((z) => z.region).filter(Boolean))];
  }, [zones]);

  const activeBranchesCount = useMemo(() => {
    return branches.filter((b) => b.on).length;
  }, [branches]);

  // Branch rollups
  const branchRows = useMemo(() => {
    const m: Record<string, any> = {};
    hc.forEach((h) => {
      const b = branches.find((x) => x.id === h.b);
      const d = desigs.find((x) => x.id === h.d);
      if (!b || !d) return;
      const k = b.name;
      if (!m[k]) {
        m[k] = { k, r: [0, 0], i: [0, 0], b, ta: 0, tc: 0 };
      }
      const x = d.cat === 'Rider' ? m[k].r : m[k].i;
      x[0] += h.ap;
      x[1] += h.ac;
    });

    return Object.values(m)
      .map((row: any) => {
        const ta = row.r[0] + row.i[0];
        const tc = row.r[1] + row.i[1];
        return {
          ...row,
          ta,
          tc,
          f: pct(tc, ta),
        };
      })
      .sort((u: any, v: any) => u.f - v.f);
  }, [hc, branches, desigs]);

  // Filtered branch rows
  const filteredBranchRows = useMemo(() => {
    return branchRows.filter((r: any) => {
      const matchesSearch = r.k.toLowerCase().includes(branchSearch.toLowerCase());
      const matchesZone = !branchZoneFilter || String(r.b.zone) === branchZoneFilter;
      return matchesSearch && matchesZone;
    });
  }, [branchRows, branchSearch, branchZoneFilter]);

  // Pagination for branches (15 rows/page)
  const pageSize = 15;
  const totalBranchPages = Math.max(1, Math.ceil(filteredBranchRows.length / pageSize));
  const currentPage = Math.min(Math.max(branchPage, 1), totalBranchPages);
  const paginatedBranchRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBranchRows.slice(start, start + pageSize);
  }, [filteredBranchRows, currentPage]);

  // Designation rollup
  const desigRollup = useMemo(() => {
    return desigs.map((d) => {
      const hList = hc.filter((x) => x.d === d.id);
      const appr = hList.reduce((a, b) => a + b.ap, 0);
      const act = hList.reduce((a, b) => a + b.ac, 0);
      const deptObj = depts.find((dp) => dp.id === d.dept);
      return {
        d,
        deptName: deptObj ? deptObj.name : 'OPERATIONS',
        ap: appr,
        ac: act,
        vac: appr - act,
        fillRate: pct(act, appr),
      };
    });
  }, [desigs, hc, depts]);

  const filteredDesigRows = useMemo(() => {
    return desigRollup.filter((x) => desigCatFilter === 'all' || x.d.cat === desigCatFilter);
  }, [desigRollup, desigCatFilter]);

  // Filtered zones list
  const filteredZones = useMemo(() => {
    return zoneRollups.filter(({ z }) => !selectedZoneFilter || String(z.id) === selectedZoneFilter);
  }, [zoneRollups, selectedZoneFilter]);

  // CSV Export for Zones
  const handleExportZones = () => {
    const headers = ['Zone', 'Region', 'Branches', 'Rider Approved', 'Rider Active', 'In-House Approved', 'In-House Active', 'Fill-Rate %'];
    const rows = zones.map((z) => {
      const s = zstat(z);
      const bCount = branches.filter((b) => b.zone === z.id).length;
      return [
        z.name,
        z.region || '',
        bCount,
        s.r[0],
        s.r[1],
        s.i[0],
        s.i[1],
        pct(s.r[1] + s.i[1], s.r[0] + s.i[0]),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zones-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getZoneName = (zoneId: number) => {
    const z = zones.find((item) => item.id === zoneId);
    return z ? z.name : '-';
  };

  const handleRowClick = (entityType: 'branch' | 'zone' | 'designation', name: string, id: string | number) => {
    setSelectedEntity({
      type: entityType,
      id: String(id),
      name,
      historicalChartId: `super-admin-${entityType}-${id}-chart`,
    });
  };

  // Onboarding mini cards configuration
  const ONBC: [string, string, string, string][] = [
    ['pending', 'Onboarding Pending', 'clock', '#d97706'],
    ['onboarded', 'Onboarded', 'check', '#059669'],
    ['overdue', 'Overdue / Stuck', 'alert', '#e11d48'],
    ['correction', 'Need Correction', 'undo', '#7c3aed'],
    ['rejected', 'Rejected', 'xc', '#64748b'],
    ['ontime', 'SLA Met', 'shield', '#0891b2'],
    ['avg', 'Avg. Time (days)', 'timer', '#4f46e5'],
  ];

  return (
    <div className="ov-page">
      {/* ==================================================================== */}
      {/* 1. HERO BANNER WITH INLINE RIDER SVG & ANIMATION                     */}
      {/* ==================================================================== */}
      <div className="hero">
        <svg className="hr-art-bg" aria-hidden="true" />
        <svg
          className="hr-art"
          viewBox="0 0 540 230"
          preserveAspectRatio="xMaxYMax meet"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="hsun" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#fdba74" stopOpacity=".95" />
              <stop offset=".55" stopColor="#fb923c" stopOpacity=".35" />
              <stop offset="1" stopColor="#fb923c" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="hsl" x1="0" x2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#fff" stopOpacity=".6" />
            </linearGradient>
            <linearGradient id="hbm" x1="0" x2="1">
              <stop offset="0" stopColor="#fde68a" stopOpacity=".7" />
              <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Sunset glow circle */}
          <circle cx="380" cy="150" r="120" fill="url(#hsun)" />

          {/* City buildings */}
          <g fill="#101b52" opacity=".85">
            <rect x="20" y="120" width="34" height="80" />
            <rect x="60" y="90" width="40" height="110" />
            <rect x="108" y="130" width="30" height="70" />
            <rect x="146" y="70" width="46" height="130" />
            <rect x="200" y="110" width="34" height="90" />
            <rect x="330" y="96" width="40" height="104" />
            <rect x="378" y="60" width="44" height="140" />
            <rect x="430" y="118" width="34" height="82" />
            <rect x="472" y="84" width="46" height="116" />
          </g>

          {/* Building illuminated windows */}
          <g fill="#fcd34d" opacity=".55">
            <rect x="70" y="102" width="4" height="4" />
            <rect x="82" y="118" width="4" height="4" />
            <rect x="156" y="86" width="4" height="4" />
            <rect x="170" y="108" width="4" height="4" />
            <rect x="388" y="78" width="4" height="4" />
            <rect x="402" y="100" width="4" height="4" />
            <rect x="482" y="100" width="4" height="4" />
            <rect x="496" y="124" width="4" height="4" />
          </g>

          {/* Road baseline */}
          <rect y="196" width="540" height="34" fill="#050a1c" />
          <g stroke="#94a3b8" strokeOpacity=".35" strokeWidth="2" strokeDasharray="26 18">
            <line x1="0" y1="214" x2="540" y2="214" />
          </g>

          {/* Speed lines animation */}
          <g className="hr-sl" stroke="url(#hsl)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="30" y1="104" x2="170" y2="104" />
            <line x1="70" y1="126" x2="190" y2="126" />
            <line x1="10" y1="150" x2="150" y2="150" />
            <line x1="90" y1="172" x2="200" y2="172" />
          </g>

          {/* Rider on motorbike with delivery box animation */}
          <g className="hr-rd" transform="translate(190,12)">
            <polygon points="262,112 400,66 400,158" fill="url(#hbm)" opacity=".55" />
            <g fill="#050a1c">
              <rect x="14" y="58" width="80" height="62" rx="9" />
              <rect x="22" y="76" width="64" height="5" rx="2" fill="#fb923c" />
              <path d="M26 122 L112 118" stroke="#050a1c" strokeWidth="6" strokeLinecap="round" />
              <path d="M62 128 C70 118 96 116 110 120 L128 112 C150 107 176 109 190 112 L206 104 C222 99 236 103 241 112 L253 118 L247 132 L224 138 L208 154 L130 154 L116 138 L96 136 L72 141 Z" />
              <circle cx="262" cy="108" r="8" />
              <path d="M132 110 C134 84 148 62 164 55 L184 59 C191 70 189 85 177 101 L160 113 Z" />
              <ellipse cx="177" cy="41" rx="17" ry="15" />
            </g>
            <g fill="none" stroke="#050a1c" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="80" cy="150" r="30" strokeWidth="9" />
              <circle cx="270" cy="150" r="30" strokeWidth="9" />
              <path
                d="M80 150 L80 122 M80 150 L106 160 M80 150 L54 160 M80 150 L108 136 M80 150 L52 138 M270 150 L270 122 M270 150 L296 160 M270 150 L244 160 M270 150 L298 136 M270 150 L242 138"
                strokeWidth="1.6"
              />
              <path d="M251 102 L270 150" strokeWidth="7" />
              <path d="M243 97 L266 88" strokeWidth="6" />
              <path d="M130 150 L70 160" strokeWidth="8" />
              <path d="M180 70 Q214 84 245 92" strokeWidth="9" />
              <path d="M146 112 L196 118" strokeWidth="13" />
              <path d="M196 118 L207 145" strokeWidth="11" />
              <path d="M207 148 L224 150" strokeWidth="8" />
            </g>
            <circle cx="80" cy="150" r="7" fill="#050a1c" />
            <circle cx="270" cy="150" r="7" fill="#050a1c" />
            <rect x="185" y="37" width="12" height="5" rx="2" fill="#fde68a" opacity=".75" />
            <path d="M14 58 H94 M270 150 m-30 0" stroke="#a5b4fc" strokeOpacity=".5" strokeWidth="1.2" fill="none" />
            <circle cx="262" cy="108" r="4" fill="#fde68a" />
          </g>
        </svg>

        <div className="hr-in">
          <span className="eyebrow">
            <i />
            Super Admin Dashboard
          </span>
          <div className="hr-g">{greetingText}</div>
          <h1 className="hr-w">
            Welcome, <span>Mr. Umair Ali</span>
          </h1>
          <h2 className="hr-t">Executive Headcount &amp; Operations Overview</h2>
          <p style={{ maxWidth: '560px' }}>
            Track company-wide rider and in-house staff headcount rollups, zone performance, branch fill-rate status, month-over-month trends and historical drill-downs.
          </p>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. 4 MAIN KPI CARDS WITH SPARKLINES                                  */}
      {/* ==================================================================== */}
      <div className="grid g4">
        {/* Total Approved Riders: 5,163 */}
        <div className="kx" style={{ '--c': '#4f46e5' } as React.CSSProperties}>
          <div className="kt">
            <div className="kic">
              <Icon name="bike" size={17} />
            </div>
            <span>Total Approved Riders</span>
          </div>
          <div className="kn">{totals.ra.toLocaleString()}</div>
          <div className="kb">
            <span className="tp">
              <Icon name="up" size={12} strokeWidth={2.4} />6%
            </span>
            <span className="mut">vs. last month</span>
            <Sparkline color="#4f46e5" seed={2} id="sp-1" />
          </div>
        </div>

        {/* Total Active Riders: 4,648 */}
        <div className="kx" style={{ '--c': '#059669' } as React.CSSProperties}>
          <div className="kt">
            <div className="kic">
              <Icon name="check" size={17} />
            </div>
            <span>Total Active Riders</span>
          </div>
          <div className="kn">{totals.rc.toLocaleString()}</div>
          <div className="kb">
            <span className="tp">
              <Icon name="up" size={12} strokeWidth={2.4} />8%
            </span>
            <span className="mut">vs. last month</span>
            <Sparkline color="#059669" seed={4} id="sp-2" />
          </div>
        </div>

        {/* Total In-House Staff: 3,010 */}
        <div className="kx" style={{ '--c': '#7c3aed' } as React.CSSProperties}>
          <div className="kt">
            <div className="kic">
              <Icon name="users" size={17} />
            </div>
            <span>Total In-House Staff</span>
          </div>
          <div className="kn">{totals.ia.toLocaleString()}</div>
          <div className="kb">
            <span className="tp">
              <Icon name="up" size={12} strokeWidth={2.4} />5%
            </span>
            <span className="mut">vs. last month</span>
            <Sparkline color="#7c3aed" seed={1} id="sp-3" />
          </div>
        </div>

        {/* Total In-House Active: 1,978 */}
        <div className="kx" style={{ '--c': '#0d9488' } as React.CSSProperties}>
          <div className="kt">
            <div className="kic">
              <Icon name="bld" size={17} />
            </div>
            <span>Total In-House Active</span>
          </div>
          <div className="kn">{totals.ic.toLocaleString()}</div>
          <div className="kb">
            <span className="tp">
              <Icon name="up" size={12} strokeWidth={2.4} />7%
            </span>
            <span className="mut">vs. last month</span>
            <Sparkline color="#0d9488" seed={3} id="sp-4" />
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. 5 FLAT CARDS (5th IS OVERALL FILL-RATE DONUT)                     */}
      {/* ==================================================================== */}
      <div className="fcr">
        {/* Total Zones */}
        <div className="fc" style={{ '--c': '#4f46e5' } as React.CSSProperties}>
          <div className="kic">
            <Icon name="globe" size={18} />
          </div>
          <div>
            <span>Total Zones</span>
            <b>{zones.length}</b>
            <small>{regions.length} regions</small>
          </div>
        </div>

        {/* Total Branches */}
        <div className="fc" style={{ '--c': '#0d9488' } as React.CSSProperties}>
          <div className="kic">
            <Icon name="bld" size={18} />
          </div>
          <div>
            <span>Total Branches</span>
            <b>{branches.length}</b>
            <small>{activeBranchesCount} active · {branches.length - activeBranchesCount} inactive</small>
          </div>
        </div>

        {/* Approved Headcount */}
        <div className="fc" style={{ '--c': '#7c3aed' } as React.CSSProperties}>
          <div className="kic">
            <Icon name="users" size={18} />
          </div>
          <div>
            <span>Approved Headcount</span>
            <b>{ap.toLocaleString()}</b>
            <small>Riders {totals.ra} · In-House {totals.ia}</small>
          </div>
        </div>

        {/* Active Headcount */}
        <div className="fc" style={{ '--c': '#059669' } as React.CSSProperties}>
          <div className="kic">
            <Icon name="check" size={18} />
          </div>
          <div>
            <span>Active Headcount</span>
            <b>{ac.toLocaleString()}</b>
            <small>Riders {totals.rc} · In-House {totals.ic}</small>
          </div>
        </div>

        {/* Overall Fill-Rate Donut */}
        <div className="fc" style={{ '--c': oc } as React.CSSProperties}>
          <Donut pct={ov} color={oc} size={56} />
          <div>
            <span>Overall Fill-Rate</span>
            <b className="fc-fill-status" style={{ color: oc }}>
              {ov >= 95 ? 'Excellent' : ov >= 85 ? 'Good' : ov >= 75 ? 'Average' : 'Critical'}
            </b>
            <small>Total vacancy {ap - ac}</small>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. EMPLOYEE ONBOARDING (7 MINI CARDS)                                */}
      {/* ==================================================================== */}
      <div className="sech" style={{ marginBottom: '8px' }}>
        <div>
          <h3 className="sech-title">Employee Onboarding</h3>
          <span className="mut">Click any card to open full onboarding details.</span>
        </div>
        <a
          className="lnk"
          href="#onboarding"
          onClick={(e) => {
            e.preventDefault();
            if (onNavigateToHeadcount) onNavigateToHeadcount();
          }}
        >
          View all <Icon name="arr" size={13} />
        </a>
      </div>

      <div className="mg">
        {ONBC.map(([key, label, iconName, color]) => {
          const val = mval(key, onb);
          return (
            <div
              key={key}
              className="mini"
              style={{ '--c': color } as React.CSSProperties}
              onClick={() => {
                if (onNavigateToHeadcount) onNavigateToHeadcount();
              }}
            >
              <div className="kic">
                <Icon name={iconName} size={15} />
              </div>
              <div>
                <b>{val}</b>
                <span>{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* 5. ZONES OVERVIEW CARDS WITH DONUTS                                 */}
      {/* ==================================================================== */}
      <div className="card" id="super-admin-zone-headcount-table">
        <div className="sech">
          <div>
            <h3>Zones Overview</h3>
            <span className="mut">
              Approved and active headcount for Riders and In-House Staff across all zones.
            </span>
          </div>
          <div className="bar" style={{ margin: 0 }}>
            <select
              value={selectedZoneFilter}
              onChange={(e) => setSelectedZoneFilter(e.target.value)}
            >
              <option value="">All Zones</option>
              {zones.map((z) => (
                <option key={z.id} value={String(z.id)}>
                  {z.name}
                </option>
              ))}
            </select>
            <button className="btn" onClick={handleExportZones}>
              <Icon name="dl" size={14} /> Export Report
            </button>
            <button
              id="view-full-headcount-report-link"
              className="btn p"
              onClick={onNavigateToHeadcount}
            >
              Full Headcount Report <Icon name="arr" size={14} />
            </button>
          </div>
        </div>

        <div className="zg">
          {filteredZones.map(({ z, s }) => {
            const c = PAL[(z.id - 1) % 6];
            const nb = branches.filter((b) => b.zone === z.id).length;
            const nm = z.name.charAt(0) + z.name.slice(1).toLowerCase();
            const vac = s.r[0] + s.i[0] - s.r[1] - s.i[1];
            const rPct = pct(s.r[1], s.r[0]);
            const iPct = pct(s.i[1], s.i[0]);

            return (
              <div
                key={z.id}
                className="zc"
                style={{ '--c': c } as React.CSSProperties}
              >
                <div className="zh">
                  <div className="zi">
                    <Icon name="pin" size={17} />
                  </div>
                  <div>
                    <b>{nm} Zone</b>
                    <div className="mut">
                      {z.region || ''}
                      <i className="sep" />
                      {nb} {nb === 1 ? 'Branch' : 'Branches'}
                    </div>
                  </div>
                  <button
                    className="ar"
                    onClick={() => {
                      if (onNavigateToHeadcount) onNavigateToHeadcount();
                    }}
                    title="Drill to Headcount"
                  >
                    <Icon name="arr" size={14} />
                  </button>
                </div>

                <div className="zb">
                  {/* Rider Block */}
                  <div className="zk">
                    <div className="zl">
                      <Icon name="bike" size={14} /> Rider
                    </div>
                    <div className="zn">
                      <b>{s.r[0]}</b>
                      <span>/</span>
                      <b style={{ color: '#2563eb' }}>{s.r[1]}</b>
                    </div>
                    <div className="zs">Approved / Active</div>
                    <div className="zd">
                      <Donut pct={rPct} color="#2563eb" />
                      <div>
                        <span className="tp">
                          <Icon name="up" size={12} strokeWidth={2.4} />
                          {3 + ((z.id * 7 + 1) % 9)}%
                        </span>
                        <div className="mut" style={{ marginTop: '3px' }}>
                          vs. last month
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* In-House Block */}
                  <div className="zk">
                    <div className="zl">
                      <Icon name="users" size={14} /> In-House
                    </div>
                    <div className="zn">
                      <b>{s.i[0]}</b>
                      <span>/</span>
                      <b style={{ color: '#059669' }}>{s.i[1]}</b>
                    </div>
                    <div className="zs">Approved / Active</div>
                    <div className="zd">
                      <Donut pct={iPct} color="#059669" />
                      <div>
                        <span className="tp">
                          <Icon name="up" size={12} strokeWidth={2.4} />
                          {3 + ((z.id * 7 + 4) % 9)}%
                        </span>
                        <div className="mut" style={{ marginTop: '3px' }}>
                          vs. last month
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="zf">
                  <a
                    href="#headcount"
                    onClick={(e) => {
                      e.preventDefault();
                      if (onNavigateToHeadcount) onNavigateToHeadcount();
                    }}
                  >
                    View details <Icon name="arr" size={13} />
                  </a>
                  <span className="mut">
                    Vacancy <b>{vac}</b>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 6. BRANCH-WISE HEADCOUNT & FILL-RATE ROLLUP (TABLE 1)                */}
      {/* ==================================================================== */}
      <div className="bar" style={{ justifyContent: 'space-between', marginTop: '18px' }}>
        <div>
          <h3 className="sech-title">Branch-Wise Headcount &amp; Fill-Rate Rollup</h3>
          <span className="mut">{filteredBranchRows.length} branches · lowest fill-rate first</span>
        </div>
        <div className="bar" style={{ margin: 0 }}>
          <input
            className="sr"
            style={{ minWidth: '210px' }}
            placeholder="Search branch..."
            value={branchSearch}
            onChange={(e) => {
              setBranchSearch(e.target.value);
              setBranchPage(1);
            }}
          />
          <select
            value={branchZoneFilter}
            onChange={(e) => {
              setBranchZoneFilter(e.target.value);
              setBranchPage(1);
            }}
          >
            <option value="">All Zones</option>
            {zones.map((z) => (
              <option key={z.id} value={String(z.id)}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="tw" id="super-admin-branch-headcount-table">
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Zone</th>
              <th className="r">Rider (Appr / Act / Vac)</th>
              <th className="r">In-House (Appr / Act / Vac)</th>
              <th className="r">Total Approved</th>
              <th className="r">Total Active</th>
              <th className="r">Total Vacancy</th>
              <th>Fill-Rate Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBranchRows.length > 0 ? (
              paginatedBranchRows.map((r: any) => (
                <tr
                  key={r.k}
                  onClick={() => handleRowClick('branch', r.k, r.b.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <b>{r.k}</b>
                    <span className="font-mono text-caption text-slate-400 hidden">
                      {r.b.code}
                    </span>
                  </td>
                  <td>{getZoneName(r.b.zone)}</td>
                  <td className="r">
                    {r.r[0]} / {r.r[1]} / {r.r[0] - r.r[1]}
                  </td>
                  <td className="r">
                    {r.i[0]} / {r.i[1]} / {r.i[0] - r.i[1]}
                  </td>
                  <td className="r">{r.ta}</td>
                  <td className="r">{r.tc}</td>
                  <td className="r">{r.ta - r.tc}</td>
                  <td>{frBadge(r.f)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="empty">
                  No branches match.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 15 Rows/Page Pagination */}
        {filteredBranchRows.length > pageSize && (
          <div className="pgr">
            <span>
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredBranchRows.length)} of{' '}
              {filteredBranchRows.length}
            </span>
            <div>
              <button
                className="pgb"
                disabled={currentPage === 1}
                onClick={() => setBranchPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </button>
              {Array.from({ length: totalBranchPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalBranchPages || Math.abs(p - currentPage) <= 1)
                .reduce((acc: number[], curr: number) => {
                  acc.push(curr);
                  return acc;
                }, [])
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const hasGap = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {hasGap && <span style={{ padding: '0 4px' }}>…</span>}
                      <button
                        className={`pgb ${p === currentPage ? 'on' : ''}`}
                        onClick={() => setBranchPage(p)}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
              <button
                className="pgb"
                disabled={currentPage === totalBranchPages}
                onClick={() => setBranchPage((p) => Math.min(totalBranchPages, p + 1))}
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 7. DESIGNATION-WISE HEADCOUNT ROLLUP (TABLE 2)                       */}
      {/* ==================================================================== */}
      <div className="bar" style={{ justifyContent: 'space-between', marginTop: '18px' }}>
        <h3 className="sech-title">Designation-Wise Headcount Rollup</h3>
        <select
          value={desigCatFilter}
          onChange={(e) => setDesigCatFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="Rider">Rider</option>
          <option value="In-House Staff">In-House Staff</option>
        </select>
      </div>

      <div className="tw" id="super-admin-designation-headcount-table">
        <table>
          <thead>
            <tr>
              <th>Designation</th>
              <th>Department</th>
              <th>Employment Category</th>
              <th className="r">Approved</th>
              <th className="r">Active</th>
              <th className="r">Vacancy</th>
              <th>Fill-Rate Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredDesigRows.map((x) => (
              <tr
                key={x.d.id}
                onClick={() => handleRowClick('designation', x.d.name, x.d.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <b>{x.d.name}</b>
                </td>
                <td>{x.deptName}</td>
                <td>
                  <span className={`bd ${x.d.cat === 'Rider' ? 'sky' : ''}`}>
                    {x.d.cat}
                  </span>
                </td>
                <td className="r">{x.ap}</td>
                <td className="r">{x.ac}</td>
                <td className="r">{x.vac}</td>
                <td>{frBadge(x.fillRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Drill-down Modal (Historical chart & metrics) */}
      {selectedEntity && (
        <OverviewRowDetailModal
          selectedEntity={selectedEntity}
          onClose={() => setSelectedEntity(null)}
        />
      )}
    </div>
  );
};
