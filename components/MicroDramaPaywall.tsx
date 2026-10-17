import React, { useState, useEffect } from 'react';
import {
  Lock,
  Coins,
  Zap,
  Check,
  CreditCard,
  Smartphone,
  Sparkles,
  Loader2,
  X,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import type { Video } from '../types';
import {
  fetchWalletBalance,
  unlockEpisodeWithCoins,
  initializePayment,
  COIN_PACKAGES,
  VIP_PASSES,
  type CoinWallet,
  type CoinPackage,
} from '../services/paymentService';

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
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage>(COIN_PACKAGES[1]);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card'>('mpesa');
  const [phone, setPhone] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stkSent, setStkSent] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchWalletBalance().then(setWallet);
    }
  }, [isAuthenticated]);

  const coinCost = 10;
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
      const result = await initializePayment({
        packageId: selectedPackage.id,
        amount: isMpesa ? selectedPackage.priceKes : selectedPackage.priceUsd,
        currency: isMpesa ? 'KES' : 'USD',
        paymentMethod,
        phone: isMpesa ? phone : undefined,
      });

      if (result.error) {
        setErrorMessage(result.error);
        setIsPaying(false);
        return;
      }

      if (isMpesa) {
        setStkSent(true);
        // Poll for coin update or allow dismissal
      } else if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
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

        {/* Balance & 1-Tap Unlock Section */}
        {isAuthenticated && hasEnoughCoins ? (
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-zinc-800 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-zinc-400">Available Coins</span>
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
                  <Zap className="w-4 h-4 fill-white" />
                  <span>Unlock Episode (10 Coins)</span>
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
                  {wallet?.totalCoins ?? 0} Coins (Need {coinCost})
                </span>
              </div>
            )}

            {!isAuthenticated && (
              <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <p className="text-xs text-zinc-300 mb-2.5">Sign in to claim your 30 free welcome bonus coins!</p>
                <button
                  onClick={onRequireLogin}
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                >
                  Sign in with Phone / Email
                </button>
              </div>
            )}

            {/* Coin Package Grid */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                Choose a Coin Bundle
              </label>
              <div className="grid grid-cols-3 gap-2">
                {COIN_PACKAGES.map((pkg) => {
                  const isSelected = selectedPackage.id === pkg.id;
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg)}
                      className={`relative p-3 rounded-2xl border text-center transition-all ${
                        isSelected
                          ? 'bg-red-950/40 border-red-600 text-white shadow-md'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      {pkg.isPopular && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-[9px] font-bold px-2 py-0.2 rounded-full uppercase text-white shadow">
                          Best Value
                        </span>
                      )}
                      <div className="flex items-center justify-center gap-1 text-amber-400 font-extrabold text-sm mb-1 mt-1">
                        <Coins className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{pkg.coins}</span>
                      </div>
                      {pkg.bonus > 0 && (
                        <div className="text-[10px] text-green-400 font-semibold mb-1">+{pkg.bonus} Free</div>
                      )}
                      <div className="text-xs font-bold text-white">
                        {paymentMethod === 'mpesa' ? `KES ${pkg.priceKes}` : `$${pkg.priceUsd}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Method Selector (M-Pesa vs Diaspora Cards/Apple Pay) */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                Payment Rail
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('mpesa')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    paymentMethod === 'mpesa'
                      ? 'bg-zinc-900 border-green-500 text-white'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-green-500" />
                  <span>M-Pesa STK (Kenya)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    paymentMethod === 'card'
                      ? 'bg-zinc-900 border-red-500 text-white'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400'
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

            {/* Pay Button */}
            {!stkSent && (
              <button
                onClick={handlePurchase}
                disabled={isPaying}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              >
                {isPaying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initiating payment...</span>
                  </>
                ) : (
                  <>
                    <span>Pay {paymentMethod === 'mpesa' ? `KES ${selectedPackage.priceKes}` : `$${selectedPackage.priceUsd}`}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
