import React, { useState, useEffect } from 'react';
import {
  Lock,
  Coins,
  Crown,
  CreditCard,
  Smartphone,
  Sparkles,
  Loader2,
  X,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import type { Video } from '../types';
import {
  fetchWalletBalance,
  unlockEpisodeWithCoins,
  initializePayment,
  simulateTestPayment,
  MPESA_PACKAGES,
  CARD_PACKAGES,
  VIP_PASSES,
  type CoinWallet,
  type CoinPackage,
  type VipPass,
} from '../services/paymentService';

const WhatsAppIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2ZM12.04 20.16C10.55 20.16 9.09 19.76 7.81 19L7.26 18.68L4.14 19.5L4.97 16.46L4.62 15.9C3.79 14.58 3.35 13.06 3.35 11.91C3.35 7.12 7.25 3.22 12.04 3.22C14.36 3.22 16.54 4.13 18.18 5.77C19.82 7.41 20.73 9.59 20.73 11.91C20.73 16.7 16.83 20.16 12.04 20.16ZM16.81 14.37C16.55 14.24 15.28 13.61 15.04 13.52C14.81 13.44 14.64 13.4 14.47 13.66C14.3 13.92 13.82 14.49 13.67 14.66C13.52 14.83 13.37 14.85 13.11 14.72C12.85 14.59 12.01 14.31 11.02 13.43C10.25 12.74 9.73 11.89 9.58 11.63C9.43 11.37 9.56 11.23 9.69 11.1C9.81 10.98 9.96 10.79 10.09 10.64C10.22 10.49 10.27 10.38 10.35 10.21C10.43 10.04 10.39 9.89 10.33 9.76C10.27 9.63 9.79 8.45 9.59 7.97C9.39 7.5 9.19 7.57 9.04 7.56C8.9 7.55 8.73 7.55 8.56 7.55C8.39 7.55 8.11 7.61 7.87 7.87C7.63 8.13 6.96 8.76 6.96 10.04C6.96 11.32 7.89 12.55 8.02 12.72C8.15 12.89 9.85 15.51 12.45 16.63C13.07 16.9 13.55 17.06 13.93 17.18C14.55 17.38 15.11 17.35 15.56 17.28C16.06 17.21 17.09 16.66 17.31 16.04C17.53 15.42 17.53 14.89 17.46 14.78C17.39 14.67 17.24 14.61 16.98 14.48L16.81 14.37Z" />
  </svg>
);

interface MicroDramaPaywallProps {
  video: Video;
  onUnlocked: () => void;
  onClose: () => void;
  onRequireLogin: () => void;
  isAuthenticated: boolean;
}

export default function MicroDramaPaywall({
  video,
  onUnlocked,
  onClose,
  onRequireLogin,
  isAuthenticated,
}: MicroDramaPaywallProps) {
  const [wallet, setWallet] = useState<CoinWallet | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card'>('mpesa');
  const [purchaseTab, setPurchaseTab] = useState<'coins' | 'vip'>('coins');
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage>(MPESA_PACKAGES[0]);
  const [selectedVipPass, setSelectedVipPass] = useState<VipPass>(VIP_PASSES[0]);
    const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem('tube_verified_phone') || '';
    } catch {
      return '';
    }
  });
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showTestSettings, setShowTestSettings] = useState(false);
  const [testPublicKey, setTestPublicKey] = useState(() => {
    try {
      return localStorage.getItem('tube_paystack_test_pk') || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';
    } catch {
      return '';
    }
  });

  const handleSimulateTestPayment = async () => {
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }
    setIsSimulating(true);
    setErrorMessage('');
    try {
      const isVip = purchaseTab === 'vip';
      const coins = isVip ? 100 : selectedPackage.coins;
      const bonus = isVip ? 0 : (selectedPackage.bonus || 0);

      const res = await simulateTestPayment({
        packageId: isVip ? selectedVipPass.id : selectedPackage.id,
        coins,
        bonus,
      });

      setWallet(res.wallet);
      setSuccessNotice(`🎉 Sandbox: Added ${coins + bonus} Coins to your wallet!`);
      await unlockEpisodeWithCoins(video.id, video.seriesId, coinCost);
      setTimeout(() => {
        onUnlocked();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Test payment simulation failed.');
    } finally {
      setIsSimulating(false);
    }
  };
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stkSent, setStkSent] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchWalletBalance().then(setWallet);
    }
  }, [isAuthenticated]);

  // 1 Coin = 1 Episode = 1 Shilling (KES 1)
  const coinCost = 1;
  const hasEnoughCoins = (wallet?.totalCoins ?? 0) >= coinCost;

  const handle1TapUnlock = async () => {
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }

    setIsUnlocking(true);
    setErrorMessage('');

    try {
      const result = await unlockEpisodeWithCoins(video.id, video.seriesId, coinCost);
      if (result.success) {
        if (wallet) {
          setWallet({
            ...wallet,
            totalCoins: result.remainingBalance ?? wallet.totalCoins - coinCost,
          });
        }
        onUnlocked();
      } else {
        setErrorMessage(result.error || 'Failed to unlock episode.');
      }
    } catch {
      setErrorMessage('Network error during unlock. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }

    setIsPaying(true);
    setErrorMessage('');

    try {
      const isMpesa = paymentMethod === 'mpesa';
      const isVip = purchaseTab === 'vip';
      const targetItem = isVip ? selectedVipPass : selectedPackage;
      const amount = isMpesa ? targetItem.priceKes : targetItem.priceUsd;

      const result = await initializePayment({
        packageId: targetItem.id,
        amount,
        currency: isMpesa ? 'KES' : 'USD',
        paymentMethod,
        phone: isMpesa ? phone : undefined,
      });

      if (result.error) {
        setErrorMessage(result.error);
        setIsPaying(false);
        return;
      }

      // Launch Paystack Inline if available, otherwise redirect to Paystack hosted page
      const hasPaystackPop = typeof (window as any).PaystackPop !== 'undefined';
      if (hasPaystackPop && result.accessCode) {
        const handler = (window as any).PaystackPop.setup({
          key: testPublicKey || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
          access_code: result.accessCode,
          onClose: () => {
            setIsPaying(false);
          },
          callback: async (response: any) => {
            setIsPaying(true);
            setSuccessNotice('🎉 Payment received! Unlocking episode...');
            // Wait briefly for wallet sync then unlock
            await new Promise((r) => setTimeout(r, 1200));
            await fetchWalletBalance().then(setWallet);
            await unlockEpisodeWithCoins(video.id, video.seriesId, coinCost);
            onUnlocked();
          },
        });
        handler.openIframe();
      } else if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
      } else {
        setErrorMessage('Unable to load Paystack payment page. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment initiation failed.');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl p-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
          aria-label="Close paywall"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 flex-shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-red-500 tracking-wider uppercase">Episode Locked</span>
              <span className="text-zinc-500 text-xs">·</span>
              <span className="text-zinc-400 text-xs">Ep. {video.episode || 4}</span>
            </div>
            <h3 className="text-base font-bold text-white truncate max-w-[240px]">{video.title}</h3>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Balance & 1-Tap Unlock Section (When viewer has at least 1 coin) */}
        {isAuthenticated && hasEnoughCoins ? (
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-zinc-800 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-zinc-400">Available Balance</span>
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                <Coins className="w-4 h-4 fill-amber-400" />
                <span>{wallet?.totalCoins ?? 0} Coins</span>
              </div>
            </div>

            <button
              onClick={handle1TapUnlock}
              disabled={isUnlocking}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              {isUnlocking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Unlocking episode...</span>
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  <span>Unlock Episode (1 Coin)</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-zinc-500 text-center mt-2">Unlocks instantly for uninterrupted viewing.</p>
          </div>
        ) : (
          /* Low Coins / Recharge Flow */
          <div className="space-y-4">
            {isAuthenticated && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-xs text-zinc-400">Your Coin Balance</span>
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 fill-amber-400" />
                  {wallet?.totalCoins ?? 0} Coins (Need {coinCost} Coin)
                </span>
              </div>
            )}

            {!isAuthenticated && (
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <p className="text-xs text-zinc-300 mb-2.5">Sign in to claim your 5 free welcome bonus coins!</p>
                <button
                  onClick={onRequireLogin}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow transition-all active:scale-95"
                >
                  <Coins className="w-4 h-4 text-black" />
                  <span>Sign in with Phone to Claim 5 Coins</span>
                </button>
              </div>
            )}

            {/* Purchase Mode Toggle: Coins vs VIP Unlimited */}
            <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setPurchaseTab('coins')}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  purchaseTab === 'coins'
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Coins (1 Coin = 1 Ep)</span>
              </button>
              <button
                type="button"
                onClick={() => setPurchaseTab('vip')}
                className={`flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                  purchaseTab === 'vip'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Unlimited VIP Pass</span>
              </button>
            </div>

            {/* Coins Grid View */}
            {purchaseTab === 'coins' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                  {paymentMethod === 'mpesa' ? 'Choose M-Pesa Coin Pack (Min 10 Bob)' : 'Choose Coin Bundle'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(paymentMethod === 'mpesa' ? MPESA_PACKAGES : CARD_PACKAGES).map((pkg) => {
                    const isSelected = selectedPackage.id === pkg.id;
                    const totalCoins = pkg.coins + (pkg.bonus || 0);
                    return (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedPackage(pkg)}
                        className={`relative p-3 rounded-2xl border text-center transition-all ${
                          isSelected
                            ? 'bg-amber-950/40 border-amber-500 text-white shadow-md ring-1 ring-amber-500/50'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                        }`}
                      >
                        {pkg.id === 'coins-10' && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-600 text-[9px] font-bold px-2 py-0.2 rounded-full uppercase text-white shadow">
                            Min 10 Bob
                          </span>
                        )}
                        {pkg.isPopular && pkg.id !== 'coins-10' && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-[9px] font-bold px-2 py-0.2 rounded-full uppercase text-white shadow">
                            Best Value
                          </span>
                        )}
                        <div className="flex items-center justify-center gap-1 text-amber-400 font-extrabold text-sm mb-0.5 mt-1">
                          <Coins className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{totalCoins} Coins</span>
                        </div>
                        <div className="text-[11px] font-bold text-emerald-400 mb-0.5">
                          {totalCoins} Episodes
                        </div>
                        <div className="text-xs font-extrabold text-white">
                          {paymentMethod === 'mpesa' ? `KES ${pkg.priceKes}` : `$${pkg.priceUsd}`}
                        </div>
                        <div className="text-[9px] text-zinc-400 mt-0.5">Never expires</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIP Pass Grid View */}
            {purchaseTab === 'vip' && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                  Unlimited VIP All-Access Pass
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {VIP_PASSES.map((pass) => {
                    const isSelected = selectedVipPass.id === pass.id;
                    return (
                      <button
                        key={pass.id}
                        onClick={() => setSelectedVipPass(pass)}
                        className={`relative p-3 rounded-2xl border text-center transition-all ${
                          isSelected
                            ? 'bg-red-950/40 border-red-600 text-white shadow-md ring-1 ring-red-500/50'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                        }`}
                      >
                        {pass.id === 'pass-daily' && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-600 text-[9px] font-bold px-2 py-0.2 rounded-full uppercase text-white shadow">
                            20 Bob
                          </span>
                        )}
                        {pass.id === 'pass-weekly' && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-[9px] font-bold px-2 py-0.2 rounded-full uppercase text-black shadow">
                            100/=
                          </span>
                        )}
                        {pass.id === 'pass-monthly' && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-[9px] font-bold px-2 py-0.2 rounded-full uppercase text-white shadow">
                            300/=
                          </span>
                        )}
                        <div className="flex items-center justify-center gap-1 text-red-400 font-extrabold text-xs mb-0.5 mt-1">
                          <Crown className="w-3.5 h-3.5" />
                          <span>{pass.durationLabel}</span>
                        </div>
                        <div className="text-[11px] font-bold text-emerald-400 mb-0.5">
                          Unlimited
                        </div>
                        <div className="text-xs font-extrabold text-white">
                          {paymentMethod === 'mpesa' ? `KES ${pass.priceKes}` : `$${pass.priceUsd}`}
                        </div>
                        <div className="text-[9px] text-zinc-400 mt-0.5">{pass.durationLabel} access</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pricing Clarity Helper */}
            <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Transparent Kenyan Pricing:</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                • <strong className="text-white">1 Coin = 1 Episode = 1 Shilling (KES 1)</strong>.<br />
                • <strong className="text-white">Minimum Payment: KES 10</strong> (10 Coins = 10 Episodes).<br />
                • <strong className="text-white">KES 100 = 115 Episodes</strong> (100 coins + 15 bonus coins).<br />
                • <strong className="text-amber-400 font-semibold">VIP Unlimited:</strong> 24h for 20 bob · 7 Days for 100/= · 30 Days for 300/=.<br />
                • <strong className="text-emerald-400 font-semibold">Never Expires:</strong> Purchased coins stay in your wallet forever. Unlocked episodes remain unlocked forever.
              </p>
            </div>

            {/* Payment Method Selector (M-Pesa vs Diaspora Cards/Apple Pay) */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                Payment Rail
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('mpesa');
                    setSelectedPackage(MPESA_PACKAGES[0]);
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    paymentMethod === 'mpesa'
                      ? 'bg-zinc-900 border-green-500 text-white shadow-sm'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-green-500" />
                  <span>M-Pesa STK (Kenya)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('card');
                    setSelectedPackage(CARD_PACKAGES[0]);
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    paymentMethod === 'card'
                      ? 'bg-zinc-900 border-red-500 text-white shadow-sm'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-red-500" />
                  <span>Card / Apple Pay</span>
                </button>
              </div>

              {/* M-Pesa Phone Input */}
              {paymentMethod === 'mpesa' && !stkSent && (
                <div className="mt-3">
                  <input
                    type="tel"
                    placeholder="M-Pesa Phone (e.g. 0712 345 678)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-green-500"
                  />
                  <span className="text-[10px] text-zinc-500 block mt-1">
                    You will receive an instant STK push prompt on your phone to enter PIN.
                  </span>
                </div>
              )}

              {stkSent && (
                <div className="mt-3 p-3 rounded-xl bg-green-950/40 border border-green-800 text-xs text-green-300 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>M-Pesa prompt sent to phone. Enter your PIN to complete the unlock.</span>
                </div>
              )}
            </div>

            
            {/* Paystack Kenya Test Sandbox Panel */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Paystack Kenya Sandbox (Test Mode)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTestSettings(!showTestSettings)}
                  className="text-[10px] text-zinc-400 hover:text-white underline"
                >
                  {showTestSettings ? 'Hide Key' : 'Set Test Key'}
                </button>
              </div>

              {showTestSettings && (
                <div className="pt-2 border-t border-amber-500/20 space-y-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-400">Paystack Test Public Key (pk_test_...)</label>
                  <input
                    type="text"
                    placeholder="pk_test_..."
                    value={testPublicKey}
                    onChange={(e) => {
                      setTestPublicKey(e.target.value);
                      localStorage.setItem('tube_paystack_test_pk', e.target.value);
                    }}
                    className="w-full bg-black/60 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {paymentMethod === 'mpesa' ? (
                  <>
                    Test M-Pesa: <span className="text-white cursor-pointer underline font-bold" onClick={() => setPhone('0712345678')}>0712 345 678</span>. In Paystack popup, enter PIN <strong className="text-white">1234</strong>.
                  </>
                ) : (
                  <>
                    Test Visa: <strong className="text-white">4084 0840 8408 4081</strong> • Exp: <strong>12/30</strong> • CVV: <strong>123</strong> • OTP: <strong>123456</strong>
                  </>
                )}
              </p>

              <button
                type="button"
                onClick={handleSimulateTestPayment}
                disabled={isSimulating}
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow transition-all active:scale-95"
              >
                {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>⚡ 1-Click Sandbox Test Credit & Unlock</span>}
              </button>
            </div>

            {/* Status Notice */}
            {successNotice && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {/* Pay Button */}
            <button
              onClick={handlePurchase}
              disabled={isPaying}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              {isPaying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to Paystack...</span>
                </>
              ) : (
                <>
                  <span>
                    Pay with Paystack {paymentMethod === 'mpesa' 
                      ? `(KES ${purchaseTab === 'vip' ? selectedVipPass.priceKes : selectedPackage.priceKes})` 
                      : `(${purchaseTab === 'vip' ? selectedVipPass.priceUsd : selectedPackage.priceUsd})`}
                    {purchaseTab === 'vip' && ` • ${selectedVipPass.durationLabel} VIP`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Paystack Kenya Trust Footer */}
            <div className="pt-2 flex flex-col items-center gap-1.5 border-t border-zinc-900 mt-2">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Secured by <a href="https://paystack.com/ke" target="_blank" rel="noopener noreferrer" className="font-bold text-white hover:underline">Paystack Kenya</a> (CBK Licensed PSP)</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-emerald-400 font-bold">M-Pesa STK</span>
                <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">Visa / Mastercard</span>
                <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">Apple Pay</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
