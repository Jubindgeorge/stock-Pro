export type Role = 'admin' | 'power' | 'manager' | 'store' | 'production' | 'viewer' | 'operator';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: Role;
  permissionLevel?: string;
  createdAt: string;
}

export interface RMProduct {
  id: string;
  code: string;
  name: string;
  category: string;
  threshold: number;
  barcode: string;
  groups: string[];
  exclusive: boolean;
  qtyPerFG: number;
}

export interface FGProduct {
  id: string;
  productcode: string;
  barcode: string;
  name: string;
  volume: string;
  group: string;
  batch: string;
  expiry: string;
  threshold: number;
}

export interface Movement {
  id: string;
  productId?: string; // for RM
  fgId?: string;      // for FG
  type: 'IN' | 'OUT';
  quantity: number;
  qty?: number;       // alias for quantity in some contexts
  date: string;
  remark: string;
  billId?: string;
  productionId?: string;
  createdAt: string;
  createdBy: string;
  batch?: string;
  expiry?: string;
}

export interface Bill {
  id: string;
  billNo: string;
  date: string;
  supplierId: string;
  supplierName: string;
  items: {
    productId: string;
    qty: number;
    remark: string;
  }[];
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Production {
  id: string;
  prodNo?: string;
  date: string;
  fgId: string;
  fgName?: string;
  fgQty?: number;
  quantity?: number;
  batch?: string;
  expiry?: string;
  remark?: string;
  rmLines?: {
    rmId: string;
    req: number;
    dmg: number;
    used: number;
  }[];
  createdAt: string;
  createdBy: string;
}

export interface DeliveryNote {
  id: string;
  dnNo: string;
  date: string;
  from: string;
  to: string;
  productionPlan: string;
  prodRef: string;
  generalRemark: string;
  items: {
    productId: string;
    qty: number;
    remark: string;
  }[];
  createdAt: string;
  createdBy: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface AuditLog {
  id: string;
  at?: string;
  timestamp?: string;
  by?: string;
  username?: string;
  action: string;
  entityId?: string;
  targetId?: string;
  details: any;
}
