import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import {
  Clock,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Bed,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function BookingFlowPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cardNumber, setCardNumber] = useState('4111222233334444');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('123');
  const [nameOnCard, setNameOnCard] = useState('Demo Guest');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [confirmedData, setConfirmedData] = useState(null);

  // Fetch hold details
  const {
    data: bookingData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/bookings/${id}`),
    refetchInterval: (query) => (query.state.data?.data?.status === 'HELD' ? 5000 : false),
  });

  const booking = bookingData?.data;

  // Countdown timer for hold expiration
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes default

  useEffect(() => {
    if (!booking?.holdExpiresAt || booking.status !== 'HELD') return;

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((new Date(booking.holdExpiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [booking?.holdExpiresAt, booking?.status]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      // Deterministic idempotency key for this payment submission
      const idempotencyKey = `idemp-${booking._id}-${cardNumber.slice(-4)}`;

      const res = await api.post(
        `/bookings/${booking._id}/confirm`,
        { cardNumber },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );

      setConfirmedData(res.data);
    } catch (err) {
      setErrorMsg(err.message || 'Payment simulation failed. Please review your details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-600">Retrieving reservation details...</p>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Reservation Not Found</h2>
        <p className="text-sm text-slate-600 mb-6">This reservation may have expired or was cancelled.</p>
        <Link to="/" className="inline-flex px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium">
          Start New Search
        </Link>
      </div>
    );
  }

  // Confirmation Success View
  if (confirmedData || booking.status === 'CONFIRMED') {
    const confirmedBooking = confirmedData?.booking || booking;
    const payment = confirmedData?.payment;

    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-200">
            Booking Confirmed
          </span>

          <h1 className="text-2xl font-extrabold text-slate-900 mt-4">Your stay is reserved!</h1>
          <p className="text-sm text-slate-600 mt-1">A confirmation has been recorded in the hotel ledger.</p>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200/80 my-8 text-left space-y-3">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <span className="text-xs font-medium text-slate-500">Booking Reference</span>
              <span className="font-mono font-bold text-brand-700 text-base">{confirmedBooking.reference}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Room Type</span>
              <span className="font-semibold text-slate-800">{confirmedBooking.roomTypeId?.name || 'Deluxe'}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Dates</span>
              <span className="font-semibold text-slate-800">
                {confirmedBooking.checkIn} to {confirmedBooking.checkOut} ({confirmedBooking.nights} nights)
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Paid (SANDBOX)</span>
              <span className="font-bold text-slate-900">
                ₹{((confirmedBooking.price?.total || 0) / 100).toLocaleString('en-IN')}
              </span>
            </div>

            {payment && (
              <div className="flex justify-between text-xs text-slate-400 border-t border-slate-200 pt-2">
                <span>Transaction Ref</span>
                <span className="font-mono">{payment.providerRef}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/my-bookings"
              className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl text-sm transition shadow-sm"
            >
              View My Bookings
            </Link>
            <Link
              to="/"
              className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active Hold Checkout View
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hold Expiry Countdown Bar */}
      <div className="bg-amber-500 text-white rounded-2xl p-4 mb-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 animate-pulse" />
          <div>
            <div className="font-bold text-sm">Room Hold Active</div>
            <div className="text-xs text-amber-100">
              Complete your simulated payment before the timer expires to lock in this reservation.
            </div>
          </div>
        </div>
        <div className="font-mono text-2xl font-black bg-amber-600/60 px-3.5 py-1 rounded-xl">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Payment Form */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand-600" />
              Simulated Payment (SANDBOX)
            </h2>
            <p className="text-xs text-slate-500 mb-6">
              Evaluation Gateway. No actual charges will occur.
            </p>

            {/* Deterministic testing hint */}
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs mb-6 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Deterministic Test Rules:</strong> Card ending in <code className="font-mono font-bold bg-blue-100 px-1 rounded">0000</code> tests decline simulation. Any other number succeeds.
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs mb-6 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Card Number
                </label>
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4111 2222 3333 4444"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    required
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    CVV
                  </label>
                  <input
                    type="text"
                    required
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    placeholder="123"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Name on Card
                </label>
                <input
                  type="text"
                  required
                  value={nameOnCard}
                  onChange={(e) => setNameOnCard(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || timeLeft <= 0}
                className="w-full mt-4 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? 'Processing Payment...' : `Pay ₹${((booking.price?.total || 0) / 100).toLocaleString('en-IN')} & Confirm`}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Reservation Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-3">
              Stay Summary
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Room</span>
                <span className="font-semibold text-slate-800">{booking.roomTypeId?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Check-in</span>
                <span className="font-semibold text-slate-800">{booking.checkIn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Check-out</span>
                <span className="font-semibold text-slate-800">{booking.checkOut}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration</span>
                <span className="font-semibold text-slate-800">{booking.nights} Nights</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Guests</span>
                <span className="font-semibold text-slate-800">{booking.guests} Guests</span>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-1.5">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>₹{((booking.price?.subtotal || 0) / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Taxes (12%)</span>
                  <span>₹{((booking.price?.tax || 0) / 100).toLocaleString('en-IN')}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-slate-900">
                  <span>Total Amount</span>
                  <span className="text-brand-700">₹{((booking.price?.total || 0) / 100).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

