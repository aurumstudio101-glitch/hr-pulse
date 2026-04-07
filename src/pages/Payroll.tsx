import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Download, Search, Filter, 
  ArrowUpRight, ArrowDownRight, DollarSign,
  CheckCircle2, Clock, FileText, Plus
} from 'lucide-react';
import { PayrollRecord, UserProfile } from '../types';
import * as supabaseService from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import { cn, formatDate } from '../lib/utils';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function exportPayslipsToPDF(payrolls: PayrollRecord[], monthIdx: number, year: number) {
  if (payrolls.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const monthName = months[monthIdx] ?? 'Unknown';
  const generatedAt = new Date().toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(24, 24, 27); // zinc-900
  doc.rect(0, 0, 297, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('HR PULSE', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(161, 161, 170); // zinc-400
  doc.text(`Monthly Payroll Report  ·  ${monthName} ${year}`, 60, 14);

  doc.setTextColor(161, 161, 170);
  doc.text(`Generated: ${generatedAt}`, 297 - 14, 14, { align: 'right' });

  // ── Summary row ─────────────────────────────────────────────────────────────
  const totalNet    = payrolls.reduce((s, p) => s + (p.netSalary  || 0), 0);
  const totalA      = payrolls.reduce((s, p) => s + (p.salaryA    || 0), 0);
  const totalB      = payrolls.reduce((s, p) => s + (p.salaryB    || 0), 0);
  const totalEPF    = payrolls.reduce((s, p) => s + (p.epf        || 0), 0);
  const paidCount   = payrolls.filter(p => p.status === 'Paid').length;
  const pendingCount= payrolls.filter(p => p.status === 'Pending').length;

  doc.setFillColor(244, 244, 245); // zinc-100
  doc.rect(0, 22, 297, 18, 'F');

  const summaryItems = [
    { label: 'Total Employees', value: String(payrolls.length) },
    { label: 'Total Net Payout',  value: `LKR ${totalNet.toLocaleString()}` },
    { label: 'Total Salary A',    value: `LKR ${totalA.toLocaleString()}` },
    { label: 'Total Salary B',    value: `LKR ${totalB.toLocaleString()}` },
    { label: 'Total EPF',         value: `LKR ${totalEPF.toLocaleString()}` },
    { label: 'Paid',              value: String(paidCount) },
    { label: 'Pending',           value: String(pendingCount) },
  ];

  const colW = 297 / summaryItems.length;
  summaryItems.forEach((item, i) => {
    const x = i * colW + colW / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122); // zinc-500
    doc.text(item.label.toUpperCase(), x, 28, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(24, 24, 27);
    doc.text(item.value, x, 36, { align: 'center' });
  });

  // ── Table ──────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 44,
    head: [[
      'Employee', 'Branch', 'Month',
      'Salary A', 'Salary B', 'EPF', 'Advances', 'Cover',
      'Intensive', 'Travelling', 'Net Salary', 'Status'
    ]],
    body: payrolls.map(p => [
      p.userName || 'Unknown',
      p.branch   || 'General',
      `${months[p.month] ?? '?'} ${p.year}`,
      (p.salaryA    || 0).toLocaleString(),
      (p.salaryB    || 0).toLocaleString(),
      (p.epf        || 0).toLocaleString(),
      (p.advances   || 0).toLocaleString(),
      (p.cover      || 0).toLocaleString(),
      (p.intensive  || 0).toLocaleString(),
      (p.travelling || 0).toLocaleString(),
      `LKR ${(p.netSalary || 0).toLocaleString()}`,
      p.status,
    ]),
    foot: [[
      'TOTAL', '', '',
      totalA.toLocaleString(),
      totalB.toLocaleString(),
      totalEPF.toLocaleString(),
      payrolls.reduce((s,p) => s+(p.advances||0),0).toLocaleString(),
      payrolls.reduce((s,p) => s+(p.cover||0),0).toLocaleString(),
      payrolls.reduce((s,p) => s+(p.intensive||0),0).toLocaleString(),
      payrolls.reduce((s,p) => s+(p.travelling||0),0).toLocaleString(),
      `LKR ${totalNet.toLocaleString()}`,
      `${paidCount} Paid / ${pendingCount} Pending`,
    ]],
    styles: {
      fontSize: 8,
      cellPadding: 3,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [24, 24, 27],      // zinc-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
    },
    footStyles: {
      fillColor: [39, 39, 42],      // zinc-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],   // zinc-50
    },
    columnStyles: {
      0:  { fontStyle: 'bold', cellWidth: 38 },
      1:  { cellWidth: 22 },
      2:  { cellWidth: 22 },
      3:  { halign: 'right', cellWidth: 20 },
      4:  { halign: 'right', cellWidth: 20 },
      5:  { halign: 'right', cellWidth: 18, textColor: [220, 38, 38]  },
      6:  { halign: 'right', cellWidth: 18, textColor: [220, 38, 38]  },
      7:  { halign: 'right', cellWidth: 18, textColor: [220, 38, 38]  },
      8:  { halign: 'right', cellWidth: 22, textColor: [22, 163, 74]  },
      9:  { halign: 'right', cellWidth: 22, textColor: [22, 163, 74]  },
      10: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      11: { halign: 'center', cellWidth: 20 },
    },
    // colour the status cell
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 11) {
        const val = String(data.cell.raw);
        if (val === 'Paid') {
          data.cell.styles.textColor    = [22, 163, 74];  // green-600
          data.cell.styles.fontStyle    = 'bold';
        } else {
          data.cell.styles.textColor    = [217, 119, 6];  // amber-600
          data.cell.styles.fontStyle    = 'bold';
        }
      }
    },
    margin: { left: 10, right: 10 },
  });

  // ── Footer line ──────────────────────────────────────────────────────────────
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(228, 228, 231);
  doc.line(10, pageHeight - 10, 287, pageHeight - 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(161, 161, 170);
  doc.text('HR PULSE  ·  Confidential Payroll Document', 10, pageHeight - 5);
  doc.text(`Page 1`, 287, pageHeight - 5, { align: 'right' });

  doc.save(`Payroll_${monthName}_${year}.pdf`);
}

export default function Payroll() {
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [isExporting, setIsExporting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user?.uid, user?.role]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const isManagement = user.role === 'hr' || user.role === 'owner' || user.role === 'super';
      const data = await supabaseService.getPayroll(isManagement ? undefined : user.uid);
      setPayrolls(data || []);
    } catch (err) {
      console.error('Error loading payrolls:', err);
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayrolls = payrolls.filter(p => {
    const matchesSearch = (p.userName || '').toLowerCase().includes(search.toLowerCase());
    const matchesMonth = p.month === Number(filterMonth) + 1; // months are 1-12 in DB
    return matchesSearch && matchesMonth;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalPayout = filteredPayrolls.reduce((acc, p) => acc + p.netSalary, 0);

  const handleExport = () => {
    if (filteredPayrolls.length === 0) return;
    setIsExporting(true);
    // Small timeout lets the spinner render before the PDF blocks the thread
    setTimeout(() => {
      try {
        exportPayslipsToPDF(filteredPayrolls, Number(filterMonth), new Date().getFullYear());
      } finally {
        setIsExporting(false);
      }
    }, 50);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900">Payroll</h1>
          <p className="text-zinc-500 font-medium">View and manage salary distributions</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting || filteredPayrolls.length === 0}
            className={cn(
              "bg-white border border-zinc-200 text-zinc-600 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all",
              filteredPayrolls.length === 0
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-zinc-50 hover:border-zinc-300 active:scale-95"
            )}
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download size={18} />
                Export Payslips
              </>
            )}
          </button>
          {(user?.role === 'hr' || user?.role === 'super') && (
            <button 
              onClick={async () => {
                await supabaseService.generatePayroll(new Date().getMonth() + 1, new Date().getFullYear());
                toast.success('Current month payroll generated');
                loadData();
              }}
              className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-100"
            >
              <Plus size={18} />
              Generate Monthly Payroll
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <DollarSign size={18} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total Payout</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">LKR {totalPayout.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle2 size={18} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Paid Records</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{filteredPayrolls.filter(p => p.status === 'Paid').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
              <Clock size={18} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Pending</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{filteredPayrolls.filter(p => p.status === 'Pending').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by employee name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
          />
        </div>
        <select 
          value={filterMonth}
          onChange={(e) => setFilterMonth(Number(e.target.value))}
          className="px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold text-zinc-600 outline-none focus:ring-2 focus:ring-orange-500"
        >
          {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-4xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Employee</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Month</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Salary A</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Salary B</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">EPF</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Advances</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Cover</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Intensive</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Travelling</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Net Salary</th>
                <th className="px-8 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredPayrolls.map((p) => (
                <tr key={p.id || `p-${Math.random()}`} className="hover:bg-zinc-50/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 font-black text-xs">
                        {p.userName?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900">{p.userName || 'Unknown'}</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{p.branch || 'General'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-zinc-700">{months[p.month] || 'Unknown'} {p.year}</span>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-zinc-900 text-right">
                    {(p.salaryA || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-zinc-900 text-right">
                    {(p.salaryB || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-red-600 text-right">
                    {(p.epf || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-red-600 text-right">
                    {(p.advances || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-red-600 text-right">
                    {(p.cover || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-green-600 text-right">
                    {(p.intensive || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-green-600 text-right">
                    {(p.travelling || 0).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className="text-base font-black text-zinc-900">LKR {(p.netSalary || 0).toLocaleString()}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                      p.status === 'Paid' ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-700 border-amber-100"
                    )}>
                      {p.status}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredPayrolls.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-8 py-16 text-center text-zinc-400 font-medium">
                    No payroll records found for the selected month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
