export type CarGrade =
  | 'small_sedan'
  | 'mid_sedan'
  | 'large_sedan'
  | 'xlarge_sedan'
  | 'small_suv'
  | 'mid_suv'
  | 'large_suv'
  | 'xlarge_suv'

export type MonthlyCount = 'monthly_1' | 'monthly_2' | 'monthly_4' | 'onetime'

export type VehicleStatus = 'active' | 'paused' | 'irregular' | 'unregistered'

export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface Customer {
  id: string
  name: string
  phone: string | null
  apartment: string
  unit_number: string | null
  memo: string | null
  created_at: string
  vehicles?: Vehicle[]
}

export interface Vehicle {
  id: string
  customer_id: string
  car_name: string
  plate_number: string
  car_grade: CarGrade
  monthly_count: MonthlyCount
  repeat_mode: string | null
  monthly_price: number | null
  unit_price: number | null
  custom_price: number | null
  start_date: string
  end_date: string | null
  status: VehicleStatus
  interior_count: number | null
  is_legacy: boolean | null
  created_at: string
  customer?: Customer
}

export interface Schedule {
  id: string
  vehicle_id: string
  scheduled_date: string
  schedule_type: 'regular' | 'onetime'
  is_overcount: boolean
  is_deleted: boolean
  has_interior: boolean
  admin_memo: string | null
  sort_order: number | null
  created_at: string
  vehicle?: Vehicle
}

export interface WashRecord {
  id: string
  vehicle_id: string
  schedule_id: string | null
  wash_date: string
  price: number
  service_type: 'regular' | 'onetime' | 'interior' | 'interior_only'
  is_completed: boolean
  completed_at: string | null
  memo: string | null
  admin_note: string | null
  completed_by: 'worker' | 'admin' | null
  worker_id: string | null
  worked_by: 'worker' | 'admin'
  created_at: string
  vehicle?: Vehicle
  worker?: Worker
  photos?: WashPhoto[]
}

export interface WashPhoto {
  id: string
  wash_record_id: string
  storage_path: string
  photo_type: 'before' | 'after'
  created_at: string
}

// staff 페이지용 — wash_photos 테이블 (vehicle_id + photo_url 단순 구조)
export interface StaffPhoto {
  id: string
  vehicle_id: string
  photo_url: string
  wash_date: string
  created_at: string
}

export type PaymentMethod = 'cash' | 'card' | 'cash_receipt' | null

export interface Billing {
  id: string
  vehicle_id: string
  year_month: string
  wash_count: number
  total_amount: number
  paid_amount: number
  payment_status: PaymentStatus
  memo: string | null
  sent_at: string | null
  paid_at: string | null
  payment_method: PaymentMethod
  message_sent_at: string | null
  created_at: string
  vehicle?: Vehicle
  items?: BillingItem[]
}

export interface BillingItem {
  id: string
  billing_id: string
  item_name: string
  unit_price: number
  quantity: number
  amount: number
  created_at: string
}

export interface Worker {
  id: string
  name: string
  phone: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export interface WorkerPayroll {
  id: string
  worker_id: string
  year_month: string
  total_washes: number
  outdoor_wash_count?: number  // 실외세차 건수
  indoor_wash_count?: number   // 실내청소 건수
  total_amount: number
  bonus_amount: number
  paid_amount: number
  paid_at: string | null
  memo: string | null
  created_at: string
  worker?: Worker
}

export type MessageFilter = 'all' | 'sent' | 'unsent'

export interface MessageTemplate {
  id: string
  template_key: string
  message_body: string
  created_at: string
  updated_at: string
}
