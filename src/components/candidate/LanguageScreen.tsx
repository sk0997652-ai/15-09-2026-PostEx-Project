import React, { useState } from 'react';
import { Languages, Check, ArrowRight, Globe, ShieldCheck } from 'lucide-react';
import { Language, useI18n } from '../../lib/i18n';
import { useBranding } from '../../lib/branding';
import { Button } from '../ui';

interface LanguageScreenProps {
  candidateName: string;
  joiningId: string;
  onLanguageSelected: () => void;
}

export const LanguageScreen: React.FC<LanguageScreenProps> = ({
  candidateName,
  joiningId,
  onLanguageSelected,
}) => {
  const { lang, setLang } = useI18n();
  const { branding } = useBranding();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(lang);

  const handleSelect = (l: Language) => {
    setSelectedLanguage(l);
    setLang(l);
  };

  const handleProceed = () => {
    setLang(selectedLanguage);
    try {
      sessionStorage.setItem('pex_candidate_lang_selected', 'true');
    } catch {
      // ignore
    }
    onLanguageSelected();
  };

  return (
    <div id="candidate-language-selection-screen" className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Header Banner */}
      <div className="text-center space-y-3 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-200">
          <Languages className="w-7 h-7" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
          <span className="font-mono">{joiningId}</span>
          <span>&bull;</span>
          <span>{candidateName}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Select Your Preferred Language / زبان منتخب کریں
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
          Please select the language you would like to use during your PostEx digital onboarding journey.
          <span className="block mt-0.5 text-slate-500 font-urdu" dir="rtl">
            براہ کرم پوسٹ ایکس ڈیجیٹل آن بورڈنگ کے لیے اپنی پسندیدہ زبان کا انتخاب کریں۔
          </span>
        </p>
      </div>

      {/* Language Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* English Option */}
        <button
          type="button"
          id="lang-select-en"
          onClick={() => handleSelect('en')}
          className={`relative p-6 rounded-2xl border-2 text-left transition-all cursor-pointer ${
            selectedLanguage === 'en'
              ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-bold text-base shadow-xs">
              EN
            </div>
            {selectedLanguage === 'en' && (
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">English</h3>
          <p className="text-xs text-slate-500 mt-1">
            Official corporate language for contracts, offer letters, and policy disclosures.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
            <Globe className="w-3.5 h-3.5" />
            <span>Recommended for Executive Track</span>
          </div>
        </button>

        {/* Urdu Option */}
        <button
          type="button"
          id="lang-select-ur"
          onClick={() => handleSelect('ur')}
          className={`relative p-6 rounded-2xl border-2 text-right transition-all cursor-pointer ${
            selectedLanguage === 'ur'
              ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-xs'
          }`}
          dir="rtl"
        >
          <div className="flex items-start justify-between mb-4" dir="ltr">
            {selectedLanguage === 'ur' && (
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
            )}
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 font-bold text-base shadow-xs ml-auto font-urdu">
              اردو
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-urdu">اردو (قومی زبان)</h3>
          <p className="text-xs text-slate-500 mt-1 font-urdu leading-relaxed">
            آن بورڈنگ فارم، ہدایات اور تصدیقی اعلانات مکمل طور پر اردو زبان میں دستیاب ہیں۔
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 font-urdu justify-end">
            <span>نان ایگزیکٹو اور فیلڈ عملے کے لیے تجویز کردہ</span>
            <Globe className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Confirmation & Proceed Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              {selectedLanguage === 'en'
                ? 'Selected Language: English'
                : 'منتخب کردہ زبان: اردو'}
            </p>
            <p className="text-[11px] text-slate-500">
              You can toggle language anytime using the header selector.
            </p>
          </div>
        </div>

        <Button
          type="button"
          id="candidate-language-proceed-btn"
          variant="primary"
          size="medium"
          onClick={handleProceed}
          rightIcon={<ArrowRight className="w-4 h-4" />}
          className="w-full sm:w-auto px-8"
        >
          {selectedLanguage === 'en' ? 'Continue to Consent' : 'جاری رکھیں (شرائط و ضوابط)'}
        </Button>
      </div>
    </div>
  );
};
