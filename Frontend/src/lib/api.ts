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
  MarksSummary
} from '../types/index.js';

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

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
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
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (search) params.set('search', search);
    return this.request<UserProfile[]>(`/admin/users?${params.toString()}`);
  }

  async createUserAdmin(data: { fullName: string; email: string; role: string; rollNo?: string; tempPassword: string }): Promise<UserProfile> {
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

  async createResource(courseId: string, data: { title: string; description?: string; fileName?: string; mimeType?: string; sizeBytes?: number }): Promise<Resource> {
    return this.request<Resource>(`/courses/${courseId}/resources`, {
      method: 'POST',
      body: JSON.stringify(data)
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
