export type UserRole = 'student' | 'admin' | 'department_head';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  department_id: number | null;
  trust_score: number;
  created_at: string;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  created_at: string;
}

export type ComplaintStatus = 'submitted' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'rejected';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Attachment {
  id: number;
  complaint_id: string;
  file_url: string;
  file_type: string;
  ai_verification_status: 'pending' | 'verified' | 'rejected' | 'skipped';
  ai_verification_explanation: string | null;
  created_at: string;
}

export interface Comment {
  id: number;
  complaint_id: string;
  content: string;
  is_internal: boolean;
  is_ai_generated: boolean;
  created_at: string;
  user: User | null;
}

export interface Complaint {
  id: string;
  title: string;
  description: string;
  student_id: number;
  category: string;
  status: ComplaintStatus;
  urgency: UrgencyLevel;
  department_id: number | null;
  location: string;
  is_duplicate: boolean;
  duplicate_of_id: string | null;
  created_at: string;
  updated_at: string;
  
  student?: User;
  department?: Department | null;
  attachments?: Attachment[];
  comments?: Comment[];
}

export interface DepartmentStats {
  department_name: string;
  count: number;
}

export interface UrgencyStats {
  urgency: string;
  count: number;
}

export interface CategoryStats {
  category: string;
  count: number;
}

export interface IssueClusterStats {
  category: string;
  count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  top_locations: string[];
}

export interface AdminDashboardStats {
  total_complaints: number;
  active_complaints: number;
  resolved_complaints: number;
  resolution_rate: number;
  duplicate_count: number;
  fake_count: number;
  department_distribution: DepartmentStats[];
  urgency_distribution: UrgencyStats[];
  category_distribution: CategoryStats[];
  grouped_issue_clusters?: IssueClusterStats[];
}

