import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import {
  BarChart3,
  TrendingUp,
  Percent,
  Bed,
  ShieldAlert,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
} from 'lucide-react';

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function getNextMonthString() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'roomTypes' | 'rooms' | 'audit'
  const [fromDate, setFromDate] = useState(getTodayString());
  const [toDate, setToDate] = useState(getNextMonthString());

  // Form states for creating room type
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeRate, setNewTypeRate] = useState(5000);
  const [newTypeCap, setNewTypeCap] = useState(2);
  const [newTypeDesc, setNewTypeDesc] = useState('');

  // Fetch Summary Report
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['admin-summary', fromDate, toDate],
    queryFn: () => api.get(`/reports/summary?from=${fromDate}&to=${toDate}`),
  });

  // Fetch Room Types
  const { data: roomTypesData } = useQuery({
    queryKey: ['admin-room-types'],
    queryFn: () => api.get('/room-types'),
  });

  // Fetch Rooms
  const { data: roomsData } = useQuery({
    queryKey: ['admin-rooms'],
    queryFn: () => api.get('/rooms'),
  });

  // Fetch Audit Logs
  const { data: auditData } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => api.get('/audit-logs?limit=30'),
  });

  // Create Room Type Mutation
  const createRoomTypeMutation = useMutation({
    mutationFn: (data) => api.post('/room-types', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-room-types'] });
      setNewTypeName('');
    },
  });

  const summary = summaryData?.data;
  const roomTypes = roomTypesData?.data || [];
  const rooms = roomsData?.data || [];
  const auditLogs = auditData?.data || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Admin Console & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Financial reconciliation, catalog management, and compliance audit trail.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-8 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'reports'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Financial & Occupancy Reports
        </button>

        <button
          onClick={() => setActiveTab('roomTypes')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'roomTypes'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bed className="w-4 h-4" />
          Room Types ({roomTypes.length})
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'rooms'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bed className="w-4 h-4" />
          Rooms Catalog ({rooms.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: Financial & Occupancy Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-8">
          {/* Date Range Picker */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-4 text-xs font-medium">
            <span className="text-slate-500 font-bold uppercase tracking-wider">Report Date Window:</span>
            <div className="flex items-center gap-2">
              <label>From:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
            <div className="flex items-center gap-2">
              <label>To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
              />
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Revenue</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">
                ₹{((summary?.revenue?.total || 0) / 100).toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {summary?.revenue?.qualifyingBookings || 0} active/confirmed bookings
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Occupancy Rate</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Percent className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-blue-700">
                {summary?.occupancy?.ratePercentage || 0}%
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {summary?.occupancy?.occupiedRoomNights || 0} / {summary?.occupancy?.totalCapacity || 0} room-nights
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Inventory</span>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Bed className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {summary?.occupancy?.activeRooms || 0} Rooms
              </div>
              <div className="text-xs text-slate-400 mt-1">Excludes out-of-service rooms</div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirmed Stays</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {summary?.countsByStatus?.CONFIRMED || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {summary?.countsByStatus?.CHECKED_IN || 0} in-house guests
              </div>
            </div>
          </div>

          {/* Status Breakdown Pills */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Booking Status Volume Breakdown
            </h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(summary?.countsByStatus || {}).map(([st, cnt]) => (
                <div key={st} className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-2">
                  <span className="font-bold text-slate-800">{st}:</span>
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded shadow-sm text-brand-700">
                    {cnt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Room Types Management */}
      {activeTab === 'roomTypes' && (
        <div className="space-y-6">
          {/* Add Room Type Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Create New Room Type
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Royal Suite"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Base Rate (₹)</label>
                <input
                  type="number"
                  value={newTypeRate}
                  onChange={(e) => setNewTypeRate(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Capacity</label>
                <input
                  type="number"
                  value={newTypeCap}
                  onChange={(e) => setNewTypeCap(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 border rounded-xl"
                />
              </div>
              <div className="flex items-end">
                <button
                  disabled={!newTypeName || createRoomTypeMutation.isPending}
                  onClick={() =>
                    createRoomTypeMutation.mutate({
                      name: newTypeName,
                      baseRate: newTypeRate * 100, // convert ₹ to paise
                      capacity: newTypeCap,
                      description: 'Luxury accommodation with premium furnishings',
                    })
                  }
                  className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Room Type
                </button>
              </div>
            </div>
          </div>

          {/* Room Types Listing */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 font-bold uppercase text-slate-700 border-b">
                <tr>
                  <th className="px-6 py-3.5">Name</th>
                  <th className="px-6 py-3.5">Capacity</th>
                  <th className="px-6 py-3.5">Base Rate</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roomTypes.map((rt) => (
                  <tr key={rt._id}>
                    <td className="px-6 py-4 font-bold text-slate-900">{rt.name}</td>
                    <td className="px-6 py-4">{rt.capacity} Guests</td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      ₹{(rt.baseRate / 100).toLocaleString('en-IN')} / night
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold text-[10px]">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Rooms Catalog */}
      {activeTab === 'rooms' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 font-bold uppercase text-slate-700 border-b">
              <tr>
                <th className="px-6 py-3.5">Room Number</th>
                <th className="px-6 py-3.5">Floor</th>
                <th className="px-6 py-3.5">Room Type</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map((r) => (
                <tr key={r._id}>
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">{r.roomNumber}</td>
                  <td className="px-6 py-4">Floor {r.floor}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{r.roomTypeId?.name}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                        r.status === 'available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'maintenance'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 font-bold uppercase text-slate-700 border-b">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Actor Role</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-brand-700 text-[11px] bg-brand-50 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800">{log.entityType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                      {JSON.stringify(log.after || log.details || {})}
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
