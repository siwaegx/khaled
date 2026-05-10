
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.TenantMetaScalarFieldEnum = {
  key: 'key',
  value: 'value',
  updatedAt: 'updatedAt'
};

exports.Prisma.ActivityLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  action: 'action',
  entity: 'entity',
  entityId: 'entityId',
  meta: 'meta',
  createdAt: 'createdAt'
};

exports.Prisma.CrmCompanyScalarFieldEnum = {
  id: 'id',
  name: 'name',
  industry: 'industry',
  website: 'website',
  phone: 'phone',
  email: 'email',
  address: 'address',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CrmContactScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  name: 'name',
  position: 'position',
  email: 'email',
  phone: 'phone',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CrmCompanyLogScalarFieldEnum = {
  id: 'id',
  companyId: 'companyId',
  type: 'type',
  subject: 'subject',
  body: 'body',
  loggedAt: 'loggedAt',
  createdAt: 'createdAt'
};

exports.Prisma.LeadScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  phone: 'phone',
  company: 'company',
  status: 'status',
  source: 'source',
  notes: 'notes',
  assignedTo: 'assignedTo',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CustomerScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  phone: 'phone',
  company: 'company',
  address: 'address',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DealScalarFieldEnum = {
  id: 'id',
  title: 'title',
  value: 'value',
  currency: 'currency',
  status: 'status',
  customerId: 'customerId',
  assignedTo: 'assignedTo',
  closeDate: 'closeDate',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductScalarFieldEnum = {
  id: 'id',
  name: 'name',
  sku: 'sku',
  description: 'description',
  category: 'category',
  unitPrice: 'unitPrice',
  costPrice: 'costPrice',
  unit: 'unit',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WarehouseScalarFieldEnum = {
  id: 'id',
  name: 'name',
  location: 'location',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StockLevelScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  warehouseId: 'warehouseId',
  quantity: 'quantity',
  minQuantity: 'minQuantity',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PurchaseOrderScalarFieldEnum = {
  id: 'id',
  supplierName: 'supplierName',
  status: 'status',
  totalAmount: 'totalAmount',
  notes: 'notes',
  orderDate: 'orderDate',
  expectedDate: 'expectedDate',
  receivedDate: 'receivedDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PurchaseOrderItemScalarFieldEnum = {
  id: 'id',
  purchaseOrderId: 'purchaseOrderId',
  productId: 'productId',
  productName: 'productName',
  quantity: 'quantity',
  unitCost: 'unitCost',
  totalCost: 'totalCost',
  createdAt: 'createdAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  id: 'id',
  number: 'number',
  customerName: 'customerName',
  customerId: 'customerId',
  status: 'status',
  subtotal: 'subtotal',
  tax: 'tax',
  total: 'total',
  notes: 'notes',
  issueDate: 'issueDate',
  dueDate: 'dueDate',
  paidDate: 'paidDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InvoiceItemScalarFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  description: 'description',
  quantity: 'quantity',
  unitPrice: 'unitPrice',
  amount: 'amount',
  createdAt: 'createdAt'
};

exports.Prisma.ExpenseScalarFieldEnum = {
  id: 'id',
  category: 'category',
  description: 'description',
  amount: 'amount',
  currency: 'currency',
  date: 'date',
  reference: 'reference',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmployeeScalarFieldEnum = {
  id: 'id',
  name: 'name',
  email: 'email',
  phone: 'phone',
  position: 'position',
  department: 'department',
  salary: 'salary',
  status: 'status',
  hireDate: 'hireDate',
  terminationDate: 'terminationDate',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LeaveRequestScalarFieldEnum = {
  id: 'id',
  employeeId: 'employeeId',
  type: 'type',
  status: 'status',
  startDate: 'startDate',
  endDate: 'endDate',
  days: 'days',
  reason: 'reason',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProjectScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  status: 'status',
  startDate: 'startDate',
  endDate: 'endDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TaskScalarFieldEnum = {
  id: 'id',
  projectId: 'projectId',
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  assignedTo: 'assignedTo',
  dueDate: 'dueDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CalendarEventScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  startAt: 'startAt',
  endAt: 'endAt',
  allDay: 'allDay',
  type: 'type',
  entityType: 'entityType',
  entityId: 'entityId',
  color: 'color',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DocumentScalarFieldEnum = {
  id: 'id',
  entityType: 'entityType',
  entityId: 'entityId',
  name: 'name',
  originalName: 'originalName',
  mimeType: 'mimeType',
  size: 'size',
  storagePath: 'storagePath',
  uploadedBy: 'uploadedBy',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.CrmLogType = exports.$Enums.CrmLogType = {
  call: 'call',
  visit: 'visit',
  email: 'email',
  note: 'note',
  other: 'other'
};

exports.LeadStatus = exports.$Enums.LeadStatus = {
  new: 'new',
  contacted: 'contacted',
  qualified: 'qualified',
  converted: 'converted',
  lost: 'lost'
};

exports.DealStatus = exports.$Enums.DealStatus = {
  prospect: 'prospect',
  qualified: 'qualified',
  proposal: 'proposal',
  negotiation: 'negotiation',
  won: 'won',
  lost: 'lost'
};

exports.ProductStatus = exports.$Enums.ProductStatus = {
  active: 'active',
  inactive: 'inactive',
  discontinued: 'discontinued'
};

exports.PurchaseOrderStatus = exports.$Enums.PurchaseOrderStatus = {
  draft: 'draft',
  ordered: 'ordered',
  partial: 'partial',
  received: 'received',
  cancelled: 'cancelled'
};

exports.InvoiceStatus = exports.$Enums.InvoiceStatus = {
  draft: 'draft',
  sent: 'sent',
  paid: 'paid',
  overdue: 'overdue',
  cancelled: 'cancelled'
};

exports.EmployeeStatus = exports.$Enums.EmployeeStatus = {
  active: 'active',
  inactive: 'inactive',
  terminated: 'terminated'
};

exports.LeaveType = exports.$Enums.LeaveType = {
  annual: 'annual',
  sick: 'sick',
  unpaid: 'unpaid',
  maternity: 'maternity',
  paternity: 'paternity',
  other: 'other'
};

exports.LeaveStatus = exports.$Enums.LeaveStatus = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled'
};

exports.ProjectStatus = exports.$Enums.ProjectStatus = {
  planning: 'planning',
  active: 'active',
  on_hold: 'on_hold',
  completed: 'completed',
  cancelled: 'cancelled'
};

exports.TaskStatus = exports.$Enums.TaskStatus = {
  todo: 'todo',
  in_progress: 'in_progress',
  review: 'review',
  done: 'done',
  cancelled: 'cancelled'
};

exports.TaskPriority = exports.$Enums.TaskPriority = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent'
};

exports.CalendarEventType = exports.$Enums.CalendarEventType = {
  meeting: 'meeting',
  deadline: 'deadline',
  reminder: 'reminder',
  task: 'task',
  other: 'other'
};

exports.Prisma.ModelName = {
  TenantMeta: 'TenantMeta',
  ActivityLog: 'ActivityLog',
  CrmCompany: 'CrmCompany',
  CrmContact: 'CrmContact',
  CrmCompanyLog: 'CrmCompanyLog',
  Lead: 'Lead',
  Customer: 'Customer',
  Deal: 'Deal',
  Product: 'Product',
  Warehouse: 'Warehouse',
  StockLevel: 'StockLevel',
  PurchaseOrder: 'PurchaseOrder',
  PurchaseOrderItem: 'PurchaseOrderItem',
  Invoice: 'Invoice',
  InvoiceItem: 'InvoiceItem',
  Expense: 'Expense',
  Employee: 'Employee',
  LeaveRequest: 'LeaveRequest',
  Project: 'Project',
  Task: 'Task',
  CalendarEvent: 'CalendarEvent',
  Document: 'Document'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
