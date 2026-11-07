import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Users, Search, Calendar, Phone, Mail, Clock, Bed, X } from 'lucide-react';

export default function GuestsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState(null);

  const { data: guestsData, isLoading } = useQuery({
    queryKey: ['staff-guests', searchTerm],
    queryFn: () => api.get(`/guests?search=${searchTerm}`),
  });

  const { data: guestDetailData, isLoading: detailLoading } = useQuery({
    queryKey: ['guest-detail', selectedGuestId],
    queryFn: () => api.get(`/guests/${selectedGuestId}`),
    enabled: !!selectedGuestId,
  });

  const guests = guestsData?.data || [];
  const guestDetail = guestDetailData?.data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Guest Directory</h1>
          <p className="text-sm text-slate-500 mt-1">Review guest profiles, contact records, and past booking history.</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by guest name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
        />
      </div>

      {/* Guests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-6 py-3.5">Name</th>
              <th className="px-6 py-3.5">Email</th>
              <th className="px-6 py-3.5">Phone</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">
                  Loading guest records...
                </td>
              </tr>
            ) : guests.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">
                  No guest accounts found matching "{searchTerm}".
                </td>
              </tr>
            ) : (
              guests.map((guest) => (
                <tr key={guest._id} className="hover:bg-slate-50/80 transition">
                  <td className="px-6 py-4 font-bold text-slate-900">{guest.name}</td>
                  <td className="px-6 py-4 text-slate-600 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {guest.email}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{guest.phone || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedGuestId(guest._id)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 font-semibold rounded-xl text-xs transition"
                    >
                      View Stay History
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Guest History Detail Modal */}
      {selectedGuestId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {detailLoading ? 'Loading profile...' : guestDetail?.guest?.name}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">{guestDetail?.guest?.email}</div>
              </div>
              <button
                onClick={() => setSelectedGuestId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Past & Upcoming Reservations
            </h4>

            {detailLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading stay records...</div>
            ) : guestDetail?.bookings?.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No reservations on record for this guest.</div>
            ) : (
              <div className="space-y-3">
                {guestDetail?.bookings?.map((b) => (
                  <div
                    key={b._id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex justify-between items-center"
                  >
                    <div>
                      <div className="font-mono font-bold text-brand-700">{b.reference}</div>
                      <div className="font-semibold text-slate-800 text-sm mt-0.5">{b.roomTypeId?.name}</div>
                      <div className="text-slate-500 mt-1 flex items-center gap-2">
                        <span>
                          {b.checkIn} → {b.checkOut}
                        </span>
                        <span>•</span>
                        <span>₹{((b.price?.total || 0) / 100).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        b.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.status === 'CHECKED_IN'
                          ? 'bg-blue-100 text-blue-800'
                          : b.status === 'CHECKED_OUT'
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
