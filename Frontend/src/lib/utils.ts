// ==============================================================================
// GUTech Internal LMS - Frontend Utility Functions
// ==============================================================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'MMM dd, yyyy · hh:mm a');
  } catch {
    return dateString;
  }
}

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function isDeadlinePassed(dueAtString: string): boolean {
  try {
    return isPast(new Date(dueAtString));
  } catch {
    return false;
  }
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toUpperCase() || 'FILE';
}

export function calculateGradeLetter(percentage: number): { letter: string; color: string } {
  if (percentage >= 90) return { letter: 'A', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  if (percentage >= 80) return { letter: 'B', color: 'text-blue-600 bg-blue-50 border-blue-200' };
  if (percentage >= 70) return { letter: 'C', color: 'text-amber-600 bg-amber-50 border-amber-200' };
  if (percentage >= 60) return { letter: 'D', color: 'text-orange-600 bg-orange-50 border-orange-200' };
  return { letter: 'F', color: 'text-rose-600 bg-rose-50 border-rose-200' };
}
