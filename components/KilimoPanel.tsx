import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Calendar, Lightbulb } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

// Kenya agricultural market prices — Wakulima/NCPB reference
// Prices in KES. Updated for: Long rains harvest season (May 2026)
const MARKET_PRICES = [
  { sw: 'Mahindi',    en: 'Maize',       unit: '90kg bag',  price: 5200, prev: 4800, change: 'up'   as const },
  { sw: 'Maharagwe', en: 'Beans',        unit: '90kg bag',  price: 7800, prev: 8200, change: 'down' as const },
  { sw: 'Viazi',      en: 'Potatoes',    unit: '110kg bag', price: 2800, prev: 2800, change: 'flat' as const },
  { sw: 'Mchele',    en: 'Rice',         unit: '50kg bag',  price: 9500, prev: 9200, change: 'up'   as const },
  { sw: 'Nyanya',     en: 'Tomatoes',    unit: 'crate',     price: 4200, prev: 5100, change: 'down' as const },
  { sw: 'Sukari',     en: 'Sugar',       unit: '50kg bag',  price: 7200, prev: 7200, change: 'flat' as const },
  { sw: 'Ngano',      en: 'Wheat',       unit: '90kg bag',  price: 6100, prev: 5900, change: 'up'   as const },
  { sw: 'Vitunguu',  en: 'Onions',       unit: 'bag',       price: 5500, prev: 5500, change: 'flat' as const },
];

// Kenya agricultural calendar — current season context
const SEASONS: Record<number, { name: string; nameSw: string; badge: string; tip: string; tipSw: string }> = {
  1:  { name: 'Dry Season', nameSw: 'Kiangazi', badge: 'bg-orange-600', tip: 'Irrigate where possible. Good time to prepare land and source certified seeds for the long rains in March.', tipSw: 'Mwagilia mahali inapowezekana. Wakati mzuri wa kulima ardhi na kupata mbegu bora kwa mvua za masika Machi.' },
  2:  { name: 'Dry Season', nameSw: 'Kiangazi', badge: 'bg-orange-600', tip: 'Final land preparation before long rains. Source DAP fertilizer early — prices rise in March.', tipSw: 'Andaa ardhi kabla ya mvua za masika. Pata mbolea ya DAP mapema — bei huongezeka Machi.' },
  3:  { name: 'Long Rains Planting', nameSw: 'Kupanda kwa Masika', badge: 'bg-green-600', tip: 'Plant maize and beans now. Use certified seed and apply basal fertilizer at planting. Target plant population: 53,000 plants/ha.', tipSw: 'Panda mahindi na maharagwe sasa. Tumia mbegu bora na weka mbolea ya msingi. Lengo: mimea 53,000/ha.' },
  4:  { name: 'Long Rains Growing', nameSw: 'Ukuaji wa Masika', badge: 'bg-emerald-600', tip: 'Top-dress maize with CAN at 4–6 leaf stage. Scout for Fall Armyworm — report infestations to your county agriculture office.', tipSw: 'Weka mbolea ya CAN mahindi yakiwa na majani 4-6. Tafuta FAW — ripoti shambulio kwa ofisi ya kilimo ya kaunti.' },
  5:  { name: 'Long Rains Harvest', nameSw: 'Mavuno ya Masika', badge: 'bg-amber-600', tip: 'Maize in highland areas ready for harvest. Dry to 13% moisture before storage. Apply PICS bags to prevent weevils. Prices are rising — hold stock if you can.', tipSw: 'Mahindi ya maeneo ya juu yako tayari. Kaushia hadi unyevu 13% kabla ya kuhifadhi. Tumia mifuko ya PICS kuzuia wadudu.' },
  6:  { name: 'Long Rains Harvest', nameSw: 'Mavuno ya Masika', badge: 'bg-amber-600', tip: 'Harvest and store maize carefully. This is a price dip season — consider selling gradually or storing for later. Prepare for short rains planting in October.', tipSw: 'Vuna na hifadhi mahindi kwa makini. Bei hushuka — fikiria kuuza polepole au kuhifadhi. Jiandae kwa kupanda msimu wa Oktoba.' },
  7:  { name: 'Dry Season', nameSw: 'Kiangazi', badge: 'bg-orange-600', tip: 'Dry season — ideal for irrigated horticulture (tomatoes, capsicum). Maize stored now will fetch good prices come October.', tipSw: 'Kiangazi — mazuri kwa kilimo cha bustani chenye umwagiliaji. Mahindi yaliyohifadhiwa yataleta bei nzuri Oktoba.' },
  8:  { name: 'Dry Season', nameSw: 'Kiangazi', badge: 'bg-orange-600', tip: 'Prepare land for short rains. Order certified seeds and fertilizer in advance to avoid shortages when rains arrive.', tipSw: 'Andaa ardhi kwa mvua za msimu. Agiza mbegu na mbolea mapema ili kuepuka uhaba wakati mvua zikija.' },
  9:  { name: 'Short Rains Prep', nameSw: 'Maandalizi ya Vuli', badge: 'bg-teal-600', tip: 'Short rains expected in October across most regions. Plant sorghum, finger millet, and green grams for drought-tolerant options.', tipSw: 'Mvua za vuli zinatarajiwa Oktoba. Panda mtama, wimbi, na choroko kwa chaguzi zinazostahimili ukame.' },
  10: { name: 'Short Rains Planting', nameSw: 'Kupanda kwa Vuli', badge: 'bg-teal-600', tip: 'Plant short-cycle maize varieties (90-day). Also plant vegetables for the December market. Short rains are variable — plant within 3 days of first rains.', tipSw: 'Panda aina fupi za mahindi (siku 90). Panda mboga kwa soko la Desemba. Panda ndani ya siku 3 za mvua za kwanza.' },
  11: { name: 'Short Rains Growing', nameSw: 'Ukuaji wa Vuli', badge: 'bg-emerald-600', tip: 'Top-dress short rains maize. Good time to harvest rainwater for dry season irrigation. Monitor for pests as rains taper off.', tipSw: 'Weka mbolea mahindi ya vuli. Wakati mzuri wa kuvuna maji ya mvua. Angalia wadudu mvua zinapokwisha.' },
  12: { name: 'Short Rains Harvest', nameSw: 'Mavuno ya Vuli', badge: 'bg-amber-600', tip: 'Harvest short rains crops before festive demand drives prices up. Sell tomatoes and vegetables now — December prices are highest of the year.', tipSw: 'Vuna mazao ya vuli kabla ya mahitaji ya sherehe kuinua bei. Uza nyanya na mboga sasa — bei za Desemba ni juu zaidi mwakani.' },
};

const KilimoPanel: React.FC = () => {
  const { language } = useLanguage();
  const sw = language === 'sw';
  const [showAll, setShowAll] = useState(false);

  const month = new Date().getMonth() + 1;
  const season = SEASONS[month];
  const displayed = showAll ? MARKET_PRICES : MARKET_PRICES.slice(0, 4);
  const today = new Date().toLocaleDateString(sw ? 'sw-KE' : 'en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="rounded-2xl border border-green-800/30 bg-gradient-to-br from-green-950/40 to-zinc-950 mb-8 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.05]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${season.badge}`}>
              {sw ? season.nameSw.toUpperCase() : season.name.toUpperCase()}
            </span>
          </div>
          <p className="text-white font-black text-base">
            {sw ? 'Bei za Soko' : 'Market Prices'}
          </p>
          <p className="text-zinc-500 text-[11px] mt-0.5">
            {sw ? 'Soko la Wakulima, Nairobi' : 'Wakulima Market, Nairobi'} · {today}
          </p>
        </div>
        <Calendar className="w-5 h-5 text-zinc-600 flex-shrink-0" />
      </div>

      {/* Prices grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.03]">
        {displayed.map(item => (
          <div key={item.en} className="bg-zinc-950/70 px-4 py-3">
            <p className="text-zinc-400 text-[11px] font-medium">{sw ? item.sw : item.en}</p>
            <p className="text-white font-black text-xl mt-0.5 tabular-nums">
              {item.price.toLocaleString()}
              <span className="text-zinc-600 text-xs font-normal ml-0.5">KES</span>
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {item.change === 'up'   && <TrendingUp   size={10} className="text-green-400 flex-shrink-0" />}
              {item.change === 'down' && <TrendingDown  size={10} className="text-red-400 flex-shrink-0"   />}
              {item.change === 'flat' && <Minus         size={10} className="text-zinc-600 flex-shrink-0"  />}
              <span className={`text-[10px] font-semibold ${
                item.change === 'up' ? 'text-green-400' :
                item.change === 'down' ? 'text-red-400' : 'text-zinc-600'
              }`}>
                {item.change === 'up'   ? `+${(item.price - item.prev).toLocaleString()}` :
                 item.change === 'down' ? `-${(item.prev - item.price).toLocaleString()}` : 'Stable'}
              </span>
              <span className="text-zinc-700 text-[10px]"> / {item.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Show more toggle */}
      <button
        onClick={() => setShowAll(v => !v)}
        className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 py-2 transition-colors border-t border-white/[0.04]"
      >
        {showAll
          ? (sw ? 'Onyesha kidogo' : 'Show less')
          : (sw ? `Mazao yote (${MARKET_PRICES.length})` : `All ${MARKET_PRICES.length} crops`)}
      </button>

      {/* Season tip */}
      <div className="flex items-start gap-3 px-5 py-4 border-t border-white/[0.04]">
        <Lightbulb size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-zinc-300 text-xs leading-relaxed">
          <span className="font-bold text-amber-300">
            {sw ? 'Ushauri wa Msimu: ' : 'Season Tip: '}
          </span>
          {sw ? season.tipSw : season.tip}
        </p>
      </div>
    </div>
  );
};

export default KilimoPanel;
