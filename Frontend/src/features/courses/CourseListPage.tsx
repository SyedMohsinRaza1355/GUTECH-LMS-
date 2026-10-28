// ==============================================================================
// GUTech Internal LMS - Course List Page
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Search,
  Plus,
  Users,
  GraduationCap,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Button, Card, Input, Modal, Badge, EmptyState } from '../../components/ui/index.js';
import { LoadError } from '../../components/ui/index.js';
import { errorMessage } from '../../components/ui/Toast.js';
import { Course } from '../../types/index.js';
import { api } from '../../lib/api.js';

export const CourseListPage: React.FC = () => {
  const { role } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Admin New Course Modal
  const [searchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1' && role === 'admin');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCourses = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = role === 'admin' ? await api.getAllCoursesAdmin() : await api.getMyCourses();
      setCourses(data);
    } catch (err) {
      setLoadError(errorMessage(err, 'Your courses could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [role]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      const created = await api.createCourseAdmin({ code, title, description });
      setCourses([created, ...courses]);
      setModalOpen(false);
      setCode('');
      setTitle('');
      setDescription('');
    } catch (err: unknown) {
      setModalError((err as Error)?.message || 'Failed to create course');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    if (!window.confirm(`Delete ${course.code} — ${course.title}? Enrollments, resources, assignments, quizzes, and messages for this course will also be removed.`)) return;
    setActionError(null);
    try {
      await api.deleteCourseAdmin(course.id);
      setCourses(current => current.filter(item => item.id !== course.id));
    } catch (err) {
      setActionError((err as Error)?.message || 'Could not delete this course.');
    }
  };

  const filtered = courses.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  if (loadError) {
    return <LoadError title="Courses could not be loaded" message={loadError} onRetry={() => void fetchCourses()} />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950 tracking-tight">
            {role === 'teacher' ? 'Teaching Classes' : role === 'admin' ? 'University Course Catalog' : 'My Enrolled Courses'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Access curriculum modules, lectures, assignments, and discussions
          </p>
        </div>

        <div className="flex items-center gap-3">
          {role === 'admin' && (
            <Button
              variant="gold"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setModalOpen(true)}
            >
              Add New Course
            </Button>
          )}
        </div>
      </div>

      {/* Search Input Bar */}
      {actionError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{actionError}</div>}
      <div className="relative max-w-md">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter courses by code or name..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs placeholder:text-slate-400 focus:outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100 shadow-sm"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
      </div>

      {/* Course Cards Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title="No courses matched your query"
          description="Check your spelling or reset the search filter to display all classes."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(course => (
            <Card
              key={course.id}
              className="flex flex-col justify-between hover:border-navy-400 hover:shadow-premium-lg transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-extrabold px-3 py-1 rounded-xl bg-navy-900 text-gold-400 shadow-sm">
                    {course.code}
                  </span>
                  <Badge variant="navy">Fall 2026</Badge>
                </div>

                <h3 className="text-base font-bold text-navy-950 group-hover:text-navy-700 transition-colors">
                  {course.title}
                </h3>
                <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                  {course.description || 'Full-term academic module with interactive labs, assignments, and exams.'}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{course.studentsCount || 4} Students</span>
                </div>

                <div className="flex items-center gap-2">
                  <Link to={`/courses/${course.id}`}>
                    <Button size="sm" variant="primary" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      Enter Class
                    </Button>
                  </Link>
                  {role === 'admin' && <Button size="sm" variant="secondary" onClick={() => handleDeleteCourse(course)} aria-label={`Delete ${course.code}`}>Delete</Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Admin Create Course Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create New University Course"
        subtitle="Provision an academic course code and syllabus for GUTech faculty"
      >
        {modalError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateCourse} className="space-y-4">
          <Input
            label="Course Code (e.g. CS101, WEB302)"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="CS101"
            required
          />
          <Input
            label="Course Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Introduction to Software Engineering"
            required
          />
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
              Course Description & Objectives
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Outline topics, prerequisites, and learning outcomes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-100 min-h-[90px]"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="gold"
              className="w-full font-bold"
              isLoading={modalLoading}
            >
              Provision Course
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
