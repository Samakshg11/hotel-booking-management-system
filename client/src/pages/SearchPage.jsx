import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Calendar, Users, Bed, Check, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

export default function SearchPage() {
  const { isAuthenticated, switchDemoRole } = useAuth();
  const navigate = useNavigate();

  const [checkIn, setCheckIn] = useState(getTodayString());
  const [checkOut, setCheckOut] = useState(getTomorrowString());
  const [guests, setGuests] = useState(2);
  const [holdingId, setHoldingId] = useState(null);
  const [holdError, setHoldError] = useState(null);

  // Fetch live availability from backend
  const {
    data: availabilityData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['availability', checkIn, checkOut, guests],
    queryFn: () => api.get(`/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`),
    enabled: Boolean(checkIn && checkOut && checkOut > checkIn),
  });

  const handleHold = async (roomTypeId) => {
    setHoldError(null);
    setHoldingId(roomTypeId);

    try {
      // Auto-authenticate as demo guest if not signed in for instant evaluation
      if (!isAuthenticated) {
        await switchDemoRole('guest');
      }

      const res = await api.post('/bookings/hold', {
        roomTypeId,
        checkIn,
        checkOut,
        guests: Number(guests),
      });

      navigate(`/booking/${res.data._id}`);
    } catch (err) {
      setHoldError(err.message || 'Unable to hold room. Please try another selection.');
    } finally {
      setHoldingId(null);
    }
  };

  const results = availabilityData?.data || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Find & Book Your Stay
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600">
          Instant booking with atomic room hold concurrency protection and zero double-booking.
        </p>
      </div>

      {/* Search Filter Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-brand-600" />
              Check-In Date
            </label>
            <input
              type="date"
              value={checkIn}
              min={getTodayString()}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white text-slate-900 text-sm font-medium transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-brand-600" />
              Check-Out Date
            </label>
            <input
              type="date"
              value={checkOut}
              min={checkIn || getTodayString()}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white text-slate-900 text-sm font-medium transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-600" />
              Guests
            </label>
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white text-slate-900 text-sm font-medium transition"
            >
              <option value={1}>1 Guest</option>
              <option value={2}>2 Guests</option>
              <option value={3}>3 Guests</option>
              <option value={4}>4 Guests</option>
              <option value={6}>6 Guests (Villa/Suite)</option>
            </select>
          </div>
        </div>

        {checkOut <= checkIn && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Check-out date must be strictly after check-in date.
          </div>
        )}
      </div>

      {holdError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{holdError}</span>
        </div>
      )}

      {/* Results Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bed className="w-5 h-5 text-brand-600" />
            Available Room Types
          </h2>
          <span className="text-xs text-slate-500">
            {isLoading ? 'Checking inventory...' : `${results.length} room types found`}
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((n) => (
              <div key={n} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse h-64" />
            ))}
          </div>
        ) : isError ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center text-rose-800">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <p className="font-semibold">{error?.message || 'Failed to search availability'}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <Bed className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-800">No rooms available for selected dates</h3>
            <p className="text-sm text-slate-500 mt-1">Try selecting different dates or fewer guests.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {results.map((item) => {
              const { roomType, availableCount, isAvailable, pricing } = item;
              const isHoldingThis = holdingId === roomType.id;

              return (
                <div
                  key={roomType.id}
                  className={`bg-white rounded-2xl border transition shadow-sm overflow-hidden flex flex-col justify-between ${
                    isAvailable ? 'border-slate-200 hover:border-brand-400 hover:shadow-md' : 'border-slate-200 opacity-60'
                  }`}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{roomType.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Up to {roomType.capacity} Guests</p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          availableCount > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {availableCount > 0 ? `${availableCount} rooms left` : 'Sold Out'}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 mb-4">{roomType.description}</p>

                    {/* Amenities list */}
                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {roomType.amenities?.map((amenity, idx) => (
                        <span
                          key={idx}
                          className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium"
                        >
                          <Check className="w-3 h-3 text-brand-600" />
                          {amenity}
                        </span>
                      ))}
                    </div>

                    {/* Itemized Price Preview */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6 text-xs space-y-1.5">
                      <div className="flex justify-between text-slate-600">
                        <span>Nightly Base Rate:</span>
                        <span className="font-semibold text-slate-800">
                          ₹{(pricing.averageNightlyRate / 100).toLocaleString('en-IN')} / night
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal ({pricing.nightly.length} nights):</span>
                        <span className="font-semibold text-slate-800">
                          ₹{(pricing.subtotal / 100).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Taxes & Fees (12%):</span>
                        <span className="font-semibold text-slate-800">
                          ₹{(pricing.tax / 100).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-slate-900">
                        <span>Total Stay:</span>
                        <span className="text-brand-700">₹{(pricing.total / 100).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500">All taxes included</div>
                      <div className="text-lg font-bold text-slate-900">
                        ₹{(pricing.total / 100).toLocaleString('en-IN')}
                      </div>
                    </div>

                    <button
                      disabled={!isAvailable || isHoldingThis}
                      onClick={() => handleHold(roomType.id)}
                      className={`px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center gap-2 shadow-sm ${
                        isAvailable
                          ? 'bg-brand-600 hover:bg-brand-700 text-white cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isHoldingThis ? (
                        'Locking Room...'
                      ) : (
                        <>
                          Hold & Book
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
