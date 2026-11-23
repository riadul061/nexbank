export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export type AccountType = 'SAVINGS' | 'CURRENT' | 'BUSINESS';
export type AccountStatus = 'ACTIVE' | 'FROZEN';
export type TxType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'LOAN_DISBURSEMENT' | 'LOAN_REPAYMENT';
export type TxStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
export type RequestType = 'DEPOSIT' | 'WITHDRAWAL';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LoanType = 'PERSONAL' | 'HOME' | 'EDUCATION' | 'AUTO' | 'BUSINESS';
export type EmploymentStatus = 'EMPLOYED' | 'SELF_EMPLOYED' | 'BUSINESS_OWNER' | 'STUDENT' | 'RETIRED' | 'UNEMPLOYED';
export type LoanStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'COMPLETED';

export interface SessionUser { id: string; name: string; email: string; role: Role }

export interface AccountDTO {
  id: string; accountNumber: string; type: AccountType; status: AccountStatus; balance: number;
  dailyLimit: number; singleLimit: number; nickname: string | null; createdAt: string;
  ownerId: string; ownerName?: string; ownerEmail?: string;
}

export interface TxParty { id: string; accountNumber: string; ownerName: string }
export interface TransactionDTO {
  id: string; reference: string; type: TxType; status: TxStatus; amount: number; fee: number;
  description: string | null; createdAt: string; completedAt: string | null;
  sender: TxParty | null; receiver: TxParty | null;
  flagged: boolean; flagReason: string | null; flagSource: string | null;
  direction?: 'IN' | 'OUT' | 'SELF';
}

export interface Paginated<T> { items: T[]; total: number; page: number; pageSize: number }

export interface CustomerDTO {
  id: string; name: string; email: string; role: Role; status: UserStatus; phone: string | null;
  address: string | null; nationalId: string | null; verified: boolean; createdAt: string;
  accountCount?: number; totalBalance?: number;
}
export interface CustomerDetailDTO extends CustomerDTO { accounts: AccountDTO[]; recentTransactions: TransactionDTO[]; loanCount: number }

export interface FundRequestDTO {
  id: string; type: RequestType; status: RequestStatus; amount: number; description: string | null;
  createdAt: string; reviewedAt: string | null; reviewNote: string | null;
  account: { id: string; accountNumber: string; type: AccountType };
  requestedBy: { id: string; name: string }; transactionRef: string | null;
}

export interface InstallmentDTO { id: string; number: number; dueDate: string; amount: number; status: 'DUE' | 'PAID'; paidAt: string | null }
export interface LoanNoteDTO { id: string; authorName: string; body: string; createdAt: string }
export interface LoanDTO {
  id: string; reference: string; loanType: LoanType; amount: number; durationMonths: number; interestRate: number;
  monthlyIncome: number; employmentStatus: EmploymentStatus; description: string | null; status: LoanStatus;
  monthlyPayment: number | null; totalPayable: number | null; remainingBalance: number | null;
  createdAt: string; decidedAt: string | null; decisionNote: string | null; forwardedAt: string | null;
  customer: { id: string; name: string; email: string };
  account: { id: string; accountNumber: string };
  paidInstallments?: number;
}
export interface LoanDetailDTO extends LoanDTO {
  installments: InstallmentDTO[]; notes: LoanNoteDTO[];
  repayments: TransactionDTO[]; customerSummary?: { verified: boolean; accounts: number; totalBalance: number; status: UserStatus };
}

export interface NotificationDTO { id: string; title: string; body: string; kind: string; link: string | null; read: boolean; createdAt: string }

export interface BankSettings {
  dailyTransferLimit: number; maxSingleTransaction: number; minAccountBalance: number;
  transferFeePercent: number; suspiciousAmount: number;
}

export interface ChartPoint { label: string; [k: string]: string | number }
export interface AdminDashboardDTO {
  role: 'ADMIN' | 'STAFF';
  totals: {
    customers: number; accounts: number; balance: number; deposits: number; withdrawals: number;
    transactions: number; pendingLoans: number; pendingRequests: number; flagged: number; pendingTx: number;
  };
  monthlyVolume: ChartPoint[]; depositVsWithdrawal: ChartPoint[]; accountDistribution: ChartPoint[];
  loanStats: ChartPoint[]; monthlyActivity: ChartPoint[];
}
export interface CustomerDashboardDTO {
  totals: { balance: number; deposits: number; withdrawals: number; activeLoans: number; loanRemaining: number };
  accounts: AccountDTO[]; recent: TransactionDTO[];
  monthlySpending: ChartPoint[]; monthlyDeposits: ChartPoint[]; distribution: ChartPoint[];
  activeLoans: LoanDTO[];
}

export interface ApiErrorBody { error: string; code?: string; details?: unknown }
