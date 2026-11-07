import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Bed,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function MyBookingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('Change of plans');
  const [cancelError, setCancelError] = useState(null);

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => api.get('/bookings/mine'),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ bookingId, reason }) =>
      api.post(`/bookings/${bookingId}/cancel`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      setCancellingBooking(null);
    },
    onError: (err) => {
      setCancelError(err.message || 'Failed to cancel reservation');
    },
  });

  const bookings = bookingsData?.data || [];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-1 rounded-full font-bold">CONFIRMED</span>;
      case 'CHECKED_IN':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-1 rounded-full font-bold">CHECKED IN</span>;
      case 'CHECKED_OUT':
        return <span className="bg-slate-100 text-slate-700 border border-slate-300 text-xs px-2.5 py-1 rounded-full font-bold">CHECKED OUT</span>;
      case 'CANCELLED':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2.5 py-1 rounded-full font-bold">CANCELLED</span>;
      case 'HELD':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-1 rounded-full font-bold">HELD</span>;
      case 'EXPIRED':
        return <span className="bg-gray-100 text-gray-500 border border-gray-300 text-xs px-2.5 py-1 rounded-full font-bold">EXPIRED</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-full font-bold">{status}</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">My Stay History</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track your past and upcoming reservations.</p>
        </div>
        <Link
          to="/"
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
        >
          Book Another Room
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse h-32" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <Bed className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No bookings on record</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">You haven't made any reservations yet.</p>
          <Link to="/" className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-medium">
            Search Available Rooms
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((bkg) => {
            const canCancel = ['HELD', 'CONFIRMED'].includes(bkg.status);

            return (
              <div
                key={bkg._id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-brand-700">{bkg.reference}</span>
                    {getStatusBadge(bkg.status)}
                  </div>

                  <h3 className="font-bold text-slate-900 text-base">{bkg.roomTypeId?.name || 'Standard Room'}</h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {bkg.checkIn} → {bkg.checkOut} ({bkg.nights} nights)
                    </span>
                    <span>•</span>
                    <span>{bkg.guests} Guests</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-900">
                      ₹{((bkg.price?.total || 0) / 100).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {bkg.status === 'HELD' && (
                    <Link
                      to={`/booking/${bkg._id}`}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl transition"
                    >
                      Complete Payment
                    </Link>
                  )}

                  {canCancel && (
                    <button
                      onClick={() => setCancellingBooking(bkg)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-semibold rounded-xl transition"
                    >
                      Cancel Stay
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Modal Dialog */}
      {cancellingBooking && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <div className="p-2 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Cancel Reservation</h3>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Are you sure you wish to cancel reservation{' '}
              <strong className="text-slate-900 font-mono">{cancellingBooking.reference}</strong>?
            </p>

            {/* Refund Policy Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 space-y-1 mb-4">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-600" />
                Hotel Cancellation Policy
              </div>
              <p>
                Cancellations more than 24 hours prior to check-in receive a 100% full refund. Within 24 hours of arrival, the first night base rate is retained.
              </p>
            </div>

            {cancelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs mb-4">
                {cancelError}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason for cancellation
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCancellingBooking(null)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Keep Booking
              </button>
              <button
                disabled={cancelMutation.isPending}
                onClick={() =>
                  cancelMutation.mutate({
                    bookingId: cancellingBooking._id,
                    reason: cancelReason,
                  })
                }
                className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow-sm"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
