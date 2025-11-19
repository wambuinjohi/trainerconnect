import { apiRequest, withAuth } from '@/lib/api'

export type PlatformSettings = {
  // Finance
  commissionRate: number
  taxRate: number
  payoutSchedule: 'weekly' | 'biweekly' | 'monthly'
  currency: 'USD' | 'KES' | 'EUR' | 'GBP'
  // Referral (existing)
  referralClientDiscount: number
  referralClientBookings: number
  referralTrainerDiscount: number
  referralTrainerBookings: number
  enableReferralProgram: boolean
  useReferrerPhoneAsCode: boolean
  // Referral/Affiliate (new)
  referralReferrerPercent: number
  referralReferredPercent: number
  promptReferralOnFirstBooking: boolean
  applyReferralDiscountImmediately: boolean
  // Platform charges (new)
  platformChargeTrainerPercent: number
  platformChargeClientPercent: number
  compensationFeePercent: number
  maintenanceFeePercent: number
  // Platform
  platformName: string
  supportEmail: string
  timezone: 'Africa/Nairobi' | 'UTC' | 'America/New_York' | 'Europe/London'
  emailNotifications: boolean
  maintenanceMode: boolean
  // Theme
  theme?: 'light' | 'dark' | 'system'
  // Booking policies
  cancellationHours: number
  rescheduleHours: number
  maxDailySessionsPerTrainer: number
}

const KEY = 'platform_settings_v1'

export const defaultSettings: PlatformSettings = {
  // Finance
  commissionRate: 15,
  taxRate: 0,
  payoutSchedule: 'monthly',
  currency: 'KES',
  // Referral (existing)
  referralClientDiscount: 10,
  referralClientBookings: 5,
  referralTrainerDiscount: 10,
  referralTrainerBookings: 3,
  enableReferralProgram: true,
  useReferrerPhoneAsCode: false,
  // Referral/Affiliate (new)
  referralReferrerPercent: 15,
  referralReferredPercent: 15,
  promptReferralOnFirstBooking: true,
  applyReferralDiscountImmediately: true,
  // Platform charges (new)
  platformChargeTrainerPercent: 10,
  platformChargeClientPercent: 15,
  compensationFeePercent: 10,
  maintenanceFeePercent: 15,
  // Platform
  platformName: 'Skatryk Trainer',
  supportEmail: 'support@skatryk.com',
  timezone: 'Africa/Nairobi',
  emailNotifications: true,
  maintenanceMode: false,
  theme: 'system',
  // Booking policies
  cancellationHours: 24,
  rescheduleHours: 24,
  maxDailySessionsPerTrainer: 8,
}

export function loadSettings(): PlatformSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaultSettings }
    const parsed = JSON.parse(raw)
    return { ...defaultSettings, ...parsed }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(s: PlatformSettings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

// Attempt to load settings from PHP API
export async function loadSettingsFromDb(): Promise<PlatformSettings | null> {
  try {
    const data = await apiRequest('settings_get', {}, { headers: withAuth() })
    if (!data?.settings) return null
    const merged = { ...defaultSettings, ...(data.settings as any) }
    return merged
  } catch {
    return null
  }
}

export async function saveSettingsToDb(s: PlatformSettings): Promise<boolean> {
  try {
    const payload = { settings: s }
    await apiRequest('settings_save', payload, { headers: withAuth() })
    return true
  } catch {
    return false
  }
}
