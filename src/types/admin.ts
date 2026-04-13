// src/types/admin.ts
// All TypeScript interfaces for the admin panel.
// No 'any'. Separate from dashboard.ts — admin shape differs (unmasked fields).

export type AdminRole       = 'REVIEWER' | 'SUPER_ADMIN';
export type SellerStatus    = 'PENDING' | 'VERIFIED' | 'DEACTIVATED';
export type KycStatus       = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type AdminAction     = 'VERIFY' | 'REJECT' | 'SUSPEND';
export type AuditActionType = 'VERIFY_SELLER' | 'REJECT_SELLER' | 'SUSPEND_SELLER' | 'CREATE_ADMIN';

export interface AdminUser {
  id:          string;
  name:        string;
  role:        AdminRole;
}

export interface AdminSellerListItem {
  userId:           string;
  storeName:        string;
  city:             string;
  state:            string;
  profileStatus:    SellerStatus;
  kycStatus:        KycStatus;
  sellerRating:     number;
  reliabilityScore: number;
  createdAt:        string;
  user: { name: string; phone: string };
}

export interface AdminSellerDetail extends AdminSellerListItem {
  street:             string;
  line2:              string | null;
  landmark:           string | null;
  pinCode:            string;
  businessType:       string;
  gstNumber:          string | null;
  panNumber:          string | null;
  accountHolderName:  string | null;
  accountNumber:      string | null;  // UNMASKED — admin only
  ifscCode:           string | null;
  bankName:           string | null;
  bankVerified:       boolean;
  storeImages:        { url: string; publicId: string }[];
  user: { name: string; phone: string; createdAt: string };
}

export interface AuditLogEntry {
  id:         string;
  action:     AuditActionType;
  targetType: string;
  targetId:   string;
  note:       string | null;
  metadata:   Record<string, unknown> | null;
  createdAt:  string;
  admin: { name: string; email: string };
}

export interface PaginatedSellers {
  sellers: AdminSellerListItem[];
  total:   number;
  page:    number;
  limit:   number;
  hasMore: boolean;
}
