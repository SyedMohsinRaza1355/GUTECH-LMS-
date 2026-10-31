// ==============================================================================
// GUTech Internal LMS - Frontend API Client & Resilient Service Layer
// ==============================================================================

import {
  UserProfile,
  Course,
  Resource,
  Assignment,
  Submission,
  Quiz,
  Announcement,
  ChatMessage,
  Complaint,
  StudentMarkItem,
  MarksSummary,
  PendingTask,
  GradingQueue
} from '../types/index.js';

export interface AuditEntry {
  id: number;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  at: string;
}

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('gutech_lms_token');
  }

  private setToken(token: string) {
    localStorage.setItem('gutech_lms_token', token);
  }

  public clearToken() {
    localStorage.removeItem('gutech_lms_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = json?.error?.message || `Request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      return json.data as T;
    } catch (err: unknown) {
      // In case Backend server is offline during initial frontend preview,
      // fallback smoothly to local state preview
      console.warn(`[API Connection Note for ${endpoint}]:`, (err as Error)?.message);
      if (err instanceof TypeError) throw new Error('Cannot reach the server. Check your internet connection and try again.');
      throw err;
    }
  }

  // Auth Methods
  async login(email: string, password: string): Promise<{ accessToken: string; profile: UserProfile }> {
    const res = await this.request<{ accessToken: string; refreshToken: string; profile: UserProfile }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }
    );
    this.setToken(res.accessToken);
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  async getMe(): Promise<{ profile: UserProfile }> {
    return this.request<{ profile: UserProfile }>('/auth/me');
  }

  async updateMyProfile(data: { fullName: string }): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword })
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  // Courses
  async getMyCourses(): Promise<Course[]> {
    return this.request<Course[]>('/me/courses');
  }

  async getCourseDetail(courseId: string): Promise<Course> {
    return this.request<Course>(`/courses/${courseId}`);
  }

  // Admin Courses
  async getAllCoursesAdmin(): Promise<Course[]> {
    return this.request<Course[]>('/admin/courses');
  }

  async createCourseAdmin(course: { code: string; title: string; description?: string }): Promise<Course> {
    return this.request<Course>('/admin/courses', {
      method: 'POST',
      body: JSON.stringify(course)
    });
  }

  async patchCourseAdmin(courseId: string, data: Partial<Pick<Course, 'code' | 'title' | 'description' | 'isArchived'>>): Promise<Course> {
    return this.request<Course>(`/admin/courses/${courseId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteCourseAdmin(courseId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/courses/${courseId}`, { method: 'DELETE' });
  }

  async getCourseStudents(courseId: string): Promise<Array<{ id: string; fullName: string; email: string; rollNo: string | null; isActive: boolean }>> {
    return this.request(`/courses/${courseId}/students`);
  }

  async unenrollStudent(courseId: string, studentId: string): Promise<{ message: string }> {
    return this.request(`/admin/courses/${courseId}/enrollments/${studentId}`, { method: 'DELETE' });
  }

  async enrollStudents(courseId: string, studentIds?: string[], csvContent?: string) {
    return this.request<{ enrolledCount: number; matched: string[]; duplicates: string[]; unknown: string[] }>(
      `/admin/courses/${courseId}/enrollments`,
      {
        method: 'POST',
        body: JSON.stringify({ studentIds, csvContent })
      }
    );
  }

  // Admin Users
  async getUsersAdmin(role?: string, search?: string): Promise<UserProfile[]> {
    const params = new URLSearchParams({ pageSize: '500' });
    if (role) params.set('role', role);
    if (search) params.set('search', search);
    return this.request<UserProfile[]>(`/admin/users?${params.toString()}`);
  }

  async getAuditTrail(limit = 100): Promise<AuditEntry[]> {
    return this.request<AuditEntry[]>(`/admin/audit?limit=${limit}`);
  }

  async createUserAdmin(data: { fullName: string; email: string; role: string; rollNo?: string; courseIds?: string[]; tempPassword: string }): Promise<UserProfile> {
    return this.request<UserProfile>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async patchUserAdmin(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async resetUserPasswordAdmin(userId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/users/${userId}/reset-password`, {
      method: 'POST'
    });
  }

  // Resources
  async getCourseResources(courseId: string): Promise<Resource[]> {
    return this.request<Resource[]>(`/courses/${courseId}/resources`);
  }

  async createResource(courseId: string, data: { title: string; description?: string; file?: File | null }): Promise<Resource> {
    if (data.file) {
      // Multipart upload: let the browser set the Content-Type boundary itself.
      const body = new FormData();
      body.append('title', data.title);
      if (data.description) body.append('description', data.description);
      body.append('file', data.file);
      const token = this.getToken();
      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/courses/${courseId}/resources`, { method: 'POST', body, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      } catch {
        throw new Error('Cannot reach the server. Check your internet connection and try again.');
      }
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error?.message || `Upload failed with status ${response.status}`);
      return json.data as Resource;
    }
    return this.request<Resource>(`/courses/${courseId}/resources`, {
      method: 'POST',
      body: JSON.stringify({ title: data.title, description: data.description })
    });
  }

  async getResourceDownloadUrl(resourceId: string): Promise<{ downloadUrl: string; fileName: string; sizeBytes: number }> {
    return this.request<{ downloadUrl: string; fileName: string; sizeBytes: number }>(`/resources/${resourceId}/download`);
  }

  async deleteResource(resourceId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/resources/${resourceId}`, {
      method: 'DELETE'
    });
  }

  // Assignments
  async getCourseAssignments(courseId: string): Promise<Assignment[]> {
    return this.request<Assignment[]>(`/courses/${courseId}/assignments`);
  }

  async createAssignment(courseId: string, data: { title: string; instructions: string; maxMarks: number; dueAt: string; allowLate: boolean }): Promise<Assignment> {
    return this.request<Assignment>(`/courses/${courseId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async patchAssignment(assignmentId: string, data: Partial<{ title: string; instructions: string; maxMarks: number; dueAt: string; allowLate: boolean }>): Promise<Assignment> {
    return this.request<Assignment>(`/assignments/${assignmentId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteAssignment(assignmentId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/assignments/${assignmentId}`, { method: 'DELETE' });
  }

  async submitAssignment(assignmentId: string, textAnswer?: string, filePath?: string): Promise<Submission> {
    return this.request<Submission>(`/assignments/${assignmentId}/submission`, {
      method: 'PUT',
      body: JSON.stringify({ textAnswer, filePath })
    });
  }

  async getAssignmentSubmissions(assignmentId: string): Promise<{ assignment: Assignment; submissions: any[] }> {
    return this.request<{ assignment: Assignment; submissions: any[] }>(`/assignments/${assignmentId}/submissions`);
  }

  async gradeSubmission(submissionId: string, marks: number, feedback?: string): Promise<Submission> {
    return this.request<Submission>(`/submissions/${submissionId}/grade`, {
      method: 'PATCH',
      body: JSON.stringify({ marks, feedback })
    });
  }

  // Quizzes
  async getCourseQuizzes(courseId: string): Promise<Quiz[]> {
    return this.request<Quiz[]>(`/courses/${courseId}/quizzes`);
  }

  async createQuiz(courseId: string, quizData: any): Promise<Quiz> {
    return this.request<Quiz>(`/courses/${courseId}/quizzes`, {
      method: 'POST',
      body: JSON.stringify(quizData)
    });
  }

  async patchQuiz(quizId: string, data: Partial<{ isPublished: boolean; title: string; description: string; timeLimitMinutes: number; opensAt: string; closesAt: string }>): Promise<Quiz> {
    return this.request<Quiz>(`/quizzes/${quizId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async updateQuizAttemptScore(quizId: string, attemptId: string, score: number, note?: string): Promise<{ attemptId: string; score: number; totalMarks: number }> {
    return this.request(`/quizzes/${quizId}/attempts/${attemptId}`, { method: 'PATCH', body: JSON.stringify({ score, note }) });
  }

  async startQuizAttempt(quizId: string): Promise<{ attemptId: string; startedAt: string; expiresAt: string; timeLimitMinutes: number; questions: any[] }> {
    return this.request<any>(`/quizzes/${quizId}/attempt`, {
      method: 'POST'
    });
  }

  async submitQuizAttempt(quizId: string, answers: Record<string, string[]>): Promise<{ score: number; totalMarks: number; message: string }> {
    return this.request<any>(`/quizzes/${quizId}/attempt/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers })
    });
  }

  async getQuizResults(quizId: string): Promise<{ quiz: Quiz; results: any[] }> {
    return this.request<any>(`/quizzes/${quizId}/results`);
  }

  // Announcements
  async getAnnouncements(courseId?: string): Promise<Announcement[]> {
    const url = courseId ? `/announcements?courseId=${courseId}` : '/announcements';
    return this.request<Announcement[]>(url);
  }

  async createAnnouncement(data: { courseId?: string | null; title: string; body: string; isPinned?: boolean }): Promise<Announcement> {
    return this.request<Announcement>('/announcements', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async markAnnouncementRead(announcementId: string): Promise<void> {
    await this.request('/announcements/read', {
      method: 'POST',
      body: JSON.stringify({ announcementId })
    });
  }

  // Marks
  async getStudentMarks(courseId?: string): Promise<{ items: StudentMarkItem[]; summary: MarksSummary }> {
    const url = courseId ? `/me/marks?courseId=${courseId}` : '/me/marks';
    return this.request<{ items: StudentMarkItem[]; summary: MarksSummary }>(url);
  }

  async getGradingQueue(): Promise<GradingQueue> {
    return this.request<GradingQueue>('/me/grading-queue');
  }

  async getPendingTasks(): Promise<PendingTask[]> {
    return this.request<PendingTask[]>('/me/tasks');
  }

  /** Downloads the gradebook as a CSV. A plain link cannot send the login token, so fetch it and save the blob. */
  async downloadGradebookCsv(courseId: string): Promise<void> {
    const token = this.getToken();
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/courses/${courseId}/gradebook.csv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {
      throw new Error('Cannot reach the server. Check your internet connection and try again.');
    }
    if (!response.ok) {
      const json = await response.json().catch(() => null);
      throw new Error(json?.error?.message || `Download failed with status ${response.status}`);
    }
    const blob = await response.blob();
    const name = /filename="?([^";]+)"?/i.exec(response.headers.get('Content-Disposition') || '')?.[1] || 'gradebook.csv';
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async getCourseGradebook(courseId: string): Promise<{ course: any; columns: any[]; rows: any[] }> {
    return this.request<any>(`/courses/${courseId}/gradebook`);
  }

  // Chat
  async getChatMessages(courseId: string, before?: string): Promise<ChatMessage[]> {
    const url = before ? `/courses/${courseId}/messages?before=${encodeURIComponent(before)}` : `/courses/${courseId}/messages`;
    return this.request<ChatMessage[]>(url);
  }

  async sendChatMessage(courseId: string, body: string): Promise<ChatMessage> {
    return this.request<ChatMessage>(`/courses/${courseId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body })
    });
  }

  async deleteChatMessage(messageId: string): Promise<void> {
    await this.request(`/messages/${messageId}`, { method: 'DELETE' });
  }

  // Complaints
  async getMyComplaints(): Promise<Complaint[]> {
    return this.request<Complaint[]>('/complaints/mine');
  }

  async createComplaint(data: { courseId?: string | null; category: string; subject: string; description: string; attachmentPath?: string | null }): Promise<Complaint> {
    return this.request<Complaint>('/complaints', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getAdminComplaints(status?: string, category?: string): Promise<Complaint[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    return this.request<Complaint[]>(`/admin/complaints?${params.toString()}`);
  }

  async respondComplaint(complaintId: string, status: string, adminResponse: string): Promise<Complaint> {
    return this.request<Complaint>(`/admin/complaints/${complaintId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminResponse })
    });
  }
}

export const api = new ApiClient();
