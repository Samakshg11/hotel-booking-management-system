import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import {
  BedDouble,
  Calendar,
  LogIn,
  LogOut,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  Users,
  Clock,
  Sparkles,
  Wrench,
} from 'lucide-react';

export default function StaffDashboardPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('board'); // 'board' | 'bookings' | 'arrivals'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionError, setActionError] = useState(null);

  // Fetch Rooms for the Room Status Board
  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['staff-rooms'],
    queryFn: () => api.get('/rooms'),
  });

  // Fetch Bookings
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['staff-bookings', searchTerm, statusFilter],
    queryFn: () =>
      api.get(`/bookings?reference=${searchTerm}&status=${statusFilter}&limit=30`),
  });

  // Fetch Today's Arrivals
  const { data: arrivalsData } = useQuery({
    queryKey: ['staff-arrivals'],
    queryFn: () => api.get('/reports/arrivals'),
  });

  // Fetch Today's Departures
  const { data: departuresData } = useQuery({
    queryKey: ['staff-departures'],
    queryFn: () => api.get('/reports/departures'),
  });

  // Check In Mutation
  const checkInMutation = useMutation({
    mutationFn: (bookingId) => api.post(`/bookings/${bookingId}/check-in`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['staff-arrivals'] });
      queryClient.invalidateQueries({ queryKey: ['staff-rooms'] });
    },
    onError: (err) => setActionError(err.message || 'Check-in failed'),
  });

  // Check Out Mutation
  const checkOutMutation = useMutation({
    mutationFn: (bookingId) => api.post(`/bookings/${bookingId}/check-out`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['staff-departures'] });
      queryClient.invalidateQueries({ queryKey: ['staff-rooms'] });
    },
    onError: (err) => setActionError(err.message || 'Check-out failed'),
  });

  // Room Status Change Mutation
  const updateRoomStatusMutation = useMutation({
    mutationFn: ({ roomId, status }) => api.patch(`/rooms/${roomId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-rooms'] });
    },
    onError: (err) => setActionError(err.message || 'Failed to update room status'),
  });

  const rooms = roomsData?.data || [];
  const bookings = bookingsData?.data || [];
  const arrivals = arrivalsData?.data || [];
  const departures = departuresData?.data || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header & Summary Badges */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Front Desk & Operations</h1>
          <p className="text-sm text-slate-500 mt-1">Manage guest arrivals, departures, and physical room statuses.</p>
        </div>

        {/* Quick Operational Metrics */}
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl flex items-center gap-2.5">
            <LogIn className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-xs text-emerald-800 font-medium">Today's Arrivals</div>
              <div className="text-lg font-black text-emerald-950 leading-none mt-0.5">{arrivals.length}</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-2xl flex items-center gap-2.5">
            <LogOut className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-xs text-blue-800 font-medium">Today's Departures</div>
              <div className="text-lg font-black text-blue-950 leading-none mt-0.5">{departures.length}</div>
            </div>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-600 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('board')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'board'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BedDouble className="w-4 h-4" />
          Room Status Board ({rooms.length})
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'bookings'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          All Bookings ({bookings.length})
        </button>
      </div>

      {/* TAB 1: Room Status Board */}
      {activeTab === 'board' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Live Housekeeping Grid
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> Available
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3 h-3 rounded-full bg-amber-500" /> Maintenance
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-3 h-3 rounded-full bg-rose-500" /> Out of Service
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {rooms.map((room) => {
              const statusColor =
                room.status === 'available'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : room.status === 'maintenance'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800';

              return (
                <div
                  key={room._id}
                  className={`border rounded-2xl p-4 shadow-sm transition flex flex-col justify-between ${statusColor}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xl font-black">{room.roomNumber}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-white/60">
                        Fl. {room.floor}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-700 truncate">
                      {room.roomTypeId?.name || 'Standard'}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60">
                    <div className="text-[11px] font-bold uppercase tracking-wider mb-2">
                      {room.status.replace('_', ' ')}
                    </div>
                    <div className="flex gap-1">
                      {room.status !== 'available' && (
                        <button
                          onClick={() => updateRoomStatusMutation.mutate({ roomId: room._id, status: 'available' })}
                          className="flex-1 bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 text-[10px] font-bold py-1 px-1.5 rounded-lg border border-emerald-300 transition"
                        >
                          Mark Ready
                        </button>
                      )}
                      {room.status === 'available' && (
                        <button
                          onClick={() => updateRoomStatusMutation.mutate({ roomId: room._id, status: 'maintenance' })}
                          className="flex-1 bg-white hover:bg-amber-600 hover:text-white text-amber-700 text-[10px] font-bold py-1 px-1.5 rounded-lg border border-amber-300 transition"
                        >
                          Maintenance
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Bookings Table with Check-in / Check-out actions */}
      {activeTab === 'bookings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table Filters */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by reference or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium"
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="CHECKED_IN">CHECKED IN</option>
              <option value="CHECKED_OUT">CHECKED OUT</option>
              <option value="HELD">HELD</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5 font-mono font-bold text-brand-700">{b.reference}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{b.guestDetails?.fullName || 'Guest'}</div>
                      <div className="text-[11px] text-slate-400">{b.guestDetails?.email}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-900">{b.roomId?.roomNumber || 'Assigned'}</span>
                      <span className="text-[11px] text-slate-400 block">{b.roomTypeId?.name}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {b.checkIn} → {b.checkOut} ({b.nights}n)
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          b.status === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'CHECKED_IN'
                            ? 'bg-blue-100 text-blue-800'
                            : b.status === 'CHECKED_OUT'
                            ? 'bg-slate-200 text-slate-800'
                            : b.status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      {b.status === 'CONFIRMED' && (
                        <button
                          onClick={() => checkInMutation.mutate(b._id)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition"
                        >
                          Check In
                        </button>
                      )}
                      {b.status === 'CHECKED_IN' && (
                        <button
                          onClick={() => checkOutMutation.mutate(b._id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] transition"
                        >
                          Check Out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

